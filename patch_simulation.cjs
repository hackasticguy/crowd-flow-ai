const fs = require('fs');
let code = fs.readFileSync('simulation-engine.ts', 'utf8');

// 1. Modify findShortestPathWithCost to penalize emergency exits when not in emergency mode
const oldFindShortestPath = `const isEmergency = targetNode?.data?.type === 'emergency';
        const emergencyMultiplier = isEmergency ? 0.7 : 1.0;`;

const newFindShortestPath = `const isEmergency = targetNode?.data?.type === 'emergency';
        let emergencyMultiplier = 1.0;
        if (isEmergency) {
            if (this.eventSchedule === "Emergency Evacuation") {
                emergencyMultiplier = 0.5; // Highly prioritize
            } else {
                emergencyMultiplier = 1000.0; // Heavy penalty outside emergency
            }
        }`;
code = code.replace(oldFindShortestPath, newFindShortestPath);

// 2. Modify spawnAgentsTick to evaluate all valid exits and not force just emergency or food court
const oldSpawn = `    let exits = this.nodes.filter(n => n.data?.type === "exit" || n.data?.type === "emergency");
    if (this.eventSchedule === "Emergency Evacuation") {
       const emergencyExits = exits.filter(n => n.data?.type === "emergency");
       if (emergencyExits.length > 0) exits = emergencyExits; // Prioritize emergency exits
    } else if (this.eventSchedule === "Food Court Rush") {
       const foodCourts = this.nodes.filter(n => n.data?.type === "food_court" || n.data?.label?.toLowerCase().includes("food"));
       if (foodCourts.length > 0 && Math.random() > 0.5) {
          exits = foodCourts; // temporarily route half to food courts as intermediate/final destinations
       }
    }
    if (exits.length === 0) return;`;

const newSpawn = `    let exits = this.nodes.filter(n => n.data?.type === "exit" || n.data?.type === "emergency");
    if (this.eventSchedule === "Food Court Rush") {
       const foodCourts = this.nodes.filter(n => n.data?.type === "food_court" || n.data?.label?.toLowerCase().includes("food"));
       if (foodCourts.length > 0 && Math.random() > 0.5) {
          // Half of agents temporarily target food court in this mode
          exits = foodCourts;
       }
    } else if (this.eventSchedule === "Half-time") {
       const foodCourts = this.nodes.filter(n => n.data?.type === "food_court" || n.data?.label?.toLowerCase().includes("food"));
       if (foodCourts.length > 0 && Math.random() > 0.3) {
          exits = foodCourts;
       }
    }
    if (exits.length === 0) return;`;
code = code.replace(oldSpawn, newSpawn);

// 3. Fix the rerouting logic in tick() where it picks exits[0] blindly
const oldReroute1 = `         const exits = this.nodes.filter(n => n.data?.type === "exit" || n.data?.type === "emergency");
         if (exits.length > 0) {
             const { path } = this.findShortestPathWithCost(agent.currentNodeId, exits[0].id);
             agent.currentRoute = path;
         }`;

const newReroute1 = `         const exits = this.nodes.filter(n => n.data?.type === "exit" || n.data?.type === "emergency");
         if (exits.length > 0) {
             let bestPath = [];
             let bestCost = Infinity;
             let bestExit = null;
             for (const ex of exits) {
                 const { path, cost } = this.findShortestPathWithCost(agent.currentNodeId, ex.id);
                 if (path.length > 0 && cost < bestCost) {
                     bestCost = cost;
                     bestPath = path;
                     bestExit = ex;
                 }
             }
             if (bestPath.length > 0) {
                 agent.currentRoute = bestPath;
                 agent.destinationNodeId = bestExit.id;
             }
         }`;

code = code.replace(oldReroute1, newReroute1);

const oldReroute2 = `             const exits = this.nodes.filter(n => n.data?.type === "exit" || n.data?.type === "emergency");
             if (exits.length > 0) {
                 const { path } = this.findShortestPathWithCost(agent.currentNodeId, exits[0].id);
                 if (path.length > 0 && path[1] !== nextNodeId) {
                     agent.currentRoute = path;
                     agent.currentEdgeId = undefined; // reset edge progress
                     agent.edgeProgress = 0;
                     continue;
                 }
             }`;
             
const newReroute2 = `             const exits = this.nodes.filter(n => n.data?.type === "exit" || n.data?.type === "emergency");
             if (exits.length > 0) {
                 let bestPath = [];
                 let bestCost = Infinity;
                 let bestExit = null;
                 for (const ex of exits) {
                     const { path, cost } = this.findShortestPathWithCost(agent.currentNodeId, ex.id);
                     if (path.length > 0 && cost < bestCost) {
                         bestCost = cost;
                         bestPath = path;
                         bestExit = ex;
                     }
                 }
                 if (bestPath.length > 0 && bestPath[1] !== nextNodeId) {
                     agent.currentRoute = bestPath;
                     agent.destinationNodeId = bestExit.id;
                     agent.currentEdgeId = undefined;
                     agent.edgeProgress = 0;
                     continue;
                 }
             }`;
code = code.replace(oldReroute2, newReroute2);

fs.writeFileSync('simulation-engine.ts', code);
console.log("Patched simulation-engine.ts");

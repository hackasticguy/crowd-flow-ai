const fs = require('fs');
let code = fs.readFileSync('simulation-engine.ts', 'utf8');

const debugReplaceFrom = `    let debugInfo = null;
    if (sampleAgent) {
       debugInfo = {
          id: sampleAgent.id,
          currentNode: this.nodeMap.get(sampleAgent.currentNodeId)?.data?.label || sampleAgent.currentNodeId,
          destination: this.nodeMap.get(sampleAgent.destinationNodeId)?.data?.label || sampleAgent.destinationNodeId,
          currentRoute: sampleAgent.currentRoute.map(nId => this.nodeMap.get(nId)?.data?.label || nId),
          currentEdge: sampleAgent.currentEdgeId,
          state: sampleAgent.state,
          speed: sampleAgent.speed.toFixed(2)
       };
    }`;

const debugReplaceTo = `    let debugInfo = null;
    if (sampleAgent) {
       const destNode = this.nodeMap.get(sampleAgent.destinationNodeId);
       let destType = destNode?.data?.type?.toUpperCase() || 'UNKNOWN';
       if (destType === 'EXIT') destType = 'NORMAL_EXIT';
       
       let reason = "Lowest safe route cost";
       if (destType === 'EMERGENCY_EXIT') {
          reason = this.eventSchedule === "Emergency Evacuation" ? "Emergency protocol active" : "Normal exits critically congested";
       }

       debugInfo = {
          id: sampleAgent.id,
          currentNode: this.nodeMap.get(sampleAgent.currentNodeId)?.data?.label || sampleAgent.currentNodeId,
          destination: destNode?.data?.label || sampleAgent.destinationNodeId,
          destinationType: destType,
          destinationReason: reason,
          currentRoute: sampleAgent.currentRoute.map(nId => this.nodeMap.get(nId)?.data?.label || nId),
          currentEdge: sampleAgent.currentEdgeId,
          state: sampleAgent.state,
          speed: sampleAgent.speed.toFixed(2)
       };
    }`;
code = code.replace(debugReplaceFrom, debugReplaceTo);

// Calculate destination distribution and exit utilization
const emitReplaceFrom = `      stats: {
         nodes: this.nodes.length,
         edges: this.edges.length,
         spawned: this.agentsSpawnedSoFar,
         walking: activeWalking,
         queued: activeQueued,
         rerouted: activeRerouted,
         exited: this.exitedAgentsCount,
         congestedEdges: this.bottlenecks.length,
         avgSpeed: agentsWithSpeed > 0 ? (totalSpeed / agentsWithSpeed) : 0,
         peakDensity: this.peakDensity,
         peakRisk: this.peakRiskScore
      },
      debugAgent: debugInfo`;

const emitReplaceTo = `      stats: {
         nodes: this.nodes.length,
         edges: this.edges.length,
         spawned: this.agentsSpawnedSoFar,
         walking: activeWalking,
         queued: activeQueued,
         rerouted: activeRerouted,
         exited: this.exitedAgentsCount,
         congestedEdges: this.bottlenecks.length,
         avgSpeed: agentsWithSpeed > 0 ? (totalSpeed / agentsWithSpeed) : 0,
         peakDensity: this.peakDensity,
         peakRisk: this.peakRiskScore
      },
      debugAgent: debugInfo,
      exitUtilization: (() => {
         const util = {};
         this.nodes.filter(n => n.data?.type === 'exit' || n.data?.type === 'emergency').forEach(n => {
            const count = this.nodeOccupancy.get(n.id) || 0;
            const cap = n.data?.capacity || 200;
            util[n.data?.label || n.id] = Math.round((count / cap) * 100);
         });
         return util;
      })(),
      destinationDistribution: (() => {
         const dist = {};
         this.agents.filter(a => a.state !== "EXITED").forEach(a => {
            const destLabel = this.nodeMap.get(a.destinationNodeId)?.data?.label || a.destinationNodeId;
            dist[destLabel] = (dist[destLabel] || 0) + 1;
         });
         return dist;
      })()`;

code = code.replace(emitReplaceFrom, emitReplaceTo);
fs.writeFileSync('simulation-engine.ts', code);
console.log("Patched simulation-engine.ts for debug and stats");

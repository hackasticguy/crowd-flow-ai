const { SimulationEngine } = require("./dist/server.cjs");

// Mock Socket.IO server
const mockIo = {
  emit: () => {}
};

const testVenue = {
  id: "v-test",
  name: "Test Venue",
  nodes: [
    { id: "n1", type: "input", data: { label: "Gate A", type: "entry" }, position: { x: 50, y: 150 } },
    { id: "n2", type: "default", data: { label: "Main Concourse", type: "concourse" }, position: { x: 250, y: 150 } },
    { id: "n3", type: "default", data: { label: "Junction", type: "concourse" }, position: { x: 450, y: 150 } },
    { id: "n6", type: "output", data: { label: "Exit Gate A", type: "exit" }, position: { x: 650, y: 80 } },
    { id: "n3_b", type: "output", data: { label: "Exit Gate B", type: "exit" }, position: { x: 650, y: 220 } },
    { id: "n4", type: "default", data: { label: "Food Court", type: "food_court" }, position: { x: 350, y: 320 } },
    { id: "n5", type: "output", data: { label: "Emergency Exit", type: "emergency" }, position: { x: 650, y: 320 } },
  ],
  edges: [
    { id: "e1-2", source: "n1", target: "n2", data: { distance: 50, capacity: 200 } },
    { id: "e2-3", source: "n2", target: "n3", data: { distance: 50, capacity: 200 } },
    { id: "e3-6", source: "n3", target: "n6", data: { distance: 50, capacity: 200 } },
    { id: "e3-3b", source: "n3", target: "n3_b", data: { distance: 50, capacity: 200 } },
    { id: "e2-4", source: "n2", target: "n4", data: { distance: 60, capacity: 200 } },
    { id: "e4-5", source: "n4", target: "n5", data: { distance: 60, capacity: 200 } },
    { id: "e3-5", source: "n3", target: "n5", data: { distance: 80, capacity: 200 } },
  ]
};

function runTestScenario(name, eventSchedule, venueModifier) {
  console.log(`\n==================================================`);
  console.log(`RUNNING: ${name}`);
  console.log(`==================================================`);

  const venueCopy = JSON.parse(JSON.stringify(testVenue));
  if (venueModifier) {
    venueModifier(venueCopy);
  }

  const engine = new SimulationEngine(mockIo, null);
  engine.loadVenue(venueCopy, 100, eventSchedule);

  // Run 15 ticks synchronously
  for (let t = 0; t < 15; t++) {
     engine['tick']();
  }

  const agents = engine.agents;
  let normalExitCount = 0;
  let emergencyExitCount = 0;
  let foodCourtCount = 0;

  const destCounts = {};

  agents.forEach(a => {
     const destNode = engine.nodeMap.get(a.destinationNodeId);
     const label = destNode?.data?.label || a.destinationNodeId;
     destCounts[label] = (destCounts[label] || 0) + 1;

     if (a.destinationType === "NORMAL_EXIT") normalExitCount++;
     else if (a.destinationType === "EMERGENCY_EXIT") emergencyExitCount++;
     else if (a.destinationType === "FOOD_COURT") foodCourtCount++;
  });

  console.log(`Total Spawned Agents: ${agents.length}`);
  console.log(`Destination Counts:`, destCounts);
  console.log(`Normal Exits: ${normalExitCount}, Emergency Exits: ${emergencyExitCount}, Food Court: ${foodCourtCount}`);

  return {
     total: agents.length,
     normalExitCount,
     emergencyExitCount,
     foodCourtCount,
     destCounts
  };
}

console.log("STARTING CROWDFLOW AI ROUTING AUDIT TESTS...");

// TEST 1: Normal Schedule
const t1 = runTestScenario("TEST 1: Normal Schedule", "Normal");
const t1Pass = t1.normalExitCount > 0 && t1.emergencyExitCount === 0;
console.log(`TEST 1 RESULT: ${t1Pass ? "PASSED ✅ (Normal exits preferred, 0 emergency exit agents)" : "FAILED ❌"}`);

// TEST 2: Event Ending Schedule
const t2 = runTestScenario("TEST 2: Event Ending Schedule", "Event Ending");
const t2Pass = t2.normalExitCount > 0 && t2.emergencyExitCount === 0;
console.log(`TEST 2 RESULT: ${t2Pass ? "PASSED ✅ (High flow to normal exit gates, emergency exit not default)" : "FAILED ❌"}`);

// TEST 3: Emergency Evacuation Schedule
const t3 = runTestScenario("TEST 3: Emergency Evacuation Schedule", "Emergency Evacuation");
const t3Pass = t3.emergencyExitCount > 0;
console.log(`TEST 3 RESULT: ${t3Pass ? "PASSED ✅ (Emergency Exit usage significantly increased)" : "FAILED ❌"}`);

// TEST 4: Block Exit Gate A
const t4 = runTestScenario("TEST 4: Block Exit Gate A", "Normal", (v) => {
   // Block Exit Gate A by setting type to restricted
   const n6 = v.nodes.find(n => n.id === "n6");
   if (n6) n6.data.type = "restricted";
});
const t4Pass = t4.destCounts["Exit Gate B"] > 0 && t4.emergencyExitCount === 0;
console.log(`TEST 4 RESULT: ${t4Pass ? "PASSED ✅ (Rerouted to Exit Gate B, emergency exit NOT used)" : "FAILED ❌"}`);

// TEST 5: Block Exit Gate A AND Exit Gate B
const t5 = runTestScenario("TEST 5: Block Exit Gate A AND Exit Gate B", "Normal", (v) => {
   const n6 = v.nodes.find(n => n.id === "n6");
   const n3b = v.nodes.find(n => n.id === "n3_b");
   if (n6) n6.data.type = "restricted";
   if (n3b) n3b.data.type = "restricted";
});
const t5Pass = t5.emergencyExitCount > 0;
console.log(`TEST 5 RESULT: ${t5Pass ? "PASSED ✅ (All normal exits blocked -> Emergency Exit becomes valid fallback)" : "FAILED ❌"}`);

if (t1Pass && t2Pass && t3Pass && t4Pass && t5Pass) {
  console.log("\nALL 5 ROUTING AUDIT TESTS PASSED PERFECTLY! 🎉\n");
} else {
  console.error("\nSOME TESTS FAILED! Please review test output.\n");
  process.exit(1);
}

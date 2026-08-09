import { SimulationEngine } from "./simulation-engine";

const mockIo: any = {
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

function runTestScenario(name: string, eventSchedule: string, venueModifier?: (v: any) => void) {
  console.log(`\n==================================================`);
  console.log(`RUNNING: ${name}`);
  console.log(`==================================================`);

  const venueCopy = JSON.parse(JSON.stringify(testVenue));
  if (venueModifier) {
    venueModifier(venueCopy);
  }

  const engine = new SimulationEngine(mockIo, null as any);
  engine.loadVenue(venueCopy, 100, eventSchedule);

  for (let t = 0; t < 15; t++) {
     (engine as any)['tick']();
  }

  const agents = engine.agents;
  let normalExitCount = 0;
  let emergencyExitCount = 0;
  let foodCourtCount = 0;
  let interiorCount = 0;

  const destCounts: Record<string, number> = {};
  const intentCounts: Record<string, number> = {};

  agents.forEach(a => {
     intentCounts[a.intent] = (intentCounts[a.intent] || 0) + 1;
     const destNode = engine.nodeMap.get(a.destinationNodeId);
     const label = destNode?.data?.label || a.destinationNodeId;
     destCounts[label] = (destCounts[label] || 0) + 1;

     if (a.destinationType === "NORMAL_EXIT") normalExitCount++;
     else if (a.destinationType === "EMERGENCY_EXIT") emergencyExitCount++;
     else if (a.destinationType === "FOOD_COURT") foodCourtCount++;
     else interiorCount++;
  });

  console.log(`Total Spawned Agents: ${agents.length}`);
  console.log(`Intent Breakdown:`, intentCounts);
  console.log(`Destination Breakdown:`, destCounts);
  console.log(`Normal Exits: ${normalExitCount}, Emergency Exits: ${emergencyExitCount}, Food Court: ${foodCourtCount}, Interior Concourse: ${interiorCount}`);

  return {
     total: agents.length,
     normalExitCount,
     emergencyExitCount,
     foodCourtCount,
     interiorCount,
     destCounts,
     intentCounts
  };
}

console.log("STARTING CROWDFLOW AI MULTI-SCENARIO ROUTING TESTS...");

// TEST A: NORMAL SCHEDULE
const testA = runTestScenario("TEST A — NORMAL SCHEDULE", "Normal");
const testAPass = testA.interiorCount > 0 && testA.normalExitCount < testA.total;
console.log(`TEST A RESULT: ${testAPass ? "PASSED ✅ (Realistic mix of interior area navigation & exits, no mass exit)" : "FAILED ❌"}`);

// TEST B: STADIUM ENTRY
const testB = runTestScenario("TEST B — STADIUM ENTRY", "Stadium Entry");
const testBPass = (testB.intentCounts["WALKING_TO_AREA"] || 0) + (testB.intentCounts["FOOD"] || 0) + (testB.intentCounts["WAITING"] || 0) > testB.total * 0.7;
console.log(`TEST B RESULT: ${testBPass ? "PASSED ✅ (Large majority entering venue interior, minimal immediate exits)" : "FAILED ❌"}`);

// TEST C: FOOD COURT RUSH
const testC = runTestScenario("TEST C — FOOD COURT RUSH", "Food Court Rush");
const testCPass = (testC.intentCounts["FOOD"] || 0) > testC.total * 0.5;
console.log(`TEST C RESULT: ${testCPass ? "PASSED ✅ (Strong food court demand & queueing)" : "FAILED ❌"}`);

// TEST D: EVENT ENDING
const testD = runTestScenario("TEST D — EVENT ENDING", "Event Ending");
const testDPass = (testD.intentCounts["EXITING"] || 0) > testD.total * 0.7;
console.log(`TEST D RESULT: ${testDPass ? "PASSED ✅ (High egress flow toward normal Exit Gates)" : "FAILED ❌"}`);

// TEST E: EMERGENCY EVACUATION
const testE = runTestScenario("TEST E — EMERGENCY EVACUATION", "Emergency Evacuation");
const testEPass = (testE.intentCounts["EVACUATING"] || 0) === testE.total && testE.emergencyExitCount > 0;
console.log(`TEST E RESULT: ${testEPass ? "PASSED ✅ (100% EVACUATING intent, emergency exit heavily utilized)" : "FAILED ❌"}`);

// TEST F: BLOCKED EXIT
const testF = runTestScenario("TEST F — BLOCKED EXIT GATE A", "Normal", (v) => {
   const n6 = v.nodes.find((n: any) => n.id === "n6");
   if (n6) n6.data.type = "restricted";
});
const testFPass = (testF.destCounts["Exit Gate B"] || 0) > 0 && (testF.destCounts["Exit Gate A"] || 0) === 0 && testF.emergencyExitCount === 0;
console.log(`TEST F RESULT: ${testFPass ? "PASSED ✅ (Blocked Exit Gate A cleanly rerouted to Exit Gate B without emergency exit overuse)" : "FAILED ❌"}`);

if (testAPass && testBPass && testCPass && testDPass && testEPass && testFPass) {
  console.log("\nALL 6 ROUTING AUDIT TESTS PASSED PERFECTLY! 🎉\n");
} else {
  console.error("\nSOME TESTS FAILED! Please review test output.\n");
  process.exit(1);
}

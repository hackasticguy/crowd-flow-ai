const fs = require('fs');
let simContent = fs.readFileSync('simulation-engine.ts', 'utf-8');

simContent = simContent.replace(
  'state: "WALKING" | "WAITING" | "QUEUING" | "EXITED";',
  'state: "WALKING" | "WAITING" | "QUEUING" | "EXITED" | "REROUTING";'
);
simContent = simContent.replace(
  'public nodeMap',
  'public nodeMap' // wait let's just make it public
);
// Actually nodeMap is private
simContent = simContent.replace(
  'private nodeMap',
  'public nodeMap'
);
fs.writeFileSync('simulation-engine.ts', simContent);

let serverContent = fs.readFileSync('server.ts', 'utf-8');
serverContent = serverContent.replace(
  'a.state !== "finished"',
  'a.state !== "EXITED"'
);
fs.writeFileSync('server.ts', serverContent);

let simUiContent = fs.readFileSync('src/pages/Simulation.tsx', 'utf-8');
// Fix division error
simUiContent = simUiContent.replace(
  '{(liveRiskScore / 100 * 180).toFixed(0)}',
  '{(Number(liveRiskScore) / 100 * 180).toFixed(0)}'
);
fs.writeFileSync('src/pages/Simulation.tsx', simUiContent);

console.log("Fixed typescript lint errors");

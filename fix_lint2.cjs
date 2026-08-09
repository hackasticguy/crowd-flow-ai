const fs = require('fs');
let simUiContent = fs.readFileSync('src/pages/Simulation.tsx', 'utf-8');
simUiContent = simUiContent.replace(
  'labelFormatter={(label) => `Time: ${(label / 1000).toFixed(1)}s`}',
  'labelFormatter={(label) => `Time: ${(Number(label) / 1000).toFixed(1)}s`}'
);
fs.writeFileSync('src/pages/Simulation.tsx', simUiContent);

let simContent = fs.readFileSync('simulation-engine.ts', 'utf-8');
simContent = simContent.replace(
  'agent.state === "REROUTING"',
  '(agent as any).state === "REROUTING"'
);
fs.writeFileSync('simulation-engine.ts', simContent);

console.log("Fixed typescript lint errors 2");

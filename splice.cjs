const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf8').split('\n');
const start = 89;
const end = 606;
const newLines = [
  ...lines.slice(0, start),
  '  const { createSimulationRoutes } = await import("./src/server/routes/simulations");',
  '  app.use("/api/simulate", requireAuth, createSimulationRoutes(simEngine));',
  ...lines.slice(end + 1)
];
fs.writeFileSync('server.ts', newLines.join('\n'));

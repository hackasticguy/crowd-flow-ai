const fs = require('fs');
let simContent = fs.readFileSync('simulation-engine.ts', 'utf-8');

simContent = simContent.replace(
  'public calibrationMultiplier = 1.0;',
  'public calibrationMultiplier = 1.0;\n  public datasetMetrics: any = null;\n  public hfDatasetInfo: string = "";'
);
fs.writeFileSync('simulation-engine.ts', simContent);
console.log("Fixed sim engine dataset metrics");

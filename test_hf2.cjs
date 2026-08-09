async function run() {
  const dsRes = await fetch("https://huggingface.co/api/datasets?search=CrowdHuman");
  const ds = await dsRes.json();
  for (let d of ds) {
    if (d.id === 'purplehaze1/CrowdHuman') continue;
    const valid = await fetch(`https://datasets-server.huggingface.co/is-valid?dataset=${encodeURIComponent(d.id)}`).then(r => r.json());
    if (valid.viewer) {
      console.log("Found dataset with viewer:", d.id);
      
      const rows = await fetch(`https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(d.id)}&config=default&split=train&offset=0&length=1`).then(r => r.json());
      console.log(JSON.stringify(rows, null, 2));
    }
  }
  console.log("Done");
}
run();

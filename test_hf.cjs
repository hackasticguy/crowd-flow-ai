async function run() {
  const dsRes = await fetch("https://huggingface.co/api/datasets?search=CrowdHuman");
  const ds = await dsRes.json();
  for (let d of ds) {
    const valid = await fetch(`https://datasets-server.huggingface.co/is-valid?dataset=${encodeURIComponent(d.id)}`).then(r => r.json());
    if (valid.viewer) {
      console.log("Found dataset with viewer:", d.id);
      return;
    }
  }
  console.log("None found");
}
run();

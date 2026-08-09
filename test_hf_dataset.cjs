async function run() {
  try {
    const res = await fetch("https://datasets-server.huggingface.co/rows?dataset=jamarks%2FCrowdHuman-train&config=default&split=train&offset=0&length=2");
    if(res.ok) {
      const data = await res.json();
      console.log("Success:", data.rows[0].row);
    } else {
      console.log("Status:", res.status);
    }
  } catch(e) {
    console.error(e);
  }
}
run();

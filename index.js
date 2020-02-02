const withPuppetter = require("./with-puppetter");
const withGot = require("./with-got");

(async function() {
  const how = process.argv[2] || "curl";

  switch (how) {
    case "browser":
      console.info(`Starting daemon in browser mode`);
      await withPuppetter();
      break;
    case "curl":
      console.info(`Starting daemon in curl mode`);
      await withGot();
      break;
    default:
      console.error(`This way: '${how}' doesnt exists`);
  }
})();

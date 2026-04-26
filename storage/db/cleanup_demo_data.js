const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const db = require("./db");

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

async function main() {
  try {
    await run(`DELETE FROM prediction_result`);
    await run(`DELETE FROM sleep_score_result`);
    await run(`DELETE FROM sensor_raw`);
    await run(`DELETE FROM post_analysis_result`);
    console.log("Cleaned demo data from prediction_result, sleep_score_result, sensor_raw, and post_analysis_result.");
  } catch (error) {
    console.error("Failed to clean demo data:", error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();

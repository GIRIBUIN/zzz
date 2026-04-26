const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const db = require("./db");
const DEMO_FITBIT_CREATED_AT = "demo-seed-fitbit";
const DEMO_SENSOR_CREATED_AT = "demo-seed-sensor";

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
    await run(`DELETE FROM sensor_raw WHERE created_at = ?`, [DEMO_SENSOR_CREATED_AT]);
    await run(`DELETE FROM post_analysis_result`);
    await run(`DELETE FROM fitbit_heart WHERE created_at = ?`, [DEMO_FITBIT_CREATED_AT]);
    await run(`DELETE FROM fitbit_steps WHERE created_at = ?`, [DEMO_FITBIT_CREATED_AT]);
    await run(`DELETE FROM fitbit_calories WHERE created_at = ?`, [DEMO_FITBIT_CREATED_AT]);
    console.log("Cleaned demo data from Fitbit demo rows, prediction_result, sleep_score_result, sensor_raw, and post_analysis_result.");
  } catch (error) {
    console.error("Failed to clean demo data:", error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();

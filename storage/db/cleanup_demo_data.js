const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const db = require("./db");
const DEMO_TAG = "demo-seed";

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function dateStr(dayOffset) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

async function main() {
  try {
    await run(`DELETE FROM fitbit_heart WHERE created_at = ?`, [DEMO_TAG]);
    await run(`DELETE FROM fitbit_steps WHERE created_at = ?`, [DEMO_TAG]);
    await run(`DELETE FROM fitbit_calories WHERE created_at = ?`, [DEMO_TAG]);
    await run(`DELETE FROM sensor_raw WHERE created_at = ?`, [DEMO_TAG]);
    await run(`DELETE FROM pattern_profile`);

    for (let offset = -6; offset <= 0; offset += 1) {
      const date = dateStr(offset);
      await run(`DELETE FROM prediction_result WHERE target_sleep_date = ?`, [date]);
      await run(`DELETE FROM fitbit_sleep WHERE sleep_date = ?`, [date]);
      await run(`DELETE FROM sleep_score_result WHERE sleep_date = ?`, [date]);
      await run(`DELETE FROM user_feedback WHERE sleep_date = ?`, [date]);
      await run(`DELETE FROM post_analysis_result WHERE sleep_date = ?`, [date]);
    }

    console.log("Cleaned 7-day demo seed data.");
  } catch (error) {
    console.error("Failed to clean demo data:", error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();

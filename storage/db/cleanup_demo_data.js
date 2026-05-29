const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const db = require("./db");
const DEMO_TAG = "demo-seed";
const DEMO_LOGIN_ID = "u001";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function run(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function dateStr(dayOffset) {
  const d = new Date(Date.now() + KST_OFFSET_MS);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}

async function main() {
  try {
    const user = await get(`SELECT id FROM users WHERE login_id = ?`, [DEMO_LOGIN_ID]);

    if (!user) {
      console.log("No demo user found.");
      return;
    }

    await run(`DELETE FROM google_health_heart WHERE user_id = ? AND created_at = ?`, [user.id, DEMO_TAG]);
    await run(`DELETE FROM google_health_steps WHERE user_id = ? AND created_at = ?`, [user.id, DEMO_TAG]);
    await run(`DELETE FROM google_health_calories WHERE user_id = ? AND created_at = ?`, [user.id, DEMO_TAG]);
    await run(`DELETE FROM sensor_raw WHERE user_id = ? AND created_at = ?`, [user.id, DEMO_TAG]);
    await run(`DELETE FROM pattern_profile WHERE user_id = ?`, [user.id]);

    for (let offset = -14; offset <= 0; offset += 1) {
      const date = dateStr(offset);
      await run(`DELETE FROM post_analysis_result WHERE user_id = ? AND sleep_date = ?`, [user.id, date]);
      await run(`DELETE FROM prediction_result WHERE user_id = ? AND target_sleep_date = ?`, [user.id, date]);
      await run(`DELETE FROM user_feedback WHERE user_id = ? AND sleep_date = ?`, [user.id, date]);
      await run(`DELETE FROM sleep_score_result WHERE user_id = ? AND sleep_date = ?`, [user.id, date]);
      await run(`DELETE FROM google_health_sleep WHERE user_id = ? AND sleep_date = ?`, [user.id, date]);
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

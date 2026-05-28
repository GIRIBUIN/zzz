const db = require("../../storage/db/db");
const { kstDateString, kstDateDaysAgo } = require("../../utils/time");

const RECENT_N_DAYS = 7;

function dbGet(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function dbAll(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function normalizeArgs(userIdOrSinceIso, maybeSinceIso) {
  const legacyCall = maybeSinceIso === undefined;
  const userId = legacyCall ? 1 : Number(userIdOrSinceIso);
  const sinceIso = legacyCall ? userIdOrSinceIso : maybeSinceIso;

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("user_id must be a positive integer");
  }

  if (!sinceIso) {
    throw new Error("sinceIso is required");
  }

  return { userId, sinceIso };
}

// sinceIso: ISO 8601 string marking the start of the 1-hour window
async function buildPresleepFeatures(userIdOrSinceIso, maybeSinceIso) {
  const { userId, sinceIso } = normalizeArgs(userIdOrSinceIso, maybeSinceIso);
  const [heartRow, stepsRow, sensorRow, sleepRows, latestPattern, lowSatRow, caloriesRow] = await Promise.all([
    dbGet(
      `SELECT AVG(bpm) AS avg_hr_1h, MAX(bpm) AS max_hr_1h
       FROM fitbit_heart
       WHERE user_id = ? AND ts >= ?`,
      [userId, sinceIso]
    ),
    dbGet(
      `SELECT COALESCE(SUM(steps), 0) AS steps_sum_1h
       FROM fitbit_steps
       WHERE user_id = ? AND ts >= ?`,
      [userId, sinceIso]
    ),
    dbGet(
      `SELECT AVG(temperature) AS avg_temp_1h,
              AVG(humidity)    AS avg_humidity_1h,
              AVG(mq5_index)   AS avg_mq5_index_1h,
              MAX(mq5_raw)     AS max_mq5_raw_1h
       FROM sensor_raw
       WHERE user_id = ? AND ts >= ?`,
      [userId, sinceIso]
    ),
    dbAll(
      `SELECT minutes_asleep FROM fitbit_sleep
       WHERE user_id = ? AND is_main_sleep = 1
       ORDER BY sleep_date DESC LIMIT ?`,
      [userId, RECENT_N_DAYS]
    ),
    dbGet(
      `SELECT avg_presleep_hr, avg_sleep_minutes, avg_satisfaction, score_gap_trend
       FROM pattern_profile
       WHERE user_id = ?
       ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    ),
    // Days in the last N days where risk was elevated AND satisfaction was low
    dbGet(
      `SELECT COUNT(DISTINCT pr.target_sleep_date) AS cnt
       FROM prediction_result pr
       JOIN user_feedback uf ON pr.user_id = uf.user_id AND pr.target_sleep_date = uf.sleep_date
       WHERE pr.user_id = ?
         AND pr.target_sleep_date >= ?
         AND uf.satisfaction_score < 50
         AND pr.risk_level IN ('MEDIUM', 'HIGH')`,
      [userId, kstDateDaysAgo(RECENT_N_DAYS)]
    ),
    dbGet(
      `SELECT COALESCE(SUM(calories), 0) AS calories_sum_1h
       FROM fitbit_calories
       WHERE user_id = ? AND ts >= ?`,
      [userId, sinceIso]
    ).catch(() => null)  // defensive: returns null if table not yet populated
  ]);

  const sleepMinutes = sleepRows.map(r => Number(r.minutes_asleep) || 0);
  const recentSleepAvg =
    sleepMinutes.length > 0
      ? sleepMinutes.reduce((a, b) => a + b, 0) / sleepMinutes.length
      : null;

  // Std dev of recent sleep durations — high value = irregular sleep pattern
  let sleepIrregularity = null;
  if (sleepMinutes.length >= 3) {
    const mean = recentSleepAvg;
    const variance = sleepMinutes.reduce((a, b) => a + (b - mean) ** 2, 0) / sleepMinutes.length;
    sleepIrregularity = Math.sqrt(variance);
  }

  return {
    user_id:                userId,
    target_sleep_date:      kstDateString(),
    avg_hr_1h:              heartRow?.avg_hr_1h  ?? null,
    max_hr_1h:              heartRow?.max_hr_1h  ?? null,
    steps_sum_1h:           stepsRow?.steps_sum_1h ?? 0,
    calories_sum_1h:        caloriesRow?.calories_sum_1h ?? null,
    avg_temp_1h:            sensorRow?.avg_temp_1h       ?? null,
    avg_humidity_1h:        sensorRow?.avg_humidity_1h   ?? null,
    avg_mq5_index_1h:       sensorRow?.avg_mq5_index_1h  ?? null,
    max_mq5_raw_1h:         sensorRow?.max_mq5_raw_1h    ?? null,
    recent_n_sleep_avg:     recentSleepAvg,
    recent_avg_sleep_minutes: recentSleepAvg,            // 서비스 buildFeatureSnapshot 호환 별칭
    sleep_irregularity:     sleepIrregularity,
    recent_low_sat_high_risk: lowSatRow?.cnt ?? 0,
    pattern: latestPattern ?? null
  };
}

module.exports = { buildPresleepFeatures };

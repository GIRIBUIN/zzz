const db = require("../../storage/db/db");

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

// sinceIso: ISO 8601 string marking the start of the 1-hour window
async function buildPresleepFeatures(sinceIso) {
  const [heartRow, stepsRow, sensorRow, sleepRows, latestPattern, lowSatRow, caloriesRow] = await Promise.all([
    dbGet(
      `SELECT AVG(bpm) AS avg_hr_1h, MAX(bpm) AS max_hr_1h FROM fitbit_heart WHERE ts >= ?`,
      [sinceIso]
    ),
    dbGet(
      `SELECT COALESCE(SUM(steps), 0) AS steps_sum_1h FROM fitbit_steps WHERE ts >= ?`,
      [sinceIso]
    ),
    dbGet(
      `SELECT AVG(temperature) AS avg_temp_1h,
              AVG(humidity)    AS avg_humidity_1h,
              AVG(mq5_index)   AS avg_mq5_index_1h,
              MAX(mq5_raw)     AS max_mq5_raw_1h
       FROM sensor_raw WHERE ts >= ?`,
      [sinceIso]
    ),
    dbAll(
      `SELECT minutes_asleep FROM fitbit_sleep
       WHERE is_main_sleep = 1
       ORDER BY sleep_date DESC LIMIT ?`,
      [RECENT_N_DAYS]
    ),
    dbGet(
      `SELECT avg_presleep_hr, avg_sleep_minutes, avg_satisfaction, score_gap_trend
       FROM pattern_profile ORDER BY updated_at DESC LIMIT 1`,
      []
    ),
    // Days in the last N days where risk was elevated AND satisfaction was low
    dbGet(
      `SELECT COUNT(DISTINCT pr.target_sleep_date) AS cnt
       FROM prediction_result pr
       JOIN user_feedback uf ON pr.target_sleep_date = uf.sleep_date
       WHERE pr.target_sleep_date >= date('now', '-' || ? || ' days')
         AND uf.satisfaction_score < 50
         AND pr.risk_level IN ('MEDIUM', 'HIGH')`,
      [RECENT_N_DAYS]
    ),
    dbGet(
      `SELECT COALESCE(SUM(calories), 0) AS calories_sum_1h FROM fitbit_calories WHERE ts >= ?`,
      [sinceIso]
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
    user_id:                "user-01",
    target_sleep_date:      new Date().toISOString().slice(0, 10),
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

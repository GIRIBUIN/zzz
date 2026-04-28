const db = require("../../storage/db/db");
const { calcSleepScore } = require("../../processing/scoring/sleep_score");
const { fetchSleep } = require("../../rpi/fitbit/fitbit_client");

const inflightEnsures = new Map();

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function getSleepScore(sleepDate) {
  return dbGet(
    `SELECT id, sleep_date, time_asleep_score, deep_rem_score,
            restoration_score, total_score, created_at
     FROM sleep_score_result
     WHERE sleep_date = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [sleepDate]
  );
}

async function getSleepRow(sleepDate) {
  return dbGet(
    `SELECT sleep_date, start_time, end_time, minutes_asleep, minutes_awake,
            deep_minutes, light_minutes, rem_minutes, is_main_sleep
     FROM fitbit_sleep
     WHERE sleep_date = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [sleepDate]
  );
}

async function getLatestPattern() {
  return dbGet(
    `SELECT avg_presleep_hr, avg_sleep_minutes, avg_satisfaction, score_gap_trend
     FROM pattern_profile
     ORDER BY updated_at DESC
     LIMIT 1`
  );
}

async function saveFitbitSleepFromJson(sleepDate, sleepJson) {
  const mainSleep = (sleepJson?.sleep ?? []).find((sleep) => sleep.isMainSleep);
  if (!mainSleep) {
    return {
      action: "skipped",
      reason: "main sleep not found in Fitbit response"
    };
  }

  const levels = mainSleep.levels?.summary ?? {};
  const createdAt = new Date().toISOString();

  await dbRun(
    `INSERT OR REPLACE INTO fitbit_sleep (
      sleep_date,
      start_time,
      end_time,
      minutes_asleep,
      minutes_awake,
      deep_minutes,
      light_minutes,
      rem_minutes,
      is_main_sleep,
      raw_json,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      sleepDate,
      mainSleep.startTime,
      mainSleep.endTime,
      mainSleep.minutesAsleep,
      mainSleep.minutesAwake,
      levels.deep?.minutes ?? 0,
      levels.light?.minutes ?? 0,
      levels.rem?.minutes ?? 0,
      JSON.stringify(mainSleep),
      createdAt
    ]
  );

  return { action: "collected", created_at: createdAt };
}

async function saveSleepScore(sleepDate, scoreResult) {
  const createdAt = new Date().toISOString();

  await dbRun(`DELETE FROM sleep_score_result WHERE sleep_date = ?`, [sleepDate]);
  const insertResult = await dbRun(
    `INSERT INTO sleep_score_result (
      sleep_date,
      time_asleep_score,
      deep_rem_score,
      restoration_score,
      total_score,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      sleepDate,
      scoreResult.time_asleep_score,
      scoreResult.deep_rem_score,
      scoreResult.restoration_score,
      scoreResult.total_score,
      createdAt
    ]
  );

  return {
    id: insertResult.lastID,
    sleep_date: sleepDate,
    ...scoreResult,
    created_at: createdAt
  };
}

async function tryCollectSleep(sleepDate) {
  if (sleepDate !== todayStr()) {
    return {
      action: "skipped",
      reason: "sleep_date is not today; live Fitbit sync skipped"
    };
  }

  try {
    console.log("[sleepScoreService] Fitbit sleep sync start");
    const sleepJson = await fetchSleep();
    const result = await saveFitbitSleepFromJson(sleepDate, sleepJson);
    console.log("[sleepScoreService] Fitbit sleep sync result:", result.action);
    return result;
  } catch (error) {
    console.error("[sleepScoreService] Fitbit sleep sync failed:", error.message);
    return {
      action: "failed",
      reason: `Fitbit sleep sync failed: ${error.message}`
    };
  }
}

async function ensureSleepScoreForDateInternal(sleepDate) {
  const existingScore = await getSleepScore(sleepDate);
  if (existingScore) {
    return {
      action: "exists",
      sleep_date: sleepDate,
      score: existingScore
    };
  }

  let sleepRow = await getSleepRow(sleepDate);
  let collection = { action: "not_needed" };

  if (!sleepRow) {
    collection = await tryCollectSleep(sleepDate);
    sleepRow = await getSleepRow(sleepDate);
  }

  if (!sleepRow) {
    return {
      action: "skipped",
      sleep_date: sleepDate,
      collection,
      reason: "fitbit_sleep missing"
    };
  }

  const patternProfile = await getLatestPattern();
  const scoreResult = calcSleepScore(sleepRow, patternProfile);
  const savedScore = await saveSleepScore(sleepDate, scoreResult);

  return {
    action: "created",
    sleep_date: sleepDate,
    collection,
    score: savedScore
  };
}

async function ensureSleepScoreForDate(sleepDate) {
  if (inflightEnsures.has(sleepDate)) {
    return inflightEnsures.get(sleepDate);
  }

  const ensurePromise = ensureSleepScoreForDateInternal(sleepDate).finally(() => {
    inflightEnsures.delete(sleepDate);
  });
  inflightEnsures.set(sleepDate, ensurePromise);
  return ensurePromise;
}

module.exports = {
  ensureSleepScoreForDate
};

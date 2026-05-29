const db = require("../../storage/db/db");
const { calcSleepScore } = require("../../processing/scoring/sleep_score");
const { collectPostsleep } = require("../../rpi/google_health/collect_google_health");
const { kstDateString } = require("../../utils/time");

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
  return kstDateString();
}

async function getSleepScore(userId, sleepDate) {
  return dbGet(
    `SELECT id, user_id, sleep_date, time_asleep_score, deep_rem_score,
            restoration_score, total_score, created_at
     FROM sleep_score_result
     WHERE user_id = ? AND sleep_date = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, sleepDate]
  );
}

async function getSleepRow(userId, sleepDate) {
  return dbGet(
    `SELECT sleep_date, start_time, end_time, minutes_asleep, minutes_awake,
            deep_minutes, light_minutes, rem_minutes, is_main_sleep
     FROM google_health_sleep
     WHERE user_id = ? AND sleep_date = ?
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, sleepDate]
  );
}

async function getLatestPattern(userId) {
  return dbGet(
    `SELECT avg_presleep_hr, avg_sleep_minutes, avg_satisfaction, score_gap_trend
     FROM pattern_profile
     WHERE user_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );
}

async function saveSleepScore(userId, sleepDate, scoreResult) {
  const createdAt = new Date().toISOString();

  await dbRun(`DELETE FROM sleep_score_result WHERE user_id = ? AND sleep_date = ?`, [userId, sleepDate]);
  const insertResult = await dbRun(
    `INSERT INTO sleep_score_result (
      user_id,
      sleep_date,
      time_asleep_score,
      deep_rem_score,
      restoration_score,
      total_score,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
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
    user_id: userId,
    sleep_date: sleepDate,
    ...scoreResult,
    created_at: createdAt
  };
}

async function tryCollectSleep(userId, sleepDate) {
  if (sleepDate !== todayStr()) {
    return {
      action: "skipped",
      reason: "sleep_date is not today; live Google Health sync skipped"
    };
  }

  try {
    console.log("[sleepScoreService] Google Health sleep sync start");
    await collectPostsleep({ user_id: userId });
    console.log("[sleepScoreService] Google Health sleep sync complete");
    return { action: "collected" };
  } catch (error) {
    console.error("[sleepScoreService] Google Health sleep sync failed:", error.message);
    return {
      action: "failed",
      reason: `Google Health sleep sync failed: ${error.message}`
    };
  }
}

async function ensureSleepScoreForDateInternal(userId, sleepDate) {
  const existingScore = await getSleepScore(userId, sleepDate);
  if (existingScore) {
    return {
      action: "exists",
      sleep_date: sleepDate,
      score: existingScore
    };
  }

  let sleepRow = await getSleepRow(userId, sleepDate);
  let collection = { action: "not_needed" };

  if (!sleepRow) {
    collection = await tryCollectSleep(userId, sleepDate);
    sleepRow = await getSleepRow(userId, sleepDate);
  }

  if (!sleepRow) {
    return {
      action: "skipped",
      sleep_date: sleepDate,
      collection,
      reason: "sleep source data missing"
    };
  }

  const patternProfile = await getLatestPattern(userId);
  const scoreResult = calcSleepScore(sleepRow, patternProfile);
  const savedScore = await saveSleepScore(userId, sleepDate, scoreResult);

  return {
    action: "created",
    sleep_date: sleepDate,
    collection,
    score: savedScore
  };
}

async function ensureSleepScoreForDate(userIdOrSleepDate, maybeSleepDate) {
  const userId = maybeSleepDate === undefined ? 1 : userIdOrSleepDate;
  const sleepDate = maybeSleepDate === undefined ? userIdOrSleepDate : maybeSleepDate;
  const key = `${userId}:${sleepDate}`;

  if (inflightEnsures.has(key)) {
    return inflightEnsures.get(key);
  }

  const ensurePromise = ensureSleepScoreForDateInternal(userId, sleepDate).finally(() => {
    inflightEnsures.delete(key);
  });
  inflightEnsures.set(key, ensurePromise);
  return ensurePromise;
}

module.exports = {
  ensureSleepScoreForDate
};

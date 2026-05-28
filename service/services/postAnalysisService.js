const db = require("../../storage/db/db");
const { analyzePostSleep } = require("../../processing/analysis/post_analysis");
const { buildAnalysisPrompt } = require("../../processing/slm/prompt_builder");
const { callSlm } = require("../../processing/slm/slm_client");

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

function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

function withGapNote(analysis) {
  return analysis.score_gap_note
    ? `${analysis.analysis_text} ${analysis.score_gap_note}`
    : analysis.analysis_text;
}

async function hasPostAnalysis(userIdOrSleepDate, maybeSleepDate) {
  const userId = maybeSleepDate === undefined ? 1 : userIdOrSleepDate;
  const sleepDate = maybeSleepDate === undefined ? userIdOrSleepDate : maybeSleepDate;
  const row = await dbGet(
    `SELECT id FROM post_analysis_result WHERE user_id = ? AND sleep_date = ? LIMIT 1`,
    [userId, sleepDate]
  );
  return Boolean(row);
}

async function generatePostAnalysisForDate(userIdOrSleepDate, sleepDateOrSatisfaction, maybeSatisfactionScore) {
  const legacyCall = maybeSatisfactionScore === undefined;
  const userId = legacyCall ? 1 : userIdOrSleepDate;
  const sleepDate = legacyCall ? userIdOrSleepDate : sleepDateOrSatisfaction;
  const satisfactionScore = legacyCall ? sleepDateOrSatisfaction : maybeSatisfactionScore;

  const [sleepRow, scoreResult, predictionRow, patternProfile] = await Promise.all([
    dbGet(
      `SELECT sleep_date, start_time, end_time, minutes_asleep, minutes_awake,
              deep_minutes, light_minutes, rem_minutes, is_main_sleep
       FROM fitbit_sleep
       WHERE user_id = ? AND sleep_date = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, sleepDate]
    ),
    dbGet(
      `SELECT id, user_id, sleep_date, time_asleep_score, deep_rem_score, restoration_score, total_score
       FROM sleep_score_result
       WHERE user_id = ? AND sleep_date = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, sleepDate]
    ),
    dbGet(
      `SELECT feature_snapshot_json
       FROM prediction_result
       WHERE user_id = ? AND target_sleep_date = ?
       ORDER BY prediction_ts DESC
       LIMIT 1`,
      [userId, sleepDate]
    ),
    dbGet(
      `SELECT avg_presleep_hr, avg_sleep_minutes, avg_satisfaction, score_gap_trend
       FROM pattern_profile
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [userId]
    )
  ]);

  if (!sleepRow || !scoreResult) {
    return {
      action: "skipped",
      reason: "fitbit_sleep or sleep_score_result missing",
      sleep_date: sleepDate
    };
  }

  const featureSnapshot = parseJsonObject(predictionRow?.feature_snapshot_json);
  const analysis = analyzePostSleep({
    sleepRow,
    scoreResult,
    featureSnapshot,
    satisfactionScore,
    patternProfile
  });

  const prompt = buildAnalysisPrompt(
    analysis,
    scoreResult,
    satisfactionScore,
    patternProfile,
    sleepRow
  );
  const slmText = await callSlm(prompt);
  const analysisText = slmText
    ? `[slm] ${slmText}`
    : `[rule] ${withGapNote(analysis)}`;
  const createdAt = new Date().toISOString();

  await dbRun(`DELETE FROM post_analysis_result WHERE user_id = ? AND sleep_date = ?`, [userId, sleepDate]);
  const insertResult = await dbRun(
    `INSERT INTO post_analysis_result
       (user_id, sleep_score_result_id, sleep_date, causes_json, analysis_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, scoreResult.id, sleepDate, analysis.causes_json, analysisText, createdAt]
  );

  return {
    action: "upsert",
    id: insertResult.lastID,
    user_id: userId,
    sleep_date: sleepDate,
    causes: parseJsonObject(analysis.causes_json) || [],
    analysis_text: analysisText,
    source: slmText ? "slm" : "rule",
    created_at: createdAt
  };
}

module.exports = {
  generatePostAnalysisForDate,
  hasPostAnalysis
};

const db = require("../../storage/db/db");

function parseJsonArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  return [];
}

function getLatestRow(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

async function getLatestResult() {
  const [
    latestFeedback,
    latestPredictionRow,
    latestSleepScore,
    latestAnalysisRow,
    latestEnvironment
  ] = await Promise.all([
    getLatestRow(
      `SELECT id, sleep_date, satisfaction_score, created_at
       FROM user_feedback
       ORDER BY created_at DESC
       LIMIT 1`
    ),
    getLatestRow(
      `SELECT id, prediction_ts, target_sleep_date, risk_level, risk_score, reasons_json, action_text, feature_snapshot_json, created_at
       FROM prediction_result
       ORDER BY created_at DESC
       LIMIT 1`
    ),
    getLatestRow(
      `SELECT id, sleep_date, time_asleep_score, deep_rem_score, restoration_score, total_score, created_at
       FROM sleep_score_result
       ORDER BY created_at DESC
       LIMIT 1`
    ),
    getLatestRow(
      `SELECT id, sleep_date, causes_json, analysis_text, created_at
       FROM post_analysis_result
       ORDER BY created_at DESC
       LIMIT 1`
    ),
    getLatestRow(
      `SELECT id, ts, temperature, humidity, mq5_index, created_at
       FROM sensor_raw
       ORDER BY ts DESC
       LIMIT 1`
    )
  ]);

  const latestPrediction = latestPredictionRow
    ? {
        ...latestPredictionRow,
        reasons: parseJsonArray(latestPredictionRow.reasons_json)
      }
    : null;

  const latestAnalysis = latestAnalysisRow
    ? {
        ...latestAnalysisRow,
        causes: parseJsonArray(latestAnalysisRow.causes_json)
      }
    : null;

  return {
    latest_feedback: latestFeedback,
    latest_prediction: latestPrediction,
    latest_sleep_score: latestSleepScore,
    latest_analysis: latestAnalysis,
    latest_environment: latestEnvironment
  };
}

function getSleepScoreHistory(limit = 7) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT sleep_date, total_score
       FROM sleep_score_result
       ORDER BY sleep_date DESC
       LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) return reject(err);

        const orderedRows = (rows || []).slice().reverse();
        resolve(orderedRows);
      }
    );
  });
}

module.exports = {
  getLatestResult,
  getSleepScoreHistory
};

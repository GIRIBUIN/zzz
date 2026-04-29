const db = require("../../storage/db/db");
const { presleepPredictor } = require("../../processing/prediction/prediction");
const { callSlm } = require("../../processing/slm/slm_client");
const { buildPresleepPrompt } = require("../../processing/slm/prompt_builder");
const { kstDateString, kstIsoLocal } = require("../../utils/time");

function getTargetSleepDate() {
  return kstDateString();
}

function savePredictionResult(payload, predictionResult) {
  return new Promise((resolve, reject) => {
    const predictionTs = kstIsoLocal();
    const createdAt = new Date().toISOString();
    const targetSleepDate = payload?.target_sleep_date || getTargetSleepDate();
    const reasonsJson = JSON.stringify(predictionResult.reasons || []);
    const snapshotJson = JSON.stringify(payload || {});

    const insertQuery = `
      INSERT INTO prediction_result (
        prediction_ts,
        target_sleep_date,
        risk_level,
        risk_score,
        reasons_json,
        action_text,
        feature_snapshot_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(
      insertQuery,
      [
        predictionTs,
        targetSleepDate,
        predictionResult.risk_level,
        predictionResult.risk_score,
        reasonsJson,
        predictionResult.action_text,
        snapshotJson,
        createdAt
      ],
      function insertPrediction(insertErr) {
        if (insertErr) {
          return reject(insertErr);
        }

        return resolve({
          id: this.lastID,
          prediction_ts: predictionTs,
          target_sleep_date: targetSleepDate,
          risk_level: predictionResult.risk_level,
          risk_score: predictionResult.risk_score,
          reasons: predictionResult.reasons || [],
          reasons_json: reasonsJson,
          action_text: predictionResult.action_text,
          feature_snapshot_json: snapshotJson,
          created_at: createdAt,
          message: predictionResult.message,
          received: predictionResult.received || payload || {}
        });
      }
    );
  });
}

async function executePresleepPrediction(payload, predictor = presleepPredictor) {
  const predictionResult = predictor(payload);

  const patternProfile = payload?.pattern ?? null;
  const prompt = buildPresleepPrompt(predictionResult, payload, patternProfile);
  const slmText = await callSlm(prompt);
  predictionResult.action_text = slmText
    ? `[slm] ${slmText}`
    : `[rule] ${predictionResult.action_text}`;

  return savePredictionResult(payload, predictionResult);
}

module.exports = {
  savePredictionResult,
  executePresleepPrediction
};

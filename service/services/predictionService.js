const db = require("../../storage/db/db");

// Predictor contract:
// input: {
//   avg_hr_1h,
//   steps_sum_1h,
//   avg_temp_1h,
//   avg_humidity_1h,
//   avg_mq5_index_1h,
//   target_sleep_date
// }
// output: {
//   risk_level,
//   risk_score,
//   reasons,
//   action_text,
//   message?,
//   received?
// }
function runPresleepPrediction(payload) {
  const avgHr = Number(payload?.avg_hr_1h ?? 0);
  const steps = Number(payload?.steps_sum_1h ?? 0);
  const temp = Number(payload?.avg_temp_1h ?? 0);
  const humidity = Number(payload?.avg_humidity_1h ?? 0);
  const mq5 = Number(payload?.avg_mq5_index_1h ?? 0);

  const reasons = [];

  if (avgHr >= 85) {
    reasons.push("취침 전 심박이 평소보다 높은 편입니다.");
  }

  if (steps >= 300) {
    reasons.push("취침 전 활동량이 다소 높은 편입니다.");
  }

  if (temp >= 25.5) {
    reasons.push("실내 온도가 약간 높은 편입니다.");
  }

  if (humidity >= 65) {
    reasons.push("실내 습도가 높은 편입니다.");
  }

  if (mq5 >= 0.5) {
    reasons.push("실내 공기 상태가 불리할 수 있습니다.");
  }

  let risk_score = 35;

  if (avgHr >= 85) risk_score += 15;
  if (steps >= 300) risk_score += 10;
  if (temp >= 25.5) risk_score += 10;
  if (humidity >= 65) risk_score += 10;
  if (mq5 >= 0.5) risk_score += 10;

  if (risk_score > 100) {
    risk_score = 100;
  }

  let risk_level = "LOW";
  if (risk_score >= 70) {
    risk_level = "HIGH";
  } else if (risk_score >= 50) {
    risk_level = "MEDIUM";
  }

  let action_text = "현재 상태를 유지해도 괜찮습니다.";
  if (risk_level === "MEDIUM") {
    action_text = "취침 전 활동을 조금 줄이고 실내 환경을 점검해보세요.";
  } else if (risk_level === "HIGH") {
    action_text = "취침 전에 심박을 안정시키고, 환기나 온습도 조절을 먼저 해보는 것이 좋겠습니다.";
  }

  return {
    message: "presleep prediction endpoint ready",
    risk_level,
    risk_score,
    reasons,
    action_text,
    received: payload || {}
  };
}

function getTargetSleepDate() {
  return new Date().toISOString().slice(0, 10);
}

function savePredictionResult(payload, predictionResult) {
  return new Promise((resolve, reject) => {
    const predictionTs = new Date().toISOString();
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
        predictionTs
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
          created_at: predictionTs,
          message: predictionResult.message,
          received: predictionResult.received || payload || {}
        });
      }
    );
  });
}

async function executePresleepPrediction(payload, predictor = runPresleepPrediction) {
  const predictionResult = predictor(payload);
  return savePredictionResult(payload, predictionResult);
}

module.exports = {
  runPresleepPrediction,
  savePredictionResult,
  executePresleepPrediction
};

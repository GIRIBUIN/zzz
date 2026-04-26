const { executePresleepPrediction } = require("../services/predictionService");
const { collectPresleep } = require("../../rpi/fitbit/collect_fitbit");
const db = require("../../storage/db/db");
 
/**
 * 최근 1시간 Fitbit 데이터를 DB에서 집계해서 feature snapshot 생성
 */
function buildFeatureSnapshot() {
  return new Promise((resolve, reject) => {
    // KST = UTC+9, DB에 KST로 저장되어 있으므로 KST 기준으로 계산
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const oneHourAgo = new Date(Date.now() + KST_OFFSET - 60 * 60 * 1000)
      .toISOString()
      .replace('Z', '');
    const today = new Date().toISOString().slice(0, 10);
 
    // 심박 평균, 걸음수 합계 동시 조회
    const heartQuery = `
      SELECT AVG(bpm) as avg_hr_1h
      FROM fitbit_heart
      WHERE ts >= ?
    `;
 
    const stepsQuery = `
      SELECT SUM(steps) as steps_sum_1h
      FROM fitbit_steps
      WHERE ts >= ?
    `;

    const caloriesQuery = `
      SELECT SUM(calories) as calories_sum_1h
      FROM fitbit_calories
      WHERE ts >= ?
    `;
 
    const sensorQuery = `
      SELECT AVG(temperature) as avg_temp_1h,
             AVG(humidity)    as avg_humidity_1h,
             AVG(mq5_index)   as avg_mq5_index_1h
      FROM sensor_raw
      WHERE ts >= ?
    `;
 
    const sleepQuery = `
      SELECT AVG(minutes_asleep) as recent_avg_sleep_minutes
      FROM fitbit_sleep
      WHERE sleep_date < ?
      ORDER BY sleep_date DESC
      LIMIT 7
    `;
 
    let heart = {};
    let steps = {};
    let calories = {};
    let sensor = {};
    let sleep = {};
    let done = 0;
    const errors = [];
 
    function tryResolve() {
      done += 1;
      if (done === 5) {
        if (errors.length > 0) return reject(errors[0]);
        resolve({
          user_id: "user-01",
          avg_hr_1h:               heart.avg_hr_1h   ?? null,
          steps_sum_1h:            steps.steps_sum_1h ?? null,
          calories_sum_1h:         calories.calories_sum_1h ?? null,
          avg_temp_1h:             sensor.avg_temp_1h     ?? null,
          avg_humidity_1h:         sensor.avg_humidity_1h ?? null,
          avg_mq5_index_1h:        sensor.avg_mq5_index_1h ?? null,
          recent_avg_sleep_minutes: sleep.recent_avg_sleep_minutes ?? null,
          target_sleep_date:       today,
        });
      }
    }
 
    db.get(heartQuery,  [oneHourAgo], (err, row) => { if (err) errors.push(err); else heart  = row || {}; tryResolve(); });
    db.get(stepsQuery,  [oneHourAgo], (err, row) => { if (err) errors.push(err); else steps  = row || {}; tryResolve(); });
    db.get(caloriesQuery, [oneHourAgo], (err, row) => { if (err) errors.push(err); else calories = row || {}; tryResolve(); });
    db.get(sensorQuery, [oneHourAgo], (err, row) => { if (err) errors.push(err); else sensor = row || {}; tryResolve(); });
    db.get(sleepQuery,  [today],      (err, row) => { if (err) errors.push(err); else sleep  = row || {}; tryResolve(); });
  });
}
 
async function postPresleepPrediction(req, res) {
  try {
    console.log("[predictController]:: Fitbit 데이터 수집 시작");
    await collectPresleep();
    console.log("[predictController] Fitbit 데이터 수집 완료");
    await new Promise(resolve => setTimeout(resolve, 500));
     
    // 2. DB에서 feature snapshot 집계
    const snapshot = await buildFeatureSnapshot();
    console.log("[predictController]:: feature snapshot:", snapshot);
 
    // 3. 예측 실행 + DB 저장
    const result = await executePresleepPrediction(snapshot);
 
    return res.status(200).json({
      status: "ok",
      endpoint: "POST /predict/presleep",
      data: result
    });
  } catch (error) {
    console.error("[predictController] 오류:", error.message);
    return res.status(500).json({
      status: "error",
      message: error.message
    });
  }
}
 
module.exports = {
  postPresleepPrediction
};

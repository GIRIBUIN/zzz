// EventBridge 스케줄 트리거: 매일 자정(KST) 수면 점수 자동 계산
// cron(0 15 * * ? *)  → UTC 15:00 = KST 00:00
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "zzz",
  waitForConnections: true,
  connectionLimit: 5,
  dateStrings: true,
});

const GAP_DAMPING = 0.5;
const MAX_CORRECTION = 15;

// ─── 수면 점수 계산 (순수 함수) ───────────────────────────────────────────────

function calcSleepScore(sleepRow, patternProfile) {
  const minutesAsleep = Number(sleepRow.minutes_asleep) || 0;
  const minutesAwake  = Number(sleepRow.minutes_awake)  || 0;
  const deepMinutes   = Number(sleepRow.deep_minutes)   || 0;
  const remMinutes    = Number(sleepRow.rem_minutes)    || 0;

  let timeAsleepScore;
  if (minutesAsleep >= 420) timeAsleepScore = 50;
  else if (minutesAsleep <= 180) timeAsleepScore = 0;
  else timeAsleepScore = ((minutesAsleep - 180) / (420 - 180)) * 50;

  const stageBase = minutesAsleep || 1;
  const deepRemRatio = (deepMinutes + remMinutes) / stageBase;
  let deepRemScore;
  if (deepRemRatio >= 0.25) deepRemScore = 25;
  else if (deepRemRatio <= 0.10) deepRemScore = 5;
  else deepRemScore = 5 + ((deepRemRatio - 0.10) / 0.15) * 20;

  const sessionTotal = minutesAsleep + minutesAwake || 1;
  const awakeRatio = minutesAwake / sessionTotal;
  let restorationScore;
  if (awakeRatio <= 0) restorationScore = 25;
  else if (awakeRatio >= 0.20) restorationScore = 5;
  else restorationScore = 5 + ((0.20 - awakeRatio) / 0.20) * 20;

  const round1 = (v) => Math.round(v * 10) / 10;
  const rawTotal = timeAsleepScore + deepRemScore + restorationScore;
  const gapTrend = Number(patternProfile?.score_gap_trend ?? 0);
  const correction = Math.max(-MAX_CORRECTION, Math.min(MAX_CORRECTION, gapTrend * GAP_DAMPING));

  return {
    time_asleep_score: round1(timeAsleepScore),
    deep_rem_score: round1(deepRemScore),
    restoration_score: round1(restorationScore),
    total_score: round1(Math.max(0, Math.min(100, rawTotal - correction))),
  };
}

// ─── DB 헬퍼 ─────────────────────────────────────────────────────────────────

async function dbGet(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows[0] || null;
}

async function dbAll(sql, params) {
  const [rows] = await pool.query(sql, params);
  return rows || [];
}

async function dbRun(sql, params) {
  const [result] = await pool.query(sql, params);
  return { lastID: result.insertId || 0 };
}

// ─── 핵심 로직 ───────────────────────────────────────────────────────────────

// 점수 없는 날짜 목록 (sleep 데이터는 있지만 score는 없는 날)
async function getMissingScoreDates(userId) {
  return dbAll(
    `SELECT ghs.sleep_date
     FROM google_health_sleep ghs
     LEFT JOIN sleep_score_result ssr
       ON ghs.user_id = ssr.user_id AND ghs.sleep_date = ssr.sleep_date
     WHERE ghs.user_id = ? AND ghs.is_main_sleep = 1 AND ssr.id IS NULL
     ORDER BY ghs.sleep_date DESC
     LIMIT 30`,
    [userId]
  );
}

async function computeAndSave(userId, sleepDate) {
  const sleepRow = await dbGet(
    `SELECT minutes_asleep, minutes_awake, deep_minutes, light_minutes, rem_minutes
     FROM google_health_sleep
     WHERE user_id = ? AND sleep_date = ? AND is_main_sleep = 1
     ORDER BY created_at DESC LIMIT 1`,
    [userId, sleepDate]
  );
  if (!sleepRow) return { action: "skipped", reason: "no sleep data" };

  const pattern = await dbGet(
    `SELECT score_gap_trend FROM pattern_profile
     WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );

  const score = calcSleepScore(sleepRow, pattern);
  const createdAt = new Date().toISOString();

  await dbRun(`DELETE FROM sleep_score_result WHERE user_id = ? AND sleep_date = ?`, [userId, sleepDate]);
  await dbRun(
    `INSERT INTO sleep_score_result
       (user_id, sleep_date, time_asleep_score, deep_rem_score, restoration_score, total_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, sleepDate, score.time_asleep_score, score.deep_rem_score, score.restoration_score, score.total_score, createdAt]
  );

  return { action: "created", sleep_date: sleepDate, total_score: score.total_score };
}

// ─── 핸들러 ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  console.log("[zzz-scheduled-sleep-score] triggered:", JSON.stringify(event));

  const users = await dbAll(`SELECT id FROM users ORDER BY id ASC`, []);
  console.log(`[zzz-scheduled-sleep-score] 처리 대상 유저: ${users.length}명`);

  const results = [];

  for (const user of users) {
    const missingDates = await getMissingScoreDates(user.id);

    for (const row of missingDates) {
      try {
        const result = await computeAndSave(user.id, row.sleep_date);
        results.push({ user_id: user.id, ...result });
        console.log(`[zzz-scheduled-sleep-score] user=${user.id} date=${row.sleep_date} → ${result.action}`);
      } catch (e) {
        console.error(`[zzz-scheduled-sleep-score] user=${user.id} date=${row.sleep_date} 실패:`, e.message);
        results.push({ user_id: user.id, sleep_date: row.sleep_date, action: "failed", reason: e.message });
      }
    }
  }

  const summary = {
    created: results.filter(r => r.action === "created").length,
    skipped: results.filter(r => r.action === "skipped").length,
    failed:  results.filter(r => r.action === "failed").length,
  };

  console.log("[zzz-scheduled-sleep-score] 완료:", summary);
  return { status: "ok", summary, results };
};

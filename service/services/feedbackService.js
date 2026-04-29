const db = require("../../storage/db/db");
const { ensureSleepScoreForDate } = require("./sleepScoreService");
const {
  updatePatternStage1,
  updatePatternStage2
} = require("../../processing/pattern/pattern_update");
const {
  generatePostAnalysisForDate,
  hasPostAnalysis
} = require("./postAnalysisService");
const { kstDateString, previousDateString } = require("../../utils/time");

function saveFeedbackRecord(payload) {
  return new Promise((resolve, reject) => {
    const { sleep_date: inputDate, satisfaction_score } = payload || {};

    if (!inputDate) {
      return reject(new Error("wake_date is required"));
    }

    if (
      satisfaction_score === undefined ||
      satisfaction_score === null ||
      Number.isNaN(Number(satisfaction_score))
    ) {
      return reject(new Error("satisfaction_score must be a number"));
    }

    const score = Number(satisfaction_score);

    if (score < 0 || score > 100) {
      return reject(new Error("satisfaction_score must be between 0 and 100"));
    }

    // The post-sleep UI receives the morning wake date.
    // Internally, records are grouped by the date the sleep started.
    const wake_date = inputDate;
    const sleep_date = previousDateString(inputDate);

    if (!sleep_date) {
      return reject(new Error("wake_date must be YYYY-MM-DD"));
    }

    // 미래 날짜 입력 방지
    const today = kstDateString();
    if (wake_date > today) {
      return reject(new Error("future wake_date is not allowed"));
    }

    const now = new Date().toISOString();

    const selectQuery = `
      SELECT id, satisfaction_score
      FROM user_feedback
      WHERE sleep_date = ?
      LIMIT 1
    `;

    db.get(selectQuery, [sleep_date], (selectErr, row) => {
      if (selectErr) {
        return reject(selectErr);
      }

      // 이미 있는 날짜
      if (row) {
        // 값이 같으면 no_change
        if (Number(row.satisfaction_score) === score) {
          return resolve({
            message: "feedback unchanged",
            action: "no_change",
            id: row.id,
            wake_date,
            sleep_date,
            satisfaction_score: score
          });
        }

        // 값이 다르면 update
        const updateQuery = `
          UPDATE user_feedback
          SET satisfaction_score = ?, created_at = ?
          WHERE id = ?
        `;

        db.run(updateQuery, [score, now, row.id], function (updateErr) {
          if (updateErr) {
            return reject(updateErr);
          }

          return resolve({
            message: "feedback updated",
            action: "update",
            id: row.id,
            wake_date,
            sleep_date,
            satisfaction_score: score,
            created_at: now
          });
        });
      } else {
        // 없으면 insert
        const insertQuery = `
          INSERT INTO user_feedback (sleep_date, satisfaction_score, created_at)
          VALUES (?, ?, ?)
        `;

        db.run(insertQuery, [sleep_date, score, now], function (insertErr) {
          if (insertErr) {
            return reject(insertErr);
          }

          return resolve({
            message: "feedback saved",
            action: "insert",
            id: this.lastID,
            wake_date,
            sleep_date,
            satisfaction_score: score,
            created_at: now
          });
        });
      }
    });
  });
}

async function saveFeedback(payload) {
  const result = await saveFeedbackRecord(payload);
  let sleepScore = null;
  let pattern = null;

  try {
    sleepScore = await ensureSleepScoreForDate(result.sleep_date);
  } catch (error) {
    console.error("[feedbackService] sleep score ensure failed:", error.message);
    sleepScore = {
      action: "failed",
      sleep_date: result.sleep_date,
      reason: error.message
    };
  }

  const scoreTotal = sleepScore?.score?.total_score;
  const shouldUpdatePattern =
    scoreTotal != null &&
    (result.action === "insert" ||
      result.action === "update" ||
      sleepScore.action === "created");

  if (shouldUpdatePattern) {
    try {
      const stage1 = await updatePatternStage1(result.sleep_date);
      const stage2 = await updatePatternStage2(
        result.sleep_date,
        result.satisfaction_score,
        scoreTotal
      );
      pattern = {
        action: "upsert",
        sleep_date: result.sleep_date,
        stage1: {
          updated_at: stage1.updated_at,
          avg_sleep_minutes: stage1.avg_sleep_minutes,
          avg_presleep_hr: stage1.avg_presleep_hr
        },
        stage2: {
          updated_at: stage2.updated_at,
          avg_satisfaction: stage2.avg_satisfaction,
          score_gap_trend: stage2.score_gap_trend,
          pred_accuracy_rate: stage2.pred_accuracy_rate,
          env_sensitivity: stage2.env_sensitivity
        },
        pred_accuracy_rate: stage2.pred_accuracy_rate,
        score_gap_trend: stage2.score_gap_trend
      };

      console.log("[feedbackService] pattern updated:", {
        sleep_date: result.sleep_date,
        avg_sleep_minutes: pattern.stage1.avg_sleep_minutes,
        avg_presleep_hr: pattern.stage1.avg_presleep_hr,
        avg_satisfaction: pattern.stage2.avg_satisfaction,
        score_gap_trend: pattern.stage2.score_gap_trend,
        pred_accuracy_rate: pattern.stage2.pred_accuracy_rate
      });
    } catch (error) {
      console.error("[feedbackService] pattern update failed:", error.message);
      pattern = {
        action: "failed",
        sleep_date: result.sleep_date,
        reason: error.message
      };
    }
  } else {
    pattern = {
      action: "skipped",
      sleep_date: result.sleep_date
    };
  }

  const shouldGenerateAnalysis =
    result.action === "insert" ||
    result.action === "update" ||
    !(await hasPostAnalysis(result.sleep_date));

  if (!shouldGenerateAnalysis) {
    return {
      ...result,
      sleep_score: sleepScore,
      pattern,
      post_analysis: {
        action: "unchanged",
        sleep_date: result.sleep_date
      }
    };
  }

  try {
    const postAnalysis = await generatePostAnalysisForDate(
      result.sleep_date,
      result.satisfaction_score
    );

    return {
      ...result,
      sleep_score: sleepScore,
      pattern,
      post_analysis: postAnalysis
    };
  } catch (error) {
    console.error("[feedbackService] post analysis failed:", error.message);
    return {
      ...result,
      sleep_score: sleepScore,
      pattern,
      post_analysis: {
        action: "failed",
        sleep_date: result.sleep_date,
        reason: error.message
      }
    };
  }
}

module.exports = {
  saveFeedback
};

// Damping factor for score_gap_trend correction (0.5 = half the observed gap)
const GAP_DAMPING = 0.5;
const MAX_CORRECTION = 15; // cap so a single outlier can't ruin the score

// patternProfile: latest row from pattern_profile (optional, enables feedback correction)
function calcSleepScore(sleepRow, patternProfile) {
  const minutesAsleep = Number(sleepRow.minutes_asleep) || 0;
  const minutesAwake = Number(sleepRow.minutes_awake) || 0;
  const deepMinutes = Number(sleepRow.deep_minutes) || 0;
  const remMinutes = Number(sleepRow.rem_minutes) || 0;

  // Time Asleep: 0~50pts (180min=0, 420min=50, linear)
  let timeAsleepScore;
  if (minutesAsleep >= 420) timeAsleepScore = 50;
  else if (minutesAsleep <= 180) timeAsleepScore = 0;
  else timeAsleepScore = ((minutesAsleep - 180) / (420 - 180)) * 50;

  // Deep & REM ratio: 5~25pts (ratio<=0.10=5, ratio>=0.25=25, linear)
  const stageBase = minutesAsleep || 1;
  const deepRemRatio = (deepMinutes + remMinutes) / stageBase;
  let deepRemScore;
  if (deepRemRatio >= 0.25) deepRemScore = 25;
  else if (deepRemRatio <= 0.10) deepRemScore = 5;
  else deepRemScore = 5 + ((deepRemRatio - 0.10) / (0.25 - 0.10)) * (25 - 5);

  // Restoration: 5~25pts (awakeRatio>=0.20=5, awakeRatio<=0=25, linear)
  const sessionTotal = minutesAsleep + minutesAwake || 1;
  const awakeRatio = minutesAwake / sessionTotal;
  let restorationScore;
  if (awakeRatio <= 0) restorationScore = 25;
  else if (awakeRatio >= 0.20) restorationScore = 5;
  else restorationScore = 5 + ((0.20 - awakeRatio) / 0.20) * (25 - 5);

  const round1 = (v) => Math.round(v * 10) / 10;
  const rawTotal = timeAsleepScore + deepRemScore + restorationScore;

  // Feedback correction: if the user has historically rated lower than the objective score,
  // reduce future scores proportionally. score_gap_trend = avg(auto - satisfaction) over window.
  const gapTrend = Number(patternProfile?.score_gap_trend ?? 0);
  const correction = Math.max(-MAX_CORRECTION, Math.min(MAX_CORRECTION, gapTrend * GAP_DAMPING));
  const adjustedTotal = Math.max(0, Math.min(100, rawTotal - correction));

  return {
    time_asleep_score: round1(timeAsleepScore),
    deep_rem_score: round1(deepRemScore),
    restoration_score: round1(restorationScore),
    raw_total_score: round1(rawTotal),      // objective score before feedback correction
    total_score: round1(adjustedTotal)      // personalized score after correction
  };
}

module.exports = { calcSleepScore };

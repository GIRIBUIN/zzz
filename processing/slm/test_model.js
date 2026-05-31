// 사용법: SLM_ENDPOINT=http://localhost:11434 SLM_MODEL=exaone-deep:2.4b node processing/slm/test_model.js
// 기존 result.txt 와 동일한 테스트 조건으로 실행

const { buildPresleepPrompt, buildAnalysisPrompt } = require("./prompt_builder");

const ENDPOINT = process.env.SLM_ENDPOINT || "http://localhost:11434";
const MODEL    = process.env.SLM_MODEL    || "exaone-deep:2.4b";
const TIMEOUT  = Number(process.env.SLM_TIMEOUT_MS) || 120000;

// ── 기존 result.txt 와 동일한 테스트 픽스처 ──────────────────────────────

const PRESLEEP_RISK = {
  risk_level: "HIGH",
  risk_score: 80,
  reasons: ["심박 상승", "실내 온도 높음"]
};
const PRESLEEP_FEATURE = {
  avg_hr_1h:        88,
  avg_temp_1h:      27.5,
  avg_humidity_1h:  55,
  avg_mq5_index_1h: 0.42,
  steps_sum_1h:     320,
  calories_sum_1h:  45
};
const PATTERN_STABLE = { avg_presleep_hr: 72 };  // stable 경로

const ANALYSIS_RESULT = {
  causes_json:    JSON.stringify([{ label: "가스 불량" }, { label: "심박 상승" }]),
  analysis_text:  "취침 전 공기질 저하와 심박 상승이 감지되었습니다.",
  score_gap_note: "수면 점수 대비 주관 만족도가 낮습니다."
};
const SCORE_RESULT    = { total_score: 72 };
const SATISFACTION    = 55;
const SLEEP_ROW       = { minutes_asleep: 370, minutes_awake: 25, deep_minutes: 60, rem_minutes: 80 };

// ── 호출 헬퍼 ─────────────────────────────────────────────────────────────

async function call(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  const start = Date.now();
  try {
    const res = await fetch(`${ENDPOINT}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return { text: (json?.response ?? "").trim(), elapsed };
  } finally {
    clearTimeout(timer);
  }
}

// ── 메인 ──────────────────────────────────────────────────────────────────

(async () => {
  const promptA = buildPresleepPrompt(PRESLEEP_RISK, PRESLEEP_FEATURE, PATTERN_STABLE);
  const promptB = buildAnalysisPrompt(ANALYSIS_RESULT, SCORE_RESULT, SATISFACTION, PATTERN_STABLE, SLEEP_ROW);

  console.log(`\n모델: ${MODEL}  엔드포인트: ${ENDPOINT}\n`);
  console.log("─".repeat(64));

  console.log("[A] presleep 프롬프트 전송 중...");
  const a = await call(promptA);
  console.log(`  응답 시간: ${a.elapsed}s`);
  console.log(`  응답:\n  ${a.text.replace(/\n/g, "\n  ")}\n`);

  console.log("[B] analysis 프롬프트 전송 중...");
  const b = await call(promptB);
  console.log(`  응답 시간: ${b.elapsed}s`);
  console.log(`  응답:\n  ${b.text.replace(/\n/g, "\n  ")}\n`);

  console.log("─".repeat(64));
  console.log(`완료  presleep ${a.elapsed}s  /  analysis ${b.elapsed}s`);
})();

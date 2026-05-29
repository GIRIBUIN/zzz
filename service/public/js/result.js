// service/public/result.js

const pageStatus = document.getElementById("pageStatus");

function setText(elementId, value) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.textContent = value ?? "-";
}

function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "-";
  return Number.isInteger(score) ? `${score}점` : `${score.toFixed(1)}점`;
}

function setProgress(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  const score = Number(value);
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  element.style.setProperty("--value", `${safe}%`);
}

function setRing(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  const score = Number(value);
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  element.style.setProperty("--value", safe);
}

function renderPageStatus(message, type = "default") {
  if (!pageStatus) return;
  pageStatus.textContent = message;
  pageStatus.classList.toggle("is-visible", Boolean(message));
  pageStatus.classList.toggle("is-error", type === "error");
}

function clearPageStatus() {
  if (!pageStatus) return;
  pageStatus.textContent = "";
  pageStatus.classList.remove("is-visible", "is-error");
}

function renderList(elementId, items, fallbackText = "항목 없음") {
  const list = document.getElementById(elementId);
  if (!list) return;

  list.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    const li = document.createElement("li");
    li.textContent = fallbackText;
    list.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent =
      item && typeof item === "object"
        ? item.label || item.text || item.key || JSON.stringify(item)
        : String(item);
    list.appendChild(li);
  });
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function showEmpty(cardType) {
  const empty = document.getElementById(`${cardType}Empty`);
  const fields = document.getElementById(`${cardType}Fields`);

  if (empty) empty.style.display = "block";
  if (fields) fields.style.display = "none";
}

function showFields(cardType) {
  const empty = document.getElementById(`${cardType}Empty`);
  const fields = document.getElementById(`${cardType}Fields`);

  if (empty) empty.style.display = "none";
  if (fields) fields.style.display = "grid";
}

function renderFeedbackCard(feedback) {
  if (!feedback) {
    showEmpty("feedback");
    return;
  }

  showFields("feedback");
  setText("feedbackSleepDate", feedback.sleep_date || "-");
  setText("feedbackSatisfactionScore", feedback.satisfaction_score !== undefined ? formatScore(feedback.satisfaction_score) : "-");
  setProgress("feedbackSatisfactionBar", feedback.satisfaction_score);
  setText("feedbackCreatedAt", formatDateTime(feedback.created_at));
}

function renderPredictionCard(prediction) {
  if (!prediction) {
    showEmpty("prediction");
    return;
  }

  showFields("prediction");
  setText("predictionRiskLevel", prediction.risk_level || "-");
  setText("predictionRiskScore", prediction.risk_score !== undefined ? formatScore(prediction.risk_score) : "-");
  setProgress("predictionRiskBar", prediction.risk_score);

  renderList(
    "predictionReasons",
    prediction.reasons || parseJsonArray(prediction.reasons_json),
    "이유 없음"
  );
  setText("predictionActionText", prediction.action_text || "-");
}

function renderSleepScoreCard(score) {
  if (!score) {
    showEmpty("sleepScore");
    return;
  }

  showFields("sleepScore");
  setText("sleepScoreTotal", score.total_score !== undefined ? formatScore(score.total_score).replace("점", "") : "-");
  setRing("sleepScoreRing", score.total_score);
  setText("sleepScoreTimeAsleep", score.time_asleep_score !== undefined ? formatScore(score.time_asleep_score).replace("점", "") : "-");
  setText("sleepScoreDeepRem", score.deep_rem_score !== undefined ? formatScore(score.deep_rem_score).replace("점", "") : "-");
  setText("sleepScoreRestoration", score.restoration_score !== undefined ? formatScore(score.restoration_score).replace("점", "") : "-");
}

function renderAnalysisCard(analysis) {
  if (!analysis) {
    showEmpty("analysis");
    return;
  }

  showFields("analysis");
  renderList(
    "analysisCauses",
    analysis.causes || parseJsonArray(analysis.causes_json),
    "원인 없음"
  );
  setText("analysisText", analysis.analysis_text || "-");
}

async function loadLatestResult() {
  const user = window.ZZZAuth.requirePageUser({
    statusElement: pageStatus,
    message: "로그인 후 최신 결과를 조회할 수 있습니다."
  });
  if (!user) {
    showEmpty("feedback");
    showEmpty("prediction");
    showEmpty("sleepScore");
    showEmpty("analysis");
    return;
  }

  try {
    const response = await fetch(window.ZZZAuth.resultLatestUrl(user));
    const result = await response.json();

    if (result.status !== "ok") throw new Error(result.message || "최신 결과 조회 실패");

    const data = result.data || {};

    renderFeedbackCard(data.latest_feedback || null);
    renderPredictionCard(data.latest_prediction || null);
    renderSleepScoreCard(data.latest_sleep_score || null);
    renderAnalysisCard(data.latest_analysis || null);

    clearPageStatus();
  } catch (error) {
    renderPageStatus(`결과를 불러오지 못했습니다. (${error.message})`, "error");

    showEmpty("feedback");
    showEmpty("prediction");
    showEmpty("sleepScore");
    showEmpty("analysis");
  }
}

window.addEventListener("DOMContentLoaded", loadLatestResult);

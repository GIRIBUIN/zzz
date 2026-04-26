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
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function renderPageStatus(message, type = "default") {
  pageStatus.textContent = message;

  if (type === "error") {
    pageStatus.style.color = "#ff4e00";
  } else {
    pageStatus.style.color = "#727477";
  }
}

function clearPageStatus() {
  pageStatus.textContent = "최신 결과를 불러왔습니다.";
  pageStatus.style.color = "#727477";
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
    li.textContent = String(item);
    list.appendChild(li);
  });
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;

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
  setText(
    "feedbackSatisfactionScore",
    feedback.satisfaction_score !== undefined
      ? `${feedback.satisfaction_score} / 100`
      : "-"
  );
  setText("feedbackCreatedAt", formatDateTime(feedback.created_at));
}

function renderPredictionCard(prediction) {
  if (!prediction) {
    showEmpty("prediction");
    return;
  }

  showFields("prediction");
  setText("predictionRiskLevel", prediction.risk_level || "-");
  setText(
    "predictionRiskScore",
    prediction.risk_score !== undefined
      ? `${prediction.risk_score} / 100`
      : "-"
  );
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
  setText(
    "sleepScoreTotal",
    score.total_score !== undefined ? `${score.total_score} / 100` : "-"
  );
  setText(
    "sleepScoreTimeAsleep",
    score.time_asleep_score !== undefined ? `${score.time_asleep_score} / 50` : "-"
  );
  setText(
    "sleepScoreDeepRem",
    score.deep_rem_score !== undefined ? `${score.deep_rem_score} / 25` : "-"
  );
  setText(
    "sleepScoreRestoration",
    score.restoration_score !== undefined ? `${score.restoration_score} / 25` : "-"
  );
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
  renderPageStatus("불러오는 중...");

  try {
    const response = await fetch("/result/latest");
    const result = await response.json();

    if (result.status !== "ok") {
      throw new Error(result.message || "Failed to load latest result");
    }

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

// service/public/js/presleep.js

const predictionStatus = document.getElementById("predictionStatus");

const inputEmpty = document.getElementById("inputEmpty");
const inputFields = document.getElementById("inputFields");

const resultEmpty = document.getElementById("resultEmpty");
const resultFields = document.getElementById("resultFields");

const predictBtn = document.getElementById("predictBtn");

function showStatus(message, type = "default") {
  if (!predictionStatus) return;
  predictionStatus.textContent = message;
  predictionStatus.classList.toggle("is-visible", Boolean(message));
  predictionStatus.classList.toggle("is-error", type === "error");
}

function hideStatus() {
  if (!predictionStatus) return;
  predictionStatus.textContent = "";
  predictionStatus.classList.remove("is-visible", "is-error");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = value ?? "-";
}

function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "-";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function setProgress(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  const score = Number(value);
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  element.style.setProperty("--value", `${safe}%`);
}

function renderList(id, items, fallbackText = "항목 없음") {
  const list = document.getElementById(id);
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

function showInputEmpty(message = "아직 저장된 예측 입력 데이터가 없습니다.") {
  inputEmpty.style.display = "block";
  inputEmpty.textContent = message;
  inputFields.style.display = "none";
}

function showInputFields() {
  inputEmpty.style.display = "none";
  inputFields.style.display = "grid";
}

function showResultEmpty(message = "아직 저장된 예측 결과가 없습니다.") {
  resultEmpty.style.display = "block";
  resultEmpty.textContent = message;
  resultFields.style.display = "none";
}

function showResultFields() {
  resultEmpty.style.display = "none";
  resultFields.style.display = "grid";
}

function parseSnapshot(snapshotValue) {
  if (!snapshotValue) return null;
  if (typeof snapshotValue === "object") return snapshotValue;
  if (typeof snapshotValue === "string") {
    try { return JSON.parse(snapshotValue); } catch { return null; }
  }
  return null;
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

function formatUnit(value, unit, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const text = Number.isInteger(number) ? String(number) : number.toFixed(digits);
  return `${text}${unit}`;
}

function renderPredictionInputs(snapshot) {
  if (!snapshot) {
    showInputEmpty();
    return;
  }

  showInputFields();
  setText("inputUserId", snapshot.user_id || "user-01");
  setText("inputAvgHr", formatUnit(snapshot.avg_hr_1h, " bpm", 1));
  setText("inputStepsSum", formatUnit(snapshot.steps_sum_1h, "걸음", 0));
  setText("inputCaloriesSum", formatUnit(snapshot.calories_sum_1h, " kcal", 0));
  setText("inputAvgTemp", formatUnit(snapshot.avg_temp_1h, "°C", 1));
  setText("inputAvgHumidity", formatUnit(snapshot.avg_humidity_1h, "%", 1));
  setText("inputAvgMq5", snapshot.avg_mq5_index_1h !== undefined && snapshot.avg_mq5_index_1h !== null ? Number(snapshot.avg_mq5_index_1h).toFixed(2) : "-");
  setText("inputRecentAvgSleep", formatUnit(snapshot.recent_avg_sleep_minutes, "분", 1));
}

function renderPredictionResult(prediction) {
  if (!prediction) {
    showResultEmpty();
    setText("predictionTopTargetSleepDate", "-");
    return;
  }

  showResultFields();
  setText("predictionRiskLevel", prediction.risk_level || "-");
  setText("predictionRiskScore", prediction.risk_score !== undefined ? `${formatScore(prediction.risk_score)}점` : "-");
  setProgress("predictionRiskBar", prediction.risk_score);

  renderList(
    "predictionReasons",
    prediction.reasons || parseJsonArray(prediction.reasons_json),
    "이유 없음"
  );

  setText("predictionActionText", prediction.action_text || "-");
  setText("predictionTimestamp", formatDateTime(prediction.prediction_ts || prediction.created_at));
  setText("predictionTargetSleepDate", prediction.target_sleep_date || "-");
  setText("predictionTopTargetSleepDate", prediction.target_sleep_date || "-");
}

async function loadLatestPrediction() {
  const user = window.ZZZAuth.requirePageUser({
    statusElement: predictionStatus,
    disabledSelectors: ["#predictBtn", "#skipCollect"],
    message: "로그인 후 최신 예측 데이터를 조회할 수 있습니다."
  });
  if (!user) return;

  try {
    const response = await fetch(window.ZZZAuth.resultLatestUrl(user));
    const result = await response.json();

    if (result.status !== "ok") throw new Error(result.message || "최신 예측 조회 실패");

    const latestPrediction = result.data?.latest_prediction || null;

    if (!latestPrediction) {
      showInputEmpty();
      showResultEmpty();
      setText("predictionTopTargetSleepDate", "-");
      return;
    }

    const snapshot = parseSnapshot(latestPrediction.feature_snapshot_json);

    renderPredictionInputs(snapshot);
    renderPredictionResult(latestPrediction);
    hideStatus();
  } catch (error) {
    showInputEmpty("예측 입력 데이터를 불러오지 못했습니다.");
    showResultEmpty("예측 결과를 불러오지 못했습니다.");
    showStatus(`예측 데이터를 불러오지 못했습니다. (${error.message})`, "error");
  }
}

async function requestPrediction() {
  const user = window.ZZZAuth.requirePageUser({
    statusElement: predictionStatus,
    disabledSelectors: ["#predictBtn", "#skipCollect"],
    message: "로그인 후 예측을 계산할 수 있습니다."
  });
  if (!user) return;

  predictBtn.disabled = true;

  try {
    const skipCollect = document.getElementById("skipCollect").checked;
    const url = skipCollect
      ? "/predict/presleep?skip_collect=true"
      : "/predict/presleep";

    const predictResponse = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(window.ZZZAuth.withUserBody({}, user))
    });

    const predictResult = await predictResponse.json();
    if (predictResult.status !== "ok") throw new Error(predictResult.message || "예측 실패");

    const snapshot = JSON.parse(predictResult.data?.feature_snapshot_json || "{}");
    renderPredictionInputs(snapshot);
    renderPredictionResult(predictResult.data || null);
    hideStatus();
  } catch (error) {
    showStatus(`예측 실패: ${error.message}`, "error");
  } finally {
    predictBtn.disabled = false;
  }
}

window.addEventListener("DOMContentLoaded", loadLatestPrediction);
predictBtn.addEventListener("click", requestPrediction);

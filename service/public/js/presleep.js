// service/public/js/presleep.js

const predictionStatus = document.getElementById("predictionStatus");

const inputEmpty = document.getElementById("inputEmpty");
const inputFields = document.getElementById("inputFields");

const resultEmpty = document.getElementById("resultEmpty");
const resultFields = document.getElementById("resultFields");

const predictBtn = document.getElementById("predictBtn");

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = value ?? "-";
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
    li.textContent = String(item);
    list.appendChild(li);
  });
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

function showInputEmpty(message = "아직 저장된 prediction input 데이터가 없습니다.") {
  inputEmpty.style.display = "block";
  inputEmpty.textContent = message;
  inputFields.style.display = "none";
}

function showInputFields() {
  inputEmpty.style.display = "none";
  inputFields.style.display = "grid";
}

function showResultEmpty(message = "아직 저장된 prediction 결과가 없습니다.") {
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

  if (typeof snapshotValue === "object") {
    return snapshotValue;
  }

  if (typeof snapshotValue === "string") {
    try {
      return JSON.parse(snapshotValue);
    } catch (error) {
      return null;
    }
  }

  return null;
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

function renderPredictionInputs(snapshot) {
  if (!snapshot) {
    showInputEmpty();
    return;
  }

  showInputFields();
  setText("inputUserId", snapshot.user_id || "user-01");
  setText("inputAvgHr", snapshot.avg_hr_1h ?? "-");
  setText("inputStepsSum", snapshot.steps_sum_1h ?? "-");
  setText("inputCaloriesSum", snapshot.calories_sum_1h ?? "-");
  setText("inputAvgTemp", snapshot.avg_temp_1h ?? "-");
  setText("inputAvgHumidity", snapshot.avg_humidity_1h ?? "-");
  setText("inputAvgMq5", snapshot.avg_mq5_index_1h ?? "-");
  setText("inputRecentAvgSleep", snapshot.recent_avg_sleep_minutes ?? "-");
}

function renderPredictionResult(prediction) {
  if (!prediction) {
    showResultEmpty();
    return;
  }

  showResultFields();
  setText("predictionRiskLevel", prediction.risk_level || "-");
  setText(
    "predictionRiskScore",
    prediction.risk_score !== undefined ? `${prediction.risk_score} / 100` : "-"
  );

  renderList(
    "predictionReasons",
    prediction.reasons || parseJsonArray(prediction.reasons_json),
    "이유 없음"
  );

  setText("predictionActionText", prediction.action_text || "-");
  setText(
    "predictionTimestamp",
    formatDateTime(prediction.prediction_ts || prediction.created_at)
  );
  setText("predictionTargetSleepDate", prediction.target_sleep_date || "-");
}

async function loadLatestPrediction() {
  predictionStatus.textContent = "최신 prediction 데이터를 불러오는 중...";
  predictionStatus.style.color = "#727477";

  try {
    const response = await fetch("/result/latest");
    const result = await response.json();

    if (result.status !== "ok") {
      throw new Error(result.message || "Failed to load latest result");
    }

    const latestPrediction = result.data?.latest_prediction || null;

    if (!latestPrediction) {
      showInputEmpty();
      showResultEmpty();
      predictionStatus.textContent = "아직 prediction 데이터가 없습니다.";
      return;
    }

    const snapshot = parseSnapshot(latestPrediction.feature_snapshot_json);

    renderPredictionInputs(snapshot);
    renderPredictionResult(latestPrediction);

    predictionStatus.textContent = "최신 prediction 데이터를 표시했습니다.";
  } catch (error) {
    showInputEmpty("prediction input 데이터를 불러오지 못했습니다.");
    showResultEmpty("prediction 결과를 불러오지 못했습니다.");
    predictionStatus.textContent = `prediction 데이터를 불러오지 못했습니다. (${error.message})`;
    predictionStatus.style.color = "#ff4e00";
  }
}

async function requestPrediction() {
  predictionStatus.textContent = "prediction을 다시 계산하는 중...";
  predictionStatus.style.color = "#727477";

  try {
    const response = await fetch("/result/latest");
    const result = await response.json();

    if (result.status !== "ok") {
      throw new Error(result.message || "Failed to load latest result");
    }

    const latestPrediction = result.data?.latest_prediction || null;
    const snapshot = parseSnapshot(latestPrediction?.feature_snapshot_json);

    if (!snapshot) {
      throw new Error("feature snapshot이 없어 prediction을 다시 실행할 수 없습니다.");
    }

    const predictResponse = await fetch("/predict/presleep", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(snapshot)
    });

    const predictResult = await predictResponse.json();

    if (predictResult.status !== "ok") {
      throw new Error(predictResult.message || "Prediction failed");
    }

    renderPredictionInputs(snapshot);
    renderPredictionResult(predictResult.data || null);

    predictionStatus.textContent = "prediction을 다시 계산해 표시했습니다.";
  } catch (error) {
    predictionStatus.textContent = `prediction 재계산 실패: ${error.message}`;
    predictionStatus.style.color = "#ff4e00";
  }
}

window.addEventListener("DOMContentLoaded", loadLatestPrediction);
predictBtn.addEventListener("click", requestPrediction);

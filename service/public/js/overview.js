const healthStatus = document.getElementById("healthStatus");
const latestSleepScore = document.getElementById("overviewLatestScore");
const latestFeedback = document.getElementById("overviewLatestFeedback");
const latestPrediction = document.getElementById("overviewLatestPrediction");
const overviewScoreRing = document.getElementById("overviewScoreRing");
const sleepDateInput = document.getElementById("quickSleepDate");
const satisfactionScoreInput = document.getElementById("quickSatisfactionScore");
const scoreValue = document.getElementById("quickScoreValue");
const submitButton = document.getElementById("quickSubmitBtn");
const feedbackMessage = document.getElementById("quickFeedbackStatus");
const roomTemp = document.getElementById("overviewTemperature");
const roomHumidity = document.getElementById("overviewHumidity");
const roomGas = document.getElementById("overviewGasIndex");
const trendEmpty = document.getElementById("trendEmpty");
const trendChartWrap = document.getElementById("trendChartWrap");
const trendChart = document.getElementById("trendChart");
const trendLabels = document.getElementById("trendLabels");
const trendLatestScore = document.getElementById("trendLatestScore");
const trendBestScore = document.getElementById("trendBestScore");
const trendAverageScore = document.getElementById("trendAverageScore");

function showStatus(message, type = "default") {
  if (!healthStatus) return;
  healthStatus.textContent = message;
  healthStatus.classList.toggle("is-visible", Boolean(message));
  healthStatus.classList.toggle("is-error", type === "error");
}

function hideStatus() {
  if (!healthStatus) return;
  healthStatus.textContent = "";
  healthStatus.classList.remove("is-visible", "is-error");
}

function formatDateInputToday() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  sleepDateInput.value = `${yyyy}-${mm}-${dd}`;
}

function formatKoreanDateTime(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
  }).format(date);
}

function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try { return JSON.parse(value); } catch { return null; }
}

function formatScore(value, digits = 1) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "-";
  return Number.isInteger(score) ? String(score) : score.toFixed(digits);
}

function setScoreRing(value) {
  const score = Number(value);
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  overviewScoreRing?.style.setProperty("--value", safe);
}

function setMetricText(element, text, isPlaceholder = false) {
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("is-placeholder", isPlaceholder);
}

async function loadHealth() {
  try {
    const response = await fetch("/health");
    const data = await response.json();
    if (data.status === "ok") hideStatus();
    else showStatus("서버 상태를 확인하지 못했습니다.", "error");
  } catch (error) {
    showStatus(`서버 연결 오류: ${error.message}`, "error");
  }
}

function renderRoomEnvironment(environment, snapshot) {
  const source = environment || snapshot || {};
  const temp = source.temperature ?? source.avg_temp_1h;
  const humidity = source.humidity ?? source.avg_humidity_1h;
  const gas = source.mq5_index ?? source.avg_mq5_index_1h;
  setMetricText(roomTemp, temp !== undefined && temp !== null ? `${Number(temp).toFixed(1)}°C` : "데이터 없음", temp === undefined || temp === null);
  setMetricText(roomHumidity, humidity !== undefined && humidity !== null ? `${Number(humidity).toFixed(1)}%` : "데이터 없음", humidity === undefined || humidity === null);
  setMetricText(roomGas, gas !== undefined && gas !== null ? Number(gas).toFixed(2) : "데이터 없음", gas === undefined || gas === null);
}

async function loadLatestSummary() {
  const user = window.ZZZAuth.requirePageUser({
    statusElement: healthStatus,
    disabledSelectors: ["#quickSubmitBtn"],
    message: "로그인 후 사용자별 요약을 조회할 수 있습니다."
  });
  if (!user) {
    latestSleepScore.textContent = "-";
    setMetricText(latestFeedback, "로그인 후 표시", true);
    setMetricText(latestPrediction, "로그인 후 표시", true);
    setScoreRing(0);
    renderRoomEnvironment(null, null);
    return;
  }

  try {
    const response = await fetch(window.ZZZAuth.resultLatestUrl(user));
    const payload = await response.json();
    const data = payload.data || {};
    const latestScore = data.latest_sleep_score;
    const latestFb = data.latest_feedback;
    const latestPred = data.latest_prediction;

    if (latestScore?.total_score !== undefined) {
      latestSleepScore.textContent = formatScore(latestScore.total_score, 0);
      setScoreRing(latestScore.total_score);
    } else {
      latestSleepScore.textContent = "-";
      setScoreRing(0);
    }

    setMetricText(
      latestFeedback,
      latestFb?.satisfaction_score !== undefined ? `${formatScore(latestFb.satisfaction_score, 0)}점` : "데이터 없음",
      latestFb?.satisfaction_score === undefined
    );

    if (latestPred?.risk_level) {
      const riskScore = latestPred.risk_score !== undefined ? `${formatScore(latestPred.risk_score, 0)}점` : "";
      latestPrediction.classList.remove("is-placeholder");
      latestPrediction.innerHTML = riskScore
        ? `<span class="stacked-risk"><span>${latestPred.risk_level}</span><span class="risk-score-line">${riskScore}</span></span>`
        : latestPred.risk_level;
    } else {
      setMetricText(latestPrediction, "데이터 없음", true);
    }

    const snapshot = parseJsonObject(latestPred?.feature_snapshot_json);
    renderRoomEnvironment(data.latest_environment, snapshot);
  } catch (error) {
    showStatus(`요약을 불러오지 못했습니다: ${error.message}`, "error");
  }
}

function selectMood(score) {
  const safe = String(score);
  satisfactionScoreInput.value = safe;
  scoreValue.textContent = safe;
  document.querySelectorAll(".mood-option").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.score === safe);
  });
}

async function submitFeedback() {
  const user = window.ZZZAuth.requirePageUser({
    statusElement: healthStatus,
    disabledSelectors: ["#quickSubmitBtn"],
    message: "로그인 후 만족도를 저장할 수 있습니다."
  });
  if (!user) return;

  const payload = {
    user_id: user.user_id,
    sleep_date: sleepDateInput.value,
    satisfaction_score: Number(satisfactionScoreInput.value)
  };

  if (!payload.sleep_date) {
    showStatus("기상 날짜를 입력하세요.", "error");
    return;
  }

  submitButton.disabled = true;
  try {
    const response = await fetch(window.ZZZAuth.feedbackUrl(user), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.status !== "ok") throw new Error(result.message || "저장 실패");

    feedbackMessage.classList.remove("is-hidden");
    feedbackMessage.textContent = `저장 완료 · ${payload.satisfaction_score}점`;
    hideStatus();
    await loadLatestSummary();
  } catch (error) {
    showStatus(`만족도 저장 실패: ${error.message}`, "error");
  } finally {
    submitButton.disabled = false;
  }
}

function renderTrendChart(history) {
  if (!Array.isArray(history) || history.length === 0) {
    trendEmpty.style.display = "block";
    trendChartWrap.style.display = "none";
    return;
  }

  const rows = history.slice().sort((a, b) => {
    const aKey = a.sleep_date || a.created_at || "";
    const bKey = b.sleep_date || b.created_at || "";
    return String(aKey).localeCompare(String(bKey));
  });
  const scores = rows.map((row) => Number(row.total_score)).filter((value) => Number.isFinite(value));
  if (scores.length === 0) {
    trendEmpty.style.display = "block";
    trendChartWrap.style.display = "none";
    return;
  }

  trendEmpty.style.display = "none";
  trendChartWrap.style.display = "grid";

  const latest = scores[scores.length - 1];
  const best = Math.max(...scores);
  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  trendLatestScore.textContent = formatScore(latest);
  trendBestScore.textContent = formatScore(best);
  trendAverageScore.textContent = formatScore(average);

  const labels = rows.map((row) => row.sleep_date || "");
  const width = 960;
  const height = 300;
  const paddingLeft = 56;
  const paddingRight = 56;
  const paddingTop = 38;
  const paddingBottom = 52;
  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;
  const denominator = Math.max(scores.length - 1, 1);

  const points = scores.map((score, index) => {
    const x = paddingLeft + (usableWidth * index) / denominator;
    const y = paddingTop + usableHeight - (score / 100) * usableHeight;
    return { x, y, score, index };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = [`${points[0].x},${height - paddingBottom}`, ...points.map((p) => `${p.x},${p.y}`), `${points[points.length - 1].x},${height - paddingBottom}`].join(" ");
  const yTicks = [0, 50, 100];

  const gridLines = yTicks.map((tick) => {
    const y = paddingTop + usableHeight - (tick / 100) * usableHeight;
    return `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" class="trend-grid-line"></line><text x="8" y="${y + 4}" class="trend-y-label">${tick}</text>`;
  }).join("");

  const pointNodes = points.map((p) => {
    return `<circle cx="${p.x}" cy="${p.y}" r="4.5" class="trend-point"></circle><text x="${p.x}" y="${p.y - 12}" class="trend-point-label">${p.score.toFixed(0)}</text>`;
  }).join("");

  const xLabels = points.map((p) => {
    const label = labels[p.index] ? labels[p.index].slice(5) : "-";
    return `<text x="${p.x}" y="${height - 12}" class="trend-x-label">${label}</text>`;
  }).join("");

  trendChart.innerHTML = `${gridLines}<line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" class="trend-axis-line"></line><polygon points="${areaPoints}" class="trend-area"></polygon><polyline points="${linePoints}" class="trend-line"></polyline>${pointNodes}${xLabels}`;
  trendLabels.innerHTML = "";
}

async function loadSleepScoreTrend() {
  const user = window.ZZZAuth.requirePageUser({ disabledSelectors: ["#quickSubmitBtn"] });
  if (!user) {
    trendEmpty.style.display = "block";
    trendChartWrap.style.display = "none";
    trendEmpty.textContent = "로그인 후 수면 점수 그래프를 조회할 수 있습니다.";
    return;
  }

  try {
    const response = await fetch(window.ZZZAuth.sleepScoreHistoryUrl(user, 7));
    const payload = await response.json();
    renderTrendChart(payload.data?.history || []);
  } catch (error) {
    trendEmpty.style.display = "block";
    trendChartWrap.style.display = "none";
    trendEmpty.textContent = `그래프를 불러오지 못했습니다: ${error.message}`;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  formatDateInputToday();
  selectMood(60);
  loadHealth();
  loadLatestSummary();
  loadSleepScoreTrend();
});

document.querySelectorAll(".mood-option").forEach((button) => {
  button.addEventListener("click", () => selectMood(button.dataset.score));
});
submitButton.addEventListener("click", submitFeedback);

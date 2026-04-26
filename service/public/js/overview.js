const healthStatus = document.getElementById("healthStatus");
const latestSleepScore = document.getElementById("overviewLatestScore");
const latestFeedback = document.getElementById("overviewLatestFeedback");
const latestPrediction = document.getElementById("overviewLatestPrediction");

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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
}

async function loadHealth() {
  try {
    const response = await fetch("/health");
    const data = await response.json();

    if (data.status === "ok") {
      healthStatus.textContent = "서버가 정상적으로 실행 중입니다.";
    } else {
      healthStatus.textContent = "서버 상태를 확인하지 못했습니다.";
    }
  } catch (error) {
    healthStatus.textContent = `서버 연결 오류: ${error.message}`;
  }
}

async function loadLatestSummary() {
  try {
    const response = await fetch("/result/latest");
    const payload = await response.json();
    const data = payload.data || {};

    const latestScore = data.latest_sleep_score;
    const latestFb = data.latest_feedback;
    const latestPred = data.latest_prediction;

    latestSleepScore.textContent = latestScore
      ? `${latestScore.total_score} / 100`
      : "아직 데이터 없음";

    latestFeedback.textContent = latestFb
      ? `${latestFb.satisfaction_score} / 100`
      : "아직 데이터 없음";

    latestPrediction.textContent = latestPred
      ? `${latestPred.risk_level} (${latestPred.risk_score})`
      : "아직 데이터 없음";

    const snapshot = parseJsonObject(latestPred?.feature_snapshot_json);
    renderRoomEnvironment(data.latest_environment, snapshot);
  } catch (error) {
    latestSleepScore.textContent = "불러오기 실패";
    latestFeedback.textContent = "불러오기 실패";
    latestPrediction.textContent = "불러오기 실패";
    renderRoomEnvironment(null, null);
  }
}

async function submitFeedback() {
  const sleep_date = sleepDateInput.value;
  const satisfaction_score = Number(satisfactionScoreInput.value);
  const originalButtonText = submitButton.textContent;

  submitButton.disabled = true;
  submitButton.textContent = "Saving...";

  try {
    const response = await fetch("/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        sleep_date,
        satisfaction_score
      })
    });

    const payload = await response.json();
    const result = payload.data;

    if (payload.status !== "ok") {
      throw new Error(payload.message || "feedback 저장 실패");
    }

    feedbackMessage.textContent =
      `${result.message} | ${result.sleep_date} | ${result.satisfaction_score}/100 | ${formatKoreanDateTime(result.created_at)}`;

    await loadLatestSummary();
  } catch (error) {
    feedbackMessage.textContent = `오류: ${error.message}`;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
}

function renderTrendChart(history) {
  if (!history || history.length === 0) {
    trendEmpty.style.display = "block";
    trendChartWrap.style.display = "none";
    trendLatestScore.textContent = "-";
    trendBestScore.textContent = "-";
    trendAverageScore.textContent = "-";
    trendChart.innerHTML = "";
    trendLabels.innerHTML = "";
    return;
  }

  trendEmpty.style.display = "none";
  trendChartWrap.style.display = "grid";

  const width = 640;
  const height = 260;
  const paddingLeft = 32;
  const paddingRight = 22;
  const paddingTop = 20;
  const paddingBottom = 34;
  const labels = history.map((item) => item.sleep_date || "-");
  const scores = history.map((item) => Number(item.total_score ?? 0));
  const best = Math.max(...scores);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const latest = scores[scores.length - 1];
  const minScore = 0;
  const maxScore = 100;
  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;

  trendLatestScore.textContent = `${latest.toFixed(1)} / 100`;
  trendBestScore.textContent = `${best.toFixed(1)} / 100`;
  trendAverageScore.textContent = `${average.toFixed(1)} / 100`;

  const points = scores.map((score, index) => {
    const x = scores.length === 1
      ? width / 2
      : paddingLeft + (usableWidth * index) / (scores.length - 1);
    const y = paddingTop + usableHeight - (score / (maxScore - minScore || 1)) * usableHeight;
    return { x, y, score };
  });

  const polylinePoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = [
    `${points[0].x},${height - paddingBottom}`,
    ...points.map((point) => `${point.x},${point.y}`),
    `${points[points.length - 1].x},${height - paddingBottom}`
  ].join(" ");

  const yTicks = [0, 25, 50, 75, 100];
  const gridLines = yTicks.map((tick) => {
    const y = paddingTop + usableHeight - (tick / 100) * usableHeight;
    return `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" class="trend-grid-line"></line>
      <text x="0" y="${y + 4}" class="trend-y-label">${tick}</text>
    `;
  }).join("");

  const pointNodes = points.map((point) => `
    <circle cx="${point.x}" cy="${point.y}" r="4.5" class="trend-point"></circle>
    <text x="${point.x}" y="${point.y - 12}" class="trend-point-label">${point.score.toFixed(0)}</text>
  `).join("");

  trendChart.innerHTML = `
    ${gridLines}
    <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" class="trend-axis-line"></line>
    <polygon points="${areaPoints}" class="trend-area"></polygon>
    <polyline points="${polylinePoints}" class="trend-line"></polyline>
    ${pointNodes}
  `;

  trendLabels.innerHTML = labels.map(label => {
    const shortLabel = label ? label.slice(5) : "-";
    return `<span>${shortLabel}</span>`;
  }).join("");
}

async function loadSleepScoreTrend() {
  try {
    const response = await fetch("/result/sleep-score-history?limit=7");
    const payload = await response.json();
    const history = payload.data?.history || [];
    renderTrendChart(history);
  } catch (error) {
    trendEmpty.style.display = "block";
    trendChartWrap.style.display = "none";
    trendEmpty.textContent = `그래프를 불러오지 못했습니다: ${error.message}`;
    trendLatestScore.textContent = "-";
    trendBestScore.textContent = "-";
    trendAverageScore.textContent = "-";
  }
}

function initRange() {
  scoreValue.textContent = satisfactionScoreInput.value;

  satisfactionScoreInput.addEventListener("input", () => {
    scoreValue.textContent = satisfactionScoreInput.value;
  });
}

function parseJsonObject(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function renderRoomEnvironment(environment, snapshot) {
  const temperature = environment?.temperature ?? snapshot?.avg_temp_1h;
  const humidity = environment?.humidity ?? snapshot?.avg_humidity_1h;
  const gasIndex = environment?.mq5_index ?? snapshot?.avg_mq5_index_1h;

  roomTemp.textContent = temperature !== undefined && temperature !== null
    ? `${Number(temperature).toFixed(1)}°C`
    : "아직 데이터 없음";
  roomHumidity.textContent = humidity !== undefined && humidity !== null
    ? `${Number(humidity).toFixed(1)}%`
    : "아직 데이터 없음";
  roomGas.textContent = gasIndex !== undefined && gasIndex !== null
    ? Number(gasIndex).toFixed(2)
    : "아직 데이터 없음";
}

function init() {
  formatDateInputToday();
  initRange();
  renderRoomEnvironment(null, null);

  submitButton.addEventListener("click", submitFeedback);

  loadHealth();
  loadLatestSummary();
  loadSleepScoreTrend();
}

init();

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

function setScoreRing(value) {
  const score = Number(value);
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  overviewScoreRing?.style.setProperty("--value", safe);
}

async function loadHealth() {
  try {
    const response = await fetch("/health");
    const data = await response.json();
    healthStatus.textContent = data.status === "ok" ? "서버가 정상적으로 실행 중입니다." : "서버 상태를 확인하지 못했습니다.";
  } catch (error) {
    healthStatus.textContent = `서버 연결 오류: ${error.message}`;
  }
}

function renderRoomEnvironment(environment, snapshot) {
  const source = environment || snapshot || {};
  const temp = source.temperature ?? source.avg_temp_1h;
  const humidity = source.humidity ?? source.avg_humidity_1h;
  const gas = source.mq5_index ?? source.avg_mq5_index_1h;
  roomTemp.textContent = temp !== undefined && temp !== null ? `${Number(temp).toFixed(1)}°C` : "아직 데이터 없음";
  roomHumidity.textContent = humidity !== undefined && humidity !== null ? `${Number(humidity).toFixed(1)}%` : "아직 데이터 없음";
  roomGas.textContent = gas !== undefined && gas !== null ? Number(gas).toFixed(2) : "아직 데이터 없음";
}

async function loadLatestSummary() {
  const user = window.ZZZAuth.requirePageUser({
    statusElement: healthStatus,
    disabledSelectors: ["#quickSubmitBtn"],
    message: "로그인 후 사용자별 요약을 조회할 수 있습니다."
  });
  if (!user) {
    latestSleepScore.textContent = "-";
    latestFeedback.textContent = "로그인 필요";
    latestPrediction.textContent = "로그인 필요";
    setScoreRing(0);
    renderRoomEnvironment(null, null);
    return;
  }

  try {
    const response = await fetch(window.ZZZAuth.withUserQuery("/result/latest", user));
    const payload = await response.json();
    const data = payload.data || {};
    const latestScore = data.latest_sleep_score;
    const latestFb = data.latest_feedback;
    const latestPred = data.latest_prediction;

    if (latestScore) {
      latestSleepScore.textContent = Number(latestScore.total_score).toFixed(0);
      setScoreRing(latestScore.total_score);
    } else {
      latestSleepScore.textContent = "-";
      setScoreRing(0);
    }
    latestFeedback.textContent = latestFb ? `${latestFb.satisfaction_score} / 100` : "아직 데이터 없음";
    latestPrediction.textContent = latestPred ? `${latestPred.risk_level} (${latestPred.risk_score})` : "아직 데이터 없음";
    renderRoomEnvironment(data.latest_environment, parseJsonObject(latestPred?.feature_snapshot_json));
  } catch (error) {
    latestSleepScore.textContent = "-";
    latestFeedback.textContent = "불러오기 실패";
    latestPrediction.textContent = "불러오기 실패";
    setScoreRing(0);
    renderRoomEnvironment(null, null);
  }
}

async function submitFeedback() {
  const user = window.ZZZAuth.requirePageUser({
    statusElement: feedbackMessage,
    disabledSelectors: ["#quickSubmitBtn"],
    message: "로그인 후 만족도를 저장할 수 있습니다."
  });
  if (!user) return;

  const sleep_date = sleepDateInput.value;
  const satisfaction_score = Number(satisfactionScoreInput.value);
  const originalButtonText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "저장 중...";

  try {
    const response = await fetch("/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.user_id, sleep_date, satisfaction_score })
    });
    const payload = await response.json();
    const result = payload.data;
    if (payload.status !== "ok") throw new Error(payload.message || "만족도 저장 실패");
    feedbackMessage.textContent = `${result.message} | ${result.sleep_date} | ${result.satisfaction_score}/100 | ${formatKoreanDateTime(result.created_at)}`;
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
  const height = 220;
  const paddingLeft = 32;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 30;
  const labels = history.map((item) => item.sleep_date || "-");
  const scores = history.map((item) => Number(item.total_score ?? 0));
  const best = Math.max(...scores);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const latest = scores[scores.length - 1];
  const usableWidth = width - paddingLeft - paddingRight;
  const usableHeight = height - paddingTop - paddingBottom;

  trendLatestScore.textContent = `${latest.toFixed(1)} / 100`;
  trendBestScore.textContent = `${best.toFixed(1)} / 100`;
  trendAverageScore.textContent = `${average.toFixed(1)} / 100`;

  const points = scores.map((score, index) => {
    const x = scores.length === 1 ? width / 2 : paddingLeft + (usableWidth * index) / (scores.length - 1);
    const y = paddingTop + usableHeight - (score / 100) * usableHeight;
    return { x, y, score, index };
  });
  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPoints = [`${points[0].x},${height - paddingBottom}`, ...points.map((p) => `${p.x},${p.y}`), `${points[points.length - 1].x},${height - paddingBottom}`].join(" ");
  const yTicks = [0, 50, 100];
  const gridLines = yTicks.map((tick) => {
    const y = paddingTop + usableHeight - (tick / 100) * usableHeight;
    return `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" class="trend-grid-line"></line><text x="0" y="${y + 4}" class="trend-y-label">${tick}</text>`;
  }).join("");
  const bestIndex = scores.indexOf(best);
  const lastIndex = scores.length - 1;
  const pointNodes = points.map((p) => {
    const showLabel = p.index === bestIndex || p.index === lastIndex;
    return `<circle cx="${p.x}" cy="${p.y}" r="4.5" class="trend-point"></circle>${showLabel ? `<text x="${p.x}" y="${p.y - 12}" class="trend-point-label">${p.score.toFixed(0)}</text>` : ""}`;
  }).join("");

  trendChart.innerHTML = `${gridLines}<line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" class="trend-axis-line"></line><polygon points="${areaPoints}" class="trend-area"></polygon><polyline points="${linePoints}" class="trend-line"></polyline>${pointNodes}`;
  trendLabels.innerHTML = labels.map((label) => `<span>${label ? label.slice(5) : "-"}</span>`).join("");
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
    const response = await fetch(window.ZZZAuth.withUserQuery("/result/sleep-score-history?limit=7", user));
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
  loadHealth();
  loadLatestSummary();
  loadSleepScoreTrend();
  scoreValue.textContent = satisfactionScoreInput.value;
});
satisfactionScoreInput.addEventListener("input", () => { scoreValue.textContent = satisfactionScoreInput.value; });
submitButton.addEventListener("click", submitFeedback);

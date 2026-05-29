// service/public/js/postsleep.js

const feedbackStatus = document.getElementById("feedbackStatus");

const sleepDate = document.getElementById("sleepDate");
const satisfactionScore = document.getElementById("satisfactionScore");
const scoreValue = document.getElementById("scoreValue");
const submitBtn = document.getElementById("submitBtn");

const saveResultEmpty = document.getElementById("saveResultEmpty");
const saveResultFields = document.getElementById("saveResultFields");

function showStatus(message, type = "default") {
  if (!feedbackStatus) return;
  feedbackStatus.textContent = message;
  feedbackStatus.classList.toggle("is-visible", Boolean(message));
  feedbackStatus.classList.toggle("is-error", type === "error");
}

function hideStatus() {
  if (!feedbackStatus) return;
  feedbackStatus.textContent = "";
  feedbackStatus.classList.remove("is-visible", "is-error");
}

function formatDateInputToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = value ?? "-";
}

function formatScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return "-";
  return Number.isInteger(score) ? `${score}점` : `${score.toFixed(1)}점`;
}

function updateScoreValue() {
  scoreValue.textContent = satisfactionScore.value;
}

function setProgress(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  const score = Number(value);
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
  element.style.setProperty("--value", `${safe}%`);
}

function showSaveResultEmpty(message = "아직 저장 요청을 실행하지 않았습니다.") {
  saveResultEmpty.style.display = "block";
  saveResultEmpty.textContent = message;
  saveResultFields.style.display = "none";
}

function showSaveResultFields() {
  saveResultEmpty.style.display = "none";
  saveResultFields.style.display = "grid";
}

function renderSaveResult(data) {
  showSaveResultFields();

  const action = data.action || "-";
  let actionLabel = "저장됨";
  if (action === "update") actionLabel = "수정";
  if (action === "no_change") actionLabel = "변경 없음";

  setText("saveAction", actionLabel);
  setText("savedSleepDate", data.sleep_date || "-");
  setText("savedSatisfactionScore", data.satisfaction_score !== undefined ? formatScore(data.satisfaction_score) : "-");
  setProgress("savedSatisfactionBar", data.satisfaction_score);
  setText("savedCreatedAt", formatDateTime(data.created_at));
}

async function submitFeedback() {
  const user = window.ZZZAuth.requirePageUser({
    statusElement: feedbackStatus,
    disabledSelectors: ["#submitBtn"],
    message: "로그인 후 만족도를 저장할 수 있습니다."
  });
  if (!user) return;

  const payload = {
    user_id: user.user_id,
    sleep_date: sleepDate.value,
    satisfaction_score: Number(satisfactionScore.value)
  };

  if (!payload.sleep_date) {
    showStatus("기상 날짜를 입력하세요.", "error");
    return;
  }

  if (Number.isNaN(payload.satisfaction_score)) {
    showStatus("만족도 점수를 입력하세요.", "error");
    return;
  }

  if (payload.satisfaction_score < 0 || payload.satisfaction_score > 100) {
    showStatus("만족도는 0~100 사이여야 합니다.", "error");
    return;
  }

  submitBtn.disabled = true;

  try {
    const response = await fetch("/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (result.status !== "ok") throw new Error(result.message || "만족도 저장 실패");

    renderSaveResult(result.data || {});
    hideStatus();
  } catch (error) {
    showStatus(`만족도 저장 실패: ${error.message}`, "error");
    showSaveResultEmpty("저장 결과를 불러오지 못했습니다.");
  } finally {
    submitBtn.disabled = false;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  sleepDate.value = formatDateInputToday();
  satisfactionScore.value = "50";
  updateScoreValue();
  showSaveResultEmpty();
  window.ZZZAuth.requirePageUser({
    statusElement: feedbackStatus,
    disabledSelectors: ["#submitBtn"],
    message: "로그인 후 만족도를 저장할 수 있습니다."
  });
});

satisfactionScore.addEventListener("input", updateScoreValue);
submitBtn.addEventListener("click", submitFeedback);

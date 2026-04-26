// service/public/js/postsleep.js

const feedbackStatus = document.getElementById("feedbackStatus");

const sleepDate = document.getElementById("sleepDate");
const satisfactionScore = document.getElementById("satisfactionScore");
const scoreValue = document.getElementById("scoreValue");
const submitBtn = document.getElementById("submitBtn");

const saveResultEmpty = document.getElementById("saveResultEmpty");
const saveResultFields = document.getElementById("saveResultFields");

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

function setText(id, value) {
  const element = document.getElementById(id);
  if (!element) return;
  element.textContent = value ?? "-";
}

function updateScoreValue() {
  scoreValue.textContent = satisfactionScore.value;
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
  let actionLabel = action;

  if (action === "insert") actionLabel = "저장됨";
  if (action === "update") actionLabel = "수정됨";
  if (action === "no_change") actionLabel = "변경 없음";

  setText("saveAction", actionLabel);
  setText("savedSleepDate", data.sleep_date || "-");
  setText(
    "savedSatisfactionScore",
    data.satisfaction_score !== undefined
      ? `${data.satisfaction_score} / 100`
      : "-"
  );
  setText("savedCreatedAt", formatDateTime(data.created_at));
}

async function submitFeedback() {
  const payload = {
    sleep_date: sleepDate.value,
    satisfaction_score: Number(satisfactionScore.value)
  };

  if (!payload.sleep_date) {
    feedbackStatus.textContent = "sleep_date를 입력하세요.";
    feedbackStatus.style.color = "#ff4e00";
    return;
  }

  if (Number.isNaN(payload.satisfaction_score)) {
    feedbackStatus.textContent = "satisfaction_score를 입력하세요.";
    feedbackStatus.style.color = "#ff4e00";
    return;
  }

  if (payload.satisfaction_score < 0 || payload.satisfaction_score > 100) {
    feedbackStatus.textContent = "satisfaction_score는 0~100 사이여야 합니다.";
    feedbackStatus.style.color = "#ff4e00";
    return;
  }

  feedbackStatus.textContent = "feedback을 저장하는 중...";
  feedbackStatus.style.color = "#727477";

  try {
    const response = await fetch("/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.status !== "ok") {
      throw new Error(result.message || "Failed to save feedback");
    }

    renderSaveResult(result.data || {});

    const action = result.data?.action || "-";
    if (action === "insert") {
      feedbackStatus.textContent = "feedback을 저장했습니다.";
    } else if (action === "update") {
      feedbackStatus.textContent = "기존 feedback을 수정했습니다.";
    } else if (action === "no_change") {
      feedbackStatus.textContent = "같은 값이어서 변경 사항이 없습니다.";
    } else {
      feedbackStatus.textContent = "feedback 저장을 완료했습니다.";
    }
  } catch (error) {
    feedbackStatus.textContent = `feedback 저장 실패: ${error.message}`;
    feedbackStatus.style.color = "#ff4e00";
    showSaveResultEmpty("저장 결과를 불러오지 못했습니다.");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  sleepDate.value = formatDateInputToday();
  satisfactionScore.value = "50";
  updateScoreValue();
  showSaveResultEmpty();
});

satisfactionScore.addEventListener("input", updateScoreValue);
submitBtn.addEventListener("click", submitFeedback);
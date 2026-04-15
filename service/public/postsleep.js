const sleepDateInput = document.getElementById("sleepDate");
const satisfactionScoreInput = document.getElementById("satisfactionScore");
const submitBtn = document.getElementById("submitBtn");
const resultBox = document.getElementById("resultBox");

// 오늘 날짜 기본값 및 최대값 설정
const today = new Date().toISOString().slice(0, 10);
sleepDateInput.value = today;
sleepDateInput.max = today;

submitBtn.addEventListener("click", async () => {
  const sleep_date = sleepDateInput.value;
  const satisfaction_score = Number(satisfactionScoreInput.value);

  if (!sleep_date) {
    resultBox.textContent = "sleep_date를 입력하세요.";
    return;
  }

  if (sleep_date > today) {
    resultBox.textContent = "미래 날짜는 입력할 수 없습니다.";
    return;
  }

  if (Number.isNaN(satisfaction_score)) {
    resultBox.textContent = "satisfaction_score를 입력하세요.";
    return;
  }

  if (satisfaction_score < 0 || satisfaction_score > 100) {
    resultBox.textContent = "satisfaction_score는 0~100 사이여야 합니다.";
    return;
  }

  resultBox.textContent = "저장 중...";

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

    const data = await response.json();
    resultBox.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    resultBox.textContent = `오류: ${error.message}`;
  }
});
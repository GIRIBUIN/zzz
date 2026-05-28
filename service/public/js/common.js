const ZZZ_AUTH_STORAGE_KEY = "zzz.currentUser";

function readCurrentUser() {
  try {
    const raw = localStorage.getItem(ZZZ_AUTH_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const userId = Number(parsed.user_id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    return {
      user_id: userId,
      login_id: parsed.login_id || `user-${userId}`
    };
  } catch (error) {
    return null;
  }
}

function saveCurrentUser(user) {
  localStorage.setItem(ZZZ_AUTH_STORAGE_KEY, JSON.stringify({
    user_id: user.user_id,
    login_id: user.login_id
  }));
}

function clearCurrentUser() {
  localStorage.removeItem(ZZZ_AUTH_STORAGE_KEY);
}

function requireCurrentUser() {
  const user = readCurrentUser();

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user;
}

function withUserQuery(url, user = requireCurrentUser()) {
  const nextUrl = new URL(url, window.location.origin);
  nextUrl.searchParams.set("user_id", user.user_id);
  return `${nextUrl.pathname}${nextUrl.search}`;
}

function withUserBody(body = {}, user = requireCurrentUser()) {
  return {
    ...body,
    user_id: user.user_id
  };
}

async function fetchFitbitStatus(user = requireCurrentUser()) {
  const response = await fetch(withUserQuery("/fitbit/status", user));
  const payload = await response.json();

  if (payload.status !== "ok") {
    throw new Error(payload.message || "Fitbit 상태 확인 실패");
  }

  return payload.data;
}

function createAuthPanel() {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar || document.getElementById("authPanel")) return;

  const panel = document.createElement("div");
  panel.id = "authPanel";
  panel.className = "auth-panel";
  sidebar.appendChild(panel);

  renderAuthPanel();
}

function authPanelHtml(user) {
  if (!user) {
    return `
      <div class="auth-title">User</div>
      <div class="auth-form">
        <input id="authLoginId" class="input auth-input" type="text" placeholder="login_id" value="u001" />
        <input id="authPassword" class="input auth-input" type="password" placeholder="password" value="demo1234" />
        <button id="authLoginBtn" class="btn btn-primary auth-button" type="button">Login</button>
      </div>
      <div id="authMessage" class="auth-message">로그인 후 사용자별 데이터를 조회합니다.</div>
    `;
  }

  return `
    <div class="auth-title">User</div>
    <div class="auth-user">${user.login_id} <span>#${user.user_id}</span></div>
    <div id="fitbitStatus" class="auth-message">Fitbit 상태 확인 중...</div>
    <div class="auth-actions">
      <button id="fitbitConnectBtn" class="btn btn-secondary auth-button" type="button">Fitbit 연결</button>
      <button id="authLogoutBtn" class="btn btn-secondary auth-button" type="button">Logout</button>
    </div>
  `;
}

async function renderFitbitStatus(user) {
  const statusEl = document.getElementById("fitbitStatus");
  const connectBtn = document.getElementById("fitbitConnectBtn");
  if (!statusEl || !connectBtn) return;

  try {
    const status = await fetchFitbitStatus(user);
    statusEl.textContent = status.connected
      ? `Fitbit 연결됨 (${status.fitbit_user_id})`
      : "Fitbit 미연결";
    connectBtn.style.display = status.connected ? "none" : "block";
  } catch (error) {
    statusEl.textContent = `Fitbit 상태 확인 실패: ${error.message}`;
    connectBtn.style.display = "block";
  }
}

function renderAuthPanel() {
  const panel = document.getElementById("authPanel");
  if (!panel) return;

  const user = readCurrentUser();
  panel.innerHTML = authPanelHtml(user);

  if (!user) {
    const loginBtn = document.getElementById("authLoginBtn");
    const messageEl = document.getElementById("authMessage");

    loginBtn?.addEventListener("click", async () => {
      const login_id = document.getElementById("authLoginId")?.value || "";
      const password = document.getElementById("authPassword")?.value || "";
      loginBtn.disabled = true;
      messageEl.textContent = "로그인 중...";

      try {
        const response = await fetch("/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login_id, password })
        });
        const payload = await response.json();

        if (payload.status !== "ok") {
          throw new Error(payload.message || "로그인 실패");
        }

        saveCurrentUser(payload.data);
        window.location.reload();
      } catch (error) {
        messageEl.textContent = `로그인 실패: ${error.message}`;
      } finally {
        loginBtn.disabled = false;
      }
    });
    return;
  }

  document.getElementById("authLogoutBtn")?.addEventListener("click", () => {
    clearCurrentUser();
    window.location.reload();
  });

  document.getElementById("fitbitConnectBtn")?.addEventListener("click", () => {
    window.location.href = withUserQuery("/fitbit/connect", user);
  });

  renderFitbitStatus(user);
}

window.ZZZAuth = {
  getUser: readCurrentUser,
  requireUser: requireCurrentUser,
  withUserQuery,
  withUserBody,
  fetchFitbitStatus
};

window.addEventListener("DOMContentLoaded", createAuthPanel);

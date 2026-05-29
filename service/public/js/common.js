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

function removeUserIdQueryParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("user_id")) return;

  url.searchParams.delete("user_id");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
}

function syncUserQueryParam() {
  removeUserIdQueryParam();
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

function requirePageUser(options = {}) {
  const user = readCurrentUser();
  const statusElement = options.statusElement || null;
  const disabledSelectors = options.disabledSelectors || [];
  const message = options.message || "로그인 후 사용자별 데이터를 조회합니다.";

  disabledSelectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.disabled = !user;
    });
  });

  if (!user && statusElement) {
    statusElement.textContent = message;
    statusElement.style.color = "#ff4e00";
  }

  return user;
}

function cleanupGoogleHealthQueryParams() {
  const url = new URL(window.location.href);
  const keys = ["google_health_connected", "google_health_error", "google_health_disconnected"];
  let changed = false;

  keys.forEach((key) => {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  });

  if (changed) {
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

function googleHealthCallbackMessage() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("google_health_connected") === "1") {
    return { type: "ok", text: "Google Health 연결이 완료되었습니다." };
  }

  if (params.get("google_health_disconnected") === "1") {
    return { type: "ok", text: "Google Health 연결을 해제했습니다." };
  }

  const error = params.get("google_health_error");
  if (error) {
    return { type: "error", text: `Google Health 연결 실패: ${error}` };
  }

  return null;
}

async function fetchGoogleHealthStatus(user = requireCurrentUser()) {
  const response = await fetch(withUserQuery("/google-health/status", user));
  const payload = await response.json();

  if (payload.status !== "ok") {
    throw new Error(payload.message || "Google Health 상태 확인 실패");
  }

  return payload.data;
}

async function disconnectGoogleHealth(user = requireCurrentUser()) {
  const response = await fetch("/google-health/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withUserBody({}, user))
  });
  const payload = await response.json();

  if (payload.status !== "ok") {
    throw new Error(payload.message || "Google Health 연결 해제 실패");
  }

  return payload.data;
}

function createAuthPanel() {
  const pageHeader = document.querySelector(".page-header");
  if (!pageHeader || document.getElementById("authPanel")) return;

  const pageTitle = pageHeader.querySelector(".page-title");
  const shell = document.createElement("div");
  shell.className = "auth-shell";

  const panel = document.createElement("div");
  panel.id = "authPanel";
  panel.className = "auth-panel";

  const notice = document.createElement("div");
  notice.id = "authNotice";
  notice.className = "auth-notice";
  notice.style.display = "none";

  shell.appendChild(panel);
  shell.appendChild(notice);
  pageHeader.insertBefore(shell, pageTitle?.nextSibling || null);

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
        <button id="authRegisterBtn" class="btn btn-secondary auth-button" type="button">Create</button>
      </div>
    `;
  }

  return `
    <div class="auth-title">User</div>
    <div class="auth-account">
      <div class="auth-user">${user.login_id} <span>#${user.user_id}</span></div>
      <div id="googleHealthStatus" class="auth-message">Google Health 상태 확인 중...</div>
    </div>
    <div class="auth-actions">
      <button id="googleHealthConnectBtn" class="btn btn-secondary auth-button" type="button">Google Health 연결</button>
      <button id="googleHealthDisconnectBtn" class="btn btn-secondary auth-button" type="button">연결 해제</button>
      <button id="authLogoutBtn" class="btn btn-secondary auth-button" type="button">Logout</button>
    </div>
  `;
}

function setAuthNotice(message, type = "default") {
  const notice = document.getElementById("authNotice");
  if (!notice) return;

  if (!message) {
    notice.style.display = "none";
    notice.textContent = "";
    return;
  }

  notice.style.display = "block";
  notice.textContent = message;
  notice.className = `auth-notice ${type === "error" ? "auth-notice-error" : ""}`;
}

async function renderGoogleHealthStatus(user) {
  const statusEl = document.getElementById("googleHealthStatus");
  const connectBtn = document.getElementById("googleHealthConnectBtn");
  const disconnectBtn = document.getElementById("googleHealthDisconnectBtn");
  if (!statusEl || !connectBtn || !disconnectBtn) return;

  const callbackMessage = googleHealthCallbackMessage();
  if (callbackMessage) {
    setAuthNotice(callbackMessage.text, callbackMessage.type === "error" ? "error" : "default");
    cleanupGoogleHealthQueryParams();
  }

  try {
    const status = await fetchGoogleHealthStatus(user);
    const expiresText = status.token_expires_at
      ? ` · 만료 ${String(status.token_expires_at).slice(0, 16)}`
      : "";

    if (!callbackMessage) {
      statusEl.textContent = status.connected
        ? `Google Health 연결됨${expiresText}`
        : "Google Health 미연결";
      statusEl.style.color = "#727477";
    }

    connectBtn.textContent = status.connected ? "재연결" : "Google Health 연결";
    disconnectBtn.style.display = status.connected ? "block" : "none";
  } catch (error) {
    if (!callbackMessage) {
      setAuthNotice(`Google Health 상태 확인 실패: ${error.message}`, "error");
      statusEl.textContent = "Google Health 상태 확인 실패";
    }
    connectBtn.style.display = "block";
    connectBtn.textContent = "Google Health 연결";
    disconnectBtn.style.display = "none";
  }
}

function renderAuthPanel() {
  const panel = document.getElementById("authPanel");
  if (!panel) return;

  const user = readCurrentUser();
  panel.innerHTML = authPanelHtml(user);

  if (!user) {
    const loginBtn = document.getElementById("authLoginBtn");
    const registerBtn = document.getElementById("authRegisterBtn");
    setAuthNotice("URL의 user_id는 로그인으로 사용하지 않습니다.");

    async function submitAuth(endpoint, pendingMessage) {
      const login_id = document.getElementById("authLoginId")?.value || "";
      const password = document.getElementById("authPassword")?.value || "";
      loginBtn.disabled = true;
      registerBtn.disabled = true;
      setAuthNotice(pendingMessage);

      try {
        const response = await fetch(endpoint, {
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
        setAuthNotice(`요청 실패: ${error.message}`, "error");
      } finally {
        loginBtn.disabled = false;
        registerBtn.disabled = false;
      }
    }

    loginBtn?.addEventListener("click", () => {
      submitAuth("/auth/login", "로그인 중...");
    });

    registerBtn?.addEventListener("click", () => {
      submitAuth("/auth/register", "회원가입 중...");
    });
    return;
  }

  document.getElementById("authLogoutBtn")?.addEventListener("click", () => {
    clearCurrentUser();
    window.location.reload();
  });

  document.getElementById("googleHealthConnectBtn")?.addEventListener("click", () => {
    window.location.href = withUserQuery("/google-health/connect", user);
  });

  document.getElementById("googleHealthDisconnectBtn")?.addEventListener("click", async () => {
    const disconnectBtn = document.getElementById("googleHealthDisconnectBtn");
    const statusEl = document.getElementById("googleHealthStatus");
    disconnectBtn.disabled = true;
    statusEl.textContent = "Google Health 연결 해제 중...";
    setAuthNotice("");

    try {
      await disconnectGoogleHealth(user);
      setAuthNotice("Google Health 연결을 해제했습니다.");
      await renderGoogleHealthStatus(user);
    } catch (error) {
      setAuthNotice(`Google Health 연결 해제 실패: ${error.message}`, "error");
    } finally {
      disconnectBtn.disabled = false;
    }
  });

  renderGoogleHealthStatus(user);
}

window.ZZZAuth = {
  getUser: readCurrentUser,
  requireUser: requireCurrentUser,
  requirePageUser,
  withUserQuery,
  withUserBody,
  fetchGoogleHealthStatus,
  disconnectGoogleHealth
};

syncUserQueryParam();
window.addEventListener("DOMContentLoaded", createAuthPanel);

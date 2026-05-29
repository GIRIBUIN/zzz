const ZZZ_AUTH_STORAGE_KEY = "zzz.currentUser";

function readCurrentUser() {
  try {
    const raw = localStorage.getItem(ZZZ_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const userId = Number(parsed.user_id);
    if (!Number.isInteger(userId) || userId <= 0) return null;
    return { user_id: userId, login_id: parsed.login_id || `user-${userId}` };
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

function clearCurrentUser() { localStorage.removeItem(ZZZ_AUTH_STORAGE_KEY); }

function removeUserIdQueryParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("user_id")) return;
  url.searchParams.delete("user_id");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}
function syncUserQueryParam() { removeUserIdQueryParam(); }

function requireCurrentUser() {
  const user = readCurrentUser();
  if (!user) throw new Error("로그인이 필요합니다.");
  return user;
}

function withUserQuery(url, user = requireCurrentUser()) {
  const nextUrl = new URL(url, window.location.origin);
  nextUrl.searchParams.set("user_id", user.user_id);
  return `${nextUrl.pathname}${nextUrl.search}`;
}

function withUserBody(body = {}, user = requireCurrentUser()) {
  return { ...body, user_id: user.user_id };
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
    statusElement.style.color = "#ff5a18";
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
  if (changed) window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

function googleHealthCallbackMessage() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("google_health_connected") === "1") return { type: "ok", text: "Google Health 연결이 완료되었습니다." };
  if (params.get("google_health_disconnected") === "1") return { type: "ok", text: "Google Health 연결을 해제했습니다." };
  const error = params.get("google_health_error");
  if (error) return { type: "error", text: `Google Health 연결 실패: ${error}` };
  return null;
}

async function fetchGoogleHealthStatus(user = requireCurrentUser()) {
  const response = await fetch(withUserQuery("/google-health/status", user));
  const payload = await response.json();
  if (payload.status !== "ok") throw new Error(payload.message || "Google Health 상태 확인 실패");
  return payload.data;
}

async function disconnectGoogleHealth(user = requireCurrentUser()) {
  const response = await fetch("/google-health/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withUserBody({}, user))
  });
  const payload = await response.json();
  if (payload.status !== "ok") throw new Error(payload.message || "Google Health 연결 해제 실패");
  return payload.data;
}

function closePanel(panelId, buttonId) {
  const panel = document.getElementById(panelId);
  const button = document.getElementById(buttonId);
  panel?.classList.remove("open");
  button?.setAttribute("aria-expanded", "false");
}
function closeAllPanels() {
  closePanel("menuPanel", "menuButton");
  closePanel("accountPanel", "accountButton");
}
function togglePanel(panelId, buttonId) {
  const panel = document.getElementById(panelId);
  const button = document.getElementById(buttonId);
  if (!panel || !button) return;
  const willOpen = !panel.classList.contains("open");
  closeAllPanels();
  panel.classList.toggle("open", willOpen);
  button.setAttribute("aria-expanded", willOpen ? "true" : "false");
}

function markActiveMenu() {
  const path = window.location.pathname || "/";
  document.querySelectorAll(".menu-link").forEach((link) => {
    const itemPath = link.getAttribute("data-path");
    const active = itemPath === path || (path === "/index.html" && itemPath === "/");
    link.classList.toggle("active", active);
  });
}

function setAuthNotice(message, type = "default") {
  const notice = document.getElementById("authNotice");
  if (!notice) return;
  if (!message) {
    notice.className = "auth-notice";
    notice.textContent = "";
    return;
  }
  notice.textContent = message;
  notice.className = `auth-notice show ${type === "error" ? "auth-notice-error" : ""}`;
}

function authPanelHtml(user) {
  if (!user) {
    return `
      <div class="account-card">
        <div>
          <div class="account-name">Account</div>
          <div class="account-meta">서비스 계정으로 로그인하거나 새 계정을 만드세요.</div>
        </div>
        <div class="auth-form">
          <div class="auth-form-row">
            <input id="authLoginId" class="auth-input" type="text" placeholder="login_id" value="u001" autocomplete="username" />
            <input id="authPassword" class="auth-input" type="password" placeholder="password" value="demo1234" autocomplete="current-password" />
          </div>
          <div class="auth-actions">
            <button id="authLoginBtn" class="small-button" type="button">로그인</button>
            <button id="authRegisterBtn" class="small-button secondary" type="button">회원가입</button>
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="account-card">
      <div class="account-row">
        <div>
          <div class="account-name">${user.login_id} <span class="account-meta">#${user.user_id}</span></div>
          <div class="account-meta">현재 로그인된 사용자입니다.</div>
        </div>
      </div>
    </div>
    <div class="account-card">
      <div class="health-row">
        <div>
          <div class="health-title">Google Health</div>
          <div id="googleHealthStatus" class="health-meta">상태 확인 중...</div>
        </div>
        <span id="googleHealthBadge" class="health-badge">확인 중</span>
      </div>
      <div class="health-actions">
        <button id="googleHealthConnectBtn" class="small-button" type="button">연결</button>
        <button id="googleHealthDisconnectBtn" class="small-button secondary" type="button">연결 해제</button>
      </div>
    </div>
    <div class="auth-actions">
      <button id="authLogoutBtn" class="small-button danger" type="button">Logout</button>
    </div>
  `;
}

async function renderGoogleHealthStatus(user) {
  const statusEl = document.getElementById("googleHealthStatus");
  const badgeEl = document.getElementById("googleHealthBadge");
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
    const expiresText = status.token_expires_at ? ` · 만료 ${String(status.token_expires_at).slice(0, 16)}` : "";
    statusEl.textContent = status.connected ? `연결됨${expiresText}` : "미연결";
    if (badgeEl) {
      badgeEl.textContent = status.connected ? "Connected" : "Disconnected";
      badgeEl.className = `health-badge ${status.connected ? "connected" : "disconnected"}`;
    }
    connectBtn.textContent = status.connected ? "재연결" : "Google Health 연결";
    disconnectBtn.style.display = status.connected ? "inline-flex" : "none";
  } catch (error) {
    if (!callbackMessage) setAuthNotice(`Google Health 상태 확인 실패: ${error.message}`, "error");
    statusEl.textContent = "상태 확인 실패";
    if (badgeEl) {
      badgeEl.textContent = "Error";
      badgeEl.className = "health-badge disconnected";
    }
    connectBtn.style.display = "inline-flex";
    connectBtn.textContent = "Google Health 연결";
    disconnectBtn.style.display = "none";
  }
}

function renderAuthPanel() {
  const panel = document.getElementById("authPanel");
  const accountButton = document.getElementById("accountButton");
  if (!panel) return;

  const user = readCurrentUser();
  panel.innerHTML = authPanelHtml(user);
  if (accountButton) {
    accountButton.textContent = user ? user.login_id : "Account";
    accountButton.classList.toggle("header-button-primary", !user);
    accountButton.classList.toggle("header-button-dark", !!user);
  }

  if (!user) {
    const loginBtn = document.getElementById("authLoginBtn");
    const registerBtn = document.getElementById("authRegisterBtn");
    setAuthNotice("URL의 user_id는 로그인으로 사용하지 않습니다.");

    async function submitAuth(endpoint, pendingMessage) {
      const login_id = document.getElementById("authLoginId")?.value?.trim() || "";
      const password = document.getElementById("authPassword")?.value || "";
      if (!login_id || !password) {
        setAuthNotice("login_id와 password를 입력하세요.", "error");
        return;
      }
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
        if (payload.status !== "ok") throw new Error(payload.message || "요청 실패");
        saveCurrentUser(payload.data?.user || payload.data);
        window.location.reload();
      } catch (error) {
        setAuthNotice(`요청 실패: ${error.message}`, "error");
      } finally {
        loginBtn.disabled = false;
        registerBtn.disabled = false;
      }
    }
    loginBtn?.addEventListener("click", () => submitAuth("/auth/login", "로그인 중..."));
    registerBtn?.addEventListener("click", () => submitAuth("/auth/register", "회원가입 중..."));
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
    statusEl.textContent = "연결 해제 중...";
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

function wireHeader() {
  markActiveMenu();
  renderAuthPanel();
  document.getElementById("menuButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePanel("menuPanel", "menuButton");
  });
  document.getElementById("accountButton")?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePanel("accountPanel", "accountButton");
  });
  document.addEventListener("click", (event) => {
    const inside = event.target.closest(".header-control");
    if (!inside) closeAllPanels();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAllPanels();
  });
}

window.ZZZAuth = {
  getUser: readCurrentUser,
  requireUser: requireCurrentUser,
  requirePageUser,
  withUserQuery,
  withUserBody,
  fetchGoogleHealthStatus,
  disconnectGoogleHealth,
  renderAuthPanel
};

syncUserQueryParam();
window.addEventListener("DOMContentLoaded", wireHeader);

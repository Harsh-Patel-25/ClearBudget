// ClearBudget Auth Management Service
const Auth = {
  TOKEN_KEY: "cb_auth_token",
  USER_KEY: "cb_user_data",

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  getUser() {
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  setSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    window.location.href = "login.html";
  },

  async login(email, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Login failed");
    }
    this.setSession(data.token, data.user);
    return data;
  },

  async signup(name, email, password) {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Sign up failed");
    }
    this.setSession(data.token, data.user);
    return data;
  },

  requireAuth() {
    const isLoginPage = window.location.pathname.endsWith("login.html");
    if (!this.isLoggedIn() && !isLoginPage) {
      window.location.href = "login.html";
    }
  },

  renderUserHeader() {
    const user = this.getUser();
    if (!user) return;

    const targetHeader = document.querySelector(".app-header, .page-header, .page-header-row, .top-bar, header");
    if (targetHeader && !document.querySelector(".user-profile-badge")) {
      const badge = document.createElement("div");
      badge.className = "user-profile-badge";
      badge.innerHTML = `
        <div class="user-info-chip" title="${user.email}">
          <i class="fas fa-user-circle"></i>
          <span class="user-name">${user.name || user.email.split("@")[0]}</span>
        </div>
        <button onclick="Auth.logout()" class="btn-logout" title="Log Out">
          <i class="fas fa-sign-out-alt"></i> Logout
        </button>
      `;
      targetHeader.appendChild(badge);
    }
  }
};

// Protect page immediately
Auth.requireAuth();

document.addEventListener("DOMContentLoaded", () => {
  Auth.renderUserHeader();
});

window.Auth = Auth;

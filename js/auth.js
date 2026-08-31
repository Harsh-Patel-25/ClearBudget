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

  USERS_DB_KEY: "cb_registered_users_db",

  getLocalUsers() {
    try {
      let users = JSON.parse(localStorage.getItem(this.USERS_DB_KEY)) || [];
      if (!users.some(u => (u.email || "").toLowerCase() === "admin@clearbudget.com")) {
        users.unshift({
          id: "admin_master_1",
          name: "System Admin",
          email: "admin@clearbudget.com",
          password: "admin123",
          role: "admin",
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem(this.USERS_DB_KEY, JSON.stringify(users));
      }
      return users;
    } catch (e) {
      return [];
    }
  },

  isAdmin() {
    const user = this.getUser();
    if (!user) return false;
    return user.role === "admin" || (user.email || "").toLowerCase() === "admin@clearbudget.com";
  },

  requireAdmin() {
    return this.isAdmin();
  },

  requireAuth() {
    const isLoginPage = window.location.pathname.endsWith("login.html") || window.location.pathname.endsWith("/login");
    const isAdminPage = window.location.pathname.endsWith("admin.html") || window.location.pathname.endsWith("/admin");
    if (!this.isLoggedIn() && !isLoginPage && !isAdminPage) {
      window.location.href = "login.html";
    }
  },

  saveLocalUser(user) {
    const users = this.getLocalUsers();
    const existingIndex = users.findIndex(u => (u.email || "").toLowerCase() === (user.email || "").toLowerCase());
    if (existingIndex !== -1) {
      users[existingIndex] = { ...users[existingIndex], ...user };
    } else {
      users.push(user);
    }
    localStorage.setItem(this.USERS_DB_KEY, JSON.stringify(users));
  },

  async login(email, password) {
    const normalizedEmail = (email || "").trim().toLowerCase();

    // 1. Try Backend API first if server is running
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.token) {
          this.setSession(data.token, data.user);
          this.saveLocalUser({ ...data.user, password });
          return data;
        }
      } else if (!res.ok && contentType.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        if (data.error && (data.error.includes("Invalid") || data.error.includes("password"))) {
          throw new Error(data.error);
        }
      }
    } catch (e) {
      if (e.message && (e.message.includes("Invalid") || e.message.includes("password"))) {
        throw e;
      }
      console.warn("Backend API unavailable or static hosting mode. Checking local store fallback:", e.message);
    }

    // 2. Offline / Netlify Static Fallback Authentication
    const localUsers = this.getLocalUsers();
    const user = localUsers.find(u => (u.email || "").toLowerCase() === normalizedEmail);
    if (user && user.password === password) {
      const userObj = { id: user.id || "local_" + Date.now(), name: user.name || normalizedEmail.split("@")[0], email: user.email, role: user.role || (normalizedEmail === "admin@clearbudget.com" ? "admin" : "user") };
      const localToken = "local_token_" + btoa(user.email);
      this.setSession(localToken, userObj);
      return { token: localToken, user: userObj };
    }

    if (user && user.password !== password) {
      throw new Error("Invalid email or password.");
    }

    throw new Error("Invalid email or password. Please check your credentials or click 'Create Account'.");
  },

  async signup(name, email, password) {
    const normalizedEmail = (email || "").trim().toLowerCase();
    const normalizedName = (name || "").trim();

    // 1. Try Backend API first if server is running
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalizedName, email: normalizedEmail, password }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.token) {
          this.setSession(data.token, data.user);
          this.saveLocalUser({ ...data.user, password });
          return data;
        }
      } else if (!res.ok && contentType.includes("application/json")) {
        const data = await res.json().catch(() => ({}));
        if (data.error) throw new Error(data.error);
      }
    } catch (e) {
      if (e.message && (e.message.includes("already exists") || e.message.includes("Password must"))) {
        throw e;
      }
      console.warn("Backend API unavailable or static hosting mode. Registering locally:", e.message);
    }

    // 2. Offline / Netlify Static Fallback Signup
    const localUsers = this.getLocalUsers();
    if (localUsers.some(u => (u.email || "").toLowerCase() === normalizedEmail)) {
      throw new Error("An account with this email already exists.");
    }

    const newLocalUser = {
      id: "usr_" + Date.now() + Math.random().toString(36).substr(2, 5),
      name: normalizedName,
      email: normalizedEmail,
      password: password,
      role: normalizedEmail === "admin@clearbudget.com" ? "admin" : "user",
    };
    this.saveLocalUser(newLocalUser);

    const userObj = { id: newLocalUser.id, name: newLocalUser.name, email: newLocalUser.email, role: newLocalUser.role };
    const localToken = "local_token_" + btoa(newLocalUser.email);
    this.setSession(localToken, userObj);
    return { token: localToken, user: userObj };
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
        ${this.isAdmin() ? `
          <a href="admin.html" class="btn-secondary" style="padding:4px 10px; font-size:0.75rem; font-weight:600; border-color:var(--primary); color:var(--primary);" title="Admin Dashboard">
            <i class="fas fa-user-shield"></i> Admin
          </a>
        ` : ''}
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

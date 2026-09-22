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
    const isLoginPage = window.location.pathname.endsWith("login.html") || window.location.pathname.endsWith("/login");
    if (isLoginPage) return;

    let topNav = document.querySelector(".top-navbar");
    if (!topNav) {
      topNav = document.createElement("header");
      topNav.className = "top-navbar";
      topNav.innerHTML = `
        <div class="top-nav-inner">
          <a href="index.html" class="nav-brand" title="ClearBudget Home">
            <i class="fas fa-wallet brand-icon"></i>
            <span class="brand-text">Clear<span class="text-gradient">Budget</span></span>
          </a>
          <div class="nav-profile-slot"></div>
        </div>
      `;
      if (document.body) {
        document.body.prepend(topNav);
      }
    }

    const user = this.getUser();
    if (!user) return;

    const profileSlot = topNav.querySelector(".nav-profile-slot");
    if (profileSlot && !profileSlot.querySelector(".user-profile-dropdown-wrapper")) {
      if (!profileSlot.querySelector(".nav-calendar-btn")) {
        const calBtn = document.createElement("a");
        calBtn.href = "transaction.html?view=calendar";
        calBtn.className = "nav-calendar-btn";
        calBtn.id = "navCalendarBtn";
        calBtn.title = "Calendar View";
        calBtn.setAttribute("aria-label", "Calendar View");
        calBtn.innerHTML = `<i class="fas fa-calendar-alt"></i>`;
        profileSlot.appendChild(calBtn);
      }

      const wrapper = document.createElement("div");
      wrapper.className = "user-profile-dropdown-wrapper";

      const displayName = user.name || (user.email ? user.email.split("@")[0] : "User");
      const savedAvatar = localStorage.getItem('cb_avatar') || '';
      const avatarBtnHtml = savedAvatar
        ? `<img src="${savedAvatar}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/><i class="fas fa-user-circle" style="display:none;"></i>`
        : `<i class="fas fa-user-circle"></i>`;
      const avatarLargeHtml = savedAvatar
        ? `<img src="${savedAvatar}" alt="${displayName}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/><i class="fas fa-user-circle" style="display:none;"></i>`
        : `<i class="fas fa-user-circle"></i>`;

      wrapper.innerHTML = `
        <button type="button" class="profile-icon-btn" id="userProfileBtn" aria-label="User Profile Menu" aria-expanded="false" title="${displayName}">
          ${avatarBtnHtml}
        </button>
        <div class="profile-dropdown-menu" id="userProfileMenu" aria-hidden="true">
          <div class="profile-menu-header">
            <div class="profile-avatar-large">
              ${avatarLargeHtml}
            </div>
            <div class="profile-menu-user-details">
              <div class="profile-menu-name">${displayName}</div>
              <div class="profile-menu-email">${user.email || ''}</div>
              ${this.isAdmin() ? `
                <span class="profile-admin-badge"><i class="fas fa-user-shield"></i> Admin</span>
              ` : ''}
            </div>
          </div>
          <div class="profile-menu-divider"></div>
          <div class="profile-menu-actions">
            ${this.isAdmin() ? `
              <a href="admin.html" class="profile-menu-item">
                <i class="fas fa-user-shield"></i>
                <span>Admin Dashboard</span>
              </a>
            ` : ''}
            <a href="setting.html" class="profile-menu-item">
              <i class="fas fa-cog"></i>
              <span>Settings</span>
            </a>
            <button type="button" onclick="Auth.logout()" class="profile-menu-item logout-item">
              <i class="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      `;

      profileSlot.appendChild(wrapper);

      const btn = wrapper.querySelector('#userProfileBtn');
      const menu = wrapper.querySelector('#userProfileMenu');

      if (btn && menu) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isOpen = menu.classList.toggle('show');
          btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        });

        document.addEventListener('click', (e) => {
          if (!wrapper.contains(e.target)) {
            menu.classList.remove('show');
            btn.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
          }
        });

        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && menu.classList.contains('show')) {
            menu.classList.remove('show');
            btn.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
            btn.focus();
          }
        });
      }
    }
  }
};

// Protect page immediately
Auth.requireAuth();

// Global Smooth Page Navigation Handler
document.addEventListener("DOMContentLoaded", () => {
  Auth.renderUserHeader();

  // Intercept internal link clicks for smooth fade transitions
  document.body.addEventListener("click", (e) => {
    const anchor = e.target.closest("a");
    if (!anchor) return;
    
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:") || anchor.getAttribute("target") === "_blank") {
      return;
    }

    // Check if it's an internal html link or page
    if (href.endsWith(".html") || href.includes(".html?") || (!href.includes("://") && !href.startsWith("//"))) {
      e.preventDefault();
      const targetUrl = anchor.href;

      // Don't transition if already on target URL
      if (window.location.href === targetUrl) return;

      const mainContainer = document.querySelector(".fade-in") || document.body;
      mainContainer.classList.add("page-exit");

      setTimeout(() => {
        window.location.href = targetUrl;
      }, 140);
    }
  });
});

window.Auth = Auth;

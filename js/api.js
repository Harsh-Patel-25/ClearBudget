// ClearBudget API Service Client with Authorization & User Isolation
const API_BASE = "/api";
const TIMEOUT_MS = 3000;

function getUserStorageKey(key) {
  const user = window.Auth ? window.Auth.getUser() : null;
  const userId = user ? (user.id || user._id || user.email) : "guest";
  return `${key}_${userId}`;
}

async function fetchWithTimeout(resource, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  const headers = { ...options.headers };
  const token = window.Auth ? window.Auth.getToken() : null;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(resource, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.status === 401 && window.location.pathname.indexOf("login.html") === -1) {
      if (window.Auth) window.Auth.logout();
    }
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

const API = {
  // Transactions
  async getTransactions() {
    const storageKey = getUserStorageKey("transactions");
    try {
      const res = await fetchWithTimeout(`${API_BASE}/transactions`);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(storageKey, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Backend fetch slow/unavailable, using local store:", e.message);
    }
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  },

  async addTransaction(tx) {
    const storageKey = getUserStorageKey("transactions");
    const local = JSON.parse(localStorage.getItem(storageKey)) || [];
    const tempId = tx.id || Date.now().toString();
    const tempTx = { ...tx, id: tempId };
    local.unshift(tempTx);
    localStorage.setItem(storageKey, JSON.stringify(local));

    try {
      const res = await fetchWithTimeout(`${API_BASE}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tx),
      });
      if (res.ok) {
        const serverTx = await res.json();
        const currentLocal = JSON.parse(localStorage.getItem(storageKey)) || [];
        const updatedLocal = currentLocal.map((item) =>
          item.id === tempId ? serverTx : item
        );
        localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
        return serverTx;
      }
    } catch (e) {
      console.warn("Backend save timeout, using optimistic local save:", e.message);
    }
    return tempTx;
  },

  async updateTransaction(id, tx) {
    const storageKey = getUserStorageKey("transactions");
    const local = JSON.parse(localStorage.getItem(storageKey)) || [];
    const index = local.findIndex((t) => String(t.id) === String(id));
    if (index !== -1) {
      local[index] = { ...local[index], ...tx };
      localStorage.setItem(storageKey, JSON.stringify(local));
    }

    try {
      const res = await fetchWithTimeout(`${API_BASE}/transactions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tx),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Backend update timeout, updated local cache:", e.message);
    }
    return local[index];
  },

  async deleteTransaction(id) {
    const storageKey = getUserStorageKey("transactions");
    const local = JSON.parse(localStorage.getItem(storageKey)) || [];
    const updated = local.filter((t) => String(t.id) !== String(id));
    localStorage.setItem(storageKey, JSON.stringify(updated));

    try {
      const res = await fetchWithTimeout(`${API_BASE}/transactions/${id}`, {
        method: "DELETE",
      });
      if (res.ok) return true;
    } catch (e) {
      console.warn("Backend delete timeout, updated local cache:", e.message);
    }
    return true;
  },

  async clearAllTransactions() {
    const storageKey = getUserStorageKey("transactions");
    localStorage.removeItem(storageKey);
    try {
      const res = await fetchWithTimeout(`${API_BASE}/transactions`, {
        method: "DELETE",
      });
      if (res.ok) return true;
    } catch (e) {
      console.warn("Backend clear timeout:", e.message);
    }
    return true;
  },

  // Friends & Debts
  async getFriends() {
    const storageKey = getUserStorageKey("friends");
    try {
      const res = await fetchWithTimeout(`${API_BASE}/friends`);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(storageKey, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Backend error fetching friends, using local fallback:", e.message);
    }
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  },

  async getDoneFriends() {
    const storageKey = getUserStorageKey("doneFriends");
    try {
      const res = await fetchWithTimeout(`${API_BASE}/friends/done`);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(storageKey, JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Backend error fetching done friends:", e.message);
    }
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  },

  async addFriend(friend) {
    const storageKey = getUserStorageKey("friends");
    const local = JSON.parse(localStorage.getItem(storageKey)) || [];
    const tempId = friend.id || Date.now().toString();
    const tempObj = { ...friend, id: tempId };
    local.unshift(tempObj);
    localStorage.setItem(storageKey, JSON.stringify(local));

    try {
      const res = await fetchWithTimeout(`${API_BASE}/friends`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(friend),
      });
      if (res.ok) {
        const newFriend = await res.json();
        const currentLocal = JSON.parse(localStorage.getItem(storageKey)) || [];
        const updatedLocal = currentLocal.map((item) =>
          item.id === tempId ? newFriend : item
        );
        localStorage.setItem(storageKey, JSON.stringify(updatedLocal));
        return newFriend;
      }
    } catch (e) {
      console.warn("Backend add friend error, using local save:", e.message);
    }
    return tempObj;
  },

  async settleFriend(id) {
    const storageKey = getUserStorageKey("friends");
    const doneKey = getUserStorageKey("doneFriends");
    const local = JSON.parse(localStorage.getItem(storageKey)) || [];
    const item = local.find((f) => String(f.id) === String(id));
    if (item) {
      item.status = "settled";
      item.settledAt = new Date();
      const updatedLocal = local.filter((f) => String(f.id) !== String(id));
      localStorage.setItem(storageKey, JSON.stringify(updatedLocal));

      const doneLocal = JSON.parse(localStorage.getItem(doneKey)) || [];
      doneLocal.unshift(item);
      localStorage.setItem(doneKey, JSON.stringify(doneLocal));
    }

    try {
      const res = await fetchWithTimeout(`${API_BASE}/friends/${id}/settle`, {
        method: "PATCH",
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Backend settle friend timeout:", e.message);
    }
  },

  async restoreFriend(id) {
    const storageKey = getUserStorageKey("friends");
    const doneKey = getUserStorageKey("doneFriends");
    const doneLocal = JSON.parse(localStorage.getItem(doneKey)) || [];
    const item = doneLocal.find((f) => String(f.id) === String(id));
    if (item) {
      item.status = "active";
      delete item.settledAt;
      const updatedDone = doneLocal.filter((f) => String(f.id) !== String(id));
      localStorage.setItem(doneKey, JSON.stringify(updatedDone));

      const friendsLocal = JSON.parse(localStorage.getItem(storageKey)) || [];
      friendsLocal.unshift(item);
      localStorage.setItem(storageKey, JSON.stringify(friendsLocal));
    }

    try {
      const res = await fetchWithTimeout(`${API_BASE}/friends/${id}/restore`, {
        method: "PATCH",
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Backend restore friend timeout:", e.message);
    }
  },


  async deleteFriend(id) {
    const doneKey = getUserStorageKey("doneFriends");
    const friendsKey = getUserStorageKey("friends");
    
    const localDone = JSON.parse(localStorage.getItem(doneKey)) || [];
    const updatedDone = localDone.filter((f) => String(f.id) !== String(id));
    localStorage.setItem(doneKey, JSON.stringify(updatedDone));

    const localFriends = JSON.parse(localStorage.getItem(friendsKey)) || [];
    const updatedFriends = localFriends.filter((f) => String(f.id) !== String(id));
    localStorage.setItem(friendsKey, JSON.stringify(updatedFriends));

    try {
      const res = await fetchWithTimeout(`${API_BASE}/friends/${id}`, {
        method: "DELETE",
      });
      if (res.ok) return true;
    } catch (e) {
      console.warn("Backend delete friend timeout:", e.message);
    }
    return true;
  },

  async clearDoneFriends() {
    const doneKey = getUserStorageKey("doneFriends");
    localStorage.removeItem(doneKey);
    try {
      const res = await fetchWithTimeout(`${API_BASE}/friends/done/all`, {
        method: "DELETE",
      });
      if (res.ok) return true;
    } catch (e) {
      console.warn("Backend clear done friends timeout:", e.message);
    }
    return true;
  },

  // Admin API Methods
  async adminGetStats() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/admin/stats`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend admin stats timeout, calculating local fallback stats:", e.message);
    }

    // Local Fallback Stats
    const users = window.Auth ? window.Auth.getLocalUsers() : [];
    let totalTxCount = 0;
    let totalVol = 0;
    let totalFriendsCount = 0;

    users.forEach((u) => {
      const uId = u.id || u.email;
      const txs = JSON.parse(localStorage.getItem(`transactions_${uId}`)) || [];
      const fds = JSON.parse(localStorage.getItem(`friends_${uId}`)) || [];
      totalTxCount += txs.length;
      totalFriendsCount += fds.length;
      totalVol += txs.reduce((acc, t) => acc + Math.abs(t.amount || 0), 0);
    });

    return {
      totalUsers: users.length,
      totalTransactions: totalTxCount,
      totalFriends: totalFriendsCount,
      totalVolume: totalVol,
      dbStatus: "Static Netlify Storage",
      serverUptime: 0,
    };
  },

  async adminGetUsers() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/admin/users`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend admin users timeout, using local store fallback:", e.message);
    }

    const users = window.Auth ? window.Auth.getLocalUsers() : [];
    return users.map((u) => {
      const uId = u.id || u.email;
      const txs = JSON.parse(localStorage.getItem(`transactions_${uId}`)) || [];
      return {
        id: uId,
        name: u.name || "User",
        email: u.email,
        role: u.role || (u.email === "admin@clearbudget.com" ? "admin" : "user"),
        createdAt: u.createdAt || new Date(),
        transactionCount: txs.length,
      };
    });
  },

  async adminDeleteUser(id) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend delete user timeout:", e.message);
    }

    // Local Store Delete
    const usersKey = "cb_registered_users_db";
    const users = JSON.parse(localStorage.getItem(usersKey)) || [];
    const updatedUsers = users.filter((u) => String(u.id || u.email) !== String(id));
    localStorage.setItem(usersKey, JSON.stringify(updatedUsers));
    localStorage.removeItem(`transactions_${id}`);
    localStorage.removeItem(`friends_${id}`);
    localStorage.removeItem(`doneFriends_${id}`);
    return { message: "User deleted from local store" };
  },

  async adminUpdateUserRole(id, role) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/admin/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend update role timeout:", e.message);
    }

    const usersKey = "cb_registered_users_db";
    const users = JSON.parse(localStorage.getItem(usersKey)) || [];
    const index = users.findIndex((u) => String(u.id || u.email) === String(id));
    if (index !== -1) {
      users[index].role = role;
      localStorage.setItem(usersKey, JSON.stringify(users));
      return users[index];
    }
    return { id, role };
  },

  async adminGetTransactions() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/admin/transactions`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend admin transactions timeout, retrieving all local transactions:", e.message);
    }

    const users = window.Auth ? window.Auth.getLocalUsers() : [];
    const allTxs = [];
    users.forEach((u) => {
      const uId = u.id || u.email;
      const txs = JSON.parse(localStorage.getItem(`transactions_${uId}`)) || [];
      txs.forEach((t) => {
        allTxs.push({
          ...t,
          userName: u.name,
          userEmail: u.email,
        });
      });
    });
    return allTxs;
  },

  async adminDeleteTransaction(id) {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/admin/transactions/${id}`, { method: "DELETE" });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend delete transaction timeout:", e.message);
    }
    return { message: "Transaction purged" };
  },

  async adminGetExport() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/admin/export`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Backend export timeout, gathering local backup:", e.message);
    }

    const users = window.Auth ? window.Auth.getLocalUsers() : [];
    const allTxs = [];
    const allFriends = [];
    users.forEach((u) => {
      const uId = u.id || u.email;
      const txs = JSON.parse(localStorage.getItem(`transactions_${uId}`)) || [];
      const fds = JSON.parse(localStorage.getItem(`friends_${uId}`)) || [];
      allTxs.push(...txs);
      allFriends.push(...fds);
    });

    return {
      exportedAt: new Date().toISOString(),
      mode: "Static Local Backup",
      users,
      transactions: allTxs,
      friends: allFriends,
    };
  },
};

// Export to global scope
window.API = API;


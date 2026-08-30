// ClearBudget API Service Client
const API_BASE = "/api";
const TIMEOUT_MS = 2500; // 2.5 second timeout to guarantee fast response

async function fetchWithTimeout(resource, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

const API = {
  // Transactions
  async getTransactions() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/transactions`);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("transactions", JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Backend fetch slow/unavailable, using local store:", e.message);
    }
    return JSON.parse(localStorage.getItem("transactions")) || [];
  },

  async addTransaction(tx) {
    // Optimistic local save
    const local = JSON.parse(localStorage.getItem("transactions")) || [];
    const tempId = tx.id || Date.now().toString();
    const tempTx = { ...tx, id: tempId };
    local.unshift(tempTx);
    localStorage.setItem("transactions", JSON.stringify(local));

    try {
      const res = await fetchWithTimeout(`${API_BASE}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tx),
      });
      if (res.ok) {
        const serverTx = await res.json();
        // Replace temp object with server response
        const currentLocal = JSON.parse(localStorage.getItem("transactions")) || [];
        const updatedLocal = currentLocal.map((item) =>
          item.id === tempId ? serverTx : item
        );
        localStorage.setItem("transactions", JSON.stringify(updatedLocal));
        return serverTx;
      }
    } catch (e) {
      console.warn("Backend save timeout, using optimistic local save:", e.message);
    }
    return tempTx;
  },

  async updateTransaction(id, tx) {
    const local = JSON.parse(localStorage.getItem("transactions")) || [];
    const index = local.findIndex((t) => String(t.id) === String(id));
    if (index !== -1) {
      local[index] = { ...local[index], ...tx };
      localStorage.setItem("transactions", JSON.stringify(local));
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
    const local = JSON.parse(localStorage.getItem("transactions")) || [];
    const updated = local.filter((t) => String(t.id) !== String(id));
    localStorage.setItem("transactions", JSON.stringify(updated));

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
    localStorage.removeItem("transactions");
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
    try {
      const res = await fetchWithTimeout(`${API_BASE}/friends`);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("friends", JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Backend error fetching friends, using local fallback:", e.message);
    }
    return JSON.parse(localStorage.getItem("friends")) || [];
  },

  async getDoneFriends() {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/friends/done`);
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("doneFriends", JSON.stringify(data));
        return data;
      }
    } catch (e) {
      console.warn("Backend error fetching done friends:", e.message);
    }
    return JSON.parse(localStorage.getItem("doneFriends")) || [];
  },

  async addFriend(friend) {
    const local = JSON.parse(localStorage.getItem("friends")) || [];
    const tempId = friend.id || Date.now().toString();
    const tempObj = { ...friend, id: tempId };
    local.unshift(tempObj);
    localStorage.setItem("friends", JSON.stringify(local));

    try {
      const res = await fetchWithTimeout(`${API_BASE}/friends`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(friend),
      });
      if (res.ok) {
        const newFriend = await res.json();
        const currentLocal = JSON.parse(localStorage.getItem("friends")) || [];
        const updatedLocal = currentLocal.map((item) =>
          item.id === tempId ? newFriend : item
        );
        localStorage.setItem("friends", JSON.stringify(updatedLocal));
        return newFriend;
      }
    } catch (e) {
      console.warn("Backend add friend error, using local save:", e.message);
    }
    return tempObj;
  },

  async settleFriend(id) {
    const local = JSON.parse(localStorage.getItem("friends")) || [];
    const item = local.find((f) => String(f.id) === String(id));
    if (item) {
      item.status = "settled";
      item.settledAt = new Date();
      const updatedLocal = local.filter((f) => String(f.id) !== String(id));
      localStorage.setItem("friends", JSON.stringify(updatedLocal));

      const doneLocal = JSON.parse(localStorage.getItem("doneFriends")) || [];
      doneLocal.unshift(item);
      localStorage.setItem("doneFriends", JSON.stringify(doneLocal));
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

  async deleteFriend(id) {
    const localDone = JSON.parse(localStorage.getItem("doneFriends")) || [];
    const updatedDone = localDone.filter((f) => String(f.id) !== String(id));
    localStorage.setItem("doneFriends", JSON.stringify(updatedDone));

    const localFriends = JSON.parse(localStorage.getItem("friends")) || [];
    const updatedFriends = localFriends.filter((f) => String(f.id) !== String(id));
    localStorage.setItem("friends", JSON.stringify(updatedFriends));

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
    localStorage.removeItem("doneFriends");
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
};

// Export to global scope
window.API = API;

/* ========================================
   ClearBudget - Modern Toast & Confirm System
   ======================================== */

// Global Toast Notification Function
function showToast(message, type = "success", duration = 3000) {
  let toastContainer = document.getElementById("cb-toast-container");
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "cb-toast-container";
    toastContainer.className = "cb-toast-container";
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement("div");
  toast.className = `cb-toast cb-toast-${type}`;

  let iconHtml = '<i class="fas fa-check-circle"></i>';
  if (type === "error" || type === "danger") iconHtml = '<i class="fas fa-exclamation-circle"></i>';
  else if (type === "warning") iconHtml = '<i class="fas fa-exclamation-triangle"></i>';
  else if (type === "info") iconHtml = '<i class="fas fa-info-circle"></i>';

  toast.innerHTML = `
    <span class="cb-toast-icon">${iconHtml}</span>
    <span class="cb-toast-message">${message}</span>
    <button class="cb-toast-close" aria-label="Close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
  `;

  toastContainer.appendChild(toast);

  // Trigger animation frame
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Auto remove toast
  const timer = setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => {
      if (toast.parentElement) toast.remove();
    });
  }, duration);

  toast.addEventListener("click", (e) => {
    if (e.target.closest(".cb-toast-close")) {
      clearTimeout(timer);
      toast.classList.remove("show");
      if (toast.parentElement) toast.remove();
    }
  });
}

// Global Custom Confirm Dialog System
function showConfirm(options = {}) {
  return new Promise((resolve) => {
    let title = "Confirm Action";
    let message = "Are you sure you want to proceed?";
    let confirmText = "Confirm";
    let cancelText = "Cancel";
    let isDanger = true;
    let icon = "fa-exclamation-triangle";

    if (typeof options === "string") {
      message = options;
    } else if (typeof options === "object" && options !== null) {
      title = options.title || title;
      message = options.message || message;
      confirmText = options.confirmText || confirmText;
      cancelText = options.cancelText || cancelText;
      isDanger = options.isDanger !== undefined ? options.isDanger : isDanger;
      icon = options.icon || (isDanger ? "fa-exclamation-triangle" : "fa-info-circle");
    }

    const modal = document.createElement("div");
    modal.className = "cb-confirm-modal active";
    modal.innerHTML = `
      <div class="cb-confirm-dialog">
        <div class="cb-confirm-header">
          <div class="cb-confirm-icon ${isDanger ? "danger" : "info"}">
            <i class="fas ${icon}"></i>
          </div>
          <h3>${title}</h3>
        </div>
        <div class="cb-confirm-body">
          <p>${message}</p>
        </div>
        <div class="cb-confirm-actions">
          <button type="button" class="btn-secondary cb-cancel-btn">${cancelText}</button>
          <button type="button" class="${isDanger ? "btn-danger" : "btn-primary"} cb-ok-btn">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const cancelBtn = modal.querySelector(".cb-cancel-btn");
    const okBtn = modal.querySelector(".cb-ok-btn");

    function closeModal(result) {
      modal.classList.remove("active");
      setTimeout(() => {
        if (modal.parentElement) modal.remove();
      }, 250);
      resolve(result);
    }

    cancelBtn.addEventListener("click", () => closeModal(false));
    okBtn.addEventListener("click", () => closeModal(true));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal(false);
    });

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        document.removeEventListener("keydown", handleKeyDown);
        closeModal(false);
      } else if (e.key === "Enter") {
        document.removeEventListener("keydown", handleKeyDown);
        closeModal(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
  });
}

// Global Toast Object Export
window.Toast = {
  success: (msg, dur) => showToast(msg, "success", dur),
  error: (msg, dur) => showToast(msg, "error", dur),
  info: (msg, dur) => showToast(msg, "info", dur),
  warning: (msg, dur) => showToast(msg, "warning", dur),
  show: showToast,
  confirm: showConfirm,
};

window.showToast = showToast;
window.showConfirm = showConfirm;

// Modal/Popup functionality
let currentModal = null;

function showModal(title, message, type = 'info', showCancel = false) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const messageEl = document.getElementById('modal-message');
    const okBtn = document.getElementById('modal-ok');
    const cancelBtn = document.getElementById('modal-cancel');
    const closeBtn = document.getElementById('modal-close');
    
    titleEl.textContent = title;
    messageEl.innerHTML = message;
    
    // Set modal type styling
    const content = document.getElementById('modal-content');
    content.className = 'modal-content modal-' + type;
    
    // Show/hide cancel button
    if (showCancel) {
      cancelBtn.classList.remove('hidden');
    } else {
      cancelBtn.classList.add('hidden');
    }
    
    // Show modal
    overlay.classList.remove('hidden');
    
    // Event handlers
    const handleOk = () => {
      overlay.classList.add('hidden');
      cleanup();
      resolve(true);
    };
    
    const handleCancel = () => {
      overlay.classList.add('hidden');
      cleanup();
      resolve(false);
    };
    
    const cleanup = () => {
      okBtn.removeEventListener('click', handleOk);
      cancelBtn.removeEventListener('click', handleCancel);
      closeBtn.removeEventListener('click', handleCancel);
      currentModal = null;
    };
    
    okBtn.addEventListener('click', handleOk);
    cancelBtn.addEventListener('click', handleCancel);
    closeBtn.addEventListener('click', handleCancel);
    
    currentModal = { resolve, cleanup };
  });
}

function showError(title, message) {
  return showModal(title, message, 'error', false);
}

function showWarning(title, message) {
  return showModal(title, message, 'warning', false);
}

function showSuccess(title, message) {
  return showModal(title, message, 'success', false);
}

function showConfirm(title, message) {
  return showModal(title, message, 'confirm', true);
}

// Check for popup notifications from server
function checkPopups() {
  fetch('/api/popups')
    .then(res => res.json())
    .then(data => {
      if (data.popup && !currentModal) {
        const { title, message, type } = data.popup;
        showModal(title, message, type).then(() => {
          // Acknowledge popup was shown
          fetch('/api/popups/ack', { method: 'POST' });
        });
      }
    })
    .catch(() => {}); // Ignore errors
}

setInterval(checkPopups, 1000);

// Export functions for use by other scripts
window.PedModal = {
  showModal,
  showError,
  showWarning,
  showSuccess,
  showConfirm
};

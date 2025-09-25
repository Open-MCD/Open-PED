// Gift card value/status UI logic
// Polls the backend for gift card value and status and updates the UI
function updateGiftCard() {
  fetch('/api/giftcard')
    .then(res => res.json())
    .then(data => {
      document.getElementById('giftcard-value').textContent = data.value.toFixed(2);
      document.getElementById('giftcard-status').textContent = data.status;
    });
}

setInterval(updateGiftCard, 1000);
updateGiftCard();

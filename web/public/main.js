// PED Sim Web UI logic
async function pollPairingPrompt() {
  const res = await fetch('/api/pairing');
  const data = await res.json();
  if (data.code) {
    document.getElementById('idle-section').classList.add('hidden');
    document.getElementById('pairing-section').classList.remove('hidden');
    document.getElementById('pairing-code-display').textContent = data.code;
  } else {
    document.getElementById('pairing-section').classList.add('hidden');
    document.getElementById('idle-section').classList.remove('hidden');
    document.getElementById('pairing-status').textContent = '';
    document.getElementById('pairing-input').value = '';
  }
}

setInterval(pollPairingPrompt, 1000);

document.getElementById('pairing-submit').onclick = async function() {
  const input = document.getElementById('pairing-input').value.trim();
  if (!input) return;
  await fetch('/api/pairing/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input })
  });
  document.getElementById('pairing-status').textContent = 'Submitted!';
  setTimeout(() => {
    document.getElementById('pairing-status').textContent = '';
    document.getElementById('pairing-input').value = '';
  }, 1000);
};

document.getElementById('pairing-input').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    document.getElementById('pairing-submit').click();
  }
});

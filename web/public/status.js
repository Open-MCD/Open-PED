// Device status UI logic
function updateStatus() {
  fetch('/api/status')
    .then(res => res.json())
    .then(data => {
      document.getElementById('connection-status').textContent = data.connected ? 'Connected' : 'Disconnected';
      document.getElementById('session-status').textContent = data.sessionOpen ? 'Open' : 'Closed';
      document.getElementById('device-status').textContent = data.deviceBusy ? 'Busy' : 'Idle';
      document.getElementById('paired-status').textContent = data.paired ? 'Yes' : 'No';
      document.getElementById('last-command').textContent = data.lastCommand || '-';
      document.getElementById('counter').textContent = data.counter || '0';
      
      // Add color coding for status indicators
      const connectionEl = document.getElementById('connection-status');
      const sessionEl = document.getElementById('session-status');
      const deviceEl = document.getElementById('device-status');
      const pairedEl = document.getElementById('paired-status');
      
      connectionEl.className = 'status-value ' + (data.connected ? 'status-good' : 'status-error');
      sessionEl.className = 'status-value ' + (data.sessionOpen ? 'status-good' : 'status-neutral');
      deviceEl.className = 'status-value ' + (data.deviceBusy ? 'status-warning' : 'status-good');
      pairedEl.className = 'status-value ' + (data.paired ? 'status-good' : 'status-error');
    });
}

setInterval(updateStatus, 1000);
updateStatus();

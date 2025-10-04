// Transaction log UI logic
let logEntries = [];

function updateLog() {
  fetch('/api/log')
    .then(res => res.json())
    .then(data => {
      const logContainer = document.getElementById('log-entries');
      
      // Only update if new entries exist
      if (data.entries && data.entries.length !== logEntries.length) {
        logEntries = data.entries;
        // logContainer.innerHTML = '';
        
        logEntries.forEach(entry => {
          const logEntry = document.createElement('div');
          logEntry.className = 'log-entry';
          
          const timestamp = new Date(entry.timestamp).toLocaleString();
          const statusClass = getStatusClass(entry.type);
          
          logEntry.innerHTML = `
            <div class="log-header">
              <span class="log-time">${timestamp}</span>
              <span class="log-type ${statusClass}">${entry.type}</span>
            </div>
            <div class="log-content">${entry.message}</div>
            ${entry.details ? `<div class="log-details">${entry.details}</div>` : ''}
          `;
          
          // logContainer.appendChild(logEntry);
        });
        
        // Scroll to bottom to show latest entries
        // logContainer.scrollTop = logContainer.scrollHeight;
      }
    });
}

function getStatusClass(type) {
  switch(type.toLowerCase()) {
    case 'error': return 'log-error';
    case 'warning': return 'log-warning';
    case 'success': return 'log-success';
    case 'transaction': return 'log-transaction';
    default: return 'log-info';
  }
}

// Event listeners for log controls
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('clear-log')?.addEventListener('click', () => {
    fetch('/api/log/clear', { method: 'POST' })
      .then(() => {
        logEntries = [];
        document.getElementById('log-entries').innerHTML = '';
      });
  });
  
  document.getElementById('export-log')?.addEventListener('click', () => {
    const logData = logEntries.map(entry => 
      `${new Date(entry.timestamp).toISOString()} [${entry.type}] ${entry.message}${entry.details ? ' - ' + entry.details : ''}`
    ).join('\n');
    
    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ped-log-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

setInterval(updateLog, 1000);
updateLog();

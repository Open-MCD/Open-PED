// Simple Express web server for PED Sim UI
const express = require('express');
const http = require('http');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const server = http.createServer(app);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// In-memory state for pairing code prompt
let pairingPrompt = null;
let pairingResolve = null;

// In-memory gift card state (replace with real logic as needed)
let giftCard = {
  value: 0.00,
  status: 'Inactive'
};

// API: Show pairing code prompt
app.post('/api/pairing', (req, res) => {
  const { code } = req.body;
  pairingPrompt = code;
  res.json({ ok: true });
});

// API: Get current pairing prompt
app.get('/api/pairing', (req, res) => {
  res.json({ code: pairingPrompt });
});

// API: Submit pairing code
app.post('/api/pairing/submit', (req, res) => {
  const { input } = req.body;
  if (pairingResolve) pairingResolve(input);
  pairingPrompt = null;
  res.json({ ok: true });
});

// API: Get gift card value and status
app.get('/api/giftcard', (req, res) => {
  // Try to get real gift card info from main server
  try {
    const mainServer = require('../server');
    if (mainServer && mainServer.getGiftCardInfo) {
      const giftCardInfo = mainServer.getGiftCardInfo();
      res.json(giftCardInfo);
      return;
    }
  } catch (e) {
    // Fallback to mock data if main server not available
  }
  
  res.json({
    value: giftCard.value,
    status: giftCard.status
  });
});

// API: Get device/session status
app.get('/api/status', (req, res) => {
  // Get status from main server if available
  let status = {
    connected: false,
    sessionOpen: false,
    deviceBusy: false,
    paired: false,
    lastCommand: '',
    counter: 0
  };
  
  // Try to get real status from the main PED server
  try {
    const mainServer = require('../server');
    if (mainServer && mainServer.getStatus) {
      const realStatus = mainServer.getStatus();
      status = { ...status, ...realStatus };
    }
  } catch (e) {
    // Fallback to mock status if main server not available
  }
  
  res.json(status);
});

// In-memory transaction log
let transactionLog = [];

// API: Get transaction log
app.get('/api/log', (req, res) => {
  res.json({ entries: transactionLog });
});

// API: Clear transaction log
app.post('/api/log/clear', (req, res) => {
  transactionLog = [];
  res.json({ ok: true });
});

// API: Add log entry (for internal use by PED server)
app.post('/api/log/add', (req, res) => {
  const { type, message, details } = req.body;
  const entry = {
    timestamp: new Date().toISOString(),
    type: type || 'info',
    message: message || '',
    details: details || ''
  };
  transactionLog.push(entry);
  
  // Keep only last 100 entries to prevent memory issues
  if (transactionLog.length > 100) {
    transactionLog = transactionLog.slice(-100);
  }
  
  res.json({ ok: true });
});

// In-memory popup queue
let popupQueue = [];

// API: Get popup notifications
app.get('/api/popups', (req, res) => {
  const popup = popupQueue.length > 0 ? popupQueue[0] : null;
  res.json({ popup });
});

// API: Acknowledge popup was shown
app.post('/api/popups/ack', (req, res) => {
  if (popupQueue.length > 0) {
    popupQueue.shift();
  }
  res.json({ ok: true });
});

// API: Add popup (for internal use by PED server)
app.post('/api/popups/add', (req, res) => {
  const { title, message, type } = req.body;
  popupQueue.push({
    title: title || 'Notification',
    message: message || '',
    type: type || 'info'
  });
  res.json({ ok: true });
});

// Start server
const PORT = process.env.PED_WEB_PORT || 8080;
server.listen(PORT, () => {
  console.log(`PED Sim Web UI running at http://localhost:${PORT}`);
});

// Export for integration
module.exports = {
  showPairingPrompt: (code) => {
    return new Promise(resolve => {
      pairingPrompt = code;
      pairingResolve = resolve;
    });
  },
  clearPrompt: () => { pairingPrompt = null; pairingResolve = null; }
};

const { fork } = require('child_process');
const net = require('net');
const path = require('path');

let serverProc = null;

function waitForPort(port, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryOnce = () => {
      const sock = net.connect(port, '127.0.0.1');
      sock.once('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(tryOnce, 100);
      });
      sock.once('connect', () => {
        sock.end();
        resolve();
      });
    };
    tryOnce();
  });
}

async function startServer() {
  if (serverProc) return; // already running
  serverProc = fork(path.resolve(__dirname, '../../server.js'), { stdio: 'ignore' });
  await waitForPort(5015, 8000);
}

async function stopServer() {
  if (!serverProc) return;
  await new Promise(resolve => {
    let resolved = false;
    serverProc.once('exit', () => { if (!resolved) { resolved = true; resolve(); } });
    try { serverProc.kill('SIGTERM'); } catch {}
    setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 800);
  });
  serverProc = null;
}

module.exports = { startServer, stopServer };

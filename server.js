// Entry point for the PED Simulator Node.js server
// Will initialize all modules and start the server

const { startPortListener } = require('./ped/portListener');
const net = require('net');
const { parseXml } = require('./utils/xmlUtils');
const SecondaryCommands = require('./ped/secondaryCommands');
const PedStatus = require('./ped/pedStatus');
const LogManager = require('./logging/logManager');
const { WebSocketServer } = require('ws');

const webLogger = new LogManager();
var websocketArray = []

// Global state for web UI integration
let globalState = {
    status: null,
    primaryCommands: null,
    giftCard: null,
    webLogger: null
};

function logToWebUI(type, message, details = '') {
    if (globalState.webLogger) {
        globalState.webLogger(type, message, details);
    }
}

function showPopupInWebUI(title, message, type = 'info') {
    if (globalState.webLogger) {
        // Use a special log type to trigger popup
        globalState.webLogger('popup', JSON.stringify({ title, message, type }));
    }
}
async function main() {
    // Initialize and start the PED simulator
    console.log('Starting PED Simulator Node.js server...');
    const sharedStatus = new PedStatus();
    globalState.status = sharedStatus;

    // Start web UI server
    try {
        const webServer = require('./web/server');
        console.log('Web UI started successfully');

        // Set up web UI logging integration
        globalState.webLogger = (type, message, details) => {
            if (type === 'popup') {
                const popup = JSON.parse(message);
                fetch('http://localhost:8080/api/popups/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(popup)
                }).catch(() => { }); // Ignore errors
            } else {
                fetch('http://localhost:8080/api/log/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, message, details })
                }).catch(() => { }); // Ignore errors
            }
        };
    } catch (e) {
        console.log('Web UI not available:', e.message);
    }


    const wss = new WebSocketServer({ port: 5014 });
    webLogger.log('WebSocket server running on ws://localhost:5014');

    const PedParameters = require('./ped/pedParameters');
    const { parseXml } = require('./utils/xmlUtils');
    const LogManager = require('./logging/logManager');
    const pedParams = new PedParameters();

    const PrimaryCommands = require('./ped/primaryCommands');

    var primary = new PrimaryCommands(sharedStatus, pedParams, null, null);

    wss.on('connection', ws => {
        webLogger.log('WebSocket Client connected');

        primary.websocket = ws; // Use first connected WebSocket if available

        ws.on('message', message => {
  webLogger.log(`Received: ${message}`);

  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch {
    console.warn("Invalid JSON:", message);
    return;
  }

  // If the client sent back a response with an ID we’re waiting for
  if (parsed.id && primary.pendingResponses.has(parsed.id)) {
    const resolve = primary.pendingResponses.get(parsed.id);
    primary.pendingResponses.delete(parsed.id);
    resolve(parsed);  // fulfill the promise!
    return;
  }

  // Otherwise, handle normal unsolicited messages
  webLogger.log('No pending promise matched this ID');
});


        ws.on('close', () => {
            webLogger.log('Client disconnected')
            websocketArray = websocketArray.filter(w => w !== ws);
        });
    });

    // Primary port (5015) with C#-style protocol

    globalState.primaryCommands = primary;
    globalState.giftCard = primary.giftCard;
    const primaryLogger = new LogManager();
    const primaryServer = require('net').createServer(socket => {
        primaryLogger.log('Primary: Client connected');
        logToWebUI('info', 'Client connected to primary port 5015');
        sharedStatus.Connected = true;
        socket.on('data', async data => {
            let xml = data.toString();
            // C# sim strips leading '?'
            while (xml[0] === '?') xml = xml.slice(1);
            primaryLogger.log('Primary: Received XML: ' + xml);
            logToWebUI('transaction', 'Received command', xml.length > 200 ? xml.substring(0, 200) + '...' : xml);
            try {
                const obj = await parseXml(xml);
                const resp = await primary.handle(obj, wss);
                socket.write(resp);
                logToWebUI('transaction', 'Sent response', resp.length > 200 ? resp.substring(0, 200) + '...' : resp);
            } catch (e) {
                primaryLogger.log('Primary: XML Parse Error: ' + e);
                const errorResp = '<RESPONSE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><RESULT_CODE>-2</RESULT_CODE><RESULT>XML Format Incorrect</RESULT><RESPONSE_TEXT/></RESPONSE>';
                socket.write(errorResp);
                logToWebUI('error', 'XML Parse Error', e.message);
            }
        });
        socket.on('end', () => {
            primaryLogger.log('Primary: Client disconnected');
            logToWebUI('info', 'Client disconnected from primary port');
            sharedStatus.Connected = false;
        });
    });
    primaryServer.listen(5015, () => {
        primaryLogger.log('Primary port listening on 5015');
        logToWebUI('success', 'PED Sim started', 'Primary port listening on 5015');
    });

    // Secondary port (5016) to mirror C# SecondaryCommands
    const secondary = new SecondaryCommands(sharedStatus, {}, websocketArray[0]);
    const logger = new LogManager();
    const server = net.createServer(socket => {
        logger.log('Secondary: Client connected');
        logToWebUI('info', 'Client connected to secondary port 5016');
        socket.on('data', async data => {
            const xml = data.toString();
            logger.log('Secondary: Received XML: ' + xml);
            logToWebUI('transaction', 'Secondary command received', xml);
            try {
                const obj = await parseXml(xml);
                const resp = secondary.handle(obj, wss);
                socket.write(resp);
                logToWebUI('transaction', 'Secondary response sent', resp);
            } catch (e) {
                logger.log('Secondary: XML Parse Error: ' + e);
                const errorResp = '<RESPONSE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><RESULT_CODE>-2</RESULT_CODE><RESULT>XML Format Incorrect</RESULT><RESPONSE_TEXT/></RESPONSE>';
                socket.write(errorResp);
                logToWebUI('error', 'Secondary XML Parse Error', e.message);
            }
        });
        socket.on('end', () => {
            logger.log('Secondary: Client disconnected');
            logToWebUI('info', 'Client disconnected from secondary port');
        });
    });
    server.listen(5016, () => {
        logger.log('Secondary port listening on 5016');
        logToWebUI('success', 'Secondary port started', 'Listening on port 5016');
    });
}

// Export function to get current status for web UI
function getStatus() {
    if (!globalState.status) return {};

    const status = globalState.status;
    const primary = globalState.primaryCommands;

    return {
        connected: status.Connected || false,
        sessionOpen: status.SessionOpen || false,
        deviceBusy: status.DeviceBusy || false,
        paired: (primary && primary.pedParams && primary.pedParams.MacKey) ? true : false,
        lastCommand: status.LastCommand || '',
        counter: status.Counter || 0
    };
}

// Export function to get gift card info for web UI
function getGiftCardInfo() {
    if (!globalState.giftCard || typeof globalState.giftCard.getInfo !== 'function') {
        return { value: 0.00, status: 'Inactive' };
    }

    const info = globalState.giftCard.getInfo();
    return {
        value: info.balance || 0.00,
        status: info.balance > 0 ? 'Active' : 'Inactive'
    };
}

main();

module.exports = { getStatus, getGiftCardInfo };

// Entry point for the PED Simulator Node.js server
// Will initialize all modules and start the server

const { startPortListener } = require('./ped/portListener');
const net = require('net');
const { parseXml } = require('./utils/xmlUtils');
const SecondaryCommands = require('./ped/secondaryCommands');
const PedStatus = require('./ped/pedStatus');
const LogManager = require('./logging/logManager');

function main() {
    // Initialize and start the PED simulator
    console.log('Starting PED Simulator Node.js server...');
    const sharedStatus = new PedStatus();

    // Primary port (5015) with C#-style protocol
    const PrimaryCommands = require('./ped/primaryCommands');
    const PedParameters = require('./ped/pedParameters');
    const { parseXml } = require('./utils/xmlUtils');
    const LogManager = require('./logging/logManager');
    const pedParams = new PedParameters();
    const primary = new PrimaryCommands(sharedStatus, pedParams);
    const primaryLogger = new LogManager();
    const primaryServer = require('net').createServer(socket => {
        primaryLogger.log('Primary: Client connected');
        socket.on('data', async data => {
            let xml = data.toString();
            // C# sim strips leading '?'
            while (xml[0] === '?') xml = xml.slice(1);
            primaryLogger.log('Primary: Received XML: ' + xml);
            try {
                const obj = await parseXml(xml);
                const resp = primary.handle(obj);
                socket.write(resp);
            } catch (e) {
                primaryLogger.log('Primary: XML Parse Error: ' + e);
                socket.write('<RESPONSE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><RESULT_CODE>-2</RESULT_CODE><RESULT>XML Format Incorrect</RESULT><RESPONSE_TEXT/></RESPONSE>');
            }
        });
        socket.on('end', () => primaryLogger.log('Primary: Client disconnected'));
    });
    primaryServer.listen(5015, () => primaryLogger.log('Primary port listening on 5015'));

    // Secondary port (5016) to mirror C# SecondaryCommands
    const secondary = new SecondaryCommands(sharedStatus, {});
    const logger = new LogManager();
    const server = net.createServer(socket => {
        logger.log('Secondary: Client connected');
        socket.on('data', async data => {
            const xml = data.toString();
            logger.log('Secondary: Received XML: ' + xml);
            try {
                const obj = await parseXml(xml);
                const resp = secondary.handle(obj);
                socket.write(resp);
            } catch (e) {
                logger.log('Secondary: XML Parse Error: ' + e);
                socket.write('<RESPONSE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><RESULT_CODE>-2</RESULT_CODE><RESULT>XML Format Incorrect</RESULT><RESPONSE_TEXT/></RESPONSE>');
            }
        });
        socket.on('end', () => logger.log('Secondary: Client disconnected'));
    });
    server.listen(5016, () => logger.log('Secondary port listening on 5016'));
}

main();

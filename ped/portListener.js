// PED Port Listener - handles incoming socket connections and XML messages

const net = require('net');

const { parseXml } = require('../utils/xmlUtils');
const PED = require('./ped');
const LogManager = require('../logging/logManager');


function buildXmlResponse(obj) {
    // Simple XML builder for flat objects
    let xml = '<Response>';
    for (const key in obj) {
        xml += `<${key}>${obj[key]}</${key}>`;
    }
    xml += '</Response>';
    return xml;
}


function startPortListener(port = 9000, sharedStatus) {
    const ped = new PED(sharedStatus);
    const logger = new LogManager();
    const server = net.createServer(socket => {
        logger.log('Client connected');
        socket.on('data', async data => {
            const xml = data.toString();
            logger.log('Received XML: ' + xml);
            try {
                const command = await parseXml(xml);
                logger.log('Parsed Command: ' + JSON.stringify(command));
                const result = ped.handleCommand(command);
                logger.log('PED Response: ' + JSON.stringify(result));
                const responseXml = buildXmlResponse(result);
                socket.write(responseXml);
            } catch (err) {
                logger.log('XML Parse Error: ' + err);
                socket.write('<Response><Error>XML Parse Error</Error></Response>');
            }
        });
        socket.on('end', () => logger.log('Client disconnected'));
    });
    server.listen(port, () => logger.log(`PED Simulator listening on port ${port}`));
}

module.exports = { startPortListener };

// PED Port Listener - handles incoming socket connections and XML messages
const net = require('net');
const { parseXml } = require('../utils/xmlUtils');

function startPortListener(port = 9000) {
    const server = net.createServer(socket => {
        console.log('Client connected');
        socket.on('data', async data => {
            const xml = data.toString();
            console.log('Received XML:', xml);
            // Parse and handle XML command
            try {
                const command = await parseXml(xml);
                // TODO: Dispatch command to PED logic
                socket.write('<Response>OK</Response>');
            } catch (err) {
                console.error('XML Parse Error:', err);
                socket.write('<Response>Error</Response>');
            }
        });
        socket.on('end', () => console.log('Client disconnected'));
    });
    server.listen(port, () => console.log(`PED Simulator listening on port ${port}`));
}

module.exports = { startPortListener };

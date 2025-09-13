// Entry point for the PED Simulator Node.js server
// Will initialize all modules and start the server

const { startPortListener } = require('./ped/portListener');

function main() {
    // Initialize and start the PED simulator
    console.log('Starting PED Simulator Node.js server...');
    startPortListener();
}

main();

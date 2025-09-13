// Log Manager placeholder


const fs = require('fs');
const path = require('path');

class LogManager {
    constructor(logFile = 'ped-sim.log') {
        this.logFile = path.resolve(logFile);
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const entry = `[${timestamp}] ${message}`;
        console.log(entry);
        fs.appendFileSync(this.logFile, entry + '\n');
    }
}

module.exports = LogManager;

// PED Parameters with MacKey/MacLabel and file persistence
const fs = require('fs');
const path = require('path');

class PedParameters {
    constructor(file = 'ped-params.json') {
        this.file = path.resolve(file);
        this.MacKey = '';
        this.MacLabel = '';
        this.PairingCode = '';
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(this.file)) {
                const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
                this.MacKey = data.MacKey || '';
                this.MacLabel = data.MacLabel || '';
                this.PairingCode = data.PairingCode || '';
            }
        } catch {}
    }

    save() {
        const data = {
            MacKey: this.MacKey,
            MacLabel: this.MacLabel,
            PairingCode: this.PairingCode
        };
        fs.writeFileSync(this.file, JSON.stringify(data, null, 2));
    }
}

module.exports = PedParameters;

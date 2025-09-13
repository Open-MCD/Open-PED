// PED logic placeholder (PED state machine, command handling)


const CreditCard = require('./creditCard');
const GiftCard = require('./giftCard');
const LastPayment = require('./lastPayment');
const fs = require('fs');
const path = require('path');
const PedStatus = require('./ped/pedStatus');

class PED {

    constructor(sharedStatus) {
        this.status = 'IDLE';
        this.pedStatus = sharedStatus instanceof PedStatus ? sharedStatus : new PedStatus();
        this.creditCard = new CreditCard();
        this.giftCard = new GiftCard();
        this.lastPayment = new LastPayment();
        this.settings = this.loadConfig('config/settings.json');
        this.resources = this.loadConfig('config/resources.json');
    }

    loadConfig(file) {
        try {
            const configPath = path.resolve(__dirname, '../', file);
            if (fs.existsSync(configPath)) {
                return JSON.parse(fs.readFileSync(configPath, 'utf8'));
            }
        } catch (e) {
            // Ignore errors, return empty
        }
        return {};
    }

    handleCommand(command) {
        let cmdType = '';
        if (typeof command.Command === 'string') {
            cmdType = command.Command;
        } else if (command.Command && command.Command.Type) {
            cmdType = command.Command.Type;
        } else {
            cmdType = Object.keys(command)[0];
        }

        switch (cmdType) {
            case 'Start':
                this.status = 'ACTIVE';
                return { Status: this.status, Message: 'PED Started' };
            case 'Stop':
                this.status = 'IDLE';
                return { Status: this.status, Message: 'PED Stopped' };
            case 'Status':
                return { Status: this.status };
            case 'GetCreditCard':
                return this.creditCard.getInfo();
            case 'GetGiftCard':
                return this.giftCard.getInfo();
            case 'GetLastPayment':
                return this.lastPayment.getInfo();
            default:
                return { Status: this.status, Message: 'Unknown Command' };
        }
    }
}

module.exports = PED;

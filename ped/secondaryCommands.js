// Secondary Commands implemented to mirror C# SecondaryCommands behavior
// Handles commands: STATUS, REBOOT, ANY_UPDATES, UPDATE_STATUS

class SecondaryCommands {
    constructor(cashlessStatus, lockObject) {
        this.status = cashlessStatus; // PedStatus-like object
        this.lock = lockObject || { _l: 0 }; // simple lock placeholder
        this.isStopWatchRunning = false;
        this.stopwatchStart = null; // Date when stopwatch started
    }

    // Parse a JS object (from XML) and return exact XML string response
    handle(xmlObj) {
        // Expecting root with COMMAND child: <...><COMMAND>STATUS|REBOOT|ANY_UPDATES|UPDATE_STATUS</COMMAND></...>
        const command = this._getCommand(xmlObj);
        switch (command) {
            case 'STATUS':
                return this._status();
            case 'REBOOT':
                return this._reboot();
            case 'ANY_UPDATES':
                return this._anyUpdates();
            case 'UPDATE_STATUS':
                return this._updateStatus();
            default:
                return this._unknownError();
        }
    }

    // Helpers to mirror C# responses
    _status() {
        return '<RESPONSE><RESPONSE_TEXT>Operation SUCCESSFUL</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><SECONDARY_DATA>14</SECONDARY_DATA><MACLABEL_IN_SESSION>P_752</MACLABEL_IN_SESSION><SESSION_DURATION>00:00:02</SESSION_DURATION><INVOICE_SESSION>MD3551</INVOICE_SESSION><SERIAL_NUMBER>286061806</SERIAL_NUMBER></RESPONSE>';
    }

    _reboot() {
        // lock and reset several PedStatus fields exactly as C# does
        // ApprovalMode=true, CardSwiped=false, DeviceBusy=false, SessionOpen=false
        this._withLock(() => {
            this.status.ApprovalMode = true;
            this.status.CardSwiped = false;
            this.status.DeviceBusy = false;
            this.status.SessionOpen = false;
        });
        return '<RESPONSE><RESPONSE_TEXT>SUCCESS</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><SECONDARY_DATA>0</SECONDARY_DATA></RESPONSE>';
    }

    _anyUpdates() {
        // Return SECONDARY_DATA 1 if UpdateAvailable else 0
        let data = '0';
        this._withLock(() => {
            if (this.status.UpdateAvailable) data = '1';
        });
        return `<RESPONSE><RESPONSE_TEXT>SUCCESS</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><SECONDARY_DATA>${data}</SECONDARY_DATA></RESPONSE>`;
    }

    _updateStatus() {
        // Manage stopwatch like C#: start if not running; stop if UpdateStatus != 2
        this._withLock(() => {
            if (!this.isStopWatchRunning) {
                this.isStopWatchRunning = true;
                this.stopwatchStart = new Date();
            }
            if (this.status.UpdateStatus !== 2) {
                this.isStopWatchRunning = false;
            }
        });

        const duration = this._elapsedHHMMSS();
        const upd = this.status.UpdateStatus || 0;
        return `<RESPONSE><RESPONSE_TEXT>SUCCESS</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><SECONDARY_DATA>${upd}</SECONDARY_DATA><MACLABEL_IN_SESSION>SIMULATOR</MACLABEL_IN_SESSION><SESSION_DURATION>${duration}</SESSION_DURATION><INVOICE_SESSION>98985</INVOICE_SESSION><DEVICENAME>LANE1</DEVICENAME><SERIALNUMBER>987654321</SERIALNUMBER></RESPONSE>`;
    }

    _unknownError() {
        // Mirror PortListener.unknownError constant
        return '<RESPONSE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><RESULT_CODE>0</RESULT_CODE><RESULT>Unknown Command or error</RESULT><RESPONSE_TEXT/></RESPONSE>';
    }

    _elapsedHHMMSS() {
        if (!this.isStopWatchRunning || !this.stopwatchStart) return '00:00:00';
        const ms = Date.now() - this.stopwatchStart.getTime();
        const totalSec = Math.floor(ms / 1000);
        const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
        const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
        const s = String(totalSec % 60).padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    _getCommand(xmlObj) {
        if (!xmlObj) return '';
        // Try common shapes from fast-xml-parser: { ROOT: { COMMAND: 'STATUS' } } or { COMMAND: 'STATUS' }
        if (typeof xmlObj.COMMAND === 'string') return xmlObj.COMMAND;
        for (const k of Object.keys(xmlObj)) {
            const node = xmlObj[k];
            if (node && typeof node === 'object' && typeof node.COMMAND === 'string') {
                return node.COMMAND;
            }
        }
        return '';
    }

    _withLock(fn) {
        // JS single-threaded; placeholder to mirror critical sections
        try { fn(); } catch { /* ignore */ }
    }
}

module.exports = SecondaryCommands;

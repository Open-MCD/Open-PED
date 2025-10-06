// PrimaryCommands: C#-style protocol for PED Sim port 5015
// Handles TRANSACTION XML with FUNCTION_TYPE: DEVICE, SESSION, PAYMENT, ADMIN, SAF, etc.

const forge = require("node-forge");

class PrimaryCommands {
    constructor(status, pedParams, lockObject, websocket) {
        this.status = status;
        this.pedParams = pedParams || {};
        this.lock = lockObject || { _l: 0 };
        this.websocket = websocket; // WebSocket for web UI notifications
        this.pendingResponses = new Map();
    }

    async sendAndWait(message) {
        if (!this.websocket || this.websocket.readyState !== this.websocket.OPEN) {
            throw new Error("WebSocket not connected");
        }

        return new Promise((resolve, reject) => {
            const id = `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
            message.id = id;
            this.pendingResponses.set(id, resolve);

            this.websocket.send(JSON.stringify(message));
        });
    }

    async handle(xmlObj) {
        var commandText
        // Accepts parsed XML object, returns exact RESPONSE XML string
        // ETRANSACTION/PAYLOAD: decrypt and process inner XML
        if (xmlObj.ETRANSACTION && xmlObj.ETRANSACTION.PAYLOAD) {
            try {
                const payload = xmlObj.ETRANSACTION.PAYLOAD;
                const iv = xmlObj.ETRANSACTION.IV || new Array(16);
                const key = this.pedParams.MacKey || '00112233445566778899AABBCCDDEEFF';
                const { aesCbcDecrypt } = require('../utils/aesUtils');
                var decrypted = aesCbcDecrypt(payload, key, iv);
                const { parseXml } = require('../utils/xmlUtils');
                commandText = await parseXml(decrypted)

            } catch (error) {
                console.log(error)
                return this._badXml();
            }
        }
        else {
            commandText = this._findRoot(xmlObj);
        }

        // Support <REQUEST><COMMAND>LANE_CLOSE</COMMAND> for cashless integration
        if (xmlObj.REQUEST && xmlObj.REQUEST.COMMAND === 'LANE_CLOSE') {
            // Return the same as LANE_CLOSED for compatibility
            return '<RESPONSE><RESPONSE_TEXT>Lane Closed</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><COUNTER>12104</COUNTER></RESPONSE>';
        }
        // Expect TRANSACTION root with FUNCTION_TYPE and COMMAND

        const root = await this._findRoot(commandText);
        if (!root) return this._badXml();
        const funcType = root.FUNCTION_TYPE;
        const command = root.COMMAND;

        // Encryption/security commands (REGISTER_ENCRYPTION, UNREGISTER)
        if (command === 'REGISTER_ENCRYPTION') {
            return this._registerEncryption(root);
        }
        if (command === 'UNREGISTER') {
            return this._unregisterEncryption(root);
        }
        switch (funcType) {
            case 'DEVICE':
                return this._handleDevice(command, root);
            case 'SESSION':
                return this._handleSession(command, root);
            case 'PAYMENT':
                return this._handlePayment(command, root);
            case 'ADMIN':
                return this._handleAdmin(command, root);
            case 'SAF':
                return this._handleSaf(command, root);
            case 'SECURITY':
                return this._handleSecurity(command, root);
            default:
                return this._unknownError();
        }
    }

    async _registerEncryption(root) {
        let result = "<RESPONSE><RESULT>BAD XML</RESULT></RESPONSE>";

        // Simulate C# logic: calculate pairing code from public key (SHA1 digest, first 4 hex chars)
        let pubKey = root.PUBLIC_KEY || root.KEY || '';
        if (!pubKey) {
            return '<RESPONSE><RESPONSE_TEXT>NO PUBLIC KEY</RESPONSE_TEXT><RESULT>ERROR</RESULT><RESULT_CODE>59012</RESULT_CODE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><COUNTER>10002</COUNTER></RESPONSE>';
        }

        const keyInfoData = Buffer.from(root.KEY, "base64");
        const returnCodeRef = { value: "" };

        const crypto = require('crypto');
        let code = '';
        try {
            const keyBuf = Buffer.from(pubKey, 'base64');
            const sha1 = crypto.createHash('sha1').update(keyBuf).digest();
            let hex1 = sha1[0].toString(16).toUpperCase().padStart(2, '0');
            let hex2 = sha1[1].toString(16).toUpperCase().padStart(2, '0');
            code = (hex1 + hex2).substring(0, 4);
        } catch {
            return '<RESPONSE><RESPONSE_TEXT>BAD PUBLIC KEY</RESPONSE_TEXT><RESULT>ERROR</RESULT><RESULT_CODE>59013</RESULT_CODE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><COUNTER>10002</COUNTER></RESPONSE>';
        }
        // Show pairing code in web UI and wait for user input
        let webUi;

        const socketResult = await this.sendAndWait({ type: 'pair', message: `PED Pairing Required. Code for POS: ${code}` }).catch(() => { });


        if (socketResult.data.substring(0, 4) === code) {

            var aesKey = crypto.randomBytes(16); // 128-bit AES key

            const publicKeyDer = forge.util.createBuffer(keyInfoData.toString("binary"));
            const asn1Obj = forge.asn1.fromDer(publicKeyDer);
            const publicKey = forge.pki.publicKeyFromAsn1(asn1Obj);

            const entryCodeEnc = publicKey.encrypt(
                Buffer.from(returnCodeRef.value, "ascii").toString("binary"),
                "RSAES-PKCS1-V1_5"
            );
            const terminalKeyEnc = publicKey.encrypt(
                aesKey.toString("binary"),
                "RSAES-PKCS1-V1_5"
            );


            this.pedParams.MacLabel = "PED_SIM";
            this.pedParams.MacKey = aesKey.toString("base64");
            aesKey.copy(Buffer.from(this.pedParams.MacKey), 0);
            this.pedParams.save();

            result = `<RESPONSE><RESPONSE_TEXT>REGISTERED</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><TERMINAL_KEY>${Buffer.from(terminalKeyEnc, "binary").toString("base64")}</TERMINAL_KEY><MAC_LABEL>${this.pedParams.MacLabel}</MAC_LABEL><ENTRY_CODE>${Buffer.from(entryCodeEnc, "binary").toString("base64")}</ENTRY_CODE></RESPONSE>`;

            this.websocket.send(JSON.stringify({ type: 'pair_success', message: 'PED Paired Successfully' }));

            return result;

        } else {
            this.websocket.send(JSON.stringify({ type: 'pair_failure', message: 'PED Pairing Failed' }));
            return result
        }
    }

    _unregisterEncryption(root) {
        // Clear MacKey/MacLabel/PairingCode
        this.pedParams.MacKey = '';
        this.pedParams.MacLabel = '';
        this.pedParams.PairingCode = '';
        if (typeof this.pedParams.save === 'function') this.pedParams.save();
        return '<RESPONSE><RESPONSE_TEXT>UNREGISTERED</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><COUNTER>10003</COUNTER></RESPONSE>';
    }

    _handleAdmin(command, root) {
        const now = new Date();
        const text = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
        if (command === 'SETTIME') {
            return `<RESPONSE><RESPONSE_TEXT>SUCCESS</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><COUNTER>12099</COUNTER><TIME>${text}</TIME></RESPONSE>`;
        }
        if (command === 'LANE_CLOSED') {
            this.websocket.send(JSON.stringify({ type: 'message', message: root.DISPLAY_TEXT }));
            return '<RESPONSE><RESPONSE_TEXT>Lane Closed</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><COUNTER>12104</COUNTER></RESPONSE>';
        }
        if (command === 'APPLYUPDATES') {
            // Simulate no updates available
            return '<RESPONSE><RESPONSE_TEXT>No Updates Available on Terminal to Apply</RESPONSE_TEXT><RESULT>ERROR</RESULT><RESULT_CODE>59052</RESULT_CODE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><COUNTER>1</COUNTER></RESPONSE>';
        }
        if (command === "GET_COUNTER") {
            return '<RESPONSE><RESPONSE_TEXT>Counter Retrieved</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><COUNTER>12100</COUNTER><TRANSACTION_COUNTER>12345</TRANSACTION_COUNTER><BATCH_NUMBER>67</BATCH_NUMBER></RESPONSE>';
        }
        return this._unknownError();
    }

    _handleSaf(command, root) {
        if (command === 'QUERY') {
            return '<RESPONSE><RESPONSE_TEXT>0 SAF RECORDS FOUND</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><COUNTER>1971</COUNTER><RECORD_COUNT>0</RECORD_COUNT><TOTAL_AMOUNT>0.00</TOTAL_AMOUNT><RECORDS></RESPONSE>';
        }
        return this._unknownError();
    }

    _handleSecurity(command, root) {
        if (command == "TEST_MAC") {
            if (this.status.SessionOpen) {
                return `<RESPONSE>
                            <RESPONSE_TEXT>Session in progress</RESPONSE_TEXT>
                            <RESULT>OK</RESULT>
                            <RESULT_CODE>59003</RESULT_CODE>
                            <TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS>
                            <COUNTER>13154</COUNTER>
                        </RESPONSE>`;
            } else {
                return `<RESPONSE>
                            <RESPONSE_TEXT>Match</RESPONSE_TEXT>
                            <RESULT>OK</RESULT>
                            <RESULT_CODE>-1</RESULT_CODE>
                            <TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS>
                            <COUNTER>13154</COUNTER>
                        </RESPONSE>`;
            }

        } else if (command == "REGISTER_ENCRYPTION") {
            return this._registerEncryption(root);
        } else if (command == "UNREGISTER") {
            for (let i = 0; i < macKey.length; i++) {
                macKey[i] = 0;
            }
            this.pedParams.macKey = Buffer.from(macKey).toString("base64");
            this.pedParams.save(pedParamFileName);
            return `<RESPONSE>
                        <RESPONSE_TEXT>Unregistered RDI_SIM</RESPONSE_TEXT>
                        <RESULT>OK</RESULT>
                        <RESULT_CODE>-1</RESULT_CODE>
                        <TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS>
                    </RESPONSE>`;

        }
    }

    // Stubs for GIFT, VOID, CREDIT (to be expanded)

    _handleDevice(command, root) {
        if (command === 'VERSION') {
            return '<RESPONSE><RESPONSE_TEXT>Version Information Captured</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><COUNTER>12101</COUNTER><VERSION_INFO>RDI Simulator.  Better than the real thing</VERSION_INFO></RESPONSE>';
        }
        if (command === 'GET_PARM') {
            // Only support a few params for now
            let param = '';
            try {
                const req = root.PARAM || '';
                const arr = req.split('|');
                param = arr.map(k => {
                    if (k === 'transactionfloorlimit') return 'transactionfloorlimit=30';
                    if (k === 'totalfloorlimit') return 'totalfloorlimit=5000';
                    if (k === 'dayslimit') return 'dayslimit=1';
                    return '';
                }).filter(Boolean).join('|');
            } catch { }
            return `<RESPONSE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><COUNTER>1</COUNTER><RESULT_CODE>-1</RESULT_CODE><RESULT>OK</RESULT><PARAM>${param}</PARAM></RESPONSE>`;
        }
        return this._unknownError();
    }

    _handleSession(command, root) {
        if (command === 'START') {
            this.websocket.send(JSON.stringify({ type: 'start_session' }));
            if (!this.status.SessionOpen) {
                this.status.SessionOpen = true;
                return '<RESPONSE><RESPONSE_TEXT>Session Started</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><COUNTER>13239</COUNTER></RESPONSE>';
            } else {
                return '<RESPONSE><RESPONSE_TEXT>SESSION in progress</RESPONSE_TEXT><RESULT>BUSY</RESULT><RESULT_CODE>59003</RESULT_CODE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><COUNTER>13240</COUNTER></RESPONSE>';
            }
        }
        if (command === 'FINISH') {
            if (this.status.SessionOpen) {
                this.status.SessionOpen = false;
                return '<RESPONSE><RESPONSE_TEXT>Session Finished</RESPONSE_TEXT><RESULT>OK</RESULT><RESULT_CODE>-1</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><COUNTER>13241</COUNTER></RESPONSE>';
            } else {
                return '<RESPONSE><RESPONSE_TEXT>No Session</RESPONSE_TEXT><RESULT>FAILED</RESULT><RESULT_CODE>59004</RESULT_CODE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><COUNTER>13241</COUNTER></RESPONSE>';
            }
        }
        return this._unknownError();
    }

    async _handlePayment(command, root) {
        const result = await this.sendAndWait({ type: "payment", data: root.TRANS_AMOUNT });
        // Use GiftCard and LastPayment modules for state (ensure instances)
        if (!this.giftCard || typeof this.giftCard !== 'object' || typeof this.giftCard.getInfo !== 'function') {
            try {
                const GiftCard = require('./giftCard');
                this.giftCard = new GiftCard();
            } catch { }
        }
        if (!this.lastPayment || typeof this.lastPayment !== 'object' || typeof this.lastPayment.getInfo !== 'function') {
            try {
                const LastPayment = require('./lastPayment');
                this.lastPayment = new LastPayment();
            } catch { }
        }
        // CREDIT/CAPTURE
        if (command === 'CAPTURE' || command === 'CREDIT') {
            if (this.status.DeviceBusy) return this._deviceIsBusy();
            if (this.status.UserCancel) return this._cancelledByCustomer();
            if (!this.status.ApprovalMode) return this._decline();
            // Simulate approval, update last payment
            const now = new Date();
            const time = now.toTimeString().slice(0, 8);
            const date = now.toISOString().slice(0, 10).replace(/-/g, '.');
            const seq = '000108';
            const auth = 'OK9841';
            const troutd = '000108';
            const ctroutd = '74';
            const cardToken = result.data.cardNumber;
            const acctNum = '************1111';

            var expDate = result.data.expiry.split("/");

            const expMonth = expDate[0];
            const expYear = expDate[1];
            if (this.lastPayment && typeof this.lastPayment.getInfo === 'function') {
                this.lastPayment.amount = root.TRANS_AMOUNT;
                this.lastPayment.date = date;
                this.lastPayment.method = 'CreditCard';
            }
            return `<RESPONSE><RESPONSE_TEXT>APPROVED</RESPONSE_TEXT><RESULT>APPROVED</RESULT><RESULT_CODE>5</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><HOST_RESPCODE>000</HOST_RESPCODE><COUNTER>12052</COUNTER><TRANS_SEQ_NUM>${seq}</TRANS_SEQ_NUM><INTRN_SEQ_NUM>${seq}</INTRN_SEQ_NUM><AUTH_CODE>${auth}</AUTH_CODE><TROUTD>${troutd}</TROUTD><CTROUTD>${ctroutd}</CTROUTD><PAYMENT_TYPE>CREDIT</PAYMENT_TYPE><CARD_TOKEN>${cardToken}</CARD_TOKEN><MERCHID>9165</MERCHID><TERMID>06</TERMID><LANE>01</LANE><TRANS_DATE>${date}</TRANS_DATE><TRANS_TIME>${time}</TRANS_TIME><APPROVED_AMOUNT>${result.data.value}</APPROVED_AMOUNT><PAYMENT_MEDIA>VISA</PAYMENT_MEDIA><ACCT_NUM>${acctNum}</ACCT_NUM><CARD_EXP_MONTH>${expMonth}</CARD_EXP_MONTH><CARD_EXP_YEAR>${expYear}</CARD_EXP_YEAR><CARD_ENTRY_MODE>Swiped</CARD_ENTRY_MODE><PINLESSDEBIT>C</PINLESSDEBIT></RESPONSE>`;
        }
        // GIFT (simulate purchase)
        if (command === 'GIFT') {
            if (this.status.DeviceBusy) return this._deviceIsBusy();
            if (!this.giftCard) return this._unknownError();
            if (this.giftCard && typeof this.giftCard.balance === 'number') {
                if (this.giftCard.balance < 10) {
                    return '<RESPONSE><RESPONSE_TEXT>INSUFFICIENT FUNDS</RESPONSE_TEXT><RESULT>DECLINED</RESULT><RESULT_CODE>100</RESULT_CODE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS></RESPONSE>';
                }
                this.giftCard.balance -= 10;
            }
            if (this.lastPayment && typeof this.lastPayment.getInfo === 'function') {
                this.lastPayment.amount = 10.00;
                this.lastPayment.date = (new Date()).toISOString().slice(0, 10).replace(/-/g, '.');
                this.lastPayment.method = 'GiftCard';
            }
            const bal = this.giftCard && typeof this.giftCard.balance === 'number' ? this.giftCard.balance.toFixed(2) : '0.00';
            return `<RESPONSE><RESPONSE_TEXT>GIFT APPROVED</RESPONSE_TEXT><RESULT>APPROVED</RESULT><RESULT_CODE>5</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><GIFT_BALANCE>${bal}</GIFT_BALANCE></RESPONSE>`;
        }
        // GIFT ACTIVATE
        if (command === 'ACTIVATE') {
            if (this.status.DeviceBusy) return this._deviceIsBusy();
            const now = new Date();
            const time = now.toTimeString().slice(0, 8);
            const date = now.toISOString().slice(0, 10).replace(/-/g, '.');
            let amount = 0;
            if (root.TRANS_AMOUNT) amount = parseFloat(root.TRANS_AMOUNT);
            if (isNaN(amount) || amount <= 0) amount = 0;
            this.giftCard.balance = amount;
            return `<RESPONSE><RESPONSE_TEXT>APPROVED</RESPONSE_TEXT><RESULT>APPROVED</RESULT><RESULT_CODE>5</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><HOST_RESPCODE>000</HOST_RESPCODE><COUNTER>13671</COUNTER><TRANS_SEQ_NUM>000478</TRANS_SEQ_NUM><INTRN_SEQ_NUM>000478</INTRN_SEQ_NUM><AUTH_CODE>000500</AUTH_CODE><TROUTD>000478</TROUTD><CTROUTD>297</CTROUTD><PAYMENT_TYPE>GIFT</PAYMENT_TYPE><MERCHID>9165</MERCHID><TERMID>06</TERMID><LANE>01</LANE><TRANS_DATE>${date}</TRANS_DATE><TRANS_TIME>${time}</TRANS_TIME><APPROVED_AMOUNT>${amount.toFixed(2)}</APPROVED_AMOUNT><AVAILABLE_BALANCE>${this.giftCard.balance.toFixed(2)}</AVAILABLE_BALANCE><PAYMENT_MEDIA>GIFT</PAYMENT_MEDIA><ACCT_NUM>${this.giftCard.number}</ACCT_NUM><CARDHOLDER>*********</CARDHOLDER><EMBOSSED_ACCT_NUM>****************</EMBOSSED_ACCT_NUM><CARD_EXP_MONTH>01</CARD_EXP_MONTH><CARD_EXP_YEAR>00</CARD_EXP_YEAR><CARD_ENTRY_MODE>Swiped</CARD_ENTRY_MODE></RESPONSE>`;
        }
        // GIFT ADD_VALUE (reload)
        if (command === 'ADD_VALUE') {
            if (this.status.DeviceBusy) return this._deviceIsBusy();
            const now = new Date();
            const time = now.toTimeString().slice(0, 8);
            const date = now.toISOString().slice(0, 10).replace(/-/g, '.');
            let amount = 0;
            if (root.TRANS_AMOUNT) amount = parseFloat(root.TRANS_AMOUNT);
            if (isNaN(amount) || amount <= 0) amount = 0;
            this.giftCard.balance += amount;
            return `<RESPONSE><RESPONSE_TEXT>APPROVED</RESPONSE_TEXT><RESULT>APPROVED</RESULT><RESULT_CODE>5</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><HOST_RESPCODE>000</HOST_RESPCODE><COUNTER>13709</COUNTER><TRANS_SEQ_NUM>000486</TRANS_SEQ_NUM><INTRN_SEQ_NUM>000486</INTRN_SEQ_NUM><AUTH_CODE>010500</AUTH_CODE><TROUTD>000486</TROUTD><CTROUTD>303</CTROUTD><PAYMENT_TYPE>GIFT</PAYMENT_TYPE><MERCHID>9165</MERCHID><TERMID>06</TERMID><LANE>01</LANE><TRANS_DATE>${date}</TRANS_DATE><TRANS_TIME>${time}</TRANS_TIME><APPROVED_AMOUNT>${amount.toFixed(2)}</APPROVED_AMOUNT><AVAILABLE_BALANCE>${this.giftCard.balance.toFixed(2)}</AVAILABLE_BALANCE><PAYMENT_MEDIA>GIFT</PAYMENT_MEDIA><ACCT_NUM>${this.giftCard.number}</ACCT_NUM><CARDHOLDER>*********</CARDHOLDER><EMBOSSED_ACCT_NUM>****************</EMBOSSED_ACCT_NUM><CARD_EXP_MONTH>01</CARD_EXP_MONTH><CARD_EXP_YEAR>00</CARD_EXP_YEAR><CARD_ENTRY_MODE>Swiped</CARD_ENTRY_MODE></RESPONSE>`;
        }
        // GIFT BALANCE
        if (command === 'BALANCE') {
            if (this.status.DeviceBusy) return this._deviceIsBusy();
            const now = new Date();
            const time = now.toTimeString().slice(0, 8);
            const date = now.toISOString().slice(0, 10).replace(/-/g, '.');
            const bal = this.giftCard && typeof this.giftCard.balance === 'number' ? this.giftCard.balance.toFixed(2) : '0.00';
            return `<RESPONSE><RESPONSE_TEXT>APPROVED</RESPONSE_TEXT><RESULT>APPROVED</RESULT><RESULT_CODE>5</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><HOST_RESPCODE>000</HOST_RESPCODE><COUNTER>13685</COUNTER><TRANS_SEQ_NUM>000483</TRANS_SEQ_NUM><INTRN_SEQ_NUM>000483</INTRN_SEQ_NUM><AUTH_CODE>000500</AUTH_CODE><TROUTD>000483</TROUTD><CTROUTD>300</CTROUTD><PAYMENT_TYPE>GIFT</PAYMENT_TYPE><MERCHID>9165</MERCHID><TERMID>06</TERMID><LANE>01</LANE><TRANS_DATE>${date}</TRANS_DATE><TRANS_TIME>${time}</TRANS_TIME><APPROVED_AMOUNT>0.00</APPROVED_AMOUNT><AVAILABLE_BALANCE>${bal}</AVAILABLE_BALANCE><PAYMENT_MEDIA>GIFT</PAYMENT_MEDIA><ACCT_NUM>${this.giftCard.number}</ACCT_NUM><CARDHOLDER>*********</CARDHOLDER><EMBOSSED_ACCT_NUM>****************</EMBOSSED_ACCT_NUM><CARD_EXP_MONTH>01</CARD_EXP_MONTH><CARD_EXP_YEAR>00</CARD_EXP_YEAR><CARD_ENTRY_MODE>Swiped</CARD_ENTRY_MODE></RESPONSE>`;
        }
        // GIFT CLOSE
        if (command === 'GIFT_CLOSE') {
            if (this.status.DeviceBusy) return this._deviceIsBusy();
            const now = new Date();
            const time = now.toTimeString().slice(0, 8);
            const date = now.toISOString().slice(0, 10).replace(/-/g, '.');
            return `<RESPONSE><RESPONSE_TEXT>APPROVED</RESPONSE_TEXT><RESULT>APPROVED</RESULT><RESULT_CODE>5</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><HOST_RESPCODE>000</HOST_RESPCODE><COUNTER>13769</COUNTER><TRANS_SEQ_NUM>000497</TRANS_SEQ_NUM><INTRN_SEQ_NUM>000497</INTRN_SEQ_NUM><AUTH_CODE>000000</AUTH_CODE><TROUTD>000497</TROUTD><CTROUTD>314</CTROUTD><PAYMENT_TYPE>GIFT</PAYMENT_TYPE><MERCHID>9165</MERCHID><TERMID>06</TERMID><LANE>01</LANE><TRANS_DATE>${date}</TRANS_DATE><TRANS_TIME>${time}</TRANS_TIME><APPROVED_AMOUNT>0.00</APPROVED_AMOUNT><AVAILABLE_BALANCE>0.00</AVAILABLE_BALANCE><PAYMENT_MEDIA>GIFT</PAYMENT_MEDIA><ACCT_NUM>${this.giftCard.number}</ACCT_NUM><CARDHOLDER>*********</CARDHOLDER><EMBOSSED_ACCT_NUM>****************</EMBOSSED_ACCT_NUM><CARD_EXP_MONTH>01</CARD_EXP_MONTH><CARD_EXP_YEAR>00</CARD_EXP_YEAR><CARD_ENTRY_MODE>Swiped</CARD_ENTRY_MODE></RESPONSE>`;
        }
        // VOID (simulate voiding last payment)
        if (command === 'VOID') {
            if (this.status.DeviceBusy) return this._deviceIsBusy();
            const now = new Date();
            const time = now.toTimeString().slice(0, 8);
            const date = now.toISOString().slice(0, 10).replace(/-/g, '.');
            const seq = '000504';
            const auth = '000500';
            const troutd = '000504';
            const ctroutd = '319';
            const paymentType = this.lastPayment && this.lastPayment.method === 'CreditCard' ? 'CREDIT' : 'GIFT';
            const acctNum = '************1111';
            const amount = this.lastPayment ? this.lastPayment.amount : 0;
            return `<RESPONSE><RESPONSE_TEXT>APPROVED</RESPONSE_TEXT><RESULT>VOIDED</RESULT><RESULT_CODE>7</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><HOST_RESPCODE>000</HOST_RESPCODE><COUNTER>13796</COUNTER><TRANS_SEQ_NUM>${seq}</TRANS_SEQ_NUM><INTRN_SEQ_NUM>${seq}</INTRN_SEQ_NUM><AUTH_CODE>${auth}</AUTH_CODE><TROUTD>${troutd}</TROUTD><CTROUTD>${ctroutd}</CTROUTD><PAYMENT_TYPE>${paymentType}</PAYMENT_TYPE><BANK_USERDATA>011/00/04/PPayCL/</BANK_USERDATA><MERCHID>9165</MERCHID><TERMID>06</TERMID><LANE>01</LANE><TRANS_DATE>${date}</TRANS_DATE><TRANS_TIME>${time}</TRANS_TIME><APPROVED_AMOUNT>${amount}</APPROVED_AMOUNT><EMBOSSED_ACCT_NUM>${acctNum}</EMBOSSED_ACCT_NUM></RESPONSE>`;
        }
        return this._unknownError();
    }

    _findRoot(obj) {
        // Accepts { TRANSACTION: { ... } } or just { ... }
        if (obj.TRANSACTION) return obj.TRANSACTION;
        return obj;
    }

    _badXml(error) {
        return `<RESPONSE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><RESULT_CODE>-2</RESULT_CODE><RESULT>${error}</RESULT><RESPONSE_TEXT/></RESPONSE>`;
    }
    _unknownError() {
        return '<RESPONSE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><RESULT_CODE>0</RESULT_CODE><RESULT>Unknown Command or error</RESULT><RESPONSE_TEXT/></RESPONSE>';
    }
    _deviceIsBusy() {
        return '<RESPONSE><RESPONSE_TEXT>DEVICE IS BUSY</RESPONSE_TEXT><RESULT>BUSY</RESULT><RESULT_CODE>59002</RESULT_CODE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><COUNTER>13169</COUNTER></RESPONSE>';
    }
    _cancelledByCustomer() {
        return '<RESPONSE><RESPONSE_TEXT>Cancelled by CUSTOMER</RESPONSE_TEXT><RESULT>CANCELLED</RESULT><RESULT_CODE>59001</RESULT_CODE><TERMINATION_STATUS>FAILURE</TERMINATION_STATUS><COUNTER>1024</COUNTER></RESPONSE>';
    }
    _decline() {
        return '<RESPONSE><RESPONSE_TEXT>DECLINE</RESPONSE_TEXT><RESULT>Error</RESULT><RESULT_CODE>6</RESULT_CODE><TERMINATION_STATUS>SUCCESS</TERMINATION_STATUS><HOST_RESPCODE>116</HOST_RESPCODE><COUNTER>5643</COUNTER></RESPONSE>';
    }
}

module.exports = PrimaryCommands;

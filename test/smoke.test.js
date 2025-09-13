// Smoke test for Open-PED Node.js simulator
const net = require('net');
const assert = require('assert');
const { startServer, stopServer } = require('./helpers/server');

function sendXml(port, xml, cb) {
    const client = new net.Socket();
    let data = '';
    client.connect(port, '127.0.0.1', () => {
        client.write(xml);
    });
    client.on('data', chunk => {
        data += chunk.toString();
        client.destroy();
    });
    client.on('close', () => cb(data));
}

describe('Open-PED Protocol Smoke Test', function() {
    this.timeout(10000);

    before(async function() { await startServer(); });
    after(async function() { await stopServer(); });
    it('should respond to DEVICE VERSION', done => {
        sendXml(5015, '<TRANSACTION><FUNCTION_TYPE>DEVICE</FUNCTION_TYPE><COMMAND>VERSION</COMMAND></TRANSACTION>', resp => {
            assert(resp.includes('Version Information Captured'));
            done();
        });
    });
    it('should handle SESSION START/FINISH', done => {
        sendXml(5015, '<TRANSACTION><FUNCTION_TYPE>SESSION</FUNCTION_TYPE><COMMAND>START</COMMAND></TRANSACTION>', resp => {
            assert(resp.includes('Session Started'));
            sendXml(5015, '<TRANSACTION><FUNCTION_TYPE>SESSION</FUNCTION_TYPE><COMMAND>FINISH</COMMAND></TRANSACTION>', resp2 => {
                assert(resp2.includes('Session Finished'));
                done();
            });
        });
    });
    it('should approve CREDIT CAPTURE', done => {
        sendXml(5015, '<TRANSACTION><FUNCTION_TYPE>PAYMENT</FUNCTION_TYPE><COMMAND>CAPTURE</COMMAND></TRANSACTION>', resp => {
            assert(resp.includes('APPROVED'));
            done();
        });
    });
    it('should handle GIFT and VOID', done => {
        sendXml(5015, '<TRANSACTION><FUNCTION_TYPE>PAYMENT</FUNCTION_TYPE><COMMAND>GIFT</COMMAND></TRANSACTION>', resp => {
            assert(resp.includes('GIFT APPROVED'));
            sendXml(5015, '<TRANSACTION><FUNCTION_TYPE>PAYMENT</FUNCTION_TYPE><COMMAND>VOID</COMMAND></TRANSACTION>', resp2 => {
                assert(resp2.includes('VOIDED'));
                done();
            });
        });
    });
    it('should register and unregister encryption', done => {
        sendXml(5015, '<TRANSACTION><COMMAND>REGISTER_ENCRYPTION</COMMAND><MACKEY>00112233445566778899AABBCCDDEEFF</MACKEY><MACLABEL>SIM</MACLABEL><PAIRING_CODE>123456</PAIRING_CODE></TRANSACTION>', resp => {
            assert(resp.includes('REGISTERED'));
            sendXml(5015, '<TRANSACTION><COMMAND>UNREGISTER</COMMAND></TRANSACTION>', resp2 => {
                assert(resp2.includes('UNREGISTERED'));
                done();
            });
        });
    });
});

describe('Secondary Commands Parity', function() {
    this.timeout(10000);

    before(async function() { await startServer(); });
    after(async function() { await stopServer(); });

    it('should return STATUS', done => {
        sendXml(5016, '<TRANSACTION><COMMAND>STATUS</COMMAND></TRANSACTION>', resp => {
            assert(resp.includes('<RESULT>OK</RESULT>'));
            assert(resp.includes('<SECONDARY_DATA>14</SECONDARY_DATA>'));
            done();
        });
    });

    it('should REBOOT and reset flags', done => {
        sendXml(5016, '<TRANSACTION><COMMAND>REBOOT</COMMAND></TRANSACTION>', resp => {
            assert(resp.includes('SUCCESS'));
            done();
        });
    });

    it('should ANY_UPDATES reflect state', done => {
        sendXml(5016, '<TRANSACTION><COMMAND>ANY_UPDATES</COMMAND></TRANSACTION>', resp => {
            assert(resp.includes('<SECONDARY_DATA>0</SECONDARY_DATA>'));
            done();
        });
    });

    it('should report UPDATE_STATUS', done => {
        sendXml(5016, '<TRANSACTION><COMMAND>UPDATE_STATUS</COMMAND></TRANSACTION>', resp => {
            assert(resp.includes('<RESULT>OK</RESULT>'));
            assert(resp.includes('<SECONDARY_DATA>'));
            done();
        });
    });
});

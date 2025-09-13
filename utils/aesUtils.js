// AES Utilities for PED Sim encryption/decryption
const crypto = require('crypto');
const fs = require('fs');

function aesCbcDecrypt(base64Cipher, key, iv) {
    const cipherBuf = Buffer.from(base64Cipher, 'base64');
    const decipher = crypto.createDecipheriv('aes-128-cbc', Buffer.from(key, 'hex'), Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(cipherBuf);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
}

module.exports = { aesCbcDecrypt };

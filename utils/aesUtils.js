// AES Utilities for PED Sim encryption/decryption
var CryptoJS = require("crypto-js");

function aesCbcDecrypt(base64Cipher, macKey) {
    try {
        // Decode key from Base64
        var key = CryptoJS.enc.Base64.parse(macKey);

        // IV = 16 zero bytes
        var iv = CryptoJS.enc.Hex.parse('00000000000000000000000000000000');

        // Ciphertext can be passed directly (Base64 string is fine)
        var decryptedBytes = CryptoJS.AES.decrypt(
            { ciphertext: CryptoJS.enc.Base64.parse(base64Cipher) },
            key,
            { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
        );

        var decryptedMessage = decryptedBytes.toString(CryptoJS.enc.Utf8);

        console.log("Decrypted Message:", decryptedMessage);
        return decryptedMessage;

    } catch (e) {
        console.error("Decryption Error:", e);
        return "";
    }
}


module.exports = { aesCbcDecrypt };

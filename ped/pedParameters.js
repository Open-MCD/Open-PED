// PED Parameters with MacKey/MacLabel and file persistence
const fs = require('fs');
const path = require('path');
const crypto = require("crypto");

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
                this.MacKey = decryptString(data.P1) || '';
                this.MacLabel = decryptString(data.P2) || '';
                // this.PairingCode = decryptString(data.PairingCode) || '';
            }
        } catch {}
    }

    save() {
        const data = {
            P1: encryptString(this.MacKey),
            P2: encryptString(this.MacLabel),
            P3: '',
            P4: '',
            // PairingCode: encryptString(this.PairingCode)
        };
        fs.writeFileSync(this.file, JSON.stringify(data, null, 2));
    }
}

function decryptString(encryptedText) {
  try {
    // Convert Base64 to buffer
    const encrypted = Buffer.from(encryptedText, "base64");

    // Keys and IV from ASCII
    const iv = Buffer.from("dugpdonnlhyxvs;l", "ascii");
    const key = Buffer.from("oiunnewfgfgu0u9jkl;sdjljkhsdf]ou", "ascii"); // 32 bytes

    // AES-256-CBC
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    decipher.setAutoPadding(true);

    let decrypted = decipher.update(encrypted, undefined, "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (e) {
    console.log('Decryption Error:', e);
    return "";
  }
}

function encryptString(plainText) {
  try {
    // Keys and IV from ASCII
    const iv = Buffer.from("dugpdonnlhyxvs;l", "ascii");
    const key = Buffer.from("oiunnewfgfgu0u9jkl;sdjljkhsdf]ou", "ascii"); // 32 bytes

    // AES-256-CBC
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    cipher.setAutoPadding(true);

    let encrypted = cipher.update(plainText, "utf8", "base64");
    encrypted += cipher.final("base64");

    return encrypted;
  } catch (e) {
    console.log("Encryption Error:", e);
    return "";
  }
}


module.exports = PedParameters;

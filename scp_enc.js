//
// scp_enc - encryption
//

'use strict';

const CryptoJS = require("crypto-js");

module.exports = {

    aesEncryption: function(salt, passphrase, plaintext) {
        const keys = getKeyAndIV(salt, passphrase);
        const ciphertext = CryptoJS.AES.encrypt(plaintext, keys.key, { iv: keys.iv });
        return ciphertext.toString();
    },

    aesDecryption: function(salt, passphrase, ciphertext) {
        try {
            const keys = getKeyAndIV(salt, passphrase);
            const bytes = CryptoJS.AES.decrypt(ciphertext, keys.key, { iv: keys.iv });
            const plaintext = bytes.toString(CryptoJS.enc.Utf8);
            return plaintext;
        }
        catch (err) {
            console.error('## aesDecryption -- err=', err);
            return null;
        }
    }
};

function getKeyAndIV(salt, passphrase) {
    const iterations = 234
    const saltHex = CryptoJS.enc.Hex.parse(salt)
    const iv128Bits = CryptoJS.PBKDF2(passphrase, saltHex, { keySize: 128 / 32, iterations })
    const key256Bits = CryptoJS.PBKDF2(passphrase, saltHex, { keySize: 256 / 32, iterations })
    return { iv: iv128Bits, key: key256Bits }
}

// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2025 Dominic Morris.

//
// scp_util - authentication, encryption
//

'use strict';

const BigNumber = require("bignumber.js");
const CryptoJS = require('crypto-js');
const jayson = require('jayson');

const eos_lib = require('./eos_lib'); 
const config = require('./config');

module.exports = {

    // * internal authentication *
    // checks that the supplied account matches supplied encrypted email 
    check_auth: async function(owner, e_email) {
        const eos = eos_lib.init();
        if (owner.length > 12) { 
            console.error(`## check_auth - bad owner=${owner}}`);
            return false;
        }
        const primaryKey = new BigNumber(eos.modules.format.encodeName(owner, false));
        //console.log(`check_auth... ${owner} ${e_email}`);
        try {
            var result = await eos.getTableRows({ // retrieve by supplied eos account name (primary key)
                code: config.get("scp_auth_account"),
                json: true,
                scope: config.get("scp_auth_account"),
                table: config.get("scp_table"),
                lower_bound: primaryKey.toString(),
                upper_bound: primaryKey.plus(1).toString(),
                limit: 1
            });
            if (!result || !result.rows || result.rows.length != 1) {
                console.error(`## check_auth - failed on lookup for owner=${owner}}`);
                return false;
            }
            const user = result.rows[0];
            if (user != null && user != undefined && user.owner === owner) {

                const enc_e_email = module.exports.aesEncryption(CryptoJS.MD5(owner).toString(), config.get("api_enc_key_1"), e_email);

                if (user.e_email !== enc_e_email) { // encrypted email mismatch
                    console.log(`## check_auth - encrypted email mismatch for owner=${owner}}: (${user.e_email} row) vs (${e_email} supplied, ${enc_e_email} derived)`);
                    return false;
                }
                else { // ok
                    //console.log(`check_auth - checked OK for ${owner} - supplied: ${e_email}`);
                    return true;
                }
            }
            else {
                console.log(`## check_auth - unexpected error 1 on lookup for owner=${owner}}`);
                return false;
            }
        }
        catch (err) {
            console.log(`## check_auth - unexpected error 2 for owner=${owner}`, err);
            return false;
        }
    },

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
    },

    scpx_wallet_rpc: function (cmd, params) {
        // validate: format is for a scpx-wallet RPC command, and its params JSON encoded, e.g.
        // e.g. ./rt --rpcPort 4000 --cmd ".tx-push" --params "{\"mpk\": \"...\", \"symbol\": \"...\", \"value\": \"...\"}"
        // e.g. ./rt --rpcPort ... --rpcHost ... --rpcUsername ... --rpcPassword ... --cmd tx-push --params '{\"symbol\": \"BTC_TEST\", \"value\": \"0.00042\", \"to\": \"2MwyFPaa7y5BLECBLhF63WZVBtwSPo1EcMJ\" }'

        const rpcHost = config.get("scp_rpc_host");
        const rpcPort = config.get("scp_rpc_port");
        const rpcUsername = config.get("scp_rpc_username");
        const rpcPassword = config.get("scp_rpc_password");
        if (!rpcHost || !rpcPort || !rpcUsername || !rpcPassword) { console.error(`## scpx_wallet_rpc: missing config`); return false; }
        if (!cmd || !params) { console.error(`## scpx_wallet_rpc: missing args`); return false; }
        var parsedParams; try { parsedParams = JSON.parse(params); }
        catch (err) { console.error(`## scpx_wallet_rpc: invalid param json`); return false; }

        const https = require('https')
        const agent = new https.Agent({ host: rpcHost, port: rpcPort, path: '/',
            rejectUnauthorized: false // ### for self-signed cert - FIXME (a less bad (but still bad) version of: process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;)
        });
        const client = jayson.client.https({ host: rpcHost, port: rpcPort, agent: agent });
        const auth = { username: rpcUsername, password: rpcPassword };
        return new Promise((resolve) => {
            client.request('exec', [ auth, cmd, parsedParams], function (err, response) {
                if (err) resolve({ err: err.message || err.toString() });
                resolve({ response });
            })
        })
    }

};

function getKeyAndIV(salt, passphrase) {
    const iterations = 234
    const saltHex = CryptoJS.enc.Hex.parse(salt)
    const iv128Bits = CryptoJS.PBKDF2(passphrase, saltHex, { keySize: 128 / 32, iterations })
    const key256Bits = CryptoJS.PBKDF2(passphrase, saltHex, { keySize: 256 / 32, iterations })
    return { iv: iv128Bits, key: key256Bits }
}
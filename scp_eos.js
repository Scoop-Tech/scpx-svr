// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2020 Dominic Morris.

//
// scp_eos - scoop eos sidechain 
//

'use strict';

const BigNumber = require("bignumber.js");
const jschardet = require("jschardet");
const CryptoJS = require('crypto-js');
const LZString = require('lz-string');

const eos_lib = require('./eos_lib'); 
const config = require('./config');
const enc = require('./scp_enc.js');

// * internal authentication *
// checks that the supplied account matches supplied encrypted email 
async function check_auth(owner, e_email) {
    var eos = eos_lib.init();
    const primaryKey = new BigNumber(eos.modules.format.encodeName(owner, false));
    console.log(`check_auth... ${owner} ${e_email}`);
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
            console.log(`check_auth - unexpected error 1 on lookup for ${owner}}`);
            return false;
        }
        const user = result.rows[0];
        if (user != null && user != undefined && user.owner === owner) {

            const enc_e_email = enc.aesEncryption(CryptoJS.MD5(owner).toString(), config.get("api_enc_key_1"), e_email);

            if (user.e_email !== enc_e_email) { // encrypted email mismatch
                console.log(`check_auth - encrypted email mismatch for ${owner}}: (${user.e_email} row) vs (${e_email} supplied, ${enc_e_email} derived)`);
                return false;
            }
            else { // ok
                //console.log(`check_auth - checked OK for ${owner} - supplied: ${e_email}`);
                return true;
            }
        }
        else {
            console.log(`check_auth - unexpected error 2 on lookup for ${owner}}`);
            return false;
        }
    }
    catch (err) {
         console.log(`check_auth - lookup failed for ${owner}`, err);
         return false;
    }
};

// for getTableRows by secondary uint128 index
// e.g. 4655be51828445ffd3681a10ab6c6f81 -> 816f6cab101a68d3ff45848251be5546
function invertBytesMd5Hex(s) {
    if (!s || s === undefined || s.length != 32) throw "bad md5 hex string";
    var split = s.match(/.{1,2}/g); // split into chunks of 2 chars
    var reversed = split.slice(0).reverse();
    var ret = '';
    for (var i = 0, len = reversed.length; i < len; i++) {
        ret += reversed[i];
    }
    return ret;
};

module.exports = {

    // new account
    new_account: function (req, res) {
        var eos = eos_lib.init();
        if (!req.body) return res.sendStatus(400);

        let owner = eos_lib.gen_account_name(); 
        
        let e_email = req.body.e_email;
        let publicKeys = req.body.publicKeys;
        let h_email = req.body.h_email; 

        if (!h_email || h_email === undefined || h_email.length !== 32) { // validate email hash -- expecting MD5 32 hex chars (128 bits)
            res.status(400).send( { msg: "bad h_email" } ); return;
        }
        const h_email_ui128 = new BigNumber(h_email, 16).toFixed();

        //var scp_ac_pubkey = req.body.pubkey;
        var Eos_ecc = require('eosjs-ecc');
        if (!Eos_ecc.isValidPublic(publicKeys.owner) || !Eos_ecc.isValidPublic(publicKeys.active)) {  // validate pubkey
            res.status(400).send( { msg: "bad pubkey" } ); return; 
        }

        console.log("new_account -         owner: " + owner + "...");
        console.log("new_account -       h_email: " + h_email + "...");
        console.log("new_account - h_email_ui128: " + h_email_ui128 + "...");

        eos.transaction(tr => {
            tr.newaccount({
                creator: config.get("scp_auth_account"),
                name: owner,
                owner: publicKeys.owner,
                active: publicKeys.active 
            })
            tr.buyram({
                payer: config.get("scp_auth_account"),
                receiver: owner,
                quant: '0.1000 SYS'
            })
            tr.delegatebw({
                from: config.get("scp_auth_account"),
                receiver: owner,
                stake_net_quantity: '0.0001 SYS',
                stake_cpu_quantity: '0.0001 SYS',
                transfer: 0
            })
        })
        .then(tr_createAccount_Data => {
            var isCatch = false
            var body = {}

            console.log('$$ new_account - newaccount/buyram/delegatebw - TX DONE, txid=', tr_createAccount_Data.transaction_id);

            eos.transaction(config.get("scp_auth_account"), contract => {

                contract.newuser(owner,
                    //e_email, //** ENC
                        enc.aesEncryption(CryptoJS.MD5(owner).toString(), config.get("api_enc_key_1"), e_email),
                    h_email_ui128,
                    { authorization: [ config.get("scp_auth_account") + '@active' ] })
            })
            .then(tr_newUser => {
                console.log("$$ new_account - newuser - TX DONE, txid=", tr_newUser.transaction_id);
                body = { res: "ok", txid: tr_newUser.transaction_id, owner };
            })
            .catch(err2 => {
                console.log(err2);
                isCatch = true;
                try {
                    console.error("## new_account ERR 2 (" + JSON.stringify(err2) + ") (exec tx) [catch object doesn't propagate reliably?]");
                    const json_err = JSON.parse(err2)
                    res.statusMessage = "ERROR #2.CA " + json_err.error.details[0].message;
                    body = { msg: "ERROR #2.CA " + json_err.error.details[0].message }
                } catch(err2b) {
                    console.error("## new_account ERR 2b: " + err2);
                    res.statusMessage = "ERROR #2b.CA " + err2.toString();
                    body = { msg: "ERROR #2b.CA " + err2b.toString() }
                }
            })
            .finally(() => {
                if (isCatch) {
                    res.status(500).send(body);
                } else {
                    console.log("$$ new_account - 201 OK");
                    res.status(201).send(body);
                }
            })

        })
        .catch(err => {
            console.error("## new_account ERR 1 (creating tx): " + JSON.stringify(err, null, 2));
            res.statusMessage = "ERROR #1.CA " + err.statusText;
            res.status(500).send({ msg: "ERROR #1.CA " + err.statusText });
        })
        ;
    },

    login_v2: function (req, res) {
        var eos = eos_lib.init();
        if (!req.body) return res.sendStatus(400);

        const e_email = req.body.e_email;
        if (!e_email || e_email.length == 0)  {
            res.status(400).send({ msg: "bad email" }); return;
        }

        const h_email = req.body.h_email;
        if (!h_email || h_email === undefined || h_email.length !== 32) { // expecting MD5 32 hex chars (128 bits)
            res.status(400).send({ msg: "bad h_email" }); return;
        }
        const h_email_ui128_reversed = invertBytesMd5Hex(h_email); // hash bytes get endian-reversed when saved by the eos contract action
        
        console.log(`login_v2 -                e_email: ${e_email}`);
        console.log(`login_v2 -                h_email: ${h_email}`);
        console.log(`login_v2 - h_email_ui128_reversed: ${h_email_ui128_reversed}`);

        // retrieve by supplied email hash (secondary index)
        eos.getTableRows({
            code: config.get("scp_auth_account"),
            json: true,
            scope: config.get("scp_auth_account"),
            table: config.get("scp_table"),
            lower_bound: '0x' + h_email_ui128_reversed,
            upper_bound: '0x' + h_email_ui128_reversed,
            key_type: "i128",
            index_position: "2",
            limit: 1
        }).then(result => {
            const user = result.rows[0];
            console.dir(user);

            if (user != null && user != undefined) {
                console.log(`login_v2 - fetched -    user.owner: ${user.owner}`);
                console.log(`login_v2 - fetched -       e_email: ${user.e_email} (vs. ${e_email} supplied)`);
                console.log(`login_v2 - fetched - h_email_ui128: ${user.h_email_ui128} (vs. ${h_email} supplied)`);

                //** UNCOMPRESS (assets_json only)
                if (jschardet.detect(user.assets_json).encoding !== 'ascii') {
                    user.assets_json = LZString.decompressFromUTF16(user.assets_json);
                }
                else {
                    console.log('*** nop - (detected ASCII encoding on assets)...'); // legacy dev/test accounts
                }

                //** L2 DECRYPT (all fields)
                const dec_e_email = enc.aesDecryption(CryptoJS.MD5(user.owner).toString(), config.get("api_enc_key_1"), user.e_email);
                const dec_assets_json = enc.aesDecryption(CryptoJS.MD5(e_email + user.owner).toString(), config.get("api_enc_key_2"), user.assets_json);
                const dec_data_json = enc.aesDecryption(CryptoJS.MD5(e_email).toString(), config.get("api_enc_key_3"), user.data_json);
                user.e_email = dec_e_email;
                user.assets_json = dec_assets_json;
                user.data_json = dec_data_json;
                
                // authentication
                if (user.e_email !== e_email) { // email mismatch?
                    res.statusMessage = "ERROR #3.LI USER MISMATCH";
                    console.log(res.statusMessage);
                    res.status(400).send({ msg: res.statusMessage });
                }
                else {
                    console.log(`login_v2 - OK 200 ${user.owner}`);
                    res.status(200).send({
                        res: "ok",
                        owner: user.owner,
                        h_email_ui128: user.h_email_ui128,
                        e_email: user.e_email, 
                        assetsJSON: user.assets_json,
                        dataJSON: user.data_json,    
                    });
                }
            } else {
                res.statusMessage = "ERROR #2 USER NOT FOUND";
                console.log(res.statusMessage);
                res.status(400).send({ msg: res.statusMessage });
            }
        }).catch(err => {
            console.error("## login ERR 1: " + JSON.stringify(err.message, null, 2));
            res.statusMessage = "ERROR #1 USER NOT FOUND";
            res.status(500).send({ msg: res.statusMessage });
        })
    },

    update_assets: async function (req, res) {
        var eos = eos_lib.init();
        if (!req.body) return res.sendStatus(400);

        let owner = req.body.owner; 
        let assetsJSONRaw = req.body.assetsJSONRaw; 
        let e_email = req.body.e_email;
        if (!owner || !assetsJSONRaw || !e_email) return res.sendStatus(400);
        if (owner.length==0 || assetsJSONRaw.length==0 || e_email.length==0) return res.sendStatus(400);
        
        var authenticated = await check_auth(owner, e_email);
        console.log(`update_assets... ${owner} authenticated=${authenticated} assetsJSONRaw.len=${assetsJSONRaw.length}`);
        if (authenticated == false) {
            res.status(403).send({ msg: "PERMISSION DENIED" });
            return;
        }

        let body = {};
        let isCatch = false;
        eos.transaction(config.get("scp_auth_account"), contract => {

            //** L2 ENCRYPT
            const enc_assetsJSONRaw = enc.aesEncryption(CryptoJS.MD5(e_email + owner).toString(), config.get("api_enc_key_2"), assetsJSONRaw);

            //** COMPRESS - reduces ~50% compared to ascii, probably mostly due to utf16 alone
            const compressed_enc_assetsJSONRaw = LZString.compressToUTF16(enc_assetsJSONRaw);

            contract.setassets(owner,
                compressed_enc_assetsJSONRaw,
                { authorization: [ config.get("scp_auth_account") + '@active' ] }
            )
        })
        .then(tr_setAssets => {
            console.log("$$ update_assets - setassets - TX DONE, txid=", tr_setAssets.transaction_id);
            body = { res: "ok", txid: tr_setAssets.transaction_id, owner };
        })
        .catch(e => {
            console.error("ERROR #1.UA (" + e + ")");
            isCatch = true;

            try {
                const json_err = JSON.parse(e); 
                res.statusMessage = "ERROR #1A.UA (" + json_err.error.details[0].message + ")"; 
                body = { msg: "ERROR #1A.UA (" + json_err.error.details[0].message + ")" } ;
            } catch (err) {
                res.statusMessage = "ERROR #1B.UA " + e.toString();
                body = { msg: "ERROR #1B.UA " + e.toString() };
            }
        })
        .finally(() => {
            if (isCatch) {
                res.status(500).send(body);
            } else {
                console.log("$$ update_assets - 202 OK");
                res.status(202).send(body);
            }
        })
    },

    update_data: async function (req, res) {
        var eos = eos_lib.init();
        if (!req.body) return res.sendStatus(400);

        let owner = req.body.owner; 
        let dataJSONRaw = req.body.dataJSONRaw; 
        let e_email = req.body.e_email;
        if (!owner || !dataJSONRaw || !e_email) return res.sendStatus(400);
        if (owner.length==0 || dataJSONRaw.length==0 || e_email.length==0) return res.sendStatus(400);

        var authenticated = await check_auth(owner, e_email);
        console.log(`update_data... ${owner} authenticated=${authenticated} owner=${owner} e_email=${e_email}`);
        if (authenticated == false) {
            res.status(403).send({ msg: "PERMISSION DENIED" });
            return;
        }

        let body = {};
        let isCatch = false;
        eos.transaction(config.get("scp_auth_account"), contract => {

            contract.setdata(owner,
                //** ENCRYPT
                enc.aesEncryption(CryptoJS.MD5(e_email).toString(), config.get("api_enc_key_3"), dataJSONRaw),
                { authorization: [ config.get("scp_auth_account") + '@active' ] }
            )

            console.log("*** Update data: OK ***");
        })
        .then(tr_setData => {
            console.log("$$ update_data - setdata - TX DONE, txid=", tr_setData.transaction_id);
            body = { res: "ok", txid: tr_setData.transaction_id, owner };
        })
        .catch(e => {
            console.log("ERROR #1.UD (" + e + ")");
            isCatch = true;

            try {
                const json_err = JSON.parse(e);
                res.statusMessage = "ERROR #1A.UD (" + json_err.error.details[0].message + ")"; 
                body = { msg: "ERROR #1A.UD (" + json_err.error.details[0].message + ")" } ;
            } catch (err) {
                res.statusMessage = "ERROR #1B.UD " + e.toString()
                body = { msg: "ERROR #1B.UD " + err.toString() };
            }
        })
        .finally(() => {
            if (isCatch) {
                res.status(500).send(body);
            } else {
                console.log("$$ update_data - 202 OK");
                res.status(202).send(body);
            }
        })
    },

    delete_account: function(req, res) {
        // TODO...
    },

    // eos diag
    get_info: function (req, res) {
        var eos = eos_lib.init();
        eos.getInfo({}).then((data) => {
            res.status(200).send({ scp_nodeos_url: config.get("scp_nodeos_url"), getInfo: data });
        }).catch((e) => {
            res.status(500).send({ err: e });
        });
    },

};  
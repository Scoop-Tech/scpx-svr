// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2021 Dominic Morris.

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
const utils = require('./scp_util.js');

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

    // new_account
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

        // Validate using PublicKey.fromString instead of isValidPublic (more reliable)
        let ownerValid = false, activeValid = false;
        try {
            Eos_ecc.PublicKey.fromString(publicKeys.owner);
            ownerValid = true;
        } catch (e) {
            console.error('## new_account - owner key INVALID:', e.message);
        }

        try {
            Eos_ecc.PublicKey.fromString(publicKeys.active);
            activeValid = true;
        } catch (e) {
            console.error('## new_account - active key INVALID:', e.message);
        }

        if (!ownerValid || !activeValid) {
            console.error('## new_account - pubkey validation failed! owner:', publicKeys.owner, 'active:', publicKeys.active);
            res.status(400).send( { msg: "bad pubkey" } ); return; 
        }

        console.log(`$$ new_account: creating account ${owner} with owner=${publicKeys.owner.substring(0, 20)}... active=${publicKeys.active.substring(0, 20)}...`);

        //console.log("new_account -         owner: " + owner + "...");
        //console.log("new_account -       h_email: " + h_email + "...");
        //console.log("new_account - h_email_ui128: " + h_email_ui128 + "...");

        eos.transaction(tr => {
            tr.newaccount({
                creator: config.get("scp_auth_account"),
                name: owner,
                owner: {
                    threshold: 1,
                    keys: [{ key: publicKeys.owner, weight: 1 }],
                    accounts: [],
                    waits: []
                },
                active: {
                    threshold: 1,
                    keys: [{ key: publicKeys.active, weight: 1 }],
                    accounts: [],
                    waits: []
                }
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

            //console.log('$$ new_account - newaccount/buyram/delegatebw - TX DONE, txid=', tr_createAccount_Data.transaction_id);

            eos.transaction(config.get("scp_auth_account"), contract => {

                contract.newuser(owner,
                    //e_email, //** ENC
                        utils.aesEncryption(CryptoJS.MD5(owner).toString(), config.get("api_enc_key_1"), e_email),
                    h_email_ui128,
                    { authorization: [ config.get("scp_auth_account") + '@active' ] })
            })
            .then(tr_newUser => {
                console.log(`$$ new_account: owner=${owner} e_email=${e_email} - TX DONE, txid=`, tr_newUser.transaction_id);
                body = { res: "ok", txid: tr_newUser.transaction_id, owner };
            })
            .catch(err2 => {
                console.log(err2);
                isCatch = true;
                try {
                    console.error("## new_account: ERR 2 (" + JSON.stringify(err2) + ") (exec tx) [catch object doesn't propagate reliably?]");
                    const json_err = JSON.parse(err2)
                    res.statusMessage = "ERROR #2.CA " + json_err.error.details[0].message;
                    body = { msg: "ERROR #2.CA " + json_err.error.details[0].message }
                } catch(err2b) {
                    console.error("## new_account: ERR 2b - " + err2);
                    res.statusMessage = "ERROR #2b.CA " + err2.toString();
                    body = { msg: "ERROR #2b.CA " + err2b.toString() }
                }
            })
            .finally(() => {
                if (isCatch) {
                    res.status(500).send(body);
                } else {
                    //console.log("$$ new_account - 201 OK");
                    res.status(201).send(body);
                }
            })

        })
        .catch(err => {
            console.error("## new_account ERR 1 (creating tx):", err);
            console.error("## new_account ERR 1 - message:", err.message);
            console.error("## new_account ERR 1 - stack:", err.stack);
            const errMsg = err.message || err.statusText || err.toString();
            res.statusMessage = "ERROR #1.CA " + errMsg;
            res.status(500).send({ msg: "ERROR #1.CA " + errMsg });
        });
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
        
        // EOSIO v5/Antelope: NO byte reversal needed (was required in v1.7)
        // const h_email_ui128_reversed = invertBytesMd5Hex(h_email);
        const h_email_ui128 = new BigNumber(h_email, 16).toFixed();

        console.log(`$$ login_v2: querying table for h_email_ui128: ${h_email_ui128} (email: ${req.body.email || 'n/a'})`);

        // retrieve by supplied email hash (secondary index)
        eos.getTableRows({
            code: config.get("scp_auth_account"),
            json: true,
            scope: config.get("scp_auth_account"),
            table: config.get("scp_table"),
            lower_bound: h_email_ui128,
            upper_bound: h_email_ui128,
            key_type: "i128",
            index_position: "2",
            limit: 1
        }).then(result => {
            console.log(`$$ login_v2: getTableRows result:`, result);
            const user = result.rows[0];
            console.log(`$$ login_v2: user from rows[0]:`, user);
            //console.dir(user);

            if (user != null && user != undefined) {
                //console.log(`login_v2 - fetched -    user.owner: ${user.owner}`);
                //console.log(`login_v2 - fetched -       e_email: ${user.e_email} (vs. ${e_email} supplied)`);
                //console.log(`login_v2 - fetched - h_email_ui128: ${user.h_email_ui128} (vs. ${h_email} supplied)`);

                //** UNCOMPRESS (assets_json only)
                if (jschardet.detect(user.assets_json).encoding !== 'ascii') {
                    user.assets_json = LZString.decompressFromUTF16(user.assets_json);
                }
                else {
                    console.log('*** nop - (detected ASCII encoding on assets)...'); // legacy dev/test accounts
                }

                //** L2 DECRYPT (all fields)
                const dec_e_email = utils.aesDecryption(CryptoJS.MD5(user.owner).toString(), config.get("api_enc_key_1"), user.e_email);
                    const dec_assets_json = utils.aesDecryption(CryptoJS.MD5(e_email + user.owner).toString(), config.get("api_enc_key_2"), user.assets_json);
                const dec_data_json = utils.aesDecryption(CryptoJS.MD5(e_email).toString(), config.get("api_enc_key_3"), user.data_json);
                user.e_email = dec_e_email;
                user.assets_json = dec_assets_json;
                user.data_json = dec_data_json;
                
                // authentication
                if (user.e_email !== e_email) { // email mismatch?
                    res.statusMessage = "ERROR #3.LI USER MISMATCH";
                    console.error(`## login_v2: ${res.statusMessage} owner=${user.owner} e_email=${e_email} h_email=${h_email}`);
                    res.status(400).send({ msg: res.statusMessage });
                }
                else {
                    console.log(`$$ login_v2: owner=${user.owner} e_email=${e_email} h_email=${h_email} - OK 200`);
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
                console.error(`## login_v2: ${res.statusMessage} owner=${user.owner} e_email=${e_email} h_email=${h_email}`);
                res.status(400).send({ msg: res.statusMessage });
            }
        }).catch(err => {
            console.error("## login_v2: login ERR 1 - " + JSON.stringify(err.message, null, 2));
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
        
        var authenticated = await utils.check_auth(owner, e_email);
        //console.log(`update_assets... ${owner} authenticated=${authenticated} assetsJSONRaw.len=${assetsJSONRaw.length}`);
        if (authenticated == false) {
            res.status(403).send({ msg: "Permission denied" });
            return;
        }

        let body = {};
        let isCatch = false;
        eos.transaction(config.get("scp_auth_account"), contract => {

            //** L2 ENCRYPT
            const enc_assetsJSONRaw = utils.aesEncryption(CryptoJS.MD5(e_email + owner).toString(), config.get("api_enc_key_2"), assetsJSONRaw);

            //** COMPRESS - reduces ~50% compared to ascii, probably mostly due to utf16 alone
            const compressed_enc_assetsJSONRaw = LZString.compressToUTF16(enc_assetsJSONRaw);

            contract.setassets(owner,
                compressed_enc_assetsJSONRaw,
                { authorization: [ config.get("scp_auth_account") + '@active' ] }
            )
        })
        .then(tr_setAssets => {
            console.log(`$$ update_assets: owner=${owner} e_email=${e_email} txid=${tr_setAssets.transaction_id} - OK 200`);
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
                //console.log("$$ update_assets - 202 OK");
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

        var authenticated = await utils.check_auth(owner, e_email);
        //console.log(`update_data... authenticated=${authenticated} owner=${owner} e_email=${e_email}`);
        if (authenticated == false) {
            res.status(403).send({ msg: "Permission denied" });
            return;
        }

        let body = {};
        let isCatch = false;
        eos.transaction(config.get("scp_auth_account"), contract => {
            contract.setdata(owner,
                //** ENCRYPT
                utils.aesEncryption(CryptoJS.MD5(e_email).toString(), config.get("api_enc_key_3"), dataJSONRaw),
                { authorization: [ config.get("scp_auth_account") + '@active' ] }
            )
            //console.log("*** Update data: OK ***");
        })
        .then(tr_setData => { 
            console.log(`$$ update_data: owner=${owner} e_email=${e_email} txid=${tr_setData.transaction_id} - OK 200`);
            body = { res: "ok", txid: tr_setData.transaction_id, owner };
        })
        .catch(e => {
            console.error("## update_data: ERROR #1.UD (" + e + ")");
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
                //console.log("$$ update_data - 202 OK");
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
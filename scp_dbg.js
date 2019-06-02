// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019 Dominic Morris.

//
// scp_dbg - dbg/test
//

'use strict';

const BigNumber = require("bignumber.js");

module.exports = {

    single: function (req, res) { // single row, by PK (scp_ac_name)
        var eos_lib = require('./eos_lib'); 
        var eos = eos_lib.init();
        var config = require('./config');
        let scp_ac_name = req.params.owner;
        const primaryKey = new BigNumber(eos.modules.format.encodeName(scp_ac_name, false))
        eos.getTableRows({
            code: config.get("scp_auth_account"),
            json: true,
            scope: config.get("scp_auth_account"),
            table: config.get("scp_table"),
            lower_bound: primaryKey.toString(),
            upper_bound: primaryKey.plus(1).toString(),
            //key_type: "i64",
            //index_position: "1",
            limit: 1
        }).then(result => {
            //console.log(result);
            const user = result.rows[0];
            console.log(user);
            console.log("email_hash: " + user.email_hash);
            console.log("created_at: " + user.created_at);

            res.status(200).send({ res: "ok", count: result.rows.length, data: result }); 
        })
    },

    idx2: function (req, res) {
        var eos_lib = require('./eos_lib'); 
        var eos = eos_lib.init();
        var config = require('./config');
        console.log('idx3');
        eos.getTableRows({
            code: config.get("scp_auth_account"),
            json: true,
            scope: config.get("scp_auth_account"),
            table: config.get("scp_table"),
            lower_bound: '0x816f6cab101a68d3ff45848251be5546',
            upper_bound: '0x816f6cab101a68d3ff45848251be5546',
            key_type: "i128",
            index_position: "2",
            limit: 1
        }).then(result => {
            //console.log(result);
            const user = result.rows[0];
            console.log(user);

            res.status(200).send({ res: "ok", count: result.rows.length, data: result }); 
        })
        .catch(err => {
            console.log('err=', err);
        })
    },

    top: function (req, res) {
        var eos_lib = require('./eos_lib'); 
        var eos = eos_lib.init();
        var config = require('./config');
        var n = req.params.n;
        eos.getTableRows({
            code: config.get("scp_auth_account"),
            json: true,
            scope: config.get("scp_auth_account"),
            table: config.get("scp_table"),
            limit: n
        }).then(result => {
            console.log(result);
            res.status(200).send({ res: "ok", count: result.rows.length, data: result }); 
        })
    },
    
    test1: function (req, res) {
        var eos_lib = require('./eos_lib'); var eos = eos_lib.init();
        var callback = (err, data) => {
            if (err) {
                console.log("## getInfo ERR: " + JSON.stringify(err, null, 2));
                res.send({err: "undefined"});
                return;
            }
            console.log("$$ getInfo OK: " + JSON.stringify(data, null, 2));
            var p1 = req.params.p1;
            console.log("p1 = " + p1);
            res.send(JSON.stringify({
                hey: "ok3",
                p1: p1,
                getInfo: data,
            }));
        };
        eos.getInfo({}, callback);
    },

    test_sql: async function (req, res) {
        // test sql
        const sql = require('mssql');
        var p1 = req.params.p1;

        sql_pool.request().input('a', sql.NVarChar, `%${p1}%`)
        .query(`select * from _scpx_ref where referer_id like @a`)
        .then((result) => {
            console.dir(result);
            var data = result.recordset;
            res.status(200).send ({ res: "ok", count: data.length, data: data }); 
        }).catch(err => {
            console.warn(`## SQL failed: ${err.message}`, err);
            res.status(500).send ({ msg: "DATA ERROR" }); 
        })
    },

    // test_enc: async function (req, res) {
    //     const enc = require('./scp_enc.js');
    //     var config = require('./config');
    //     var p1 = req.params.p1;
    //     const salt128 = '1';
    //     const data = enc.aesEncryption(salt128, config.get("api_enc_key_1"), p1);
    //     res.status(200).send({ res: "ok", enc: data }); 
    // },
    // test_dec: async function (req, res) {
    //     const enc = require('./scp_enc.js');
    //     var config = require('./config');
    //     var p1 = req.params.p1;
    //     const salt128 = '1';
    //     const data = enc.aesDecryption(salt128, config.get("api_enc_key_1"), p1);
    //     res.status(200).send({ res: "ok", dec: data }); 
    // },

};
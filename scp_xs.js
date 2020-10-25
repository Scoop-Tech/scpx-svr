// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2020 Dominic Morris.

//
// scp_xs -- exchange service(s)
//

'use strict';

const CryptoJS = require("crypto-js");
const config = require('./config');
const sql = require('mssql');

module.exports = {

    changelly_sign: function (req, res) { // sign changelly api call

        if (!req.body || !req.body.rpc_params) {
            res.status(400).send( { msg: "bad params (1)" } ); return;
        }
    
        const rpc_params_json = req.body.rpc_params;
        if (rpc_params_json.length == 0) {
            res.status(400).send( { msg: "bad params (2)" } ); return;
        }

        // string json to obj
        const o_rpc_params = JSON.parse(rpc_params_json);
        if (!o_rpc_params) {
            res.status(400).send( { msg: "bad params (3)" } ); return;
        }
        console.log("$$ changelly_sign - o_rpc_params=", o_rpc_params);

        // save
        if (o_rpc_params.method === 'createFixTransaction' || o_rpc_params.method === 'createTransaction') {
            const p = o_rpc_params.params
            const from = p.from
            const to = p.to
            const address = p.address
            const amount = p.amount
            const rateId = p.rateId
            scp_sql_pool.request()
            .input('from', sql.NVarChar, `${from}`)
            .input('to', sql.NVarChar, `${to}`)
            .input('address', sql.NVarChar, `${address}`)
            .input('amount', sql.Decimal(14,8), `${amount}`)
            .input('rateId', sql.NVarChar, `${rateId}`)
            .query(`INSERT INTO [_scpx_xs_tx] VALUES (GETUTCDATE(), @from, @to, @address, @amount, @rateId, 'CHANGELLY')`)
            .then((result) => {
                console.log(`changelly_sign - xs_tx save ok (amount=${amount})`, result.rowsAffected);
            }).catch(err => {
                console.warn(`## changelly_sign - SQL failed: ${err.message}`, err);
            })
        }

        // sign
        const sign = CryptoJS.HmacSHA512(JSON.stringify(o_rpc_params), config.get("changelly_api_secret"));
        const sig = sign.toString()
        console.log(`$$ changelly_sign - DONE (${rpc_params_json}), sig=`, sig);

        res.status(200).send({ res: "ok", data: sig }); 
    },

};
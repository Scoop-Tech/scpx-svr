// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2025 Dominic Morris.

//
// scp_cm -- cryptomail
//

/*'use strict';

const jayson = require('jayson');
const CryptoJS = require("crypto-js");
const config = require('./config');
const sql = require('mssql');

module.exports = {

    new_otu: async function (req, res) { // new one time use address

        // validation
        if (!req.query || !req.query.symbol) { res.status(400).send( { msg: "bad params (1)" } ); return; }
        const symbol = req.query.symbol;
        if (symbol.length == 0) { res.status(400).send( { msg: "bad params (2)" } ); return; }

        try {

            // create new OTU address in server wallet
            const rpc_otu = await rpc_op("wallet-add-address", { symbol, save: true });

            if (!rpc_otu || !rpc_otu.result || !rpc_otu.result.ok) {
                res.status(500).send({ msg: 'Unexpected or invalid RPC response (1)' });
                return;
            }
            const walletAddAddr = rpc_otu.result.ok.walletAddAddr
            if (!walletAddAddr || !walletAddAddr.newAddr || !walletAddAddr.newAddr.addr) {
                res.status(500).send({ msg: 'Unexpected or invalid RPC response (2)' });
                return;
            }

            const otuAddr = walletAddAddr.newAddr.addr;
            const otuSymbol = walletAddAddr.newAddr.symbol;

            // 
            
            res.status(200).send({ res: "ok", data: { otuAddr, otuSymbol } });

            // save
            // if (o_rpc_params.method === 'createFixTransaction' || o_rpc_params.method === 'createTransaction') {
            //     const p = o_rpc_params.params
            //     const from = p.from
            //     const to = p.to
            //     const address = p.address
            //     const amount = p.amount
            //     const rateId = p.rateId
            //     sql_pool.request()
            //     .input('from', sql.NVarChar, `${from}`)
            //     .input('to', sql.NVarChar, `${to}`)
            //     .input('address', sql.NVarChar, `${address}`)
            //     .input('amount', sql.Decimal(14,8), `${amount}`)
            //     .input('rateId', sql.NVarChar, `${rateId}`)
            //     .query(`INSERT INTO [_scpx_xs_tx] VALUES (GETUTCDATE(), @from, @to, @address, @amount, @rateId, 'CHANGELLY')`)
            //     .then((result) => {
            //         console.log(`changelly_sign - xs_tx save ok (amount=${amount})`, result.rowsAffected);
            //     }).catch(err => {
            //         console.warn(`## changelly_sign - SQL failed: ${err.message}`, err);
            //     })
            // }
        }
        catch (err) {
            res.status(500).send({ msg: err });
        }
    },
}

function rpc_op(cmd, params) {
    const agent = new require('https').Agent({
        host: config.get("scp_rpc_host"),
        port: config.get("scp_rpc_port"),
        path: '/',
        rejectUnauthorized: false  // ### for self-signed cert - FIXME (a less bad (but still bad) version of: process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;)
    });

    const client = jayson.client.https({
        host: config.get("scp_rpc_host"),
        port: config.get("scp_rpc_port"),
        agent: agent
    });

    const auth = { username: config.get("scp_rpc_username"), password: config.get("scp_rpc_password") };
    return new Promise((resolve) => {
        client.request('exec', [auth, cmd, params], function (err, response) {
            if (err) {
                console.error(`## failed RPC`, err)
                resolve(null)
            }
            else if (response.error) {
                console.error(`## RPC unexpected error response`, response.error)
                resolve(null)
            }
            else if (response.result) {
                console.log(`RPC response OK:`, response.result)
                resolve(response)
            }
        });
    });
}*/
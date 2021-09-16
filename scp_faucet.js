// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2021 Dominic Morris.

//
// scp_faucet -- gives out test crypto
//

'use strict';

const eos_lib = require('./eos_lib'); 
const sql = require('mssql');
const WAValidator = require('scp-address-validator').validate

const utils = require('./scp_util.js');

module.exports = {

    faucet_drip: async function (req, res) {
        if (!req.body) return res.sendStatus(400);
        const config = require('./config');
       
        // validation
        let owner = req.body.owner; 
        let e_email = req.body.e_email;
        let btc_test_addr = req.body.btc_test_addr;
      //let btc_bech32_test_addr = req.body.btc_bech32_test_addr;
        let eth_test_addr = req.body.eth_test_addr;
        if (!owner || !e_email) return res.sendStatus(400);
        if (owner.length==0 || e_email.length==0) return res.sendStatus(400);

        var isValid_BtcTest, isValid_EthTest
        if (btc_test_addr && btc_test_addr.length > 0) {
            isValid_BtcTest = WAValidator(btc_test_addr, 'BTC', 'testnet'); // or... 'BECH32', 'prod'
            if (!isValid_BtcTest) return res.status(400).send(`Invalid BTC_TEST address`);
        }
        if (eth_test_addr && eth_test_addr.length > 0) {
            isValid_EthTest = WAValidator(eth_test_addr, 'ETH', 'testnet'); 
            if (!isValid_EthTest) return res.status(400).send(`Invalid ETH_TEST address`);
        }

        // authentication
        const authenticated = await utils.check_auth(owner, e_email);
        if (authenticated == false) {
            return res.status(403).send({ msg: "Permission denied" });
        }

        // get last drip datetime from DB; only drip once for this owner & asset
        const dripBtc = isValid_BtcTest && (await exists(owner, 'BTC_TEST') == false);
        const dripEth = isValid_EthTest && (await exists(owner, 'ETH_TEST') == false);
        //console.log('dripBtc', dripBtc);
        //console.log('dripEth', dripEth);
        const MIN_BTC_TEST = 0.1, DRIP_BTC_TEST = 0.00003; // 3k Sats
        const MIN_ETH_TEST = 1.0, DRIP_ETH_TEST = 0.0001;
        if (dripBtc || dripEth) {
            // todo: get/validate balance from wallet first...
            const op = await utils.scpx_wallet_rpc('wallet-balance', JSON.stringify({ }));
            if (op && op.response && op.response.result && op.response.result.ok) {
                if (dripBtc) {
                    const btcBal = op.response.result.ok.balances.find(p => p.symbol === 'BTC_TEST');
                    if (!btcBal || btcBal.conf < MIN_BTC_TEST) {
                        console.error(`## faucet_drip: insufficient confirmed BTC_TEST in faucet`, JSON.stringify(btcBal));
                        return res.status(400).send('Faucet has run out of BTC_TEST');
                    }
                }
                if (dripEth) {
                    const btcBal = op.response.result.ok.balances.find(p => p.symbol === 'ETH_TEST');
                    if (!btcBal || btcBal.conf < MIN_ETH_TEST) {
                        console.error(`## faucet_drip: insufficient confirmed ETH_TEST in faucet`, JSON.stringify(btcBal));
                        return res.status(400).send('Faucet has run out of ETH_TEST');
                    }
                }
            }
            else { 
                console.error(`## faucet_drip: unexpected RPC(wallet-balance) return - `, JSON.stringify(op));
                return res.status(400).send('Failed getting faucet balance');
            }
        }

        // RPC: send testnet btc & eth
        const btc_test = dripBtc ? await send(res, owner, 'BTC_TEST', DRIP_BTC_TEST, btc_test_addr) : {};
        const eth_test = dripEth ? await send(res, owner, 'ETH_TEST', DRIP_ETH_TEST, eth_test_addr) : {};
        res.status(201).send({ res: "ok", btc_test, eth_test });
    },
};

const send = async (res, owner, symbol, value, to) => {
    const op = await utils.scpx_wallet_rpc('tx-push', JSON.stringify({ symbol, value, to }));
    if (op && op.response && op.response.result && op.response.result.ok) {
        console.log(`$$ faucet_drip: dripped ${value} ${symbol} to ${to} for owner=${owner}`);
        const save = await scp_sql_pool.request()
            .input('owner', sql.NVarChar, `${owner}`)
            .input('symbol', sql.NVarChar, `${symbol}`)
            .input('txid', sql.NVarChar, `${op.response.result.ok.txid}`)
            .query(`INSERT INTO [_scpx_faucet_drip] VALUES (@owner, GETUTCDATE(), @symbol, @txid)`)
            .catch(err => {
                console.error(`## faucet_drip - INSERT failed! ${err.message}`, err);
            });
        return { txid: op.response.result.ok.txid, value };
    }
    else { 
        console.error(`## faucet_drip: unexpected RPC(tx-push(${symbol})) return - `, JSON.stringify(op)); 
        //res.status(400).send(`Failed sending ${symbol}`);
        return { err: `Failed sending ${symbol}` };
    }
}

const exists = async (owner, asset_symbol) => {
    const result = await global.scp_sql_pool.request()
    .input('owner', sql.NVarChar, `${owner}`)
    .input('asset_symbol', sql.NVarChar, `${asset_symbol}`)
    .query(`SELECT TOP 1 [id] FROM [_scpx_faucet_drip] WHERE [owner] = @owner and [asset_symbol] = @asset_symbol`)
    .catch(err => {
        console.error(`## faucet_drip: SQL failed - ${err.message}`);
    });
    return result && result.recordset.length > 0;
}

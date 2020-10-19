// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019,20 Dominic Morris.

//
// scp_stm - StMaster / Scoop Wallet integration
//

'use strict';
const Web3 = require('web3');
const BigNumber = require("bignumber.js");
const config = require('./config');

module.exports = {

    get_sec_tokens: async function (req, res) {

        try {
            const warn = [];

            // read last deployed CFT-C from n AC/SD DBs
            const sql = require('mssql');
            var ret = [];
            for (let i=0 ; i < global.stm_sql_pools.length ; i++) {
                // get last deployed controller, on Ropsten
                const stm_pool = global.stm_sql_pools[i];
                const result = await stm_pool.request().query(`select top 1 * from [contract] where [network_id] = 3 and [contract_type] = 'CASHFLOW_CONTROLLER' order by [id] desc`)
                //console.dir(result);
                //ropsten_CFT_Cs = ropsten_CFT_Cs.concat(result.recordset);
                const CFT_C = result.recordset[0];
                console.log('CFT_C', CFT_C);

                // get controller's WL, sealed & collateral values
                const cftc_results = await Promise.all([
                    web3_call('getContractSeal', [], CFT_C.network_id, CFT_C.addr, CFT_C.abi),
                    web3_call('getWhitelist', [], CFT_C.network_id, CFT_C.addr, CFT_C.abi),
                    web3_call('getCcyTypes', [], CFT_C.network_id, CFT_C.addr, CFT_C.abi),
                ]);
                const [cftc_getContractSeal, cftc_WL, cftc_ccyTypes] = cftc_results;
                console.log('cftc_getContractSeal', cftc_getContractSeal);
                console.log('cftc_WL.length', cftc_WL.length);
                console.log('cftc_ccyTypes.length', cftc_ccyTypes.length);
                if (!cftc_getContractSeal) warn.push('Controller is not sealed');
                if (cftc_WL.length == 0) warn.push('Controller has no whitelist defined');

                // unpack CFT-C's base types
                const spotTypes = (await web3_call('getSecTokenTypes', [], CFT_C.network_id, CFT_C.addr, CFT_C.abi,)).tokenTypes.filter(p => p.settlementType == 1/*SPOT*/);
                console.log(CFT_C.contract_enum, spotTypes.map(p => p.name));
                const ops = spotTypes.map(p => new Promise(async (resolve, reject) => {
                    const base = p;
                    try {
                        console.log('base.cashflowBaseAddr', base.cashflowBaseAddr);
                        const result2 = await stm_pool.request().query(`select * from [contract] where addr = '${base.cashflowBaseAddr}'`);
                        console.log('result2', result2);
                        const db_cft_base = result2.recordset[0];

                        // read base info (note: uses CFT-C ABI for calls on base CFT-B's...)
                        const cftb_results = await Promise.all([
                            web3_call('name', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('symbol', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('version', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('unit', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('getContractSeal', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('getWhitelist', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('getCashflowData', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                        ]);
                        // const base_name = await web3_call('name', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi);
                        // const base_symbol = await web3_call('symbol', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi);
                        // const base_version = await web3_call('version', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi);
                        // const base_unit = await web3_call('unit', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi);
                        // const base_getContractSeal = await web3_call('getContractSeal', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi);
                        // const base_WL = await web3_call('getWhitelist', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi);
                        // const base_getCashflowData  = await web3_call('getCashflowData', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi);
                        const [base_name, base_symbol, base_version, base_unit, base_getContractSeal, base_WL, base_getCashflowData] = cftb_results;
                        // TODO: .... max supply, batch[0] metadata inc. "issuer", cashflowArgs...

                        if (!base_getContractSeal) warn.push(`Base ${base.name} is not sealed`);
                        if (base_WL.length == 0) warn.push(`Base ${base.name} has no whitelist defined`);
                        if (base_WL.length != cftc_WL.length) warn.push(`Base ${base.name} / controller whitelist mismatch`);


                        console.log(`${base.name} base_name`, base_name);
                        console.log(`${base.name} base_symbol`, base_symbol);
                        console.log(`${base.name} base_version`, base_version);
                        console.log(`${base.name} base_unit`, base_unit);
                        console.log(`${base.name} base_getContractSeal`, base_getContractSeal);
                        console.log(`${base.name} base_WL.length`, base_WL.length);
                        console.log(`${base.name} base_getCashflowData`, base_getCashflowData);
                        console.log(`${base.name} base_getCashflowData.args`, base_getCashflowData.args);
                        const parsedCashflowData = parseWeb3Struct(base_getCashflowData);
                        parsedCashflowData.args = parseWeb3Struct(base_getCashflowData.args);
                        console.log('parsedCashflowData', parsedCashflowData);

                        resolve({ 
                            base_name, base_symbol, base_version, base_unit, base_getContractSeal, wlCount: base_WL.length, base_getCashflowData: parsedCashflowData
                        });
                    }
                    catch(ex) {
                        reject(ex.toString());
                    }
                }));
                const results = await Promise.all(ops);
                console.log(results);
                ret = ret.concat(results);
            }

            res.status(200).send ({ res: "ok", count: ret.length, data: ret, }); 
        }
        catch(ex) {
            res.status(500).send({ msg: ex.toString() });
            return;
        }
    },
};

function parseWeb3Struct(s) {
    var ret = {};
    if (s === undefined) throw ('Unexpected web3 struct data');
    for (const [key, value] of Object.entries(s)) {
        if (isNaN(key)) {
            console.log(`key=${key}, bignumber(value)=${(value instanceof BigNumber)},  value=`, value);
            ret[key] = value.toString();
        }
    }
    return ret;
}

function getWeb3(network_id) {
    const context =
        network_id == 3 ? { web3: new Web3(config.get('geth_http_ropsten')), ethereumTxChain: { chain: 'ropsten', hardfork: 'petersburg' } }
        : undefined;
    if (!context) throw('Bad network_id');
    return context;
}

async function web3_call(methodName, methodArgs, networkId, addr, ABI, fromAddr) {
    const { web3, ethereumTxChain } = getWeb3(networkId);
    console.log(` > CALL: [@${addr}] ${methodName + '(' + methodArgs.map(p => JSON.stringify(p)).join() + ')'}` + ` [networkId: ${networkId} - ${web3.currentProvider.host}]`);
    var contract = new web3.eth.Contract(JSON.parse(ABI), addr);
    //if ((await contract.methods['version']().call()) != contractDb.contract_ver) throw('Deployed contract missing or version mismatch');
    if (fromAddr) {
        return await contract.methods[methodName](...methodArgs).call({from: fromAddr});
    }
    else {
        return await contract.methods[methodName](...methodArgs).call();
    }
}
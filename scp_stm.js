// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2020 Dominic Morris.

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
            var base_types = [];
            //for (let i=0 ; i < global.stm_sql_pools.length ; i++) {
                // get last deployed controller, on Ropsten
                //const stm_pool = global.stm_sql_pools[i];
                const stm_pool = global.stm_sql_pool;

                const result = await stm_pool.request().query(`select top 1 * from [contract] where [network_id] = 3 and [contract_type] = 'CASHFLOW_CONTROLLER' order by [id] desc`)
                //console.dir(result);
                //ropsten_CFT_Cs = ropsten_CFT_Cs.concat(result.recordset);
                const CFT_C = result.recordset[0];
                //console.log('CFT_C', CFT_C);

                // get controller's WL, sealed & collateral values
                const cftc_results = await Promise.all([
                    web3_call('getContractSeal', [], CFT_C.network_id, CFT_C.addr, CFT_C.abi),
                    web3_call('getWhitelist', [], CFT_C.network_id, CFT_C.addr, CFT_C.abi),
                    //web3_call('getCcyTypes', [], CFT_C.network_id, CFT_C.addr, CFT_C.abi),
                    web3_call('version', [], CFT_C.network_id, CFT_C.addr, CFT_C.abi),
                ]);
                const [cftc_sealed, cftc_WL, //cftc_ccyTypes,
                        cftc_version] = cftc_results;
                console.log('cftc_getContractSeal', cftc_sealed);
                console.log('cftc_WL.length', cftc_WL.length);
                //console.log('cftc_ccyTypes.length', cftc_ccyTypes.length);
                console.log('cftc_version', cftc_version);
                if (!cftc_sealed) warn.push('Controller is not sealed');
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

                        // read base info (note: uses CFT-B's ABI is slightly different from CFT-C's)
                        const cftb_results = await Promise.all([
                            web3_call('name', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('symbol', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('version', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('totalSupply', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('unit', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('getContractSeal', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('getWhitelist', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                            web3_call('getCashflowData', [], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi),
                        ]);
                        var [base_name, base_symbol, base_version, base_totalSupply, base_unit, base_sealed, base_WL, base_cfd] = cftb_results;
                        
                        // read uni-batch, if minted
                        var base_uniBatch, parsed_uniBatch;
                        if (base_cfd.issuer != "0x0000000000000000000000000000000000000000") {
                            base_uniBatch = await web3_call('getSecTokenBatch', [1], CFT_C.network_id, base.cashflowBaseAddr, db_cft_base.abi);
                            console.log('base_uniBatch', base_uniBatch);
                            parsed_uniBatch = parseWeb3Struct(base_uniBatch);
                            parsed_uniBatch.origTokFee = parseWeb3Struct(base_uniBatch.origTokFee);
                        }

                        if (!base_sealed) warn.push(`Base ${base.name} is not sealed`);
                        if (base_WL.length == 0) warn.push(`Base ${base.name} has no whitelist defined`);
                        if (base_WL.length != cftc_WL.length) warn.push(`Base ${base.name} / controller whitelist mismatch`);

                        console.log(`${base.name} base_name`, base_name);
                        console.log(`${base.name} base_symbol`, base_symbol);
                        console.log(`${base.name} base_version`, base_version);
                        console.log(`${base.name} base_unit`, base_unit);
                        console.log(`${base.name} base_getContractSeal`, base_sealed);
                        console.log(`${base.name} base_WL.length`, base_WL.length);
                        console.log(`${base.name} base_getCashflowData`, base_cfd);
                        console.log(`${base.name} base_getCashflowData.args`, base_cfd.args);
                        
                        // parse from web3 return format to something more friendly
                        const parsed_cfd = parseWeb3Struct(base_cfd);
                        parsed_cfd.args = parseWeb3Struct(base_cfd.args);
                        console.log('parsed_cfd', parsed_cfd);
                        
                        base_totalSupply = parseInt(Number(base_totalSupply['_hex']), 10);
                        console.log('base_totalSupply', base_totalSupply);

                        resolve({ 
                            //network_id: 3,
                            //cftc: {
                            //     cft_addr: CFT_C.addr,
                            //     cftc_version,
                            //     cftc_sealed,
                            //     cftc_wl_length: cftc_WL.length, 
                            //     //cftc_ccyTypes: (cftc_ccyTypes.ccyTypes),
                            //},
                            base_addr: db_cft_base.addr,
                            base_url: `${config.get('stm_web_base')}${base_symbol}`,
                            base_version,
                            base_sealed,
                            base_wl_length: base_WL.length, 
                            base_name,
                            base_symbol,
                            base_totalSupply,
                            base_unit,
                            base_cfd: parsed_cfd,
                            base_uniBatch: parsed_uniBatch,
                        });
                    }
                    catch(ex) {
                        reject(ex.toString());
                    }
                }));
                const results = await Promise.all(ops);
                console.log(results);
                base_types = base_types.concat(results);
            //}

            res.status(200).send ({ res: "ok", warn, count: base_types.length, data: { 
                network_id: 3,
                cftc: {
                    cft_addr: CFT_C.addr,
                    cftc_version,
                    cftc_sealed,
                    cftc_wl_length: cftc_WL.length, 
                    //cftc_ccyTypes: (cftc_ccyTypes.ccyTypes),
                },
                base_types, 
            }}); 
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
            if (value.length > 0) // preserve arrays
                ret[key] = value;
            // else if (value['_hex'] !== undefined) // convert from BN representation, e.g. {_hex: "0x0f4240"} 
            //     ret[key] = parseInt(Number(value['_hex']), 10);
            else
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
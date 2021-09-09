// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2021 Dominic Morris.

//
// scp_ext - external 3PBP(s) - DEPRECATED - unused
//

/*'use strict';

var axios = require('axios'); 

const ext_bc_config = require('./ext_bc_config');

// blockcypher
// check limits - https://api.blockcypher.com/v1/tokens/e47f00049b034e62bc70648377c3a409
module.exports = {
    // get balance
    address_balance: (req, res) => {
        var asset = req.params.asset.toLowerCase();
        var address = req.params.address;
        //console.log(`scp_ext :: address_balance -- asset: ${asset}, address: ${address}...`);

        axios
            .get(ext_bc_config.address_balance(asset, address))
            .then(bc_res => {
                res.status(200).send(bc_res.data);
            })
            .catch(err => {
                console.log(`## scp_ext :: (BlockCypher) address_balance -- ${err.response.status} ${err.message}!`, err);
                res.status(err.response.status || 500).send({
                    msg: err.response.data || err.message
                })
            })
    },

    // get address full
    address_full: (req, res) => {
        var asset = req.params.asset.toLowerCase();
        var address = req.params.address;
        //console.log(`scp_ext :: address_full -- asset: ${asset}, address: ${address}...`);

        axios
            .get(ext_bc_config.address_full(asset, address))
            .then(bc_res => {
                res.status(200).send(bc_res.data);
            })
            .catch(err => {
                console.log(`## scp_ext :: (BlockCypher) address_full -- ${err.response.status} ${err.message}!`, err);
                res.status(err.response.status || 500).send({
                    msg: err.response.data || err.message
                })
            })
    },

    // new tx
    new_tx: (req, res) => {
        if (!req.body) return res.sendStatus(400);
        const asset = req.params.asset.toLowerCase();
        const params = req.body;

        axios
            .post(ext_bc_config.new_tx(asset), params)
            .then(bc_res => {
                res.status(200).send(bc_res.data);
            })
            .catch(err => {
                if (err.response) {
                    console.log(`## scp_ext :: (BlockCypher) err.response=`, err.response)
                        if (err.response.data) {
                            console.log(`## scp_ext :: (BlockCypher) err.response.data=`, err.response.data)
                        }
                }
                console.log(`## scp_ext :: (BlockCypher) new_tx -- ${err.response.status} ${err.message}!`);
                res.status(err.response.status || 500).send({
                    msg: err.response.data || err.message
                })
            })
    },

    // new tx
    push_tx: (req, res) => {
        if (!req.body) return res.sendStatus(400);
        const asset = req.params.asset.toLowerCase();
        const params = req.body;

        axios
            .post(ext_bc_config.push_tx(asset), params)
            .then(bc_res => {
                res.status(bc_res.status || 201).send(bc_res.data);
            })
            .catch(err => {
                console.log(`## scp_ext :: (BlockCypher) push_tx -- ${err.response.status} ${err.message}!`, err);
                res.status(err.response.status || 500).send({
                    msg: err.response.data || err.message
                })
            })
    }
};*/

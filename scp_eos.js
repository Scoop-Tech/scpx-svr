'use strict';

// TODO: script deployments for SCPX and owner ac (then deploy to dev, i.e. ay-scp2)

module.exports = {
    // new member account
    new_account: function (req, res) {
        console.log(req.params)

        let scp_ac_name = req.params.accountName;
        let publicKeys = req.params.publicKeys;

        var eos_lib = require('./eos_lib'); var eos = eos_lib.init();
        var config = require('./config');

        // validate pubkey
        var scp_ac_pubkey = req.params.pubkey;
        var Eos_ecc = require('eosjs-ecc');
        if (!Eos_ecc.isValidPublic(publicKeys.owner) || !Eos_ecc.isValidPublic(publicKeys.active)) { 
            res.status(400/*badreq*/).send( { err: "bad pubkey" } ); 
            return; 
        }

        // todo - deterministic base32 hash from pubkey would be better
        // var scp_ac_name = eos_lib.gen_account_name(); 

        // todo - check account/pubkey already exists (SCPX lookup?)
        
        // create
        var callback = (err, data) => {
            if (err) {
                console.log("## new_account ERR: " + JSON.stringify(err, null, 2));
                res.status(500).send({err: "undefined"});
                return;
            }
            console.log("$$ new_account OK: " + JSON.stringify(data, null, 2));
            res.status(201/*created*/).send({ res: "ok", txid: data.transaction_id, scp_ac_name: scp_ac_name }); 
        };

        var ret = eos.transaction(tr => {
            tr.newaccount({
                creator: config.get("scp_auth_account"),
                name: scp_ac_name,
                owner: publicKeys.owner,
                active: publicKeys.active 
            })
            tr.buyrambytes({
                payer: config.get("scp_auth_account"),
                receiver: scp_ac_name,
                bytes: 4096
            })
            // tr.delegatebw({
            //     from: config.get("scp_auth_account"),
            //     receiver: scp_ac_name,
            //     stake_net_quantity: '10.0000 EOS',
            //     stake_cpu_quantity: '10.0000 EOS',
            //     transfer: 0
            // })
        }, callback);
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

        eos.getInfo({}, callback);//.then(data => { 
    }
};
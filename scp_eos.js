'use strict';

// TODO: script deployments for SCPX and owner ac (then deploy to dev, i.e. ay-scp2)

module.exports = {
    // new member account
    new_account: function (req, res) {
        if (!req.body) return res.sendStatus(400);

        var eos_lib = require('./eos_lib'); 
        var eos = eos_lib.init();
        var config = require('./config');

        let scp_ac_name = eos_lib.gen_account_name(); 
        let encryptedEmail = req.body.email;
        let publicKeys = req.body.publicKeys;

        // validate pubkey
        var scp_ac_pubkey = req.body.pubkey;
        var Eos_ecc = require('eosjs-ecc');
        if (!Eos_ecc.isValidPublic(publicKeys.owner) || !Eos_ecc.isValidPublic(publicKeys.active)) { 
            res.status(400/*badreq*/).send( { err: "bad pubkey" } ); 
            return; 
        }

        // todo - deterministic base32 hash from pubkey would be better
        // var scp_ac_name = eos_lib.gen_account_name(); 

        // todo - check account/pubkey already exists (SCPX lookup?)

        eos.transaction(tr => {
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
        }).then(data => {
            console.log("$$ new_account OK: " + JSON.stringify(data, null, 2));

            eos.transaction(config.get("scp_auth_account"), contract => {
                contract.uputx2(scp_ac_name, encryptedEmail, { authorization: [ config.get("scp_auth_account") + '@active' ] })

                console.log("Encrypted email recorded.")
            }).catch(e => {
                console.log(e)
            })
            
            res.status(201).send({ res: "ok", txid: data.transaction_id, scp_ac_name: scp_ac_name }); 
        }).catch(err => {
            console.log("## new_account ERR: " + JSON.stringify(err, null, 2));

            Promise.resolve(err)
                .then(JSON.parse)
                .then(res.status(500).json(err))
                .catch(res.status(500));
        });
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
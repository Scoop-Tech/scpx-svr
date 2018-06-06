'use strict';

module.exports = {
//var scp_eos = function() {
//    return {
        test1: function (req, res) {
            var config = require('./config');
            var Eos = require('eosjs');

            var keyProvider_privkey = config.get("scp_auth_privkey");
            var keyProvider_pubkey = config.get("scp_auth_pubkey");
            var eos = Eos( {
                keyProvider: keyProvider_privkey,
                httpEndpoint: config.get("scp_nodeos_url"),
                expireInSeconds: 60,
                broadcast: true,
                debug: false, // API and transactions
                sign: true
            });

            eos.getInfo({}).then(data => { 
                console.log("getInfo: " + JSON.stringify(data));

                var p1 = req.params.p1;
                console.log("p1 = " + p1);
                res.send(JSON.stringify({
                    hey: "ok3",
                    scp_auth_account: config.get("scp_auth_account"),
                    p1: p1,
                    getInfo: data,
                }))
            });
        }
    }

//};

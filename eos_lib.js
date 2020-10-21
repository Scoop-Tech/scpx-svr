// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019,20 Dominic Morris.
'use strict';

module.exports = {

    init: function(req, res) {
        var config = require('./config');
        var Eos = require('eosjs');
        var eos = Eos({
            chainId: config.get("scp_chain_id"),
            httpEndpoint: config.get("scp_nodeos_url"),
            expireInSeconds: 60,
            keyProvider: config.get("scp_auth_active_privkey"),
            broadcast: true,
            //debug: true,
            //verbose: true,
            sign: true
        });
        return eos;
    },

    gen_account_name: function() {
        var possible = "abcdefghijklmnopqrstuvwxyz12345";
        var text = "scp";
        for (var i = 0; i < 9; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
    }
};
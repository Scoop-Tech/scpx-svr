'use strict';

module.exports = {
    
    test1: function (req, res) {
        var keyProvider_privkey = [ '5JYEmXQPdjqi2oghfVVEX8smJeW49hBtNWQ5GL4oRhkhCgXNR5i' ] // privkey for utest3 -- i.e for SCP creator account
        var keyProvider_pubkey = 'EOS8aiKpjEDHMfd5RVGbqio3kDu7fSbeanXwLy5uswJUPdiyBcnei'; // fyi
        var Eos = require('eosjs');
        var eos = Eos( {
            keyProvider: keyProvider_privkey,
            httpEndpoint: 'http://127.0.0.1:8888',
            expireInSeconds: 60,
            broadcast: true,
            debug: false, // API and transactions
            sign: true
        });

        eos.getInfo({}).then(data => { 
            console.log("getInfo: " + JSON.stringify(data));

            var p1 = req.params.p1;
            console.log('p1 = ' + p1);
            res.send(JSON.stringify({
                hey: "ok3",
                p1: p1,
                getInfo: data,
            }))
        });
    }

};
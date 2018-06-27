'use strict';

var fs = require('fs');

module.exports = {
    deploy: function (req, res) {
        var eos_lib = require('./eos_lib'); 
        var eos = eos_lib.init();

        //----- deploy contract -----
        // issue cannot continue update same contract will have Assert Exception (10)
        // https://eosio.stackexchange.com/questions/1105/trying-to-re-deploy-the-contract-gives-assert-exception-10
        // 
        // solution: deploy a different contract before deploy the update

        // var wasm = fs.readFileSync('./contract/scp2.wasm')
        // var abi = fs.readFileSync('./contract/scp2.abi')

        // Publish contract to the blockchain
        // eos.setcode('scoopowner', 2, 2, wasm)
        //     .then(res => {
        //         console.log(res)
        //     })
        //     .catch(error => {
        //         console.log(error)
        //     })
        // eos.setabi('scoopowner', JSON.parse(abi))
        //     .then(res => {
        //         console.log(res)
        //     })
        //     .catch(error => {
        //         console.log(error)
        //     })

        //----- call contract action -----
        // eos.transaction('scoopowner', myaccount => {
        //     myaccount.uputx2('scooptest111', 'test111@scoop.com', { authorization: [ 'scoopowner@active' ] })
        // }).catch(e => {
        //     console.log(e)
        // })

        //----- get table rows from contract -----
        eos.getTableRows({
            scope: 'scoopowner',
            code: 'scoopowner',
            table: 'user4',
            json: true,
            table_key: 'scooptest111'
        }).then(res => {
            console.log(res)
        }).catch(e => {
            console.log(e)
        })

        res.status(200).send({ res: "ok" });
    }
};

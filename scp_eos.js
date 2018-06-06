'use strict';

module.exports = {

    test1: function (req, res) {
        var p1 = req.params.p1;
        console.log('p1 = ' + p1);
        res.send(JSON.stringify({
            hey: "ok",
            p1: p1,
        }));
    }

};
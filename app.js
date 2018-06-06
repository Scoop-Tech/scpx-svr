'use strict';

var express = require('express'); var app = express();
var scp_eos = require('./scp_eos'); 

app.get('/', function (req, res) { res.send('scp-svr: ok1'); });
console.log('up');


/*
 * Main
 */
app.get('/test1/:p1', function (req, res) { scp_eos.test1(req, res); }); 



module.exports = app;

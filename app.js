'use strict';

var express = require('express'); var app = express();
var scp_eos = require('./scp_eos'); 

app.get('/', function (req, res) { res.send('scp-svr: ok1'); });
console.log('up');


/*
 * Main - todo: rate limiting
 */
app.get('/test1/:p1', function (req, res) { scp_eos.test1(req, res); }); 

app.get('/acc/:pubkey', function (req, res) { scp_eos.new_account(req, res); }); 


module.exports = app;

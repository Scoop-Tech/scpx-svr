'use strict';

var express = require('express'); 
var bodyParser = require('body-parser')

var app = express();

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

var Promise = require('promise');
var scp_eos = require('./scp_eos'); 

app.get('/', function (req, res) { res.send('scp-svr: ok1'); });

console.log('up');

/*
 * Main - todo: rate limiting
 */
app.get('/test1/:p1', function (req, res) { scp_eos.test1(req, res); }); 

// Create account
app.post('/api/account', function (req, res) { scp_eos.new_account(req, res); });

module.exports = app;

'use strict';

const express = require('express');
const cors = require('cors');
const rateLimit = require("express-rate-limit");
const slowDown = require('express-slow-down');
const bodyParser = require('body-parser')
const Promise = require('promise');

const scp_eos = require('./scp_eos');
const scp_ext = require('./scp_ext');
const scp_ref = require('./scp_ref');
const scp_xs = require('./scp_xs');
const scp_dbg = require('./scp_dbg');
const sql = require('mssql');
const config = require('./config');

var app = express();

// version & environment
const ver = "RC-" + require('./package.json').version;
let chain_id = config.get("scp_chain_id");
let info = `*** UP v${ver} (chain_id: ${chain_id}) ***`;
console.log(info);
console.log(`process.env.PORT: ${process.env.PORT}`);
console.log(`process.env.DEV: ${process.env.DEV}`);

// SQL connection
global.sql_pool = new sql.ConnectionPool(config.sql_config());
sql.on('error', err => {
    console.warn(`### sql.on (global handler): ${err.message}`, err);
});
sql_pool.connect()
    .then(() => { console.log(`SQL pool connected ok`); })
    .catch((err => { console.error(`## failed to connect to SQL pool: ${err.message}`); }));

// *** cors is set on the azure web service (host IIS instance) - works much more reliably ***
// but needed for dev
if (process.env.DEV === "1") {
    console.warn('* DEV: setting up express/CORS *');
    var whitelist = [
        'http://10.0.2.2:3000',                            // android emulator dev
        'http://localhost:3000', 'https://localhost:3000', // local dev
        'http://localhost:3030', 'https://localhost:3030',
    ];
    var corsOptions = {
        origin: function (origin, callback) {
            //if (origin === undefined) console.warn(`# corsOptions - origin undefined!!`)
            if (whitelist.indexOf(origin) !== -1 || process.env.DEV === "1" || process.env.DEV === 1) {
                callback(null, true);
            } else {
                console.log('CORS disallowing origin: ', origin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        maxAge: 60
    }
    app.options('*', cors( { maxAge: 60 } )); // enable cors prefight options
    app.use("/api", cors(corsOptions));
}

// hard rate limits - block
const generous_limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 15, // limit per IP per windowMs - clears after windowMs
    handler: (req, res, /*next*/) => { console.log(`### generous_limiter - handler: ${req.url}`); /*set_cors(req, res);*/ res.status(429).send("Scoop Limit #1a"); },
    onLimitReached: (req, res, options) => { console.log(`### generous_limiter - onLimitReached: ${req.url}`); }
});
app.use("/api/assets", generous_limiter);
app.use("/api/data", generous_limiter);
app.use("/api/login_v2", generous_limiter); 
app.use("/api/account", generous_limiter);
app.use("/api/refer", generous_limiter);

const paranoid_limiter = rateLimit({
    windowMs: 10 * 1000, // 10 seconds
    max: 4,
    handler: (req, res, /*next*/) => { console.log(`### paranoid_limiter - handler: ${req.url}`); /*set_cors(req, res);*/ res.status(429).send("Scoop Limit #1b"); },
    onLimitReached: (req, res, options) => { console.log(`### paranoid_limiter - onLimitReached: ${req.url}`); }
});
app.use("/api/login_v2", paranoid_limiter); 
app.use("/api/account", paranoid_limiter);

// soft limit - slow down
const speed_limiter = slowDown({
    windowMs: 10 * 1000, // 10 secs
    delayAfter: 10,
    delayMs: 100, // begin adding 100ms of delay per request above delayAfter - clears after windowMs
    handler: (req, res, /*next*/) => { console.log(`### slowDown - handler: ${req.url}`); /*set_cors(req, res);*/ res.status(429).send("Scoop Limit #2"); },
    onLimitReached: (req, res, options) => { console.log(`### slowDown - onLimitReached: ${req.url}`); }
});
app.use("/api/login_v2", speed_limiter);
app.use("/api/account", speed_limiter);
app.use("/api/refer", speed_limiter);

// misc
app.use(bodyParser.urlencoded({ limit: '2mb', extended: false }));
app.use(bodyParser.json({limit: '2mb'}));

// logging
app.get('/', function (req, res) { res.send(info); });
app.get('/get_info', function (req, res) { scp_eos.get_info(req, res); });

/*
 * Main
 */
app.get('/api/ver', function (req, res) { res.send(ver); });
app.post('/api/account', function (req, res) { scp_eos.new_account(req, res); }); // Create account
app.post('/api/login_v2', (req, res) => { scp_eos.login_v2(req, res); });         // Login
app.post('/api/assets', (req, res) => { scp_eos.update_assets(req, res); });      // Update assets json
app.post('/api/data', (req, res) => { scp_eos.update_data(req, res); });          // Update data json
app.get('/api/ol', function (req, res) { res.status(200).send(                    // online poller / announcements
    JSON.stringify({ annTitle: 'Server Maintenance', annSubtitle: 'Affected: ZCash, Bitcoin Cash, Dash and DigiByte' })
    //'🤖'
); });

/*
 * External - BlockCypher: only used for BTC SegWit tx pushes (DEPRECATED)
 */
// app.get('/api/ext/:asset/address_balance/:address', (req, res) => { scp_ext.address_balance(req, res); });
// app.get('/api/ext/:asset/address_full/:address', (req, res) => { scp_ext.address_full(req, res); });
// app.post('/api/ext/:asset/new_tx', (req, res) => { scp_ext.new_tx(req, res); });
// app.post('/api/ext/:asset/push_tx', (req, res) => { scp_ext.push_tx(req, res); });

/*
 * Referral
 */
app.post('/api/refer', function (req, res) { scp_ref.send_refs(req, res); });

/*
 * Exchange Service
 */
app.post('/api/xs/c/sign', function (req, res) { scp_xs.changelly_sign(req, res); });

// dbg
// app.get('/api/idx2', (req, res) => { scp_dbg.idx2(req, res); });
app.get('/api/top/:n', (req, res) => { scp_dbg.top(req, res); });
app.get('/api/single/:owner', (req, res) => { scp_dbg.single(req, res); });
//app.get('/api/enc/:p1', (req, res) => { scp_dbg.test_enc(req, res); });
//app.get('/api/dec/:p1', (req, res) => { scp_dbg.test_dec(req, res); });
//app.get('/api/test1/:p1', (req, res) => { scp_dbg.test1(req, res); });
//app.get('/api/sql/:p1', (req, res) => { scp_dbg.test_sql(req, res); });

module.exports = app;

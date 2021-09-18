// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2021 Dominic Morris.
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
//const scp_cm = require('./scp_cm');
const scp_stm = require('./scp_stm');
const scp_faucet = require('./scp_faucet');
const scp_invite = require('./scp_invite');
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

// SQL connection (main - SCP DB)
sql.on('error', err => { console.warn(`### sql.on (global handler): ${err.message}`, err); });
global.scp_sql_pool = new sql.ConnectionPool(config.scp_sql_config());
scp_sql_pool.connect()
    .then(() => { console.log(`scp_sql_pool connected ok: `, global.scp_sql_pool.config.server); })
    .catch((err => { console.error(`## failed to connect to scp_sql_pool: ${err.message}`); }));

// SQL connections (StMaster - AC/SD DBs)
//global.stm_sql_pools = [];
// const stm_db = config.stm_sql_db();
// const stm_sql_pool = new sql.ConnectionPool(stm_db.config);
// stm_sql_pool.connect()
//     .then(() => { console.log(`stm_sql_pool connected ok: `, stm_db.config.server); })
//     .catch((err => { console.error(`## failed to connect to stm_sql_pool: ${err.message}`); }));
// global.stm_sql_pool = stm_sql_pool;

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

// hard rate limits - these block requests after limits are breached
    const generous_limiter = rateLimit({
        windowMs: 1 * 60 * 1000, // 15 per minute max == every 4 seconds
        max: 15,
        handler: (req, res, /*next*/) => { console.log(`### generous_limiter - handler: ${req.url}`); /*set_cors(req, res);*/ res.status(429).send("Scoop Limit #1a"); },
        onLimitReached: (req, res, options) => { console.log(`### generous_limiter - onLimitReached: ${req.url}`); }
    });
    app.use("/api/assets", generous_limiter);
    app.use("/api/data", generous_limiter);
    app.use("/api/login_v2", generous_limiter); 
    app.use("/api/account", generous_limiter);
    app.use("/api/refer", generous_limiter);
    app.use("/api/faucet", generous_limiter);
    app.use("/api/invite_link", generous_limiter);
    //app.use("/api/stm", generous_limiter); // no limit on this endpoint - it's called in parallel by wallet worker threads (see: action/s/wallet.js:newWalletAddressFromPrivKey())

    const paranoid_limiter = rateLimit({
        windowMs: 1 * 1000, // 2 per second max.
        max: 2,
        handler: (req, res, /*next*/) => { console.log(`### paranoid_limiter - handler: ${req.url}`); /*set_cors(req, res);*/ res.status(429).send("Scoop Limit #1b"); },
        onLimitReached: (req, res, options) => { console.log(`### paranoid_limiter - onLimitReached: ${req.url}`); }
    });
    app.use("/api/login_v2", paranoid_limiter); 
    app.use("/api/account", paranoid_limiter);
    app.use("/api/faucet", paranoid_limiter);
    app.use("/api/invite_link", paranoid_limiter);
    app.use("/api/invite_links", paranoid_limiter);

// soft rate limiter - this slows down requests are limits are breached
    const speed_limiter = slowDown({
        windowMs: 10 * 1000, // 10 seconds
        delayAfter: 10,      // allow 10 requests per 10 seconds, then...
        delayMs: 100,        // begin adding 100ms of delay per request above delayAfter # requests - clears after windowMs
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
    //JSON.stringify({ annTitle: 'Server Maintenance', annSubtitle: 'Affected: Bitcoin Cash' })
    '🤖'
); });

/*
 * Referral (dumb, v1)
 */
app.post('/api/refer', function (req, res) { scp_ref.send_refs(req, res); });

/*
 * Exchange Service
 */
app.post('/api/xs/c/sign', function (req, res) { scp_xs.changelly_sign(req, res); });

/*
 * CryptoMail
 */
//app.get('/api/cm/otu/new', function (req, res) { scp_cm.new_otu(req, res); });

/*
 * StMaster Integration
 */
//app.get('/api/stm', function (req, res) { scp_stm.get_sec_tokens(req, res); });

/*
 * Faucet
 */
app.post('/api/faucet', function (req, res) { scp_faucet.faucet_drip(req, res); });

/*
 * Invite Links (smart, v2)
 */
app.post('/api/invite_link', function (req, res) { scp_invite.send_invite_link(req, res); });
app.post('/api/invite_links', function (req, res) { scp_invite.get_invite_links(req, res); });

/*
 * dbg
 */
// app.get('/api/idx2', (req, res) => { scp_dbg.idx2(req, res); });
app.get('/api/top/:n', (req, res) => { scp_dbg.top(req, res); });
app.get('/api/single/:owner', (req, res) => { scp_dbg.single(req, res); });
//app.get('/api/enc/:p1', (req, res) => { scp_dbg.test_enc(req, res); });
//app.get('/api/dec/:p1', (req, res) => { scp_dbg.test_dec(req, res); });
//app.get('/api/test1/:p1', (req, res) => { scp_dbg.test1(req, res); });
//app.get('/api/sql/:p1', (req, res) => { scp_dbg.test_sql(req, res); });

/*
 * External - BlockCypher: only used for BTC SegWit tx pushes (DEPRECATED)
 */
// app.get('/api/ext/:asset/address_balance/:address', (req, res) => { scp_ext.address_balance(req, res); });
// app.get('/api/ext/:asset/address_full/:address', (req, res) => { scp_ext.address_full(req, res); });
// app.post('/api/ext/:asset/new_tx', (req, res) => { scp_ext.new_tx(req, res); });
// app.post('/api/ext/:asset/push_tx', (req, res) => { scp_ext.push_tx(req, res); });

module.exports = app;

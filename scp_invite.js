// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2021 Dominic Morris.

//
// scp_invites -- invites & notifies the referrer with arbitrary info from the referred person
//  (links the two accounts with arbitrary data-sharing, e.g. pubkeys)
//

'use strict';

const eos_lib = require('./eos_lib'); 
const sql = require('mssql');
const sendgrid = require('@sendgrid/mail');

const utils = require('./scp_util.js');

module.exports = {
    send_invite_link: async function (req, res) { // sends an invite-link: singular invite - email only
        if (!req.body) return res.sendStatus(400);
        const config = require('./config');
       
        // validation
        let owner = req.body.owner; 
        let e_email = req.body.e_email;
        let target_email = req.body.target_email;
        let source_name = req.body.source_name;
        let source_email = req.body.source_email;
        if (!owner || !e_email || !target_email || !source_name) return res.sendStatus(400); // keep source_email optional
        if (owner.length==0 || e_email.length==0 || target_email.length==0 || source_name.length==0) return res.sendStatus(400);

        // authentication
        const authenticated = await utils.check_auth(owner, e_email);
        if (authenticated == false) {
            return res.status(403).send({ msg: "Permission denied" });
        }

        if (await exists(owner, target_email)) {
            return res.status(400).send({ msg: "Already invited" });
        }

        // create the invite row
        const save = await scp_sql_pool.request()
        .input('owner', sql.NVarChar, `${owner}`)
        .input('target_email', sql.NVarChar, `${target_email}`)
        .input('source_email', sql.NVarChar, source_email || null)
        .query(`INSERT INTO [_scpx_invite]\
            ([owner], [accepted_utc], [payload_json], [target_email], [source_email])\
            VALUES (@owner, NULL, NULL, @target_email, @source_email); \
            SELECT @@IDENTITY`)
        .catch(err => {
            console.error(`## send_invite_link - INSERT failed! ${err.message}`, err);
        });
        const id = Object.values(save.recordset[0])[0];
        const row = (await by_id(id))[0];
        const invite_id = row.invite_id.toLowerCase();
        const invite_url = `${config.WEBSITE_URL}/invite?id=${invite_id}`;

        // send invite email
        const msg = {
                 to: target_email,
               from: config.get('ref_mail_from'), 
            subject: `${source_name} would like you to spend his Bitcoin...`,
               html: 
`${source_name} is inviting you to spend his Bitcoin, in case one day he (or she) can’t.<br/>\
<br/>\
Follow this link to create your wallet: <a href='${invite_url}'>${invite_url}</a><br/>\
<br/>\
Dominic Morris can then complete the transaction to make you his/her beneficiary.<br/>\
<br/>\
Thank you,<br/>\
<br/>\
${config.WEBSITE_DOMAIN}<br/>\
Trustless estate planning for Bitcoin and Ethereum assets.<br/>\
${config.GITHUB_URL}`
        };
        const apiKey = config.get('sendgrid_apikey');
        sendgrid.setApiKey(apiKey);
        var sendResult = await sendgrid.send(msg);
        if (!sendResult || sendResult.length == 0 || sendResult[0].statusCode != 202) {
            console.log(`## send_invite_link: unexpected for owner=${owner}, sendResult=`, sendResult);
        }
        else {
            console.log(`$$ send_invite_link: invited ${target_email} with sendResult ${sendResult[0].statusCode} for owner=${owner}`);
        }
        res.status(201).send({ res: "ok", sendResultStatusCode: sendResult[0].statusCode });
    },

    get_invite_links: async function (req, res) { // gets all invite-links sent by the specified (& authenticated) owner
        if (!req.body) return res.sendStatus(400);
        
        // validation
        let owner = req.body.owner; 
        let e_email = req.body.e_email;
        if (!owner || !e_email) return res.sendStatus(400);
        if (owner.length==0 || e_email.length==0) return res.sendStatus(400);

        // authentication
        const authenticated = await utils.check_auth(owner, e_email);
        if (authenticated == false) {
            return res.status(403).send({ msg: "Permission denied" });
        }

        const invites = await global.scp_sql_pool.request()
        .input('owner', sql.NVarChar, `${owner}`)
        .query(`SELECT [created_utc], [accepted_utc], [payload_json], [target_email] FROM [_scpx_invite] WHERE [owner] = @owner ORDER BY [id] DESC`)
        .catch(err => { console.error(`## get_invite_links: SQL failed - ${err.message}`); });
        
        console.log(`$$ get_invite_links: ok for owner=${owner}`);
        res.status(200).send({ res: "ok", invites: invites.recordset });
    }
}

const exists = async (owner, target_email) => {
    const result = await global.scp_sql_pool.request()
    .input('owner', sql.NVarChar, `${owner}`)
    .input('target_email', sql.NVarChar, `${target_email}`)
    .query(`SELECT TOP 1 [id] FROM [_scpx_invite] WHERE [owner] = @owner and [target_email] = @target_email`)
    .catch(err => { console.error(`## send_invite_link: SQL failed - ${err.message}`); });
    return result && result.recordset && result.recordset.length > 0;
}

const by_id = async (id) => {
    const result = await global.scp_sql_pool.request()
    .input('id', sql.Int, `${id}`)
    .query(`SELECT * FROM [_scpx_invite] WHERE [id] = @id`)
    .catch(err => { console.error(`## send_invite_link: SQL failed - ${err.message}`); });
    return result.recordset;
}
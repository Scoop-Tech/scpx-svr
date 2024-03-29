// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2021 Dominic Morris.

//
// scp_invites -- invites & notifies the referrer with arbitrary info from the referred person
//  (links the two accounts with arbitrary data-sharing, e.g. pubkeys)
//

'use strict';

const sql = require('mssql');

const config = require('./config');
const utils = require('./scp_util.js');
const email_lib = require('./email_lib.js');

module.exports = {

    send_invite_link: async function (req, res) { // sends an invite-link: singular invite - email only
        try {
            if (!req.body) return res.sendStatus(400);
        
            // validation
            let owner = req.body.owner; 
            let e_email = req.body.e_email;
            let symbol = req.body.symbol;
            let target_email = req.body.target_email;
            let target_name = req.body.target_name; // optional (fallback: target_email)
            let source_email = req.body.source_email;
            let source_name = req.body.source_name; // optional (fallback: source_email)
            let source_gender = req.body.source_gender; // optional
            if (!owner || !e_email || !symbol || !target_email || !source_email) return res.sendStatus(400);
            if (owner.length==0 || e_email.length==0 || symbol.length==0 || target_email.length==0 || source_email.length==0) return res.sendStatus(400);
            if (symbol != 'BTC_TEST' && symbol != 'BTC_SEG') return res.sendStatus(400);

            // authentication
            const authenticated = await utils.check_auth(owner, e_email);
            if (authenticated == false) {
                return res.status(403).send({ msg: "Permission denied" });
            }

            if (await exists(owner, target_email, symbol)) {
                return res.status(201).send({ res: "ok", msg: `Already invited ${target_email}` });
            }

            // create the invite row
            const save = await scp_sql_pool.request()
            .input('owner', sql.NVarChar, `${owner}`)
            .input('symbol', sql.NVarChar, `${symbol}`)
            .input('target_email', sql.NVarChar, `${target_email}`)
            .input('target_name', sql.NVarChar, `${target_name}`)
            .input('source_email', sql.NVarChar, source_email)
            .input('source_name', sql.NVarChar, source_name || null)
            .input('source_gender', sql.NVarChar, source_gender || null)
            .query(`INSERT INTO [_scpx_invite]\
                ([owner], [accepted_utc], [payload_json], [target_email], [source_email], [source_name], [symbol], [source_gender], [target_name])\
                VALUES (@owner, NULL, NULL, @target_email, @source_email, @source_name, @symbol, @source_gender, @target_name); \
                SELECT @@IDENTITY`)
            .catch(err => {
                console.error(`## send_invite_link - INSERT failed! ${err.message}`, err);
            });
            const id = Object.values(save.recordset[0])[0];
            const row = (await by_id(id))[0];
            const invite_id = row.invite_id.toLowerCase();
            const invite_url = `${config.WEBSITE_URL}/accept/${invite_id}`;

            const asset = asset_name(symbol);
            const source_first_name = source_name ? source_name.split(' ')[0] : undefined;

            // send email to target
            const { p, pp } = pronouns(source_gender);
            const sendResult = await email_lib.send_mail({
                 to: target_email,
            subject: `${source_name || source_email} would like you to spend ${pp} ${asset}...`,
               html: 
`${source_first_name || source_email} is inviting you to spend ${pp} ${asset} in case one day ${p} can’t.<br/>\
<br/>\
Follow this link to accept ${pp} invitation: <a href='${invite_url}'>${invite_url}</a><br/>\
<br/>\
${source_first_name || source_email} can then complete ${pp} transaction to make you ${pp} beneficiary.`
            });
            if (!sendResult || sendResult.length == 0 || sendResult[0].statusCode != 202) {
                console.log(`## send_invite_link: unexpected sendResult for owner=${owner}`, sendResult);
                return res.status(500).send({ msg: "Send failed" });
            }
            else {
                console.log(`$$ send_invite_link: invited ${target_email} with sendResult ${sendResult[0].statusCode} for owner=${owner}`);
            }
            res.status(201).send({ res: "ok", msg: `${target_email}`,});
        }
        catch(err) {
            console.log(`## send_invite_link`, err);
            return res.sendStatus(500);
        }
    },

    get_invite_links: async function (req, res) { // gets all invite-links sent by the specified (& authenticated) owner
        try {
            if (!req.body) return res.sendStatus(400);
            
            // validation
            let owner = req.body.owner; 
            let e_email = req.body.e_email;
            if (!owner || !e_email) return res.sendStatus(400);
            if (owner.length==0 || e_email.length==0) return res.sendStatus(400);

            if (!(await utils.check_auth(owner, e_email))) {
                return res.status(403).send({ msg: "Permission denied" });
            }

            const invites = await global.scp_sql_pool.request()
            .input('owner', sql.NVarChar, `${owner}`)
            .query(`SELECT [created_utc], [accepted_utc], [payload_json], [target_email], [target_name], [symbol], [invite_id] \
            FROM [_scpx_invite] \
            WHERE [owner] = @owner ORDER BY [id] DESC`)
            .catch(err => { console.error(`## get_invite_links: SQL failed - ${err.message}`); });
            
            console.log(`$$ get_invite_links: ok for owner=${owner}`);
            res.status(200).send({ res: "ok", invites: invites.recordset });
        }
        catch(err) {
            console.log(`## get_invite_links`, err);
            return res.sendStatus(500);
        }
    },

    get_invite_link: async function (req, res) { // gets one invite-link by ID, unauthenticated
        try {
            // validation
            let invite_id = req.params.iid
            if (!invite_id) return res.sendStatus(400);
            if (invite_id.length != 64) return res.status(200).send({ res: "ok", invite: undefined }); // 64 hex chars, 256 bits

            const rowset = await by_invite_id(invite_id);
            if (!rowset) return res.sendStatus(400);
            
            console.log(`$$ get_invite_link: ok for invite_id=${invite_id}`);
            res.status(200).send({ res: "ok", invite: rowset.length > 0 ? rowset[0] : undefined });
        }
        catch(err) {
            console.log(`## get_invite_link`, err);
            return res.sendStatus(500);
        }
    },

    accept_invite_link: async function (req, res) { // accepts an invite-link - updates payload field
        try {
            if (!req.body) return res.sendStatus(400);
            
            // validation 
            let owner = req.body.owner; 
            let e_email = req.body.e_email;
            let symbol = req.body.symbol;
            let invite_id = req.body.invite_id;
            let payload_json = req.body.payload_json;
            if (!owner || !e_email || !symbol || !invite_id || !payload_json) return res.sendStatus(400);
            if (owner.length==0 || e_email.length==0 || symbol.length==0 || invite_id.length==0 || payload_json.length==0) return res.sendStatus(400);
            if (symbol != 'BTC_TEST' && symbol != 'BTC_SEG') return res.sendStatus(400);
            var payload_obj;
            try {
                payload_obj = JSON.parse(payload_json);
            }
            catch(err) {
                console.warn(`## accept_invite_link: failed to parse payload_json for owner=${owner}, symbol=${symbol}, invite_id=${invite_id}`, payload_json);
                return res.sendStatus(400);
            }

            if (!(await utils.check_auth(owner, e_email))) {
                return res.status(403).send({ msg: "Permission denied" });
            }

            // get the invite
            const rowset = await by_invite_id(invite_id);
            console.log('req.body', req.body)
            console.log('rowset', rowset)
            if (!rowset) return res.sendStatus(400);
            if (rowset.length == 0) return res.sendStatus(404);
            const invite = rowset[0]
            if (invite.symbol != symbol) return res.sendStatus(404);
            if (invite.accepted_utc != null) {
                console.error(`## accept_invite_link: already accepted for owner=${owner}, symbol=${symbol}, invite_id=${invite_id}`);
                return res.sendStatus(409); // conflict
            }

            // update it
            const update = await scp_sql_pool.request()
            .input('invite_id', sql.NVarChar, `${invite_id}`)
            .input('payload_json', sql.NVarChar, `${payload_json}`)
            .query(`UPDATE [_scpx_invite]\
                SET [accepted_utc]=GETUTCDATE(), [payload_json]=@payload_json\
                WHERE [invite_id] = @invite_id\
            `)
            .catch(err => { console.error(`## accept_invite_link - UPDATE failed! ${err.message}`, err); });
            if (update.rowsAffected != 1) {
                console.error(`## accept_invite_link - unexpected update count for owner=${owner}, symbol=${symbol}, invite_id=${invite_id}`);
                return res.sendStatus(400);
            }

            // send email to source: target has accepted the invite
            const { p, pp } = pronouns(invite.source_gender);
            const asset = asset_name(symbol);
            const wallet_url = `${config.WEBSITE_URL}/unlock-wallet`;
            const sendResult = await email_lib.send_mail({
                 to: invite.source_email,
            subject: `${invite.target_name || invite.target_email} has accepted your invite`,
               html: 
`<b>${invite.target_name || invite.target_email}</b> has accepted your invite to be your ${asset} beneficiary.<br/>\
<br/>\
Open your <a href='${wallet_url}'>wallet</a> to complete the transaction.`
            });
            if (!sendResult || sendResult.length == 0 || sendResult[0].statusCode != 202) {
                console.log(`## accept_invite_link: unexpected sendResult for owner=${owner}`, sendResult);
                //return res.status(500).send({ msg: "Send failed" }); // keep going: report success, this isn't critical path
            }

            console.log(`$$ accept_invite_link: ok for owner=${owner}, symbol=${symbol}, invite_id=${invite_id}`, payload_json);
            res.status(200).send({ res: "ok", });
        }
        catch(err) {
            console.log(`## accept_invite_link`, err);
            return res.sendStatus(500);
        }        
    },
}

// const send_mail = async(p) => {
//     const msg = {
//         to: p.to,
//       from: config.get('ref_mail_from'), 
//    subject: p.subject,
//       html:
// `<div style='font-size:larger'>${p.html}\
// <br/>\
// <br/>\
// <b>${config.WEBSITE_DOMAIN}</b><br/>\
// <div style='font-style:italic;'>Trustless crypto social recovery: let someone else spend it when you can't.</div>
// An open <a href='${config.GITHUB_URL}'>source</a> project.\
// </div>` 
//     };
//     const apiKey = config.get('sendgrid_apikey');
//     sendgrid.setApiKey(apiKey);
//     var sendResult = await sendgrid.send(msg);
//     return sendResult;
// }

const exists = async (owner, target_email, symbol) => {
    const result = await global.scp_sql_pool.request()
    .input('owner', sql.NVarChar, `${owner}`)
    .input('symbol', sql.NVarChar, `${symbol}`)
    .input('target_email', sql.NVarChar, `${target_email}`)
    .query(`SELECT TOP 1 [id] FROM [_scpx_invite] WHERE \
    [owner] = @owner AND [symbol] = @symbol AND [target_email] = @target_email\
    `)
    .catch(err => { console.error(`## scp_invite.exists: SQL failed - ${err.message}`); });
    return result && result.recordset && result.recordset.length > 0;
}

const by_id = async (id) => {
    const result = await global.scp_sql_pool.request()
    .input('id', sql.Int, `${id}`)
    .query(`SELECT * FROM [_scpx_invite] WHERE [id] = @id`)
    .catch(err => { console.error(`## scp_invite.by_id: SQL failed - ${err.message}`); });
    return result.recordset;
}

const by_invite_id = async (invite_id) => {
    const result = await global.scp_sql_pool.request()
    .input('invite_id', sql.NVarChar, `${invite_id}`)
    .query(`SELECT * FROM [_scpx_invite] WHERE [invite_id] = @invite_id`)
    .catch(err => { console.error(`## scp_invite.by_invite_id: SQL failed - ${err.message}`); });
    return result.recordset;
}

const pronouns = (source_gender) => {
    const p = source_gender == "male" ? "he" // pronoun
    : source_gender == "female" ? "she"
    : "they";
    const pp = source_gender == "male" ? "his" // possessive
    : source_gender == "female" ? "her"
    : "their";
    return { p, pp }
}

const asset_name = (symbol) => {
    return symbol == 'BTC_TEST' ? 'Test Bitcoin' :
           symbol == 'BTC_SEG' ? 'Bitcoin'
           : '?';
}
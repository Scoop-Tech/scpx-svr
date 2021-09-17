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
    // send invite: by singular invite - email only
    send_invite_link: async function (req, res) {
        if (!req.body) return res.sendStatus(400);
        const config = require('./config');
       
        // validation
        let owner = req.body.owner; 
        let e_email = req.body.e_email;
        let target_email = req.body.target_email;
        let source_name = req.body.source_name;
        if (!owner || !e_email || !target_email || !source_name) return res.sendStatus(400);
        if (owner.length==0 || e_email.length==0 || target_email.length==0 || source_name.length==0) return res.sendStatus(400);

        // authentication
        const authenticated = await utils.check_auth(owner, e_email);
        if (authenticated == false) {
            return res.status(403).send({ msg: "Permission denied" });
        }

        // if (await exists(owner, target_email)) {
        //     return res.status(400).send({ msg: "Already invited" });
        // }

        // create the invite row
        const save = await scp_sql_pool.request()
        .input('owner', sql.NVarChar, `${owner}`)
        .input('target_email', sql.NVarChar, `${target_email}`)
        .query(`INSERT INTO [_scpx_invite]\
            ([owner], [accepted_utc], [payload_json], [target_email])\
            VALUES (@owner, NULL, NULL, @target_email); \
            SELECT @@IDENTITY`)
        .catch(err => {
            console.error(`## send_invite_link - INSERT failed! ${err.message}`, err);
        });
        const id = Object.values(save.recordset[0])[0]
        const row = (await by_id(id))[0]
        const invite_id = row.invite_id
        const invite_url = `${config.WEBSITE_URL}/invite/${invite_id}`

        // send invite email
        const msg = {
                 to: target_email,
               from: config.get('ref_mail_from'), 
            subject: `${source_name} would like you to spend his Bitcoin...`,
               html: 
`${source_name} is inviting you to spend his Bitcoin, in case one day he (or she) can’t.<br/>\
<br/>\
Scoop is a trustless and non-custodial way of protecting Bitcoin so it can be passed on in the event of the holder's death or incapacitation.<br/>\
<br/>\
Follow this link to create your wallet:<br/>\
<a href='${invite_url}'>${invite_url}</a><br/>\
<br/>\
Dominic Morris can then complete the transaction to make you his/her beneficiary.<br/>\
<br/>\
Once the transaction is complete, you will be able to spend the protected Bitcoin after a time lock expires.<br/>\
<br/>\
<br/>Thank you,<br/>\
<br/>\
${config.WEBSITE_DOMAIN}`
        };
        sendgrid.setApiKey(config.get('sendgrid_apikey'));
        var sendResult = await sendgrid.send(msg);
        console.log('sendResult[0].complete', sendResult[0].complete);
        console.log('sendResult[0].statusCode', sendResult[0].statusCode);

        res.status(201).send({ res: "ok" });
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
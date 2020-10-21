// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019,20 Dominic Morris.

//
// scp_ref -- referrals
//

'use strict';

const sql = require('mssql');

module.exports = {

    // send referals: by SMS and email
    send_refs: function (req, res) {
        // init
        if (!req.body) return res.sendStatus(400);
        const config = require('./config');
        const nexmo = require('nexmo');
        const async = require("async");
        const sendgrid = require('@sendgrid/mail');
        let emails = req.body.emails;
        let phones = req.body.phones;
        let googDisplayName = req.body.googDisplayName;
        let googEmail = req.body.googEmail;
        let googPhoneNo = req.body.googPhoneNo;
        if (emails === undefined || phones === undefined || googDisplayName === undefined || googEmail === undefined) return res.sendStatus(400);
        if ((emails.length == 0 && phones.length == 0) || googDisplayName === '' || googEmail === '') return res.sendStatus(400);
        console.log(`send_refs - emails: ${JSON.stringify(emails)}`);
        console.log(`send_refs - phones: ${JSON.stringify(phones)}`);
        console.log(`send_refs - from ${googDisplayName} ${googEmail}`);

        // return fast
        res.status(201).send({ res: "ok", });

        // limit no. of sends
        const MAX_EMAILS = 10
        const MAX_PHONES = 10
        var capped_emails = emails.length > MAX_EMAILS ? emails.slice(0, MAX_EMAILS) : emails;
        var capped_phones = phones.length > MAX_PHONES ? phones.slice(0, MAX_PHONES) : phones;
        console.log(`capped_emails.length: ${capped_emails.length} (emails.length: ${emails.length})`)
        console.log(`capped_phones.length: ${capped_phones.length} (emails.length: ${phones.length})`)

        // prep
        sendgrid.setApiKey(config.get('sendgrid_apikey'));
        const nx = new nexmo({ apiKey: config.get('nexmo_apikey'), apiSecret: config.get('nexmo_apisecret'), },
                             { debug: false, timeout: 1000 * 10 });
        var referer_firstname = googDisplayName;
        var names = googDisplayName.split(' ');
        if (names !== undefined && names.length > 0)
            referer_firstname = names[0];

        // sends - async 
        async.each(capped_emails, (email) => {
            console.log(`send_refs - each(email) [${email}]...`)

            const msg = {
                //***
                to: email,
                from: config.get('ref_mail_from'), 

                // send from refer's email addr - triggers spam/security warning in gmail; better - send using gmail API
                //from: googEmail, 
                //cc: config.get('ref_mail_from'),

                subject: `${referer_firstname} has invited you to Scoop! 💖`,
                html: 
`Hi there!<br/>
<br/>
${googDisplayName} is using Scoop, and has invited you to join.<br/>
<br/>
Scoop makes digital payments instant, secure and easy.<br/>
<br/>
<a href='${config.WEBSITE_URL}'>Join Scoop</a>, spread the word!<br/>
<br/>
Kind regards,<br/>
<b>Scoop</b><br/>
${config.WEBSITE_DOMAIN}`
            };
            var sendResult = sendgrid.send(msg).then((r) => { });// todo - check sent ok

            // save
            sql_pool.request()
            .input('ref_id', sql.NVarChar, `${googEmail}`)
            .input('ref_name', sql.NVarChar, `${googDisplayName}`)
            .input('ref_target', sql.NVarChar, `${email}`)
            .query(`INSERT INTO [_scpx_ref] VALUES (@ref_id, GETUTCDATE(), @ref_name, @ref_target)`)
            .then((result) => {
                console.log('send_refs - email ref save ok', result.rowsAffected);
            }).catch(err => {
                console.warn(`## send_refs - SQL failed: ${err.message}`, err);
            })

            console.log('email done.');
        });
        
        async.each(capped_phones, (phone) => {
            var from = googPhoneNo && googPhoneNo !== "" ? googPhoneNo : config.get('ref_sms_from');
            console.log(`send_refs - each(phone) TO: [${phone}] FROM: [${from}]...`)
            
            var sendResult = nx.message.sendSms(
                //***
                from,
                phone, 
`${referer_firstname} has invited you to join Scoop!\n
${config.WEBSITE_DOMAIN}\n
Scoop makes digital payments instant, secure and easy.`
                //options, callback
                ); // todo - check sent ok
            
            // save
            sql_pool.request()
                .input('ref_id', sql.NVarChar, `${googEmail}`)
                .input('ref_name', sql.NVarChar, `${googDisplayName}`)
                .input('ref_target', sql.NVarChar, `${phone}`)
                .query(`INSERT INTO [_scpx_ref] VALUES (@ref_id, GETUTCDATE(), @ref_name, @ref_target)`)
                .then((result) => {
                    console.log('send_refs - phone ref save ok', result.rowsAffected);
                }).catch(err => {
                    console.warn(`## send_refs - SQL failed: ${err.message}`, err);
                })

            console.log('phone done.');
        });

        // send summary, internal
        nx.message.sendSms(config.get('ref_sms_from'), config.get('ref_sms_summary_to'), `SCP send-refs: ${googEmail} -> emails: ${emails.length} phones: ${phones.length}`);
    },

};
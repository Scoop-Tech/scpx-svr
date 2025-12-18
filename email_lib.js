// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019-2025 Dominic Morris.
'use strict';

const sendgrid = require('@sendgrid/mail');
const config = require('./config');

module.exports = {

    send_mail: async(p) => {
        const msg = {
            to: p.to,
          from: config.get('ref_mail_from'), 
       subject: p.subject,
          html:
    `<div style='font-size:larger'>${p.html}\
    <br/>\
    <br/>\
    <b>${config.WEBSITE_DOMAIN}</b><br/>\
    <div style='font-style:italic;'>Trustless crypto social recovery: let someone else spend it when you can't.</div>
    An open <a href='${config.GITHUB_URL}'>source</a> project.\
    </div>` 
        };
        const apiKey = config.get('sendgrid_apikey');
        sendgrid.setApiKey(apiKey);
        var sendResult = await sendgrid.send(msg);
        return sendResult;
    },

}
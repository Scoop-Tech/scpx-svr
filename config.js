// Distributed under MS-RSL license: see /LICENSE for terms. Copyright 2019,20 Dominic Morris.
'use strict';

module.exports = {

    WEBSITE_DOMAIN : 'scoop.tech',
    WEBSITE_URL    : `https://scoop.tech`,

    get: function (key) {
        if (process.env[key] != null) 
           return process.env[key];

        console.log(`Failed to find config key ${key} in process.env; looking for config file...`);

        var config_json = require('./config.json');

        if (config_json[key] != null)
            return config_json[key];

        console.error(`### missing config!: ${key}`);

        return null;
    },

    scp_sql_config: function() {
        return { // https://www.npmjs.com/package/mssql#tedious
            user:     this.get('scp_sql_user'),
            password: this.get('scp_sql_password'),
            server:   this.get('scp_sql_server'), 
            database: this.get('scp_sql_database'),

            connectionTimeout: 3000,
            requestTimeout: 3000,   

            pool: { // https://github.com/coopernurse/node-pool
                max: 10,
                min: 0,
                idleTimeoutMillis: 30000,
            },
         
            options: {
                encrypt: true // Use this if you're on Windows Azure
            }
        }        
    },

    stm_sql_db: function () { 
        return {
            name: this.get('stm_db_name'),
            config: {
                user:     this.get('stm_sql_user'),
                password: this.get('stm_sql_password'),
                server:   this.get('stm_sql_server'),
                database: this.get('stm_sql_database'),
                port:     this.get('stm_sql_port'),
    
                connectionTimeout: 3000,
                requestTimeout:    3000,   
                pool:    { max: 10, min: 0, idleTimeoutMillis: 30000, },
                options: { encrypt: true }
            }
        };
    },
    // stm_sql_dbs: function () { 
    //     const dbs = this.get('stm_dbs');
    //     return dbs.map(p => { return {
    //         name: p.stm_db_name,
    //         config: {
    //             user:     p.stm_sql_user,
    //             password: p.stm_sql_password,
    //             server:   p.stm_sql_server,
    //             database: p.stm_sql_database,
    //             port:     p.stm_sql_port,
    
    //             connectionTimeout: 3000,
    //             requestTimeout:    3000,   
    //             pool:    { max: 10, min: 0, idleTimeoutMillis: 30000, },
    //             options: { encrypt: true }
    //         }
    //     }});
    // },

};
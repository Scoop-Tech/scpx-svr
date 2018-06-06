'use strict';

module.exports = {

    get: function (key) {
        if (process.env[key] != null) 
           return process.env[key];

        var config_json = require('./config.json');

        if (config_json[key] != null)
            return config_json[key];

        return null;
    }
};
'use strict';
var mssql       = require('mssql');
var path        = require('path');
var async       = require('async');
var q           = require('q');
var fs          = require('fs');
var md5         = require('MD5');
var util        = require('util');
const CaseLoader  = require('./caseloader');
const CaseRemover  = require('./caseremover');

class CaseMan {

    constructor(config, roundsql) {
        this.config = config;
        this.round = roundsql;
        this.loader = new CaseLoader(this);
        this.remover = new CaseRemover(this);

        // Just in case there was a problem with the case definition.
        if(Object.keys(config).length == 0) {
            console.log('ERROR: There was a problem with the configuration object: ' + config);
            return;
        }
    }

    /**
     * Returns a function that will log the error and call the provided reject
     * method.
     * @param  {function} reject
     * @return {function}
     */
    getErrorHandler(reject) {
        return ((reject, err) => {
            console.log(err);
            reject(err);
        }).bind(this,reject);
    }
}

module.exports = CaseMan;

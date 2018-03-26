'use strict';
var mssql       = require('mssql');
var path        = require('path');
var async       = require('async');
var q           = require('q');
var fs          = require('fs');
var md5         = require('MD5');
var util        = require('util');
const CaseLoader  = require('./caseloader');

class CaseMan {

    constructor(config, roundsql) {
        this.config = config;
        this.round = roundsql;
        this.modelNames = null;
        this.loader = new CaseLoader(this);
        // this.caseloader = new CaseLoader(this);
        //this.caseremover = new CaseRemover(this);

        // Just in case there was a problem with the case definition.
        if(Object.keys(config).length == 0) {
            console.log('ERROR: There was a problem with the configuration object: ' + config);
            return;
        }
    }

}

module.exports = CaseMan;

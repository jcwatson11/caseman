var mssql       = require('mssql');
var path        = require('path');
var roundsql    = require('roundsql');
var async       = require('async');
var q           = require('q');
var fs          = require('fs');
var md5         = require('MD5');
var util        = require('util');
var CaseSetter  = require('./casesetter');

class CaseLoader {

    constructor(caseman) {
        this.config = caseman.config;
        this.round = caseman.round;
        // Just in case there was a problem with getting the case definition file.
        if(Object.keys(this.config).length == 0) {
            console.log('ERROR: The caseman config object is in an unexpected format: ', config);
            return;
        }
    }

    /**
     * Validates the format of the record.populateFrom object.
     *
     * populateFrom instructions should follow the syntax:
     *
     * {
     *    'FieldIWantToPopulate':{'TableToGetItFrom':'FieldToGetItFrom'}
     *    ,'AnotherFieldIWantToPopulate':{'AnotherTableToGetItFrom':'AnotherFieldToGetItFrom'}
     * }
     *
     * @param record record object. See validateRecord();
     * @param caseDef the case definition in which this record is found. Gives access to more accurate messaging and debugging.
     * @return true if validated, string message if there is a problem.
     */
    validatePopulateFrom(record,caseDef) {
        if(typeof record.populateFrom != 'undefined' && typeof record.populateFrom != 'object') {
            return 'Error in case definition ['+caseDef.name+']: in table ['+ record.table +']: The record item indicates that one or more fields should be populated from previously entered record values, but the populateFrom value is not an object as it should be.';
        }
        for(var i in record.populateFrom) {
            if(typeof record.populateFrom[i] != 'object') {
                return 'Error in case definition ['+caseDef.name+']: in table ['+ record.table +']: in populateFrom['+i+']: should be an object with {\'tablename\':\'fieldname\'} format.';
            }
        }
        if(record.sequences) {
            for(var i in record.sequences) {
                var targetTable = record.sequences[i];
                if(typeof targetTable != 'string') {
                    return 'Error in case definition ['+caseDef.name+']: in table ['+ record.table +']: in nextNumbers['+i+']: value should be a string table name.';
                }
            }
        }
        return true;
    }

    /**
     * Validates a record instruction in the case definition.
     *
     * @param record object following format:
     * {
     *     'table': 'string'
     *     ,'sequences': {
     *         'fieldname': 'tablename'
     *         // where table name is the nextNumber enabled field
     *         // and field name is the local field that will receive the value.
     *     }
     *     ,'populateFrom': object with mappings. See validatePopulateFrom()
     *     ,'row': object with fieldname:value pairs
     * }
     */
    validateRecord(record,caseDef) {
        if(record.sequences) {
            if(typeof record.sequences != 'object') {
                return "Property must be an object: record.sequences.";
            }
        }
        var strMessage = this.validatePopulateFrom(record,caseDef);
        if(strMessage !== true) {
            return strMessage;
        }
        return true;
    }

    /**
     * Loads the given test case in a new instance of CaseSetter to separate scope
     * between asyncronous uses of caseloader.
     * @param  {object} testCase
     * @return {Promise}
     */
    loadTestCase(testCase) {
        this.testCase = testCase;
        // Just in case there was a problem with getting the case definition file.
        if(Object.keys(testCase).length == 0) {
            throw 'ERROR: The case definition object is in an unexpected format.';
        }
        var setter = new CaseSetter(this);
        return setter.loadCase();
    }

}
module.exports = CaseLoader;

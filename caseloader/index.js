var mssql       = require('mssql');
var path        = require('path');
var roundsql    = require('roundsql');
var sehelper    = require('../sehelper');
var async       = require('async');
var q           = require('q');
var fs          = require('fs');
var md5         = require('MD5');
var util        = require('util');

module.exports = function(casefile,outputdir,configfile) {

    // 'use strict';
    // Validate casefile is readable
    var casefile = path.resolve(casefile);
    var testCase = require(casefile);

    // Just in case there was a problem with getting the case definition file.
    if(Object.keys(testCase).length == 0) {
        console.log('ERROR: Could not parse case definition file: ' + casefile);
        return;
    }

    // Validate output dir is readable and writable
    var outputdir = path.resolve(outputdir);

    // Validate configfile is readable
    var configfile = (configfile) ? path.resolve(configfile):path.resolve('.')+'/caseman.js';
    var config = require(configfile);

    // Just in case there was a problem with getting the case definition file.
    if(Object.keys(config).length == 0) {
        console.log('ERROR: Could not get configuration file: ' + configfile);
        return;
    }

    /**
     * The function that does the work of processing the case definition file is in a
     * self-executing function because of the way node caches modules.
     *
     * @param testCase the object that defines all of the records in the test case.
     */
    (function(testCase) {
        var transaction    = null;
        var round          = null;
        var modelNames     = [];
        var self           = this;

        /**
         * Function to connect to the database. Will be used in async.sequence array.
         */
        var connect     = function(callback) {
            var connection = new mssql.Connection(config.mssql,function(err) {
                console.log('Connection established...');
                if(err) {
                    console.log('ERROR: ' + err.message);
                    callback(err);
                    return;
                }
                console.log('Creating transaction...');
                transaction = new mssql.Transaction(connection);
                transaction.begin().then(function() {
                    console.log("transaction begun");
                    round = new roundsql(mssql,transaction);
                    callback(null);
                },function(reason) {
                    callback(reason);
                });
            });
        };
        self.connect = connect;

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
        var validatePopulateFrom = function(record,caseDef) {
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
        };
        self.validatePopulateFrom = validatePopulateFrom;

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
        var validateRecord = function(record,caseDef) {
            if(record.sequences) {
                if(typeof record.sequences != 'object') {
                    return "Property must be an object: record.sequences.";
                }
            }
            var strMessage = self.validatePopulateFrom(record,caseDef);
            if(strMessage !== true) {
                return strMessage;
            }
            return true;
        };
        self.validateRecord = validateRecord;

        /**
         * Returns a function that will set up the test case defined in the json file.
         *
         * @caseDef a single item from the case list
         * @return function
         */
        var setupCase = function(caseDef) {

            return function(caseCallback) {

                var models = {};
                var records = [];
                var declaredVariables = [];
                var boundParameters = [];
                var outputObjects = [];
                var strSql = '';

                function getStatementId(name,records,bReverse,startingPoint) {
                    if(bReverse) {
                        for(var i=startingPoint;i>=0;i--) {
                            if(records[i].table == name) {
                                return i;
                            }
                        }
                    } else {
                        for(var i = 0;i<records.length;i++) {
                            if(records[i].table == name) {
                                return i;
                            }
                        }
                    }
                    return 'NOTFOUND';
                }

                function discoverAllModels(callback) {
                    // Discover all the models at once
                    // The array.pop() syntax has higher performance ratings than any other kind of loop
                    var instruction = null;
                    var tables = [];
                    while(instruction = caseDef.records.pop()) {
                        tables.push(instruction.table);
                        records.push(instruction);
                    }

                    var strSql = round.getColumnsSql(tables);
                    var modelDefs = {};
                    var modelCols = {};
                    round.query(strSql).then(function(results) {
                        for(var i=0;i<results.length;i++) {
                            var result = results[i];
                            var strTable = result.TABLE_NAME;
                            var strField = result.COLUMN_NAME;
                            if(typeof modelDefs[strTable] == 'undefined') {
                                modelDefs[strTable] = [];
                            }
                            modelDefs[strTable].push(result);
                        }
                        for(var i in modelDefs) {
                            modelCols[i] = round.translateColumns(modelDefs[i]);
                        }
                        for(var i in modelCols) {
                            models[i] = round.generateModel(i,i,{},modelCols[i]);
                        }
                        callback();
                    },function(err) {
                        callback(err);
                    });
                };

                function writeSql(callback) {
                    records.reverse();
                    for(var i=0;i<records.length;i++) {
                        // sequence management
                        var record = records[i];
                        var strMessage = self.validateRecord(record,caseDef);
                        if(strMessage !== true) {
                            console.log(caseDef.name + ': ' + record.table + ': ' + strMessage);
                            callback(strMessage);
                            return;
                        }
                        var instruction = records[i];
                        var strTableName = records[i].table;
                        var model = models[strTableName].new();
                        model.hydrate(instruction.row);
                        records[i].model = model;
                        var scopeIdVariable = "pk" +i+ strTableName;
                        var insertSql = model.getInsertQuery(true,i);
                        var insertBindings = model.getInsertUpdateParams(false,i);
                        if(instruction['sequences']) {
                            if(!config.getSequenceSqlFunction) {
                                callback('ERROR: Your case definition instructs one or more fields to be populated with a sequence. However your configuration file does not define getSequenceSqlFunction(identifier,varName).');
                                return;
                            }
                            for(var n in instruction.sequences) {
                                delete insertBindings[i+n];
                                var sequenceIdentifier = instruction.sequences[n];
                                var variableName = 'seq'+n;
                                if(declaredVariables.indexOf(variableName) == -1) {
                                    declaredVariables.push(variableName);
                                    strSql += "\nDECLARE @"+variableName+" bigint;\n"
                                }
                                var fn = config.getSequenceSqlFunction(sequenceIdentifier,variableName);
                                strSql += fn();
                            }
                        }
                        strSql += "\nDECLARE @"+scopeIdVariable+" bigint;\n"
                        declaredVariables.push(scopeIdVariable);
                        if(instruction.populateFrom) {
                            for(var f in instruction.populateFrom) {
                                for(var t in instruction.populateFrom[f]) {

                                    // remove insertBinding for fields that are populated
                                    // from previous fields.
                                    delete insertBindings[i+f];
                                    var strFromField = instruction.populateFrom[f][t];
                                    var modelId = getStatementId(t,records,true,i);
                                    if(modelId == 'NOTFOUND') {
                                        console.dir(records);
                                        callback('Table ['+t+'] was not found in the above list of records');
                                        return;
                                    }
                                    var strVarToPopulateFrom = '@' + modelId+strFromField;
                                    var strToField = '@' + i + f;
                                    var strReplaceField = '@'+i+f;
                                    var strReplacement = strVarToPopulateFrom;
                                    insertSql = insertSql.replace(strReplaceField,strReplacement);
                                }
                            }
                        }
                        util._extend(boundParameters,insertBindings);
                        strSql += insertSql;
                        strSql += "\nSELECT @"+scopeIdVariable+" = SCOPE_IDENTITY();\n";
                    }
                    // Now go back through the sequences and replace their target field names
                    // with the sequence name
                    for(var i=0;i<records.length;i++) {
                        var instruction = records[i];
                        if(instruction['sequences']) {
                            for(var n in instruction.sequences) {
                                var sequenceModelId = getStatementId(instruction.sequences[n],records);
                                var strFrom = '@'+i+n;
                                var strTo   = '@seq'+n;
                                var regex = new RegExp(strFrom, 'g');
                                strSql = strSql.replace(regex,strTo);
                            }
                        }
                    }
                    strSql = strSql.replace(/@[A-Za-z0-9]+ = (@seq[A-Za-z0-9]+),/g,'$1,');

                    var unions = [];
                    for(var i=0;i<declaredVariables.length;i++) {
                        if(declaredVariables[i].indexOf('seq') == -1) {
                            var cnt = declaredVariables[i].replace(/pk([0-9]+)[^0-9]+.*/,'$1');
                            unions.push("\nSELECT "+cnt+" AS id, '"+declaredVariables[i]+"' AS varname, @"+declaredVariables[i]+" AS value\n");
                        }
                    }
                    strSql += unions.join("\nUNION ALL\n");

                    // Now go back and select all of the primary key values from the records inserted.
                    //console.log(strSql);

                    callback();

                };

                function executeTransaction(callback) {
                    console.log('Executing transaction');
                    round.query(strSql,boundParameters).then(function(results) {
                        for(var i = 0;i<results.length;i++) {
                            var record = records[i];
                            var model = record.model;
                            var pk    = model.primaryKey;
                            model[pk] = results[i].value;
                            var allowedJsonProperties = Object.keys(model.columns);
                            var created = {
                                'table': record.table
                               ,'row': JSON.parse(JSON.stringify(model,allowedJsonProperties))
                            };
                            if(record.deleteCascade) {
                                created.deleteCascade = record.deleteCascade;
                            }
                            records[i].row;
                            outputObjects.push(created);
                        }
                        callback();
                    },function(err) {
                        callback(err);
                    });
                }

                function writeFile(callback) {
                    // write the objects to the file system and exit
                    var strContents = JSON.stringify(outputObjects,null,4);
                    var strCaseDefSanitized = caseDef.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
                    var strFile = strCaseDefSanitized + '_' + md5(strContents) + '.json';
                    var strPath = path.normalize(outputdir + '/') + strFile;
                    fs.writeFile(strPath,strContents,function(err) {
                        if(err) {
                            console.log('Could not write file: ' + strPath);
                            console.log('CONTENTS: ', strContents);
                            callback(err);
                            return;
                        }
                        console.log('File written to:' + strPath);
                        callback();
                    });
                };

                var commitTryCount = 0;
                var commit = function(callback) {
                    commitTryCount++;

                    transaction.commit().then(function() {
                        console.log('COMMITTED');
                        callback();
                    },function(reason) {
                        if(reason.code == 'EREQINPROG' && commitTryCount < 5) {
                            setTimeout(function() {
                                commit(callback);
                            },1000);
                            return;
                        }
                        console.log('NOT COMMITTED: tried ' + commitTryCount + ' times.');
                        callback(reason);
                    });
                };

                async.series([
                    connect
                    ,discoverAllModels
                    ,writeSql
                    ,executeTransaction
                    ,commit
                    ,writeFile
                ],function(err) {
                    if(err) {
                        caseCallback(err);
                        return;
                    }
                    caseCallback();
                });
            };

        };

        setupCase(testCase)(function(err) {
            if(err) {
                console.log("ERROR: ");
                console.dir(err);
                process.exit(1);
                return;
            }
            console.log("Master Case List Complete: YAY! ");
            process.exit(0);
        });
        // Master Task List for the entire list of testCase defined in the JSON file.
        // This level of abstraction isn't currently necessary. But it will be if multiple
        // cases are ever allowed to be loaded into the case loader.
        /*
        var caseMasterTasks = [];
        caseMasterTasks.push();

        async.series(caseMasterTasks,function(err,results) {
            if(err) {
                console.log("ERROR: ");
                console.dir(err);
                process.exit(0);
            }
            console.log("Master Case List Complete: YAY! ");
            process.exit(0);
        });
        */


    })(testCase);
}

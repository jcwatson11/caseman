var mssql       = require('mssql');
var path        = require('path');
var roundsql    = require('roundsql');
var sehelper    = require('../sehelper');
var async       = require('async');
var q           = require('q');
var fs          = require('fs');
var md5         = require('MD5');

module.exports = function(casefile,outputdir) {

    var testCase = require(path.resolve(casefile));

    if(typeof testCase != 'object') {
        console.log('ERROR: Could not read ' + casefile);
        return;
    }

    var outDirFiles = fs.readdirSync(outputdir);
    if(!Array.isArray(outDirFiles)) {
        console.log('ERROR: Could not read directory ' + outputdir);
        return;
    }

    var config = {
        user: process.env.DMS_US_USER
       ,password: process.env.DMS_US_PASS
       ,server: process.env.DMS_US_PROTRACTOR_HOST
       ,database: process.env.DMS_US_DBNAME
       ,port: process.env.DMS_US_PROTRACTOR_PORT
    };

    (function(testCase) {
        var transaction    = null;
        var round          = null;
        var se             = null;
        var self           = this;

        var connect     = function(callback) {
            var connection = new mssql.Connection(config,function(err) {
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
                    se = new sehelper(round);
                    callback(null,se);
                },function(reason) {
                    callback(reason);
                });
            });
        };
        self.connect = connect;

        /**
         * Searches through the recordsCreated array for a table name / field name pair
         * and returns its value.
         *
         * @param def object of format {'tablename': 'fieldname'}
         * @return the value from the field requested.
         */
        var resolveValueFromPreviouslyCreatedRecord = function(def,recordsCreated) {
            for(var i in def) {
                for(var j=0;j<recordsCreated.length;j++) {
                    if(recordsCreated[j].table == i) {
                        return recordsCreated[j].row[def[i]];
                    }
                }
            }
            return null;
        };
        self.resolveValueFromPreviouslyCreatedRecord = resolveValueFromPreviouslyCreatedRecord;

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
            if(record.nextNumbers) {
                for(var i in record.nextNumbers) {
                    var targetTable = record.nextNumbers[i];
                    if(typeof targetTable != 'string') {
                        return 'Error in case definition ['+caseDef.name+']: in table ['+ record.table +']: in nextNumbers['+i+']: value should be a string table name.';
                    }
                    if(se.getNextNumberIdNameByTableName(targetTable) === false) {
                        return 'Error in case definition ['+caseDef.name+']: in table ['+ record.table +']: in nextNumbers['+i+']: target table name is not nextNumber enabled. Perhaps you misspelled it?';
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
         *     ,'nextNumbers': {
         *         'tablename': 'fieldname'
         *         // where table name is the nextNumber enabled field
         *         // and field name is the local field that will receive the value.
         *     }
         *     ,'populateFrom': object with mappings. See validatePopulateFrom()
         *     ,'row': object with fieldname:value pairs
         * }
         */
        var validateRecord = function(record,caseDef) {
            if(record.nextNumberPopulated && !record.nextNumberAssignmentField) {
                return 'Error in case definition ['+caseDef.name+']: in table ['+ record.table +']: The record item indicates a NextNumber, but there is no nextNumberAssignmentField in the record object.';
            }
            var strMessage = self.validatePopulateFrom(record,caseDef);
            if(strMessage !== true) {
                return strMessage;
            }
            return true;
        };
        self.validateRecord = validateRecord;

        /**
         * Writes values from row to model.
         *
         * @param model
         * @param row
         * @return void
         */
        var writeValuesFromCaseToModel = function(model,row) {
            for(var i in row) {
                model[i] = row[i];
            }
        };
        self.writeValuesFromCaseToModel = writeValuesFromCaseToModel;

        /**
         * Populates the model with values from the next numbers array.
         * Array members are objects with format:
         *
         * {'fieldtopopulate':'valuetopopulatethefieldwith'}
         *
         * @param model object model to populate
         * @param nextNumbers array of objects fitting the format described above.
         * @record object the record instruction context for the record we are acting on.
         * @caseDef object the case definition context
         * @return void
         */
        var populateNextNumbers = function(model,nextNumbers,record,caseDef) {
            for(var i=0;i<nextNumbers.length;i++) {
                var nxt = nextNumbers[i];
                for(var j in nxt) {
                    console.log(caseDef.name + ': ' + record.table + ': ' + 'Populating [' + j + '] with value: ' + nxt[j]);
                    model[j] = nxt[j];
                }
            }
        };
        self.populateNextNumbers = populateNextNumbers;

        /**
         * Populates the model with values from previously entered records.
         * Helpful for inserting records with a foreign key relationship to a record that was
         * entered previously.
         *
         * See validatePopulateFrom() for instruction formatting requirements.
         *
         * @param model object model to populate
         * @record object the record instruction context for the record we are acting on.
         * @caseDef object the case definition context
         * @return void
         */
        var populatePreviouslyEnteredValues = function(model,record,caseDef,recordsCreated) {
            for(var i in record.populateFrom) {
                var value = self.resolveValueFromPreviouslyCreatedRecord(record.populateFrom[i],recordsCreated);
                console.log(caseDef.name + ': ' + record.table + ': ' + 'Populating ['+record.table+'].['+i+'] with previously acquired value ('+value+').');
                model[i] = value;
            }
        };
        self.populatePreviouslyEnteredValues = populatePreviouslyEnteredValues;

        /**
         * Returns a function that will set up the test case defined in the json file.
         *
         * @caseDef a single item from the case list
         * @return function
         */
        var setupCase = function(caseDef) {
            var modelWriters = [];
            var recordsCreated = [];
            return function(caseCallback) {
                console.log('SETUP: ', caseDef.name);
                // console.dir(caseDef);
                caseDef.records.forEach(function(record) {
                    modelWriters.push(function(result,callback) {
                        /**
                         * Validate the record before starting.
                         */
                        var strMessage = self.validateRecord(record,caseDef);
                        if(strMessage !== true) {
                            console.log(caseDef.name + ': ' + record.table + ': ' + strMessage);
                            callback(strMessage);
                            return;
                        }
                        round.discoverModel(record.table,record.table,{}).then(function(models) {
                            console.log(caseDef.name + ': ' + record.table + ': ' + record.table + ' model discovered');
                            var m = models[record.table].new();
                            // m.setDebug(true);

                            /**
                             * We can go ahead and write static values from the record instruction
                             * now. Dynamic values will come later after some async management.
                             */
                            self.writeValuesFromCaseToModel(m,record.row);

                            // Preparing to collect nextNumberBusinessData through async waterfall
                            var nextNumbers = [];

                            /**
                             * This function will be called as the last member of an async.waterfall
                             * sequence after getting all nextNumbers (if there are any for this table)
                             */
                            function insertModel(err) {
                                if(err) {
                                    console.log(caseDef.name + ': ' + record.table + ': ' + 'Error retrieving final nextNumber.');
                                    callback(err);
                                    return;
                                }
                                if(nextNumbers.length > 0) {
                                    console.log(caseDef.name + ': ' + record.table + ': ' + 'Acquired nextNumbers: ');
                                    console.dir(nextNumbers);
                                }

                                // Populate nextNumbers retrieved before this point.
                                self.populateNextNumbers(m,nextNumbers,record,caseDef);

                                if(record.populateFrom) {
                                    self.populatePreviouslyEnteredValues(m,record,caseDef,recordsCreated);
                                }

                                console.log(caseDef.name + ': ' + record.table + ': ' + 'Saving model.');

                                // Now save the model and record it in the recordsCreated array.
                                m.save().then(function(model) {
                                    console.log(caseDef.name + ': ' + record.table + ': ' + 'Saved');
                                    var created = {
                                        'table': record.table
                                        ,'row': JSON.parse(JSON.stringify(model,Object.keys(model.columns)))
                                    };
                                    if(record.deleteCascade) {
                                        created.deleteCascade = record.deleteCascade;
                                    }
                                    recordsCreated.push(created);
                                    callback(null,model);
                                },function(reason) {
                                    console.log(caseDef.name + ': ' + record.table + ': ' + 'ERROR while saving record in ['+record.table+']: ', reason);
                                    callback(reason);
                                });
                            }

                            /**
                             * For getting multiple next numbers for a given table,
                             * we must waterfall the calls to get next number and push them
                             * into an array that we can pass to the model insertion method.
                             * This is the only way to handle this asyncronously.
                             */
                            if(record.nextNumbers) {
                                var nextNumberTasks = [function(cback) {cback(null,'foo')}];
                                var addNextNumberTask = function(i) {
                                    nextNumberTasks.push(function(result,cback) {
                                        console.log(caseDef.name + ': ' + record.table + ': ' + 'Model is nextNumber populated in field ['+i+']. Getting nextNumber for table ['+record.nextNumbers[i]+']');
                                        se.getNextUniqueId(record.nextNumbers[i]).then(
                                         function(nextNumber) {
                                             console.log(caseDef.name + ': ' + record.table + ': ' + ' Acquired nextNumber: ' + nextNumber);
                                             var savedNextNumber = {};
                                             savedNextNumber[i] = nextNumber;
                                             nextNumbers.push(savedNextNumber);
                                             cback(null,nextNumber);
                                         }
                                        ,function(reason) {
                                            console.log(caseDef.name + ': ' + record.table + ': ' + 'ERROR: ', reason);
                                            cback(reason);
                                        })
                                    });
                                };
                                for(var index in record.nextNumbers) {
                                    addNextNumberTask(index);
                                }
                                async.waterfall(nextNumberTasks,insertModel);
                            } else {
                                insertModel(null);
                            }
                        },function(reason) {
                            console.log(caseDef.name + ': ' + record.table + ': ' + 'ERROR: model not discovered.');
                            console.dir(reason);
                            callback(reason);
                        });
                    });
                });

                var commitTryCount = 0;
                var commit = function(result,callback) {
                    commitTryCount++;
                    console.log('Calling commit callback.');

                    transaction.commit().then(function() {
                        console.log('COMMITTED');
                        callback();
                    },function(reason) {
                        console.log("COMMIT ATTEMPT "+commitTryCount+" FAILED");
                        if(reason.code == 'EREQINPROG' && commitTryCount < 5) {
                            console.log("Trying commit again...");
                            setTimeout(function() {
                                commit(result,callback);
                            },1000);
                            return;
                        }
                        console.log('NOT COMMITTED');
                        callback(reason);
                    });
                };

                var tasks = [];
                tasks.push(connect);
                for(var i=0;i<modelWriters.length;i++) {
                    tasks.push(modelWriters[i]);
                }
                tasks.push(commit);

                var writeFile = function(callback) {
                    // write the objects to the file system and exit
                    var strContents = JSON.stringify(recordsCreated,null,4);
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
                tasks.push(writeFile);

                console.log('Composing sequence.',tasks);
                async.waterfall(tasks,function(err,results) {
                    if(err) {
                        console.log('ERROR: ');
                        console.dir(err);
                        caseCallback(reason);
                    }
                    process.exit(0);
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

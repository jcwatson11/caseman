var mssql       = require('mssql');
var roundsql    = require('roundsql');
var async       = require('async');
var q           = require('q');
var fs          = require('fs');
var md5         = require('MD5');
var path        = require('path');

module.exports = function(recordfile,configfile) {

    var inputFile = path.resolve(recordfile);

    var records = require(inputFile);

    if(!Array.isArray(records)) {
        console.log('ERROR: Could not read ' + inputFile + '. File must be a JSON file containing an array of record objects.');
        return;
    }

    // Validate configfile is readable
    var configfile = (configfile) ? path.resolve(configfile):path.resolve('.')+'/caseman.js';
    var config = require(configfile);

    // Just in case there was a problem with getting the case definition file.
    if(Object.keys(config).length == 0) {
        console.log('ERROR: Could not get configuration file: ' + configfile);
        return;
    }

    (function(records) {
        var transaction    = null;
        var round          = null;
        var self           = this;

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

        // Master Task List for the entire list of records defined in the JSON file.
        var removalTasks = [connect];
        console.log('Setting up '+records.length+' records for teardown.');

        var strSql = '';
        var models = {};

        function discoverAllModels(callback) {
            var tables = [];
            for(var i=0;i<records.length;i++) {
                tables.push(records[i].table);
            }

            var strSql = round.getColumnsSql(tables);
            var modelDefs = {};
            var modelCols = {};
            console.log('running model discovery sql');
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
        }
        removalTasks.push(discoverAllModels);

        function findCascadingDeleteTableValues() {
            console.log('cascade deleting where necessary...');
            for(var i=records.length-1;i>=0;i--) {
                var record = records[i];
                if(record.deleteCascade) {
                    var cascadeDeleteFunctionGetter = (function(record) {
                        return function(callback) {
                            var model        = models[record.table];
                            var modelPk      = model.primaryKey;
                            var modelPkValue = record.row[modelPk];
                            var where = {};
                            where[modelPk] = {"value":modelPkValue};
                            model.setDebug(true);
                            model.findAll(where).then(function(results) {
                                if(results.length == 0) {
                                    callback("Unexpected empty results. Searched for a row in " + record.table + " where: " + JSON.stringify(where));
                                }
                                record.row = results[0];
                                // now loop through the deleteCascade items and construct the delete
                                // statements.
                                for(var table in record.deleteCascade) {
                                    for(var localKey in record.deleteCascade[table]) {
                                        var foreignKey = record.deleteCascade[table][localKey];
                                        strSql += "\nDELETE FROM ["+table+"] WHERE ["+foreignKey+"] = " + record.row[localKey];
                                    }
                                }
                                callback();
                            },function(err) {
                                callback(err);
                            });
                        };
                    })(record);
                    removalTasks.push(cascadeDeleteFunctionGetter);
                }
            }
        }
        findCascadingDeleteTableValues();

        function deleteTheRest(callback) {
            console.log('setting up '+records.length+' delete statements...');
            for(var i=records.length-1;i>=0;i--) {
                var record = records[i];
                var model  = models[record.table];
                strSql += "\nDELETE FROM ["+record.table+"] WHERE ["+model.primaryKey+"] = "+record.row[model.primaryKey];
            }
            process.nextTick(callback);
        }
        removalTasks.push(deleteTheRest);

        function executeTransaction(callback) {
            console.log('executing transaction');
            round.query(strSql).then(function(results) {
                console.log('transaction has no errors. about to commit.');
                callback();
            },function(err) {
                callback(err);
            });
        }
        removalTasks.push(executeTransaction);

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
        removalTasks.push(commit);

        var deleteFile = function(callback) {
            fs.unlink(inputFile, function(err) {
                if(err) {
                    console.log("Error while trying to remove input file: " + inputFile);
                    callback(err);
                }
                console.log("Input file deleted: " + inputFile);
                callback();
            });
        };
        removalTasks.push(deleteFile);

        async.series(removalTasks,function(err,results) {
            if(err) {
                console.log("ERROR: ");
                console.dir(err);
                process.exit(1);
            }
            console.log("Records Removed: YAY! ");
            process.exit(0);
        });


    })(records);
}

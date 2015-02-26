var mssql       = require('mssql');
var roundsql    = require('roundsql');
var sehelper    = require('../sehelper');
var async       = require('async');
var q           = require('q');
var fs          = require('fs');
var md5         = require('MD5');
var path        = require('path');

module.exports = function(recordfile) {

    var inputFile = path.resolve(recordfile);

    var records = require(inputFile);

    if(!Array.isArray(records)) {
        console.log('ERROR: Could not read ' + recordfile + '. File must be a JSON file containing an array of record objects.');
        return;
    }

    var config = {
        user: process.env.DMS_US_USER
       ,password: process.env.DMS_US_PASS
       ,server: process.env.DMS_US_PROTRACTOR_HOST
       ,database: process.env.DMS_US_DBNAME
       ,port: process.env.DMS_US_PROTRACTOR_PORT
    };

    (function(records) {
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
                    console.log('calling callback');
                    callback(null);
                },function(reason) {
                    callback(reason);
                });
            });
        };
        self.connect = connect;

        function createRemovalFunction(r) {
            return function remove(callback) {
                var delRecord = function(cascadeCallback) {
                    round.discoverModel(r.table,r.table,{}).then(function(models) {
                        var m = models[r.table];
                        var where = {};
                        where[m.primaryKey] = {"value": r.row[m.primaryKey]};
                        m.findAll(where).then(function(results) {
                            console.log("DELETE FROM ["+r.table+"] WHERE ["+m.primaryKey+"] = " + r.row[m.primaryKey]);
                            if(results.length == 0) {
                                console.log('Record already deleted');
                                cascadeCallback(null);
                                return;
                            }
                            results[0].delete().then(function() {
                                console.log("DELETE SUCCESS");
                                cascadeCallback(null);
                            },function(reason) {
                                cascadeCallback(reason);
                            });
                        },function(reason) {
                            cascadeCallback(reason);
                        });
                    },function(reason) {
                        console.log(r.table + ': Model discovery error');
                        cascadeCallback(reason);
                    });
                };
                var createDeleteCascader = function(table,localKey,foreignKey) {
                    return function(cascadeCallback) {
                        round.discoverModel(table,table,{}).then(function(models) {
                            var m = models[table];
                            var where = {};
                            where[foreignKey] = {"value": r.row[localKey]};
                            m.findAll(where).then(function(results) {
                                console.log("DELETE FROM ["+table+"] WHERE ["+foreignKey+"] = " + r.row[localKey]);
                                if(results.length == 0) {
                                    console.log('Record already deleted');
                                    cascadeCallback(null);
                                    return;
                                }
                                var deleteTasks = [];
                                var createDeleteTask = function(recordToDelete) {
                                    return function(delCallback) {
                                        recordToDelete.delete().then(function() {
                                            console.log("DELETE SUCCESS");
                                            delCallback(null);
                                        },function(reason) {
                                            delCallback(reason);
                                        });
                                    }
                                }
                                var toDelete = 1;
                                while(toDelete = results.pop()) {
                                    deleteTasks.push(createDeleteTask(toDelete));
                                }
                                async.series(deleteTasks,function(err,results) {
                                    if(err) {
                                        console.log("CASCADE DELETE ERROR: ");
                                        console.dir(err);
                                        cascadeCallback(err);
                                    }
                                    cascadeCallback(null);
                                });
                            },function(reason) {
                                cascadeCallback(reason);
                            });
                        },function(reason) {
                            cascadeCallback(reason);
                        });
                    }
                };
                var cascadeTasks = [];
                if(r.deleteCascade) {
                    console.log();
                    for(var t in r.deleteCascade) {
                        var localKey = null;
                        var foreignKey = null;
                        for(var lk in r.deleteCascade[t]) {
                            localKey = lk;
                            foreignKey = r.deleteCascade[t][lk]
                        }
                        cascadeTasks.push(createDeleteCascader(t,localKey,foreignKey));
                    }
                }
                cascadeTasks.push(delRecord);
                async.series(cascadeTasks,function(err,results) {
                    if(err) {
                        console.log("CASCADE ERROR: ");
                        console.dir(err);
                        callback(err);
                    }
                    callback(null);
                });
            };
        }

        // Master Task List for the entire list of records defined in the JSON file.
        var removalTasks = [connect];
        var rec = 1;
        console.log('Setting up '+records.length+' records for teardown.');
        while(rec = records.pop()) {
            removalTasks.push(createRemovalFunction(rec));
        }

        var commitTryCount = 0;
        var commit = function(callback) {
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
                        commit(callback);
                    },1000);
                    return;
                }
                console.log('NOT COMMITTED');
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

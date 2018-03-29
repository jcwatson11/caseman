var mssql       = require('mssql');
var roundsql    = require('roundsql');
var async       = require('async');
var q           = require('q');
var fs          = require('fs');
var md5         = require('MD5');
var path        = require('path');
var Promise     = require('bluebird');

class CaseRemover {
    constructor(caseman) {
        this.config = caseman.config;
        this.round = caseman.round;
    }

    destroyCase(models, records) {
        return new Promise(((resolve, reject) => {
            this.discoverAllModels()
            .then(((resolve,reject,models) => {
                this.writeSql(models, records)
                .then(((strSql) => {
                    this.executeTransaction(strSql)
                    .then(((resolve,reject) => {
                        this.commit()
                        .then(((resolve,reject) => {
                            resolve();
                        }).bind(this,resolve,reject),reject).catch(reject);
                    }).bind(this,resolve,reject),reject).catch(reject);
                }).bind(this,resolve,reject),reject).catch(reject);
            }).bind(this,resolve,reject),reject).catch(reject);
        }).bind(this))
    }

    writeSql(models, records) {
        return new Promise(((outerResolve, outerReject) => {
            var aContexts = [];
            for(var i=records.length-1;i>=0;i--) {
                var record = records[i];
                if(record.deleteCascade) {
                    var context = {
                        'record'        : records[i]
                        ,'model'        : models[record.table]
                        ,'modelPk'      : models[record.table].primaryKey
                        ,'modelPkValue' : record.row[0][models[record.table].primaryKey]
                        ,'where'        : {}
                        ,'strSql'       : ''
                    };
                    context.where[context.modelPk] = {"type":this.round.mssql.VarChar(10),"value":context.modelPkValue};
                    context.model.setDebug(true);
                    aContexts.push(context);
                }
            }
            Promise.resolve(aContexts).mapSeries(((context) => {
                return context.model.findAll(context.where).then(((results) => {
                    if(results.length == 0) {
                        console.log("Unexpected empty resultset. Searched for a row in " + record.table + " where: " + JSON.stringify(where));
                        return '';
                    }
                    // now loop through the deleteCascade items and construct the delete
                    // statements.
                    for(var table in context.record.deleteCascade) {
                        for(var localKey in context.record.deleteCascade[table]) {
                            var foreignKey = context.record.deleteCascade[table][localKey];
                            context.strSql += "\nDELETE FROM ["+table+"] WHERE ["+foreignKey+"] = " + context.record.row[0][localKey];
                        }
                    }
                    return context.strSql;
                }).bind(this),(err) => {
                    console.log("Could not get information for removing deleteCascade group for record:", err);
                }).catch((err) => {
                    console.log("Could not get information for removing deleteCascade group for record:", err);
                });
            })
            .bind(this))
            .then(((aSqlStatements) => {
                outerResolve(aSqlStatements.join("\n") + this.getTopLevelDeleteStatements(models, records));
            }).bind(this),outerReject)
            .catch(outerReject);
        }).bind(this));
    }

    getTopLevelDeleteStatements(models, records) {
        var strSql = "\n";
        var reversed = records.reverse();
        for(var i=0;i<reversed.length;i++) {
            var record = reversed[i];
            var model  = models[record.table];
            strSql += "\nDELETE FROM ["+record.table+"] WHERE ["+model.primaryKey+"] = "+record.row[0][model.primaryKey];
        }
        return strSql;
    }

    executeTransaction(strSql) {
        return new Promise(((resolve, reject) => {
            this.round.query(strSql).then(((results) => {
                resolve(true);
            }).bind(this),reject).catch(reject);
        }).bind(this));
    }

}

module.exports = CaseRemover;

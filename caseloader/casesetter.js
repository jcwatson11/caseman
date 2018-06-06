'use strict';
const Promise = require('bluebird');
const util = require('util');

/**
 * Class CaseSetter
 *
 * @param {CaseLoader}
 */
class CaseSetter {
    constructor(caseloader) {
        this.round = caseloader.round;
        this.loader = caseloader;
        this.records = [];
        this.declaredVariables = [];
        this.boundParameters = [];
        this.strSql = '';
        this.commitTryCount = 1;
    }

    /**
     * Executes the tree of promises in sequence to write the test case to the database
     * @return {Promise}
     */
    loadCase() {
        return new Promise(((resolve, reject) => {
            this.round.connection.begin()
            .then((() => {
                this.discoverAllModels()
                .then(((models) => {
                    this.writeSql(models)
                    .then(((strSql) => {
                        this.executeTransaction(strSql)
                        .then(((records) => {
                            this.commit(this.round.connection)
                            .then((() => {
                                var res = {'models':models,'records':records};
                                resolve(res);
                            }).bind(this),reject).catch(reject);
                        }).bind(this),reject).catch(reject);
                    }).bind(this),reject).catch(reject);
                }).bind(this),reject).catch(reject);
            }).bind(this),reject).catch(reject);
        }).bind(this))
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

    /**
     * Get the Array Key of the record with table name "name".
     * @param  {string} name
     * @param  {array} records
     * @param  {boolean} bReverse
     * @param  {integer} startingPoint
     * @return {integer}
     */
    getStatementId(name,records,bReverse,startingPoint) {
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

    /**
     * Discover the schema of all tables mentioned in the test case definition.
     * @return {Promise}
     */
    discoverAllModels() {
        return new Promise(((resolve, reject) => {
            // Discover all the models at once
            // The array.pop() syntax has higher performance ratings than any other kind of loop
            var instruction = null;
            var tables = [];
            for(var i=0;i<this.loader.testCase.records.length;i++) {
                var instruction = JSON.parse(JSON.stringify(this.loader.testCase.records[i]));
                tables.push(instruction.table);
                this.records.push(instruction);
            }
            this.records = this.records.reverse();

            var strSql = this.round.getColumnsSql(tables);
            var modelDefs = {};
            var modelCols = {};
            var models = [];
            this.round.query(strSql).then(((results) => {
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
                    modelCols[i] = this.round.translateColumns(modelDefs[i]);
                }
                for(var i in modelCols) {
                    models[i] = this.round.generateModel(i,i,modelCols[i]);
                }
                resolve(models);
            }).bind(this),this.getErrorHandler(reject)).catch(this.getErrorHandler(reject));
        }).bind(this));
    };

    /**
     * Write the SQL required to insert test records into the database as
     * defined in the test case definition
     * @return {Promise}
     */
    writeSql(models) {
        return new Promise(((resolve, reject) => {
            var strSql = '';
            this.records.reverse();

            for(var i=0;i<this.records.length;i++) {
                // sequence management
                var record = this.records[i];
                var strMessage = this.loader.validateRecord(record,this.loader.testCase);
                if(strMessage !== true) {
                    console.log(this.loader.testCase.name + ': ' + record.table + ': ' + strMessage);
                    callback(strMessage);
                    return;
                }
                var instruction = this.records[i];
                var strTableName = this.records[i].table;
                var model = models[strTableName].new();
                model.hydrate(instruction.row);
                this.records[i].model = model;
                var scopeIdVariable = "pk" +i+ strTableName;
                var insertSql = model.getInsertQuery(true,i);
                var insertBindings = model.getInsertUpdateParams(false,i);
                if(instruction['sequences']) {
                    if(!this.loader.config.getSequenceSqlFunction) {
                        callback('ERROR: Your case definition instructs one or more fields to be populated with a sequence. However your configuration file does not define getSequenceSqlFunction(identifier,varName).');
                        return;
                    }
                    for(var n in instruction.sequences) {
                        delete insertBindings[i+n];
                        var sequenceIdentifier = instruction.sequences[n];
                        var variableName = 'seq'+n;
                        if(this.declaredVariables.indexOf(variableName) == -1) {
                            this.declaredVariables.push(variableName);
                            strSql += "\nDECLARE @"+variableName+" bigint;\n"
                        }
                        var fn = this.loader.config.getSequenceSqlFunction(sequenceIdentifier,variableName);
                        strSql += fn();
                    }
                }
                strSql += "\nDECLARE @"+scopeIdVariable+" bigint;\n"
                this.declaredVariables.push(scopeIdVariable);
                if(instruction.populateFrom) {
                    for(var f in instruction.populateFrom) {
                        for(var t in instruction.populateFrom[f]) {

                            // remove insertBinding for fields that are populated
                            // from previous fields.
                            delete insertBindings[i+f];
                            var strFromField = instruction.populateFrom[f][t];
                            var modelId = null;
                            if(t=='this') {
                                modelId = 'seq';
                            } else {
                                modelId = this.getStatementId(t,this.records,true,i);
                            }
                            if(modelId == 'NOTFOUND') {
                                console.dir(this.records);
                                reject('Table ['+t+'] was not found in the above list of records');
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
                util._extend(this.boundParameters,insertBindings);
                strSql += insertSql;
                strSql += "\nSELECT @"+scopeIdVariable+" = SCOPE_IDENTITY();\n";
            }
            // Now go back through the sequences and replace their target field names
            // with the sequence name
            for(var i=0;i<this.records.length;i++) {
                var instruction = this.records[i];
                if(instruction['sequences']) {
                    for(var n in instruction.sequences) {
                        var sequenceModelId = this.getStatementId(instruction.sequences[n],this.records);
                        var strFrom = '@'+i+n;
                        var strTo   = '@seq'+n;
                        var regex = new RegExp(strFrom, 'g');
                        strSql = strSql.replace(regex,strTo);
                    }
                }
            }
            strSql = strSql.replace(/@[A-Za-z0-9]+ = (@seq[A-Za-z0-9]+),/g,'$1,');

            var unions = [];
            for(var i=0;i<this.declaredVariables.length;i++) {
                if(this.declaredVariables[i].indexOf('seq') == -1) {
                    var cnt = this.declaredVariables[i].replace(/pk([0-9]+)[^0-9]+.*/,'$1');
                    unions.push("\nSELECT "+cnt+" AS id, '"+this.declaredVariables[i]+"' AS varname, @"+this.declaredVariables[i]+" AS value\n");
                }
            }
            strSql = new String(strSql);
            var strUnions = new String(unions.join("\nUNION ALL\n"));
            strSql += strUnions;

            // Now go back and select all of the primary key values from the records inserted.
            // console.log('SQL: ', strSql);

            resolve(strSql);
        }).bind(this));

    };

    /**
     * Executes the set of SQL statements generated to insert all records
     * from the test case into the database at the same time.
     * @return {Promise}
     */
    executeTransaction(strSql) {
        return new Promise(((resolve, reject) => {
            this.round.query(strSql,this.boundParameters).then(((results) => {
                var aSqlGetters = [];
                for(var i = 0;i<results.length;i++) {
                    var model = this.records[i].model;
                    var pk    = model.primaryKey;
                    model[pk] = results[i].value;
                    var self = this;
                    var getter = {
                        'sql': "SELECT * FROM ["+model.tableName+"] WHERE ["+pk+"] = @primaryKey;"
                        ,'bindings': {'primaryKey': {'type': this.round.mssql.VarChar(10), 'value': results[i].value}}
                        ,'record': this.records[i]
                        ,'model': this.records[i].model
                    };
                    aSqlGetters.push(getter);

                }
                Promise.resolve(aSqlGetters).mapSeries(((getter) => {
                    return this.round.query(getter.sql, getter.bindings)
                    .then(((res) => {
                        var created = {
                            'table': getter.record.table
                           ,'row': res
                        };
                        if(getter.record.deleteCascade) {
                            created.deleteCascade = getter.record.deleteCascade;
                        }
                        return created;
                    }).bind(this),this.getErrorHandler(reject))
                    .catch(this.getErrorHandler(reject));
                })
                .bind(this))
                .then(((allResults) => {
                    resolve(allResults);
                }).bind(this),this.getErrorHandler(reject))
                .catch(this.getErrorHandler(reject));

            }).bind(this),this.getErrorHandler(reject)).catch(this.getErrorHandler(reject));
        }).bind(this));
    }

    /**
     * Commit the transaction
     * @return {Promise}
     */
    commit(transaction,previousResolves,previousRejects) {
        const rejectAll = (rejects, err) => {
            rejects = previousRejects.reverse();
            rejects.map((rej) => {
                rej(err);
            });
        };
        const resolveAll = (resolves, value) => {
            resolves = previousResolves.reverse();
            resolves.map((res) => {
                res(value);
            });
        };
        return new Promise(((resolve, reject) => {
            if(!previousRejects) {
                previousRejects = [reject];
            } else {
                previousRejects.push(reject);
            }
            if(!previousResolves) {
                previousResolves = [resolve];
            } else {
                previousResolves.push(resolve);
            }
            transaction.commit(((err) => {
                if(err && err.code === 'EREQINPROG') {
                    if(this.commitTryCount >= 3) {
                        rejectAll(previousRejects, err);
                        return;
                    }
                    this.commitTryCount++;
                    setTimeout(
                        this.commit.bind(this,transaction,previousResolves,previousRejects)
                    , 1000);

                } else {
                    resolveAll(previousResolves,true);
                }
            }).bind(this)
            ,rejectAll.bind(this,previousRejects));
        }).bind(this));
    };
}
module.exports = CaseSetter;

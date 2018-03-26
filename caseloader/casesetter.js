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
        this.models = {};
        this.records = [];
        this.declaredVariables = [];
        this.boundParameters = [];
        this.outputObjects = [];
        this.strSql = '';
        this.commitTryCount = 0;
    }

    /**
     * Executes the tree of promises in sequence to write the test case to the database
     * @return {Promise}
     */
    loadCase() {
        return new Promise(((resolve, reject) => {
            this.discoverAllModels()
            .then(((resolve,reject,models) => {
                this.writeSql()
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
            while(instruction = this.loader.testCase.records.pop()) {
                tables.push(instruction.table);
                this.records.push(instruction);
            }

            var strSql = this.round.getColumnsSql(tables);
            var modelDefs = {};
            var modelCols = {};
            this.round.query(strSql).then(((modelDefs, modelCols, resolve, results) => {
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
                    this.models[i] = this.round.generateModel(i,i,modelCols[i]);
                }
                resolve(this.models);
            }).bind(this, modelDefs, modelCols, resolve),this.getErrorHandler(reject)).catch(this.getErrorHandler(reject));
        }).bind(this));
    };

    /**
     * Write the SQL required to insert test records into the database as
     * defined in the test case definition
     * @return {Promise}
     */
    writeSql() {
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
                var model = this.models[strTableName].new();
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
                            var modelId = this.getStatementId(t,this.records,true,i);
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
                    var record = this.records[i];
                    var model = record.model;
                    var pk    = model.primaryKey;
                    model[pk] = results[i].value;
                    aSqlGetters.push({
                        sql: "SELECT * FROM ["+model.tableName+"] WHERE ["+pk+"] = @primaryKey;"
                        ,bindings: {'primaryKey': {'type': this.round.mssql.VarChar(10), 'value': results[i].value}}
                    });
                }

                const stepsResultsHandler = ((resolve,model,record,ar) => {
                    for(var j=0;j<ar.length;j++) {
                        var r = ar[j];
                        var allowedJsonProperties = Object.keys(model.columns);
                        var created = {
                            'table': record.table
                           ,'row': JSON.parse(JSON.stringify(r,allowedJsonProperties))
                        };
                        if(record.deleteCascade) {
                            created.deleteCascade = record.deleteCascade;
                        }
                        this.outputObjects.push(created);
                    }
                    resolve(this.outputObjects);
                }).bind(this,resolve,model,record);

                const sqlQuery = ((getter) => {
                    return this.round.query(getter.sql, getter.bindings);
                }).bind(this);

                Promise.mapSeries(aSqlGetters,sqlQuery)
                .then(stepsResultsHandler,this.getErrorHandler(reject)).catch(this.getErrorHandler(reject));

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

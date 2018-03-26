'use strict';
const mssql = require('mssql');
const CaseLoader = require('../caseloader');
const CaseSetter = require('../caseloader/casesetter');
const RoundSql = require('roundsql');
const Model = require('roundsql/model');
const config = require('./support/casemanconfig');
const CaseMan = require('../index');
var testCase = require('./testCase');
const path = require('path');
const fs = require('fs');

const getContext = () => {
    return new Promise((resolve, reject) => {
        const errHandler = ((reject,err) => {
            console.log("TRANSACTION NOT STARTED:", err);
            reject(err);
        }).bind(this, reject);
        var context = {};
        // create connection for model discovery
        context.connection = new mssql.Connection(config.mssql, (err) => {
            if(err) {
                errHandler(err)
                return;
            }
            context.transaction = new mssql.Transaction(context.connection);
            context.round = new RoundSql(mssql, context.transaction);
            context.caseman = new CaseMan(config, context.round);
            context.transaction.begin()
            .then(() => {
                context.begun = true;
                resolve(context);
            }
            ,errHandler
            )
            .catch(errHandler);
        });
    });
}

describe("When using the caseloader", () => {

    var specSql = null;
    var context1 = null;
    var context2 = null;

    beforeAll((done) => {
        const specSqlPath = path.join(__dirname, 'spec.sql');
        specSql = fs.readFileSync(specSqlPath).toString('utf8');
        const errHandler = ((err) => {
            done();
        });
        // Get the first context for basic functions
        getContext().then((context) => {
            context1 = context;
            // Get the second context for database work
            getContext().then((context) => {
                context2 = context;
                done();
            },errHandler).catch(errHandler);
        },errHandler).catch(errHandler);

    });

    it("CaseMan can set the caseloader when constructing", () => {
        expect(context1.caseman.loader instanceof CaseLoader).toBeTruthy();
    });

    it("CaseMan will pass the config file to CaseLoader", () => {
        expect(context1.caseman.loader.config).toBe(config);
    });

    it("CaseSetter can load a test case", (done) => {
        var loader = context1.caseman.loader;
        loader.testCase = testCase;
        var setter = new CaseSetter(loader);
        expect(setter.round instanceof RoundSql).toBeTruthy();
        expect(setter.loader instanceof CaseLoader).toBeTruthy();
        done();
    });

    it("CaseLoader can discover models, write Sql, execute the transaction and commit", (done) => {
        const errHandler = ((done, err) => {
            console.log('ERR:', err);
            done();
        }).bind(null, done);

        var loader = context2.caseman.loader;
        loader.testCase = testCase;
        var setter = new CaseSetter(loader);
        setter.discoverAllModels()
        .then((models) => {
            for(var i in models) {
                expect(models[i] instanceof Model).toBeTruthy();
            }
            setter.writeSql().then(((strSql) => {
                expect(strSql).toEqual(specSql);
                setter.executeTransaction(strSql).then(((outputObjects) => {
                    expect(outputObjects.length).toEqual(5);
                    expect(outputObjects[0].table).toEqual('A01aAccountNotes');
                    // test commit
                    setter.commit(context2.transaction).then(((bSuccess) => {
                        expect(bSuccess).toBeTruthy();
                        done();
                    }).bind(setter),errHandler).catch(errHandler);
                }).bind(setter),errHandler).catch(errHandler);
            }).bind(setter),errHandler).catch(errHandler);
        },errHandler).catch(errHandler)
    });

});

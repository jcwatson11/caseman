'use strict';
const mssql = require('mssql');
const CaseLoader = require('../caseloader');
const CaseRemover = require('../caseremover');
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
            context.done = true;
            resolve(context);
        });
    });
}

describe("When using the caseloader", () => {

    var specSql = null;
    var context1 = null;
    var context2 = null;
    var context3 = null;

    beforeAll((done) => {
        const specSqlPath = path.join(__dirname, 'spec.sql');
        specSql = fs.readFileSync(specSqlPath).toString('utf8');
        const errHandler = ((err) => {
            done();
        });
        // Get the first context for basic functions
        getContext().then((context) => {
            context1 = context;
            context1.transaction.begin()
            .then(() => {
                // Get the second context for database work
                getContext().then((context) => {
                    context2 = context;
                    getContext().then((context) => {
                        context3 = context;
                        done();
                    },errHandler).catch(errHandler);
                },errHandler).catch(errHandler);
            },errHandler).catch(errHandler);
        },errHandler).catch(errHandler);

    });

    it("CaseMan can set the caseloader when constructing", () => {
        expect(context1.caseman.loader instanceof CaseLoader).toBeTruthy();
    });

    it("CaseMan can set the caseremover when constructing", () => {
        expect(context1.caseman.remover instanceof CaseRemover).toBeTruthy();
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

    it("CaseLoader can discover models, write Sql, execute the transaction, commit and remove an entire test case", (done) => {
        const errHandler = ((done, err) => {
            console.log('ERR:', err);
            done();
        }).bind(null, done);

        var loader = context2.caseman.loader;
        var remover = context2.caseman.remover;
        var setter = new CaseSetter(loader);
        loader.testCase = testCase;
        context2.transaction.begin()
        .then((() => {
            setter.discoverAllModels()
            .then(((models) => {
                for(var i in models) {
                    expect(models[i] instanceof Model).toBeTruthy();
                }
                setter.writeSql(models).then(((strSql) => {
                    expect(strSql).toEqual(specSql);
                    setter.executeTransaction(strSql).then(((records) => {
                        // Testing insertion results
                        expect(records.length).toEqual(6);
                        expect(records[0].table).toEqual('A01_AccountMaster');
                        expect(records[1].table).toEqual('A03_AddressMaster');
                        expect(records[2].table).toEqual('A02_AccountAddresses');
                        expect(records[3].table).toEqual('A07_AccountEmails');
                        expect(records[4].table).toEqual('A01aAccountNotes');
                        // test commit
                        setter.commit(context2.transaction).then(((bSuccess) => {
                            expect(bSuccess).toBeTruthy();
                            context2.transaction.begin()
                            .then(() => {
                                // Testing preparation of clean-up SQL statements
                                remover.writeSql(models, records)
                                .then((strCascadedDeletes) => {
                                    // Second Transaction
                                    var regexExpected = /\nDELETE FROM \[T07_TransactionResponseMaster\] WHERE \[AddressId\] = [0-9]+\n\nDELETE FROM \[A02_AccountAddresses\] WHERE \[AccountNumber\] = [0-9]+\nDELETE FROM \[A05_AccountCommunications\] WHERE \[AccountNumber\] = [0-9]+\nDELETE FROM \[A06_AccountSalutations\] WHERE \[AccountNumber\] = [0-9]+\nDELETE FROM \[A07_AccountEmails\] WHERE \[AccountNumber\] = [0-9]+\nDELETE FROM \[A10_AccountPledges\] WHERE \[AccountNumber\] = [0-9]+\nDELETE FROM \[T01_TransactionMaster\] WHERE \[AccountNumber\] = [0-9]+\nDELETE FROM \[T16_RecurringTransactionHeaders\] WHERE \[AccountNumber\] = [0-9]+\nDELETE FROM \[A14_AccountFirstContacts\] WHERE \[AccountNumber\] = [0-9]+\n\nDELETE FROM \[A10_AccountPledges\] WHERE \[RecordId\] = [0-9]+\nDELETE FROM \[A01aAccountNotes\] WHERE \[RecordId\] = [0-9]+\nDELETE FROM \[A07_AccountEmails\] WHERE \[RecordId\] = [0-9]+\nDELETE FROM \[A02_AccountAddresses\] WHERE \[RecordID\] = [0-9]+\nDELETE FROM \[A03_AddressMaster\] WHERE \[RecordId\] = [0-9]+\nDELETE FROM \[A01_AccountMaster\] WHERE \[RecordId\] = [0-9]+/;
                                    expect(strCascadedDeletes).toMatch(regexExpected);
                                    remover.executeTransaction(strCascadedDeletes)
                                    .then((bSuccess) => {
                                        expect(bSuccess).toBe(true);
                                        setter.commit(context2.transaction)
                                        .then((bSuccess) => {
                                            expect(bSuccess).toBe(true);
                                            context2.done = true;
                                            done();
                                        });
                                    });
                                },errHandler)
                                .catch(errHandler);
                            },errHandler)
                            .catch(errHandler);
                        }).bind(setter),errHandler).catch(errHandler);
                    }).bind(setter),errHandler).catch(errHandler);
                }).bind(setter),errHandler).catch(errHandler);
            }).bind(this),errHandler).catch(errHandler)
        }).bind(this), errHandler).catch(errHandler);
    });

    it("Caseman can create and remove a test case using its own controlling methods.", (done) => {
        const errHandler = ((done, err) => {
            console.log('ERR:', err);
            done();
        }).bind(null, done);

        const thisTest = () => {
            if(context2.done) {
                const man = context3.caseman;
                man.loader.loadTestCase(testCase).then((ret) => {
                    expect(Object.keys(ret.models).length).toEqual(6);
                    expect(ret.records.length).toEqual(6);
                    man.remover.destroyCase(ret.models, ret.records)
                    .then((bSuccess) => {
                        expect(bSuccess).toBe(true);
                        done();
                    },errHandler).catch(errHandler);
                });
            } else {
                setTimeout(thisTest, 1000);
            }
        };
        thisTest();
    });

});

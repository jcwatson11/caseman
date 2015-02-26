var mssql       = require('mssql');
var jasminUtils = require('jasmine-utils');
var roundsql    = require('roundsql');
var sehelper    = require('../sehelper');

describe('after connecting,', function() {

    describe('when using roundsql,',function() {

        var connection = { connected: false };
        var transaction = { connected: false };
        var begun = false;
        var round;
        var se;
        var config = {
            user: process.env.DMS_US_USER
           ,password: process.env.DMS_US_PASS
           ,server: process.env.DMS_US_PROTRACTOR_HOST
           ,database: process.env.DMS_US_DBNAME
           ,port: process.env.DMS_US_PROTRACTOR_PORT
        };

        beforeAll(function(done) {
            connection = new mssql.Connection(config,function(err) {
                if(err) {
                    console.log('CONNECTION ERR: ' + err.message);
                }
                transaction = new mssql.Transaction(connection);
                round = new roundsql(mssql,transaction);
                se = new sehelper(round);
                transaction.begin().then(function() {
                    begun = true;
                    done();
                },function(reason) {
                    console.log('TRANSACTION NOT BEGUN: ', reason);
                    done();
                });
            });
        });

        it('it can get a SessionId',function(done) {
            if(begun) {
                se.getSessionId().then(function(sessionId) {
                    expect(sessionId).toBe(5663);
                    done();
                },function(reason) {
                    console.log("ERROR: " , reason);
                    done();
                });
            }
        });

        it('it returns the right NextNumber ID Names for Q03_ImportMaster',function() {
            expect(se.getNextNumberIdNameByTableName('Q03_ImportMaster')).toBe('ECOMMIMPID');
        });

        it('it returns the right NextNumber ID Names for Q04_ImportDetails',function() {
            expect(se.getNextNumberIdNameByTableName('Q04_ImportDetails')).toBe('ECOMMIDTID');
        });

        it('it returns the right NextNumber ID Names for A03_AddressMaster',function() {
            expect(se.getNextNumberIdNameByTableName('A03_AddressMaster')).toBe('ADDRESSID');
        });

        it('it returns the right NextNumber ID Names for A10_AccountPledges',function() {
            expect(se.getNextNumberIdNameByTableName('A10_AccountPledges')).toBe('PLEDGEID');
        });

        it('it returns the right NextNumber ID Names for A01_AccountMaster',function() {
            expect(se.getNextNumberIdNameByTableName('A01_AccountMaster')).toBe('ACCTNBR');
        });

        it('it returns a new unique ID for Q03_ImportMaster',function(done) {
            if(begun) {
                se.getNextUniqueId('Q03_ImportMaster').then(
                function(id) {
                    expect(id).toBeInteger();
                    done();
                },
                function(reason) {
                    console.log("ERROR: Could not get NextNumber for Q03_ImportMaster: " , reason);
                    done();
                });
            }
        });

        it('it returns a new unique ID for Q04_ImportDetails',function(done) {
            if(begun) {
                se.getNextUniqueId('Q04_ImportDetails').then(
                function(id) {
                    expect(id).toBeInteger();
                    done();
                },
                function(reason) {
                    console.log("ERROR: Could not get NextNumber for Q04_ImportDetails: " , reason);
                    done();
                });
            }
        });

        it('it returns a new unique ID for A03_AddressMaster',function(done) {
            if(begun) {
                se.getNextUniqueId('A03_AddressMaster').then(
                function(id) {
                    expect(id).toBeInteger();
                    done();
                },
                function(reason) {
                    console.log("ERROR: Could not get NextNumber for A03_AddressMaster: " , reason);
                    done();
                });
            }
        });

        it('it returns a new unique ID for A10_AccountPledges',function(done) {
            if(begun) {
                se.getNextUniqueId('A10_AccountPledges').then(
                function(id) {
                    expect(id).toBeInteger();
                    done();
                },
                function(reason) {
                    console.log("ERROR: Could not get NextNumber for A10_AccountPledges: " , reason);
                    done();
                });
            }
        });

    });

});


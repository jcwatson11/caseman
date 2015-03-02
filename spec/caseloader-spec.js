var mssql       = require('mssql');
var jasminUtils = require('jasmine-utils');
var roundsql    = require('roundsql');
var sehelper    = require('../caseloader');
var sehelper    = require('../sehelper');

describe('after connecting,', function() {

    /**
     * Helper function for getting nextNumbers for the test tables.
     *
     * @param strTableName string table name to use for getting the next number
     * @return nextNumber ID in database.
     */
    var getNextNumberIdNameByTableName = function(strTableName) {
        var ref = {
             'Q03_ImportMaster'                : 'ECOMMIMPID'
            ,'Q04_ImportDetails'               : 'ECOMMIDTID'
            ,'A03_AddressMaster'               : 'ADDRESSID'
            ,'A10_AccountPledges'              : 'PLEDGEID'
            ,'A01_AccountMaster'               : 'ACCTNBR'
            ,'T07_TransactionResponseMaster'   : 'RESPONSEID'
            ,'T16_RecurringTransactionHeaders' : 'RECTRANSID'
        };
        if(typeof ref[strTableName] == 'undefined') {
            console.log(strTableName + ' is not a nextNumber enabled table.');
            return false;
        }
        return ref[strTableName];
    };

    /**
     * roundsql config object 
     */
    var roundsqlconfig = {

        mssqlconfig: {
            user     : process.env.CASEMAN_USER
           ,password : process.env.CASEMAN_PASS
           ,server   : process.env.CASEMAN_HOST
           ,database : process.env.CASEMAN_DBNAME
           ,port     : process.env.CASEMAN_PORT
        },

        sequenceIdValidator: function() {
        },

        /**
         * Used by roundsql to get sequence numbers for fields that need them.
         *
         * @mssql reference to the mssql object
         * @connection the mssql connection or transaction
         * @identifier the identifier used to identify the sequence number you want to get
         *             this identifier is entirely up to you, and can be implemented however
         *             you want to implement it.
         */
        nextNumberGetter: function(mssql,connection,identifier) {
            var strType = getNextNumberIdNameByTableName(identifier);
            var deferred = q.defer();
            var request = new mssql.Request(connection);
            var strSql = "DECLARE @iNextNumber bigint\n" +
                "EXEC [dbo].[X31_NextNumberBusinessDataSingleValueByType] @strType=N'"+strType+"',@iNextNumber=@iNextNumber OUTPUT\n" +
                "SELECT @INextNumber as N'NextNumber'";
            request.query(strSql,function(err,resultset) {
                if(dbHadError(err,deferred,connection)) return;
                deferred.resolve(resultset[0].NextNumber);
            });
            return deferred.promise;
        }
    };


    describe('when configuring caseloader,',function() {
        var connection = { connected: false };
        var transaction = { connected: false };
        var begun = false;
        var round;
        var se;
        var config = {
            user       : process.env.ROUNDSQL_USER
           ,password   : process.env.ROUNDSQL_PASS
           ,server     : process.env.ROUNDSQL_HOST
           ,database   : process.env.ROUNDSQL_DBNAME
           ,port       : process.env.ROUNDSQL_PORT
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
    });

});


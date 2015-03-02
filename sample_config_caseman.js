module.exports = {
    getSequenceSqlFunction: function(id,variableName) {
        /**
         * Returns the next number for the secondary primary key for a given table.
         * Yes. I know tables shouldn't have a secondary primary key. Good luck telling
         * Donor Direct that. Maybe the next database they design will have a measure
         * of sanity after you talk to them.
         *
         * @param strTableName string name of the table you want to get the next number for.
         * @return promise that resolves with an integer ID
         */
            /**
             * Returns the rather cryptic "NextNumber" ID code name
             *
             * @param strTableName string name of table you want to know the next number ID
             *        code name for
             */
            var getNextNumberIdNameByTableName = function(strTableName,varName) {
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

            return function() {
                var strType = getNextNumberIdNameByTableName(id);
                var strSql = "EXEC [dbo].[X31_NextNumberBusinessDataSingleValueByType] @strType=N'"+strType+"',@iNextNumber=@"+variableName+" OUTPUT\n";
                return strSql;
            };
    },
    mssql: {
         user       : process.env.ROUNDSQL_USER
        ,password   : process.env.ROUNDSQL_PASS
        ,server     : process.env.ROUNDSQL_HOST
        ,database   : process.env.ROUNDSQL_DBNAME
        ,port       : process.env.ROUNDSQL_PORT
    }
};

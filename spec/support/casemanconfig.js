'use strict';
module.exports = {
    getSequenceSqlFunction: function(id,variableName) {
        /**
         * Returns the next number for the secondary primary key for a given table.
         *
         * @param strTableName string name of the table you want to get the next number for.
         * @return promise that resolves with an integer ID
         */
            /**
             * Returns the "NextNumber" ID code name
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
                    ,'T01_TransactionMaster'           : 'DOCNBR'
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
         user       : process.env.LOCAL_DMS_USER
        ,password   : process.env.LOCAL_DMS_PASS
        ,server     : process.env.LOCAL_DMS_HOST
        ,database   : process.env.LOCAL_DMS_DBNAME
        ,port       : process.env.LOCAL_DMS_PORT
    }
};

var q        = require('q');

module.exports = function sehelper(round) {

    /**
     * Returns the session ID for 'DDAPI'
     *
     * @return promise that resolves with an integer sessionID
     */
    this.getSessionId = function() {
        var deferred = q.defer();
        var args = ['DDAPI','DEV','I'];
        round.proc('X29_CreateNewAccessorSession',args)
        .then(function(rets) {
            var results = rets[0];
            deferred.resolve(parseInt(results[0][0]['']));
        },function(reason) {
            deferred.reject(reason);
        });
        return deferred.promise;
    };

    /**
     * Returns the rather cryptic "NextNumber" ID code name
     *
     * @param strTableName string name of table you want to know the next number ID
     *        code name for
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
    this.getNextNumberIdNameByTableName = getNextNumberIdNameByTableName;

    /**
     * Returns the next number for the secondary primary key for a given table.
     * Yes. I know tables shouldn't have a secondary primary key. Good luck telling
     * Donor Direct that. Maybe the next database they design will have a measure
     * of sanity after you talk to them.
     *
     * @param strTableName string name of the table you want to get the next number for.
     * @return promise that resolves with an integer ID
     */
    var getNextUniqueId = function(strTableName) {
        var deferred = q.defer();
        var strType = getNextNumberIdNameByTableName(strTableName);
        var strSql = "DECLARE @iNextNumber bigint\n" +
            "EXEC [dbo].[X31_NextNumberBusinessDataSingleValueByType] @strType=N'"+strType+"',@iNextNumber=@iNextNumber OUTPUT\n" +
            "SELECT @INextNumber as N'NextNumber'";
        round.query(strSql).then(function(results) {
            deferred.resolve(results[0].NextNumber);
        },function(reason) {
            deferred.reject(reason);
        });
        return deferred.promise;
    };
    this.getNextUniqueId = getNextUniqueId;
};


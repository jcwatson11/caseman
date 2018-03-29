module.exports = {
    "name": "testing simple account login to web site"
    ,"description": "Single account with email address, password and physical address."
    ,"records": [{
        "table":"A01_AccountMaster"
       ,"sequences": {
           "AccountNumber": "A01_AccountMaster"
       }
       ,"deleteCascade": {
           "A02_AccountAddresses":{"AccountNumber":"AccountNumber"}
           ,"A05_AccountCommunications":{"AccountNumber":"AccountNumber"}
           ,"A06_AccountSalutations":{"AccountNumber":"AccountNumber"}
           ,"A07_AccountEmails":{"AccountNumber":"AccountNumber"}
           ,"A10_AccountPledges":{"AccountNumber":"AccountNumber"}
           ,"T01_TransactionMaster":{"AccountNumber":"AccountNumber"}
           ,"T16_RecurringTransactionHeaders":{"AccountNumber":"AccountNumber"}
       }
       ,"row": {
             "FirstName"         : "TEST"
            ,"LastName"          : "CASE"
            ,"AccountType"       : "I"
            ,"FamilyConsolidate" : 0
            ,"AllowTransactions" : 1
            ,"Status"            : "A"
            ,"FamilyId"          : 0
       }
    }
    ,{
        "table":"A03_AddressMaster"
       ,"sequences": {
           "AddressId": "A03_AddressMaster"
       }
       ,"deleteCascade": {
           "T07_TransactionResponseMaster":{"AddressId":"AddressId"}
       }
       ,"row": {
             "Type"           : "HOME"
            ,"AddressLine1"   : "123456 E TEST AVE"
            ,"City"           : "TESTVILLE"
            ,"State"          : "AZ"
            ,"ZipPostal"      : "85379"
            ,"Country"        : "USA"
            ,"AddressIsPOBox" : 0
       }
    }
    ,{
        "table":"A02_AccountAddresses"
       ,"populateFrom": {
           "AccountNumber": {"A01_AccountMaster":"AccountNumber"}
           ,"AddressId": {"A03_AddressMaster":"AddressId"}
       }
       ,"row": {
             "Active"       : 1
            ,"UseAsPrimary" : 1
       }
    }
    ,{
        "table":"A07_AccountEmails"
       ,"populateFrom": {
           "AccountNumber": {"A01_AccountMaster":"AccountNumber"}
       }
       ,"row": {
             "EmailType"    : "HOME"
            ,"EmailAddress" : "test_login@fh.org"
            ,"Active"       : 1
            ,"UseAsPrimary" : 1
            ,"DataSource"   : "FH"
       }
    }
    ,{
        "table":"A01aAccountNotes"
       ,"populateFrom": {
           "AccountNumber": {"A01_AccountMaster":"AccountNumber"}
       }
       ,"row": {
             "NoteType"     : "YWEBPASS"
            ,"ShortComment" : "testing"
            ,"LongComment"  : "testing"
            ,"DataSource"   : "FH"
       }
    }
]};

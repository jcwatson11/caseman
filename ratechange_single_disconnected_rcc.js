module.exports = {
    "name": "Single Disconnected Child Sponsorship RCC"
    ,"description": "Account with single, disconnected RCC child sponsorship."
    ,"records": [{
        "table":"A01_AccountMaster"
       ,"nextNumbers": {
           "AccountNumber": "A01_AccountMaster"
       }
       ,"deleteCascade": {
           "A14_AccountFirstContacts":{"AccountNumber":"AccountNumber"}
       }
       ,"row": {
             "FirstName"         : "TESTJON"
            ,"LastName"          : "TESTWATSON"
            ,"AccountType"       : "I"
            ,"FamilyConsolidate" : 0
            ,"AllowTransactions" : 1
            ,"Status"            : "A"
       }
    }
    ,{
        "table":"A03_AddressMaster"
       ,"nextNumbers": {
           "AddressId": "A03_AddressMaster"
       }
       ,"row": {
             "Type"           : "HOME"
            ,"AddressLine1"   : "1234 E TEST AVE"
            ,"City"           : "TESTVILLE"
            ,"State"          : "AZ"
            ,"ZipPostal"      : "81144"
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
            ,"EmailAddress" : "singleDRCC@fh.org"
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
    ,{
        "table":"L01_PledgeMaster"
       ,"row": {
             "PledgeCode"                  : "99995"
            ,"Description"                 : "Test Child SDCSRCC"
            ,"Company"                     : "FH"
            ,"Active"                      : 1
            ,"DefaultPledgeFrequency"      : "M"
            ,"DefaultAmountPerGift"        : 27
            ,"DefaultOpenEnded"            : 1
            ,"PledgeType"                  : "CHILD"
            ,"SingleOrMultipleSponsorship" : "S"
            ,"UseInShoppingCart"           : 1
       }
    }
    ,{
        "table":"A10_AccountPledges"
       ,"nextNumbers": {
           "PledgeId": "A10_AccountPledges"
           ,"ResponseId": "T07_TransactionResponseMaster"
       }
       ,"populateFrom": {
           "AccountNumber": {"A01_AccountMaster":"AccountNumber"}
           ,"PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "TotalAmount"     : 27
            ,"AmountPerGift"   : 27
            ,"PledgeFrequency" : "M"
            ,"StartDate"       : new Date(2015,2,15)
            ,"OpenEnded"       : 1
            ,"PledgeStatus"    : "A"
            ,"SourceCode"      : "WZZZW2ZZZ2"
            ,"CurrencyCode"    : "USD"
            ,"PledgeFrequency" : "M"
            ,"PledgeFrequency" : "M"
       }
    }
    ,{
        "table":"L01aPledgeNotes"
       ,"populateFrom": {
           "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "NoteType"     : "YCNICKNAME"
            ,"ShortComment" : "TEST"
            ,"LongComment"  : "TEST"
       }
    }
    ,{
        "table":"L01dPledgeDates"
       ,"populateFrom": {
           "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "DateType"  : "DDCCHLDBD"
            ,"DateValue" : new Date(2000,3,20)
            ,"Active"    : 1
       }
    }
    ,{
        "table":"L01cPledgeCodes"
       ,"populateFrom": {
           "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "CodeType"  : "DDCCHLDGND"
            ,"CodeValue" : "M"
            ,"Active"    : 1
       }
    }
    ,{
        "table":"L01cPledgeCodes"
       ,"populateFrom": {
           "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "CodeType"  : "DDCCHLDGND"
            ,"CodeValue" : "M"
            ,"Active"    : 1
       }
    }
    ,{
        "table":"L01cPledgeCodes"
       ,"populateFrom": {
           "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "CodeType"  : "ECPLDGPROJ"
            ,"CodeValue" : "50000"
            ,"Active"    : 1
       }
    }
    ,{
        "table":"L01cPledgeCodes"
       ,"populateFrom": {
           "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "CodeType"  : "YCCHILDCAT"
            ,"CodeValue" : "GENERAL"
            ,"Active"    : 1
       }
    }
    ,{
        "table":"L01cPledgeCodes"
       ,"populateFrom": {
           "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "CodeType"  : "YCSTATUS"
            ,"CodeValue" : "SPON"
            ,"Active"    : 1
       }
    }
    ,{
        "table":"L01fPledgeAttachments"
       ,"populateFrom": {
           "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "AttachmentType"          : "PLDGPIC"
            ,"ExternalDocumentAddress" : "w:\\2564910246_20140821_20140821154020_P13.jpg"
       }
    }
    ,{
        "table":"L01fPledgeAttachments"
       ,"populateFrom": {
           "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "AttachmentType"          : "ECPLDGMED"
            ,"ExternalDocumentAddress" : "\\\\pichost\\dlshare\\256491\\2564910246-web.jpg"
       }
    }
    ,{
        "table":"L01fPledgeAttachments"
       ,"populateFrom": {
           "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
       }
       ,"row": {
             "AttachmentType"          : "ECPLDGICON"
            ,"ExternalDocumentAddress" : "\\\\pichost\\wlshare\\thumb\\2564910246_20140821_20140821154020_P13.jpg"
       }
    }
    ,{
        "table":"T16_RecurringTransactionHeaders"
       ,"nextNumbers": {
           "HeaderId": "T16_RecurringTransactionHeaders"
       }
       ,"populateFrom": {
           "AccountNumber": {"A01_AccountMaster":"AccountNumber"}
           ,"LinkedPledgeId": {"A10_AccountPledges":"PledgeId"}
       }
       ,"row": {
             "PaymentType"     : "CC"
            ,"MerchantId"      : "BLUE"
            ,"Token"           : "1234567"
            ,"ReferenceNumber" : "4xxx-xxxx-xxxx-1111 01/2017"
            ,"CurrencyCode"    : "USD"
            ,"Frequency"       : "M"
            ,"UseOnDay"        : 17
            ,"CompanyCode"     : "FH"
            ,"StartDate"       : new Date(2015,2,16)
            ,"EndDate"         : new Date(2015,2,17)
            ,"NumberCommitted" : 0
            ,"NumberRemaining" : 0
            ,"IsDonation"      : 1
            ,"Status"          : "Y"
            ,"SourceCode"      : "CZZZD1GZZZ"
       }
    }
    ,{
        "table":"T17_RecurringDonations"
       ,"populateFrom": {
            "PledgeCode": {"L01_PledgeMaster":"PledgeCode"}
           ,"HeaderId": {"T16_RecurringTransactionHeaders":"HeaderId"}
           ,"PledgeId": {"A10_AccountPledges":"PledgeId"}
       }
       ,"row": {
             "TotalAmount" : 27
            ,"SourceCode"  : "CZZZD1GZZZ"
            ,"ProjectCode" : "50000"
            ,"Deductible"  : 1
            ,"Anonymous"   : 0
       }
    }]
}

# caseman

Easily manage test case record setups and teardowns for MSSQL databases using this command line utility.

## features

  - Define test cases in a simple node module input file format.
  - Records defined are placed into a JSON output file that the teardown utility can use to delete your records after your test case has run.
  - Backreference previously defined rows (or even the current row) in your input file to define field values for input. This is useful when relating entries by auto-incremented primary keys, or sequence numbers that have been populated by a sequence function.

### Configuration

Caseman will look for a config file in your present working directory (`pwd`), or you can specify the path to the config file as the last parameter given to any command.

The following is a complex example of a config file that defines everything that can be defined. A discussion of config parameters follows.

```javascript
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
                     'ImportMaster'                : 'ECOMMIMPID'
                    ,'ImportDetails'               : 'ECOMMIDTID'
                    ,'AddressMaster'               : 'ADDRESSID'
                    ,'AccountPledges'              : 'PLEDGEID'
                    ,'AccountMaster'               : 'ACCTNBR'
                    ,'TransactionResponseMaster'   : 'RESPONSEID'
                    ,'RecurringTransactionHeaders' : 'RECTRANSID'
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
```

##### Config parameter: getSequenceSqlFunction

This method should return a function that will be called by caseman to return a SQL Statement that populates the given variable with data. The string returned by the function will be inserted into the SQL transaction and is expected to populate the given variable with the sequence value.

This function takes a sequence identifier, and a variable name.

The sequence identifier usually a string or a table name identifying which sequence you will be getting sequence data from.

The variable name is the name of the transaction variable that the rest of the transaction will use to reference the sequence value.

##### Config parameter: mssql

The mssql config parameter is given to the node-mssql module as provided. Please see [mssql](https://github.com/patriksimek/node-mssql) for more information on configuration for the mssql module.

### Usage

Caseman has two commands:

#### build

Syntax:

```sh
caseman build inputfile outputdir [configfile]
```

The build command parses through your file to create a single large transaction that will be executed to set up your test cases. Current performance metrics show that a test setup with about 90 or so records takes about 4 seconds to set up.

During the build process, caseman will auto-discover table column data and use prepared statement binding by data type to insert data.

The javascript input format defined below allows you to back-reference values gathered for the previously entered rows.

#### teardown

Syntax:

```sh
caseman teardown outputfile [configfile]
```

The teardown command takes the output file that was created during the build process as its input.

The teardown process will use the information in the output file to discover information necessary for cascade deleting as was defined in the build file, then it will run a single transaction to run all the deletions by primary key or cascade delete as was defined in your build file.

Please do try to be careful with your cascade deletes. We of course can't make any guarantee you won't reference the wrong field and delete random bits of data. However, if you enter the right column, we're fairly certain it will work as expected.

### The build file

Each test case is defined with a build file that defines the records you want to set up in your database for your test cases.

Below is an example of a test case definition file (test case build file) that is run for a certain test case.

File: login_test.js
```javascript
module.exports = {
    "name": "testing simple account login to web site"
    ,"description": "Single account with email address, password and physical address."
    ,"records": [{
        "table":"AccountMaster"
       ,"sequences": {
           "AccountNumber": "AccountMaster"
       }
       ,"deleteCascade": {
           "AccountFirstContacts":{"AccountNumber":"AccountNumber"}
           ,"AccountCommunications":{"AccountNumber":"AccountNumber"}
           ,"TransactionMaster":{"AccountNumber":"AccountNumber"}
           ,"AccountSalutations":{"AccountNumber":"AccountNumber"}
           ,"AccountPledges":{"AccountNumber":"AccountNumber"}
           ,"RecurringTransactionHeaders":{"AccountNumber":"AccountNumber"}
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
        "table":"AddressMaster"
       ,"sequences": {
           "AddressId": "AddressMaster"
       }
       ,"deleteCascade": {
           "TransactionResponseMaster":{"AddressId":"AddressId"}
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
        "table":"AccountAddresses"
       ,"populateFrom": {
           "AccountNumber": {"AccountMaster":"AccountNumber"}
           ,"AddressId": {"AddressMaster":"AddressId"}
       }
       ,"row": {
             "Active"       : 1
            ,"UseAsPrimary" : 1
       }
    }
    ,{
        "table":"AccountEmails"
       ,"populateFrom": {
           "AccountNumber": {"AccountMaster":"AccountNumber"}
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
        "table":"AccountNotes"
       ,"populateFrom": {
           "AccountNumber": {"AccountMaster":"AccountNumber"}
       }
       ,"row": {
             "NoteType"     : "YWEBPASS"
            ,"ShortComment" : "testing"
            ,"LongComment"  : "testing"
            ,"DataSource"   : "FH"
       }
    }
]};
```

The above test case was created for Donor Direct's Studio Enterprise system to test a single account login.

#### Input file properties

For the purposes of this discussion, let e = the object stored in module.exports after evaluating this file.

##### e.name

string: This is the name of the test case for your reference. It is also used to construct the file name of the output file.

##### e.description

string: This is a description that is only used for your reference. It is not used elsewhere.

##### e.records

array: Array of record objects that define the records you want to insert for your test case.

#### Record object properties

Each record object defines a row you want to insert into a particular table. Properties and their meanings are defined here:

##### table

string: The name of the table you want to insert data into

##### sequences

object: Defines the field that will receive the sequence along with the sequence identifier that will be passed to your sequence function.

If you have defined a sequence object in your case definition file without defining a sequence function getter in your caseman config file, the process will fail with an error.

The format of the object allows you to specify fieldnames as properties, and the sequence identifer as the property's value.

##### deleteCascade

object: Defines other records that should be deleted first so that you will not violate a foreign key constraint by deleting this record during the teardown process.

Caseman currently only supports one level of delete cascading. In the given example, the AccountMaster table must first delete a record from AccountFirstContacts. However, if the insertion into AccountFirstContacts also triggered an insertion into some other table, caseman has no recursion. This may come in a later version of caseman. Feel free to submit a pull request if you feel you have implemented it well.

The deleteCascade object's property names are tables that have rows that should be deleted first before deleting the record in question.

The value of each property is another object that defines the local and foreign key that will be used to find the record to delete.

The property is the local key, meaning the fieldname on AccountMaster in the given example. The value is the foreign key meaning the field name on AccountFirstContacts in the given example.

##### populateFrom

object: Defines fields in this record that should be populated from previously defined records.

Note: populateFrom does not query the database to get values that can't be acquired from a sequence or static values defined in your file. That may come in a later release, or you can submit a pull request if you feel you have implemented that well.

Properites are local field names and their values are objects that define the tablename: fieldname that the local field should be populated from.

##### row

object: Defines static data that should be inserted into e.table.

Note that date values must be entered as date objects. If the field in your database has a data type of datetime, then you must set the value to new Date('...').

Example:

```javascript
       ,"row": {
            "StartDate"       : new Date(2015,2,15)
       }
```

Note that you should not define static data for a field that is also found in sequences or populateFrom.

## Command line examples

```sh
$ caseman
# displays the help text for the program
```

```sh
$ caseman build login_test.js path/to/outputdir
```

```sh
$ caseman teardown path/to/outputdir/outputfilename.json
```

### Installation

```sh
$ npm i -g caseman
```

### Development

Want to contribute? Great!

Roadmap:

- I'd love to expand the code to support other DBMS's. So far I have only needed it for connecting to MSSQL Server.
- Recursion in the cascadeDelete would be helpful.
- Making populateFrom go get data from any table in the database regardless of whether it was in the case definition file to begin with or not would be useful.

### Todo's

 - Write Tests
 - Contribute

License
----

MIT



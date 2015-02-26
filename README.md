# caseman

Easily manage test case record setups and teardowns for MSSQL databases using this command line utility.

## features

  - Define test cases in a simple JSON file format.
  - Populate foreign key values by just telling the JSON file which table and field to get the value from. As long as the table you're getting it from comes before the table you're putting it into, the sequence will work.
  - Records defined are placed into a JSON output file that the teardown utility can use to delete your records after your test case has run.

### Usage

File: case1.js
```javascript
    {
        'name': "Single Disconnected Child Sponsorship RCC"
        ,'description': "Account with single, disconnected RCC child sponsorship."
        ,'records': [{
            table:'Account'
           ,row: {
                 FirstName         : 'TESTJON'
                ,LastName          : 'TESTWATSON'
                ,AccountType       : 'I'
                ,FamilyConsolidate : 0
                ,AllowTransactions : 1
                ,Status            : 'A'
           }
        }
        ,{
            table:'Address'
           ,row: {
                 Type           : 'HOME'
                ,AddressLine1   : '1234 E TEST AVE'
                ,City           : 'TESTVILLE'
                ,State          : 'AZ'
                ,ZipPostal      : '81144'
                ,Country        : 'USA'
                ,AddressIsPOBox : 0
           }
        }
        ,{
            table:'AccountAddress'
           ,populateFrom: {
               'AccountNumber': {'Account':'AccountNumber'}
               ,'AddressId': {'Address':'AddressId'}
           }
           ,row: {
                 Active       : 1
                ,UseAsPrimary : 1
           }
        }
    }
```

```sh
$ caseman load case1.js
```

### Installation

(Not yet published to npm. But this is what it will be.)
```sh
$ npm i -g caseman
```

### Development

Want to contribute? Great!

I'd love to expand the code to support other DBMS's. So far I have only needed it for connecting to MSSQL Server.

### Todo's

 - Write Tests
 - Contribute

License
----

MIT



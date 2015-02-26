#!/usr/bin/env node

var path        = require('path');
var pkg         = require( path.join(__dirname, 'package.json') );
var fs          = require('fs');
var caseloader  = require('./caseloader');
var caseremover = require('./caseremover');

// Parse command line options

var program = require('commander');

program
    .version(pkg.version)
    .command("build <infile> <outputdir>")
    .description('build records defined in case <infile> and record records built in <outputdir>')
    .action(function(infile, outputdir, options) {
        var dir = path.resolve(outputdir);
        caseloader(infile, dir);
    });

program
    .command("teardown <outputfile>")
    .description('delete records defined in the <outputfile> created by the build command.')
    .action(function(outputfile, options) {
        caseremover(outputfile);
    });

program.on('--help', function(){
      console.log('  Important:');
      console.log('');
      console.log('  When executing the build command, the build will generate an output file that records all of the records the build process created, most importantly, the primary key values of the records created. That output file is what the teardown process needs to delete those records.');
      console.log('');
      console.log('  Examples:');
      console.log('');
      console.log('    $ caseman build path/to/case1.json path/to/outputdir');
      console.log('    $ caseman teardown path/to/case1/output.json');
      console.log('');
});

program
    .command("")
    .description('')
    .action(function(outputfile, options) {
        program.help();
    });

program.parse(process.argv);

if (!program.args.length) {
    program.help();
}

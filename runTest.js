const Jasmine = require('jasmine');
const jasmine = new Jasmine();

jasmine.loadConfig({
    spec_dir: 'spec'
    ,spec_files: [
        '**/*[Ss]pec.js'
    ]
    ,helpers: [
        'caseloader/**/*.js'
        ,'caseremover/**/*.js'
    ]
    ,random: false
});

jasmine.execute();

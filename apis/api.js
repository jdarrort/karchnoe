
var router = require('express').Router();
var fs = require('fs');
var path = require('path');
const { exec } = require('child_process');


const KRM_PLATFORM_ROOT = "platform"
var KMR_ADAPTORS= {};


/********************* */
router.get('/browsedir',  (req, res, next) => {
    //var listfiles = fs.readdirSync(req.param("dir"));
    var listfiles  = readdir(req.param("dir"));
    res.json(listfiles);
});

/********************* */
/*
- file : filename 
- dir : path from karch_root
- force (o) : force  regeneration of SVG
 */
router.get('/getsvgfromfile',  (req, res, next) => {
    // check if previously generated image exists.
    // if yes, check timestamp vs plantuml source, to see if update required.
    let imgname =req.param("file").replace(/\.[^/.]+$/, ".svg");

    var full_file_path = path.join(global.repoRoot,  req.param("dir"),  req.param("file"));
    // get puml file if exists
    try {
        var puml_file_stats = fs.statSync(full_file_path );
    } catch (e) {
        res.status(404)
        res.json({code:"NOT_FOUND", msg:"file not found"}); 
        return;
    } 
    // only launch puml-> svg generation if file is old.
    var should_generate = true;
    try {
        var svg_target_path = path.join(global.appRoot, "svgs", imgname );
        var svg_file_stats = fs.statSync( svg_target_path );
        if (svg_file_stats.mtime > puml_file_stats.mtime) {
            console.log("already exists and uptodate");
            should_generate = false;
        }
    } catch (e) {
        // continue
        console.log("no existing file, generate it");
    }
    if ( should_generate || req.param("force")) {
        // FYI, context of execution is root path of script.
        exec('java -jar plant/plantuml.jar -tsvg -o '+path.join(global.appRoot, "svgs")+' "' + full_file_path+'"', (err, stdout, stderr) => {
            if (err) {
                res.status(500)
                res.json({code:"PUML_ERROR", msg:"Generation failed"}); 
                return;
            }
            let imgname =req.param("file").replace(/\.[^/.]+$/, ".svg")
            res.sendFile(imgname, { root: "./svgs" });
        });
    } else {
        res.sendFile(imgname, { root: "./svgs" });
    }
});



/********************* */
/*  Search a PUML file from API reference
- adapter : adapter 
- verb  :  get/post/delete/... 
- ref : apiCode / eventCode
 */
router.get('/searchapi',  (req, res, next) => {

    // Get Target Adapter
    var target_adapter = KMR_ADAPTORS[req.query.adapter.toLowerCase()];
    if ( ! target_adapter ){
        res.status(404)
        res.json( {code:"NOT_FOUND", msg:"Adaptor not found " + req.query.adapter } ); 
        return;
    }
    var search_path, dir_content, filepattern,file_pattern_re;
    var matchs = [];
    search_path = path.join(target_adapter.path, target_adapter.name + "_APIs");
    try {
        fs.statSync( path.join(global.repoRoot,search_path) );
    } catch (e){
        res.status(404)
        res.json({code:"NOT_FOUND", msg:"Adaptor API path not found (" + search_path +")"}); 
        return;
    }
    //  ==> "kxx_API_GET_myApiRe_"
    filepattern = [ target_adapter.name, "API", req.query.verb, req.query.ref ].join("_") + "_";

    file_pattern_re = new RegExp("^" + filepattern, "i" ); // case insensitive
    dir_content = readdir(search_path);
    dir_content.files.forEach ( f => {
        if (f.filename.match(file_pattern_re)){
            // Found a matching file !
            matchs.push(f);
        }
    });
    res.json({
        count : matchs.length,
        results : matchs
    });
});



/********************* */
/*  Search a PUML file from reference of MQ message
- adapter : adapter 
- ref : eventCode
 */
router.get('/searchmq',  (req, res, next) => {

    // Get Target Adapter
    var target_adapter = KMR_ADAPTORS[req.param("adapter").toLowerCase()];
    if ( ! target_adapter ){
        res.status(404)
        res.json({code:"NOT_FOUND", msg:"Adaptor not found " + req.param("adapter")}); 
        //res.json({ msg : "Could not determine adapter under platform/"});
        return;
    }
    var search_path, dir_content, filepattern,file_pattern_re;
    var matchs = [];
    switch (req.param("type").toLowerCase()){
        case 'api' : 
            search_path = path.join(target_adapter.path, target_adapter.name + "_APIs");
            try {
                fs.statSync(path.join(global.repoRoot,search_path));
            } catch (e){
                res.status(404)
                res.json({code:"NOT_FOUND", msg:"Adaptor API path not found (" + search_path +")"}); 
                return;
            }
            //  ==> "kxx_API_GET_myApiRe_"
            filepattern = [ target_adapter.name, "API", req.param("verb"), req.param("ref")].join("_") + "_";

            file_pattern_re = new RegExp("^" + filepattern, "i" ); // case insensitive
            dir_content = readdir(search_path);
            dir_content.files.forEach ( f => {
                if (f.filename.match(file_pattern_re)){
                    // Found a matching file !
                    matchs.push(f);
                }
            });
            res.json({
                count : matchs.length,
                results : matchs
            });
            break;
        case 'mq' : 
            search_path = path.join(target_adapter.path, target_adapter.name + "_MQ_processing");
            if ( ! fs.statSync(path.join(global.repoRoot,search_path)) ) {
                res.status(404)
                res.json({code:"NOT_FOUND", msg:"Adaptor API path not found (" + search_path +")"}); 
                return;
            }
            filepattern = [ target_adapter.name, "MQ", req.param("ref")].join("_") + "_";
            file_pattern_re = new RegExp("^" + filepattern, "i" );
            dir_content = readdir(search_path);
            dir_content.files.forEach ( f => {
                if (f.filename.match(file_pattern_re)){
                    // Found a matching file !
                    matchs.push(f)
                }
            });
            res.json({
                count : matchs.length,
                results : matchs
            });

            break;
        default : 
            res.status(400)
            res.json({code:"INVALID", msg:"wrong type"}); 
            return;
    }

    //res.send("searchsd");
});


/** ******************************************** */
/** ******************************************** */
//          UTILITIES
/** ******************************************** */
/** ******************************************** */

function buildAdaptorList(){
    var adapt_dir_RE = /plt-[0-9]{3}[_|-](.*)$/
    // build adapter List, stored in global Var.
    console.log("Refreshing adaptorList");
    var adapt_root_dir = path.join(global.repoRoot, KRM_PLATFORM_ROOT );
    var list = fs.readdirSync(adapt_root_dir);
    var matchs;
    KMR_ADAPTORS = {};
    list.forEach( (file)  => {
        var stat = fs.statSync( path.join(adapt_root_dir, file) );
        if ( stat && stat.isDirectory() ) { 
            matchs = file.match(adapt_dir_RE);
            if (matchs) {
                KMR_ADAPTORS[ matchs[1].toLowerCase() ] = {
                    name : matchs[1].toLowerCase(),
                    path : path.join(KRM_PLATFORM_ROOT ,file)
                };
            }
        }
    });
    setTimeout(buildAdaptorList, 60000);
}

// Load Adaptor list
buildAdaptorList();




/* Browse a DIRECTORY , non recursively, splitting dirs and files*/
var readdir = function(dir) {
    var direlems={
        dirs : [],
        files : []
    };
    working_dir = path.join(global.repoRoot, dir);
    var list = fs.readdirSync(working_dir);
    list.forEach(function(file) {
        var fullpath = dir + '/' + file;
        var stat = fs.statSync(path.join(global.repoRoot, fullpath));
        if (stat && stat.isDirectory()) { 
            // Count elem in dir
            var subcount = fs.readdirSync( path.join(global.repoRoot, fullpath)).length;

            direlems.dirs.push({dirname : file, subcount : subcount, path : fullpath});
        } else {
            //its a file
            direlems.files.push({filename : file, type : path.extname(file).substr(1), path : dir});
        }
    });
    return direlems;
}    

module.exports = router;

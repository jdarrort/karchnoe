
var router = require('express').Router();
var fs = require('fs');
var path = require('path');
const { exec } = require('child_process');


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
/*  Search a PUML file from reference
- adapter : adapter 
- type : api/MQ
- verb (o) :  get/post/delete/... , only if api
- ref : apiCode / eventCode
 */
router.get('/searchsd',  (req, res, next) => {
    var adapt_dir_RE = /plt-[0-9]{3}[_|-](.*)$/
    var adapter_list={};
    var path_relative_to_repoRoot = "platform";

    // build adapter List
    var adapt_root_dir = path.join(global.repoRoot, "platform");
    var list = fs.readdirSync(adapt_root_dir);
    var matchs;
    list.forEach( (file)  => {
        var stat = fs.statSync(path.join(global.repoRoot,path_relative_to_repoRoot, file));
        if (stat && stat.isDirectory()) { 
            matchs = file.match(adapt_dir_RE);
            if (matchs) {
                adapter_list[ matchs[1].toLowerCase() ] = {
                    name : matchs[1].toLowerCase(),
                    path : path.join(path_relative_to_repoRoot,file)
                };
            }
        }
    });

    //
    var target_adapter = adapter_list[req.param("adapter").toLowerCase()];
    if ( ! target_adapter ){
        res.status(404)
        res.json({code:"NOT_FOUND", msg:"Adaptor not found " + req.param("adapter")}); 
        //res.json({ msg : "Could not determine adapter under platform/"});
        return;
    }
    // 
    var search_path, dir_content, filepattern,file_pattern_re;
    var matchs = [];
    switch (req.param("type").toLowerCase()){
        case 'api' : 
            search_path = path.join(target_adapter.path, target_adapter.name + "_APIs");
            if ( ! fs.statSync(path.join(global.repoRoot,search_path)) ) {
                res.status(404)
                res.json({code:"NOT_FOUND", msg:"Adaptor API path not found (" + search_path +")"}); 
                return;
            }
            filepattern = [ target_adapter.name, "API", req.param("verb"), req.param("ref")].join("_") + "_";
            file_pattern_re = new RegExp("^" + filepattern, "i" );
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

/* Browse a DIRECTORY */
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

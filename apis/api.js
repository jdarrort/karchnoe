
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
router.get('/getsdfromfile',  (req, res, next) => {
    // check if previously generated image exists.
    // if yes, check timestamp vs plantuml source, to see if update required.
    let imgname =req.param("file").replace(/\.[^/.]+$/, ".svg")

    var full_file_path = path.join(global.repoRoot,  req.param("dir"),  req.param("file"));
    // get puml file if exists
    try {
        var puml_file_stats = fs.statSync(full_file_path );
    } catch (e) {
        res.status(404)
        res.send("KO, file not exists"); 
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
        exec('java -jar plant/plantuml.jar -tsvg -o '+path.join(global.appRoot, "svgs")+' ' + full_file_path, (err, stdout, stderr) => {
            if (err) {
                res.status(500)
                res.json(err);
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
router.get('/searchsd',  (req, res, next) => {
    res.send("searchsd");
});



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
/*
var walk = function(dir,parent_dir,dirname) {
    var cur_dir = {
        path : parent_dir,
        name : dirname,
        children : []
    }
    var list = fs.readdirSync(dir);
    list.forEach(function(file) {
        var fullpath = dir + '/' + file;
        var stat = fs.statSync(fullpath);
        if (stat && stat.isDirectory()) { 
            var subdir_info;
            // Recurse into a subdirectory 
            subdir_info = walk(fullpath,dir, file);
            cur_dir.children.push(subdir_info);
        }
    });
    return cur_dir;
}    
function dirTree(filename) {
    var stats = fs.lstatSync(filename),
        info = {
            path: filename,
            name: path.basename(filename)
        };

    if (stats.isDirectory()) {
        info.type = "folder";
        info.children = fs.readdirSync(filename).map(function(child) {
            return dirTree(filename + '/' + child);
        });
    } else {
        // Assuming it's a file. In real life it could be a symlink or
        // something else!
        info.type = "file";
    }

    return info;
}
*/
module.exports = router;

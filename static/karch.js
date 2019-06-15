
// handle URL change, and trigger XHR
window.onhashchange = function(){
    console.log("Switching to " + location.hash)

};
/********************* */
function formatParams( params ){
    return "?" + Object
          .keys(params)
          .map(function(key){
            return key+"="+encodeURIComponent(params[key])
          })
          .join("&")
}

/********************* */
function APICall( in_api, in_params, in_notjson) {
    return new Promise((resolve, reject) => {
        if ( !in_params ) {
            in_params = {}
        };
        var uri_params = formatParams(in_params);

        var req = new XMLHttpRequest();
        req.open('GET',ROOT_URI + "api/" + in_api + uri_params, true);
        req.setRequestHeader('X-Requested-With', 'XHR');
        
        req.onreadystatechange = function () {
            if (req.readyState == 4) {
                if (req.status == 200) {
                    resolve( in_notjson ?  req.responseText : JSON.parse(req.responseText));
                } else {
                    console.warn("Call failed to " + in_api + " with " + JSON.stringify(in_params, true));
                    reject();
                }
            }
        };
        req.send();
    })
}

/********************* */
async function renderDirContent( in_el, in_dir_path){
    var in_content = await APICall("browsedir",{dir : in_dir_path});

    // render dirs
    in_content.dirs.forEach(dir => {
        var li_el = document.createElement("li");
        li_el.classList.add("dir");
        var dir_img_el = document.createElement("img");
        dir_img_el.src="dir.gif";
        dir_img_el.style.paddingRight="4px";
        li_el.appendChild(dir_img_el);
        li_el.appendChild(document.createTextNode(dir.dirname));
        if (dir.subcount) {
            var children_el = document.createElement("ul");
            children_el.style.display = "none";
            li_el.appendChild(children_el);
            li_el.addEventListener("click", function(e){
                e.stopPropagation();
                // show/hide.
                children_el.style.display = (children_el.style.display == "none") ? "block" : "none";
                if ( ! children_el.hasChildNodes() ){
                    renderDirContent(children_el, dir.path);// load content
                }
            });
        }
        in_el.appendChild(li_el);
    });
    // render files
    in_content.files.forEach(file => {
        var li_el = document.createElement("li");
        li_el.classList.add("file");
        li_el.appendChild(document.createTextNode(file.filename));
        in_el.appendChild(li_el);
        if (file.type == "puml"){
            li_el.classList.add("puml");
            li_el.addEventListener("click", function(e){
                e.stopPropagation();
                renderPuml(file);
            });
        }
    });
}

/********************* */
async function renderPuml (in_file){
    try {
        var svgdata = await APICall("getsdfromfile",{file : in_file.filename, dir : in_file.path}, true);
        var content_el = document.getElementById("content_el");
        content_el.innerHTML = svgdata;
        }
    catch (e) {
        console.error("Failed to retrieve puml");
    }
}

/********************* */
/********************* */
/********************* */
/********************* */
var ROOT_URI = document.baseURI;
window.onload = async function(){
	var root_dir_el = document.getElementById("root_dir");
    renderDirContent(root_dir_el, ".");
    console.log(root_dir);
}
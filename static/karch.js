
document.addEventListener('keydown', (event) => {
    if (event.key == "Escape") toggleBrowser();
});
document.addEventListener('keydown', (event) => {
    if (event.key == "r") {G_CURRENT_TAB.refresh();}
});

var AUTH_BEARER;
  
function toggleBrowser(){
    (document.getElementById('browser_active').style.display=='none') ? showBrowser(): hideBrowser();
}
function hideBrowser(){
    document.getElementById('browser_active').style.display='none';
    //document.getElementById('browser_inactive').style.display='block';    
}
function showBrowser(){
    document.getElementById('browser_active').style.display='block';
    //document.getElementById('browser_inactive').style.display='none';    
}

function kAlert(code, msg){
    document.getElementById("alert_code").innerText = code;
    document.getElementById("alert_msg").innerText = msg;
    document.getElementById("alert").style.display="block";
}
function kNotify(code, msg){
    document.getElementById("notif_code").innerText = code;
    document.getElementById("notif_msg").innerText = msg;
    document.getElementById("notif").style.display="block";
}

function logout(){
    document.cookie = 'karch_session=; Max-Age=-99999999;';
    window.location = window.location.origin;
}

async function handleAuthent( ) {
    // Get bearer from Cookie and check if valid.
    // Otherwise, prompt social login.
    var session_bearer = false;

    // Search within existing Cookies.
    var cookies = document.cookie.split(";");
    cookies.forEach(cookie => {
        let cook = cookie.trim().split("=")
        if (cook[0] == "karch_session"){
            session_bearer = cook[1];
        }
    });
    if ( session_bearer) {
        console.log("Using karch_session from cookies");
        try {
            // check it
            var reply = await AUTHCall("checksession", {karch_session : session_bearer})
            if ( ! reply.ok ){
                console.log("Invalid session_token");
                throw new Error("Invalid session_token")
            } else {
                AUTH_BEARER = session_bearer;
            }
        } catch (e) {
            console.log("session token from cookie" +e.message);
            session_bearer = false;
            document.cookie = 'karch_session=; Max-Age=-99999999;';
        }
    }

    if (session_bearer){
        document.getElementById("browser").style.display="block";
        document.getElementById("signin").style.display="none";
        renderDirContent(document.getElementById("root_dir"), ".");
    } else {
        document.getElementById("signin").style.display="block";
        document.getElementById("browser").style.display="none";
    }
    return;
}

/********************* */
// handle URL change, and trigger XHR
window.onhashchange = async function(){
    if (!location.hash) {return;}
    console.log("Switching to " + location.hash)
    var opt = processhref(location.hash);
    var res
    try{
        switch (opt.action){
            case 'searchApi'  :
                opt.params.type="api";
                    res = await APICall("searchapi", opt.params);
                    if (res.count == 1){
                        renderPuml(res.results[0]);
                    } else if (res.count == 0) {
                        kAlert("","Could not find any match");

                    } else {
                        choseAmongProposition(res.results);
                        kNotify("","Several possibilities");
                    }
                    console.log(res);
                break;
                case 'searchFile'  :
                opt.params.type="api";
                    res = await APICall("searchfile", opt.params);
                    if (res.count == 1){
                        renderPuml(res.results[0]);
                    } else if (res.count == 0) {
                        kAlert("","Could not find any match");

                    } else {
                        choseAmongProposition(res.results);
                        kNotify("","Several possibilities");
                    }
                    console.log(res);
                break;                
            case 'searchMq'  :
                break;
        }
        document.getElementById('fakelink').click();
    } catch (e) {
        return;
    }
};

/********************* */
// handle URL change, and trigger XHR
function processhref(in_href){
    // Interpret path :
    var matchs= in_href.match(/#(.*)\?(.*)/);
    var action, tmp_params, params={}
    if (matchs){
        action = matchs[1];
        tmp_params = matchs[2];
        tmp_params.split("&").forEach( p => {
            let o = p.split("=");
            params[o[0]] = o[1];
        })
    }
    return {action : action, params : params}
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
function choseAmongProposition(in_files){
    document.getElementById("menu").style.display="block";
    var menu_content_el= document.getElementById("menu_content");
    menu_content_el.innerHTML="";

    in_files.forEach(file => {
        var li_el = document.createElement("li");
        li_el.classList.add("file");
        li_el.appendChild(document.createTextNode(file.filename));
        menu_content_el.appendChild(li_el);
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
function getBearer() {
    var bearer = false;
    // Search within existing Cookies.
    var cookies = document.cookie.split(";");
    cookies.forEach(cookie => {
        let cook = cookie.trim().split("=")
        if (cook[0] == "karch_session"){
            bearer = cook[1];
        }
    });
    return bearer;
}
function AUTHCall( in_api, in_params, in_notjson) {return  XXXCall("auth",in_api, in_params, in_notjson )}
function APICall( in_api, in_params, in_notjson) { return XXXCall("api",in_api, in_params, in_notjson )}
function XXXCall(in_type, in_api, in_params, in_notjson) {
    return new Promise((resolve, reject) => {
        if ( !in_params ) {
            in_params = {}
        };
        var uri_params = formatParams(in_params);

        var req = new XMLHttpRequest();
        req.open('GET',ROOT_URI + in_type +"/" + in_api + uri_params, true);
        req.setRequestHeader('X-Requested-With', 'XHR');
        var bearer = getBearer();
        req.setRequestHeader('Authorization', 'Bearer ' + bearer?bearer:"");
        
        req.onreadystatechange = function () {
            if (req.readyState == 4) {
                if (req.status == 200) {
                    resolve( in_notjson ?  req.responseText : JSON.parse(req.responseText));
                } 
                else if (req.status == 401) {
                    // need to reauthentify, cause token is invalid.
                    AUTH_BEARER =null;
                    document.cookie = 'karch_session=; Max-Age=-99999999;';
                    handleAuthent();
                }
                else {
                    console.warn("Call failed to " + in_api + " with " + JSON.stringify(in_params, true));
                    try{
                        let err = JSON.parse(req.responseText)
                        kAlert(err.code,err.msg );
                    } catch(e){
                        kAlert("INTERNAL","Unhandled Error" );
                    }
                    reject();
                }
            }
        };
        req.send();
    })
}

/********************* */
async function renderDirContent( in_el, in_dir_path){
    try{
        var in_content = await APICall("browsedir",{dir : in_dir_path});
    } catch (e) {
        return;
    }

    // render dirs
    in_content.dirs.forEach(dir => {
        var li_el = document.createElement("li");
        li_el.classList.add("dir");
        var dir_img_el = document.createElement("img");
        dir_img_el.src="img/dir.gif";
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
        switch (file.type) {
            case "puml" :
                li_el.classList.add("puml");
                li_el.addEventListener("click", function(e){
                    e.stopPropagation();
                    renderPuml(file);
                });
                break;
            case "md" :
                li_el.classList.add("md");
                li_el.addEventListener("click", function(e){
                    e.stopPropagation();
                    renderMd(file);
                });
                break;
        }
    });
}

/********************* */
async function renderPuml (in_file){
    TAB_ID++;
    var target_el = createTab(in_file, "tabid_"+TAB_ID).svg;
    try {
        var svgdata = await APICall("getsvgfromfile",{file : in_file.filename, dir : in_file.path}, true);
        //var content_el = document.getElementById("content_el");
        target_el.innerHTML = svgdata;
        }
    catch (e) {
        console.error("Failed to retrieve puml");
        //content_el.innerHTML = "/!\\ Failed to load /!\\";
        target_el.innerHTML = "/!\\ Failed to load /!\\";
    }
}

/********************* */
async function renderMd (in_file){
    TAB_ID++;
    var target_el = createTab(in_file, "tabid_"+TAB_ID).svg;
    try {
        var md_data = await APICall("getmdfile",{file : in_file.filename, dir : in_file.path}, true);
        //var content_el = document.getElementById("content_el");
        var converter = new showdown.Converter(),
        html = converter.makeHtml(md_data);
        target_el.innerHTML = html;

        }
    catch (e) {
        console.error("Failed to retrieve MD");
        //content_el.innerHTML = "/!\\ Failed to load /!\\";
        target_el.innerHTML = "/!\\ Failed to load /!\\";
    }
}
/********************* */
function getLoadingImg(in_size){
    var i = document.createElement("img");
    i.classList.add("loading");
    if (in_size){ i.style.width= in_size + "px";}
    return i;
}
/********************* */
async function refreshPuml (in_file, target_el){
    try {

        target_el.innerHTML="";
        target_el.appendChild(getLoadingImg());
        var svgdata = await APICall("getsvgfromfile",{file : in_file.filename, dir : in_file.path, force :true }, true);
        target_el.innerHTML = svgdata;
        }
    catch (e) {
        console.error("Failed to retrieve svg for " + in_file.filename);
        //content_el.innerHTML = "/!\\ Failed to load /!\\";
        target_el.innerHTML = "/!\\ Failed to load /!\\";
    }
}

/********************* */
function createTab(in_file, in_tab_id){
    var tab_name = in_file.filename;
    var tab_ref = in_file.path +"/"+ in_file.filename;
    // Check if tab already exists.
    let idx = Object.keys(LOADED_TABS).indexOf(tab_ref);
    if ( idx >= 0 ){
        // Already loaded
        selectTab(LOADED_TABS[tab_ref].tab_id, {currentTarget : LOADED_TABS[tab_ref].tab_but_el});
        return LOADED_TABS[tab_ref].tab_content_el;
    }
    // Create new Tab.
    var but_el = document.createElement("button");
    but_el.classList.add("tablinks");
    but_el.classList.add("active");
    but_el.innerText = tab_name;
    but_el.ref = tab_ref;

    document.getElementById("tab_root_el").appendChild(but_el);
    but_el.addEventListener("click", function(e){ 
        selectTab(in_tab_id, e);
    });
    but_el.addEventListener("dblclick", function(e){ 
        document.getElementById(in_tab_id).remove();
        delete LOADED_TABS[tab_ref];
        e.currentTarget.remove();
    });
    // Create tab Content
    var content_el = document.createElement("div");
    content_el.classList.add("tabcontent");
    content_el.id = in_tab_id;
    document.getElementById("content_el").appendChild(content_el);
    // Will hold svg image
    var content_svg_el = document.createElement("div");
    content_svg_el.appendChild(getLoadingImg());

    // Header to force reload
    var content_refresh_el = document.createElement("div");
    content_refresh_el.innerText = "(force SVG refresh)";
    content_refresh_el.style.cursor = "pointer";
    content_refresh_el.addEventListener('click', e => {
        refreshPuml(in_file, content_svg_el);
    })

    content_el.appendChild(content_refresh_el);
    content_el.appendChild(content_svg_el);

    content_el.svg = content_svg_el;

    LOADED_TABS[tab_ref] = {
        tab_id : in_tab_id,
        tab_ref : tab_ref,
        tab_but_el : but_el,
        tab_content_el : content_el,
        refresh : () => {refreshPuml(in_file, content_svg_el);}
    };
    selectTab(in_tab_id, {currentTarget : but_el});
    return content_el;
}

/********************* */
function selectTab(in_tab_id, evt){
    var i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(in_tab_id).style.display = "block";
    if (evt) {
        evt.currentTarget.className += " active";
        Object.keys(LOADED_TABS).forEach ( tref => {
            if (LOADED_TABS[tref].tab_id == in_tab_id) {
                G_CURRENT_TAB = LOADED_TABS[tref];
            }
        });        
    }
}


/********************* */
/********************* */
/********************* */
/********************* */
var ROOT_URI = window.location.origin +"/";
//var ROOT_URI = document.baseURI.replace(/#.*/,"").replace(/\?.*/,"");
var TAB_ID = 0;
var LOADED_TABS = {};
var G_CURRENT_TAB;
window.onload = async function(){
    //handleAuthent()
    renderDirContent(document.getElementById("root_dir"), ".");
    console.log(root_dir);
}
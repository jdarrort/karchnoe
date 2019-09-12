
document.addEventListener('keydown', (event) => { if (event.key == "Escape") toggleBrowser();});
document.addEventListener('keydown', (event) => { if (event.key == "r") {G_CURRENT_TAB.refresh();cleanHash()} });
document.addEventListener('click',   (event) => { if (event.clientX > 400) {hideBrowser()};});
window.onscroll = function() {
    if (G_CURRENT_TAB) {G_CURRENT_TAB.scroll = document.body.scrollTop; }
};
  
function toggleBrowser(){
    (document.getElementById('browser_active').style.display=='none') ? showBrowser(): hideBrowser();
}
function hideBrowser(){     document.getElementById('browser_active').style.display='none';}
function showBrowser(){     document.getElementById('browser_active').style.display='block';}

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
async function signInWithSlack(){
    // retrieve slack auth path  and redirect to Slack sign in page.
    try {
        var reply = await AUTHCall("slackauthparams");
        if (reply.auth_url) {
            window.location = reply.auth_url + "&state="+ encodeURIComponent(location.hash);
        }
    } catch (e){
        console.error("Failed to forge SLACK signin URL")
        kAlert("Sthg went wrong","...")
    }
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
async function askForAuthentication( ) {
    document.getElementById("signin").style.display="block";
    document.getElementById("browser").style.display="none";
    return;
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
        // Get Authorization Bearer
        var bearer = getBearer();
        req.setRequestHeader('Authorization', 'Bearer ' + bearer?bearer:"");
        
        req.onreadystatechange = function () {
            if (req.readyState == 4) {
                if (req.status == 200) {
                    resolve( in_notjson ?  req.responseText : JSON.parse(req.responseText));
                } 
                else if (req.status == 401) {
                    // need to reauthentify, cause token is invalid.
                    document.cookie = 'karch_session=; Max-Age=-99999999;';
                    askForAuthentication();
                }
                else {
                    console.warn("Call failed to " + in_api + " with " + JSON.stringify(in_params, true));
                    var err;
                    try{
                        err = JSON.parse(req.responseText)
                        kAlert(err.code,err.msg );
                    } catch(e){
                        kAlert("INTERNAL","Unhandled Error" );
                    }
                    reject(err);
                }
            }
        };
        req.send();
    })
}

function cleanHash  (){
    // Hint to clean location.hash. Drawback : navigates on top...
    // Call only if current hash has something
    if (location.hash.length >2)
    document.getElementById('fakelink').click();
}
/********************* */
// handle URL change, and trigger XHR
async function manageLoactionChange (){
    if (!location.hash) {return;}
    console.log("Switching to " + location.hash)
    var opt = processhref(location.hash);
    // Saving current tab scroll
    hideBrowser();
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
    } catch (e) {
        return;
    }
};
window.addEventListener("hashchange",function(event){manageLoactionChange()},false);

/********************* */
// handle URL change in location hash, and trigger XHR
function processhref(in_href){
    if (/^#authentication_failed/.test(in_href)){
        kAlert("Authentication Failed","");
        cleanHash();
        askForAuthentication();
        return;
    }
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
    return "?" + Object.keys(params).map(function(key){
            return key+"="+encodeURIComponent(params[key])
          }).join("&");
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
            li_el.title = file.path;
            li_el.addEventListener("click", function(e){
                e.stopPropagation();
                renderPuml(file);
            });
        }
    });    

}


/********************* */
async function renderDirContent( in_el, in_dir_path){
    in_el.appendChild(getLoadingImg(25) ); 
    try{
        var in_content = await APICall("browsedir",{dir : in_dir_path});
    } catch (e) {
        in_el.innerHTML="<font color='red'><Failed to load dir content/font>"; ;
        return;
    }
    in_el.innerHTML=""; ;

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
    getTab(in_file).setContentEl( getLoadingImg(30) );
    getTab(in_file).setContentHtml( await refreshPuml(in_file, true) );
    cleanHash();
}
/********************* */
async function refreshPuml (in_file, no_refresh ){
    try {
        let should_refresh = no_refresh ? false : true;
        let request = { file : in_file.filename, dir : in_file.path };
        if (should_refresh) {request.force = true;}
        return  await APICall( "getsvgfromfile", request, true);
        }
    catch (e) {
        console.error("Failed to retrieve svg for " + in_file.filename);
        return "/!\\ Failed to load /!\\<br>" + e.detail;
    }
}
/********************* */
async function renderMd (in_file){
    var tab = getTab(in_file);
    try {
        var md_data = await APICall("getmdfile",{file : in_file.filename, dir : in_file.path}, true);
        var converter = new showdown.Converter();
        var md_html = converter.makeHtml(md_data);
        tab.setContentHtml( md_html );
    }
    catch (e) {
        console.error("Failed to retrieve MD");
        tab.setContentHtml( "/!\\ Failed to load /!\\" );
    }
}
/********************* */
function getLoadingImg(in_size){
    var i = document.createElement("img");
    i.classList.add("loading");
    if (in_size){ i.style.width= in_size + "px";i.style.height= in_size + "px";}
    return i;
}

/********************* */
function getTabByRef(in_tref){
    var tab_found=false;
    Object.keys(LOADED_TABS).forEach(id => {if (LOADED_TABS[id].tab_ref == in_tref) {tab_found = LOADED_TABS[id];}});
    return tab_found;
}
/********************* */
// create new or activate existing tab
function getTab(in_file){
    var tab_ref = in_file.path +"/"+ in_file.filename;
    var cur_tab = getTabByRef(tab_ref);
    // Check if tab already exists.
    if (cur_tab){
        cur_tab.activate();
        return cur_tab;
    }
    // otherwise create new one
    var NEW_TAB = {
        id : TAB_ID++,
        file : in_file,
        tab_ref : tab_ref,
        tab_but_el : document.createElement("button"),
        tab_content_el : document.createElement("div"),
        tab_svg_el : document.createElement("div"),
        scroll : 0,
        async refresh () {
            this.setContentEl( getLoadingImg(30) );
            this.setContentHtml( await refreshPuml(this.file, false));
            this.scroll = 0;
        },
        deactivate () { 
            this.tab_but_el.classList.remove("active");
            this.tab_content_el.style.display = "none";
        },
        activate() {
            Object.keys(LOADED_TABS).forEach((id) => {LOADED_TABS[id].deactivate();});
            this.tab_content_el.style.display = "block";
            this.tab_but_el.classList.add("active");
            G_CURRENT_TAB = this;
        },
        delete () {
            this.tab_but_el.remove();
            this.tab_content_el.remove();
            delete LOADED_TABS[this.id];    
        },
        setContentHtml (new_content)  {
            console.log("Start rendering SVG");
            this.tab_svg_el.innerHTML=new_content; // clean
        },
        setContentEl (new_content_el)  {
            this.tab_svg_el.innerHTML=""; // clean
            this.tab_svg_el.appendChild(new_content_el);
        }
    };
    NEW_TAB.tab_but_el.classList.add("tablinks");
    NEW_TAB.tab_but_el.classList.add("active"); // active by default
    NEW_TAB.tab_but_el.innerText = in_file.filename;
    NEW_TAB.tab_but_el.ref = tab_ref;
    NEW_TAB.tab_but_el.title = in_file.path;
    document.getElementById("tab_root_el").appendChild(NEW_TAB.tab_but_el);

    // Create tab Content
    NEW_TAB.tab_content_el.classList.add("tabcontent");
    document.getElementById("content_root_el").appendChild(NEW_TAB.tab_content_el);

    // Header to force reload
    var content_refresh_el = document.createElement("div");
    content_refresh_el.innerText = "(hit 'r' to refresh)";
    content_refresh_el.style.cursor = "pointer";
    content_refresh_el.addEventListener('click', e => {
        refreshPuml(in_file, content_svg_el);
    })
    NEW_TAB.tab_content_el.appendChild(content_refresh_el);

    // Will hold svg image
    NEW_TAB.tab_svg_el.style.textAlign="center";
    NEW_TAB.setContentEl( getLoadingImg(30) );
    NEW_TAB.tab_content_el.appendChild(NEW_TAB.tab_svg_el);

    // when click on the tab button
    NEW_TAB.tab_but_el.addEventListener("click", function(e){ 
        NEW_TAB.activate();
    });
    // when Dblclick on the tab button --> Remove it
    NEW_TAB.tab_but_el.addEventListener("dblclick", function(e){ 
        NEW_TAB.delete();
    });
    LOADED_TABS[NEW_TAB.id] = NEW_TAB;
    NEW_TAB.activate();
    return NEW_TAB;
}
async function sendSearch ()  {
    var search_str = document.getElementById("i_search").value;
    res = await APICall("searchfile", {filename : search_str});
    choseAmongProposition(res.results);
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
    manageLoactionChange();
    console.log(root_dir);
    // handle search.
    document.getElementById("i_search").addEventListener("keypress", event =>  {
        if (event.keyCode == "13") {sendSearch();}
    })
    document.getElementById("b_search").addEventListener("click", sendSearch)
}
const { webContents } = require('@electron/remote');
const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);
function getWebContents(view) {
    return webContents.fromId(view.getWebContentsId());
}

let dirtyTabAddedListeners = [];

const instance = window.instance;

let baseuri = localStorage.getItem("baseuri") || "https://discord.com";
const baseuriInput = $('#baseuriinput');
const tabBaseUriInput = $('#tabbaseuriinput');
function changeBaseUri() {
    if (!confirm("Changing the global base URI may result in unexpected issues! Did you mean to do this?"))
        return;
    baseuri = baseuriInput.value;
    localStorage.setItem("baseuri", baseuri);
    alert("Please restart DTabs for this to fully take effect!");
    updateAnalytics();
}
$("#changebaseuri")?.addEventListener("click", changeBaseUri);
function changeTabBaseUri() {
    if (!confirm("Changing the base URI may result in unexpected issues! Did you mean to do this?"))
        return;
    var newuri = tabBaseUriInput.value;
    deletetab();
    addtab(false, undefined, newuri, newuri);
    updateAnalytics();
}
$("#changetabbaseuri")?.addEventListener("click", changeTabBaseUri);

const { session } = require("@electron/remote");
let tabtokens = {};
{
    let tabdata = localStorage.getItem("tabs");
    if (tabdata)
        tabtokens = JSON.parse(tabdata);
    else {
        tabtokens = { _version: 1 };
    }
}
if (tabtokens._version == undefined) {
    //convert tab tokens to new format
    let oldtokendata = localStorage.getItem("tabs") || "{}";
    let oldtokens = JSON.parse(oldtokendata);
    localStorage.setItem("oldtabs", oldtokendata);
    let newtokens = { _version: 1 };
    for (let i of Object.keys(oldtokens)) {
        let oldtoken = oldtokens[i].replace(/http(s?):/, "http$1;");
        newtokens[i] = {
            token: oldtoken.split(":")[0],
            title: oldtoken.split(":")[1],
            baseuri: oldtoken.split(":")[2]?.replace(";", ":") || baseuri,
        };
    }
    tabtokens = newtokens;
    localStorage.setItem("tabs", JSON.stringify(tabtokens));
    window.location.reload();
}
let tokenChangeState;
let tokenChangeQueue = [];
const tokenChangeDialogue = $(".tokenchange");
const tchmainEl = $(`#tchmain`);
const tchNewTabSetup = $(`#tchnewtabsetup`);
const tchTargetTabText = $(`#tokenchangetab`);
async function handleToken(details, name, dirty) {
    if (details.requestHeaders && details.requestHeaders["Authorization"]) {
        var header = details.requestHeaders["Authorization"];
        let token = typeof header === "string" ? header : header[0];
        // check the changestate if we already handled this token
        if (tokenChangeState != null && tokenChangeState.newToken == token) {
            return;
        }
        // check the changequeue if we already populated this token
        for (var i = 0; i < tokenChangeQueue.length; i++) {
            if (tokenChangeQueue[i].newToken == token) {
                return;
            }
        }
        if (dirty && tabtokens[name].token != token) {
            tokenChangeQueue.push({ active: true, newToken: token, tab: name });
            console.log("token change on dirty tab " + name);
        }
        else if (!dirty && tabtokens[name].token != token) {
            tokenChangeQueue.unshift({ active: false, newToken: token, tab: name });
            console.log("credential capture on new tab " + name);
            for (let i of dirtyTabAddedListeners) {
                i(name);
            }
        }
    }
    processTokenQueue();
}
async function processTokenQueue() {
    if (tokenChangeQueue.length > 0 && tokenChangeState == null) {
        tokenChangeState = tokenChangeQueue.shift();
        $$(".tokenchange .tokenchangebody").forEach((e) => {
            e.classList.remove("active");
        });
        tokenChangeDialogue.classList.add("active");
        if (tokenChangeState?.active) {
            tchmainEl.classList.add("active");
            tchTargetTabText.textContent = tabtokens[tokenChangeState.tab].title;
        }
        else {
            tchNewTabSetup.classList.add("active");
        }
    }
}
function savetabs() {
    window.localStorage.setItem("tabs", JSON.stringify(tabtokens));
}
const tabselect = $(`#tabselect`);
function deletetab(tab) {
    if (localStorage.getItem("tablock") == "true") {
        alert("Tabs are locked. Please unlock before attempting to delete a tab.");
    }
    var tabId = tab || tabselect.value;
    delete tabtokens[tabId.replace("title", "")];
    let webview = $("." + tabId.replace("title", "") + " webview");
    let partition = webview.getAttribute("partition") || tabId.replace("title", "");
    session.fromPartition(partition).clearStorageData();
    $("." + tabId)?.remove();
    $(".tab." + tabId.replace("title", ""))?.remove();
    $(`.titlebutton.title${tabId.replace("title", "")}`)?.remove();
    savetabs();
    updateAnalytics();
}
function tchresolve() {
    const tchresolvenewp = $("#tchresolvenew p");
    const tchresolveoldp = $("#tchresolveold p");
    $("#tchusernoaction")?.classList.remove("active");
    $("#tchresolve")?.classList.add("active");
    if (!tokenChangeState || !tokenChangeState.newToken)
        return;
    //request users/@me and get the username
    instance
        .get((tabtokens[tokenChangeState.tab].baseuri || baseuri) + "/api/v9/users/@me", {
        headers: {
            Authorization: tokenChangeState.newToken,
        },
    })
        .then(function (response) {
        if (response.status == 200) {
            var data = response.data;
            let name = `${data.username}`;
            if (data.discriminator != "0")
                name += `#${data.discriminator}`;
            tchresolvenewp.textContent = name;
            $("#tchresolvenew")?.setAttribute("onclick", "$`.tokenchange`.classList.remove('active'); $`#tchresolve`.classList.remove('active'); tchresolvenew();");
        }
        else {
            tchresolvenewp.textContent = "Invalid Token";
        }
    })
        .catch(function () {
        tchresolvenewp.textContent = "Invalid Token";
    });
    instance
        .get((tabtokens[tokenChangeState.tab].baseuri || baseuri) + "/api/v9/users/@me", {
        headers: {
            Authorization: tabtokens[tokenChangeState.tab].token,
        },
    })
        .then(function (response) {
        if (response.status == 200) {
            var data = response.data;
            let name = `${data.username}`;
            if (data.discriminator != "0")
                name += `#${data.discriminator}`;
            tchresolveoldp.textContent = name;
            $("#tchresolveold")?.setAttribute("onclick", "tokenChangeState = null;$`.tokenchange`.classList.remove('active'); $`#tchresolve`.classList.remove('active');");
        }
        else {
            tchresolveoldp.textContent = "Invalid Token";
        }
    })
        .catch(function () {
        tchresolveoldp.textContent = "Invalid Token";
    });
    setTimeout(() => {
        //if tchresolveold and tchresolvenew are both invalid
        if (tchresolveoldp.textContent == "Invalid Token" && tchresolvenewp.textContent == "Invalid Token") {
            tokenChangeDialogue.classList.remove("active");
            $("#tchresolve")?.classList.remove("active");
            alert("Both old and new tokens are invalid. This shouldn't be possible, but you'll probably be logged out soon.");
            tokenChangeState = undefined;
        }
    }, 5000);
}
Object.defineProperty(window, "tchresolve", {
    value: tchresolve,
});
function tchresolvenew() {
    if (!tokenChangeState || !tokenChangeState.newToken)
        return;
    tabtokens[tokenChangeState.tab].token = tokenChangeState.newToken;
    savetabs();
    tokenChangeState = undefined;
}
Object.defineProperty(window, "tchresolvenew", {
    value: tchresolvenew,
});
function tchrename() {
    if (!tokenChangeState || !tokenChangeState.newToken)
        return;
    $(`#tchrename`)?.classList.remove("active");
    $(`#tchrelogorpwch`)?.classList.add("active");
    tabtokens[tokenChangeState.tab].title = $(`#tchrenameinput`).value;
    tabtokens[tokenChangeState.tab].token = tokenChangeState.newToken;
    $(`.titlebutton.title` + tokenChangeState.tab).textContent = tabtokens[tokenChangeState.tab].title;
    savetabs();
    tokenChangeState = undefined;
}
Object.defineProperty(window, "tchrename", {
    value: tchrename,
});
function tchautofill() {
    if (!tokenChangeState || !tokenChangeState.newToken)
        return;
    instance
        .get((tabtokens[tokenChangeState.tab].baseuri || baseuri) + "/api/v9/users/@me", {
        headers: {
            Authorization: tokenChangeState.newToken,
        },
        validateStatus: () => {
            return true;
        },
    })
        .then(function (response) {
        if (!tokenChangeState || !tokenChangeState.newToken)
            throw new Error("Token change state is null at a point where it shouldn't be.");
        if (response.status == 200) {
            var data = response.data;
            let name = `${data.username}`;
            if (data.discriminator != "0")
                name += `#${data.discriminator}`;
            tabtokens[tokenChangeState.tab].title = name;
            tabtokens[tokenChangeState.tab].token = tokenChangeState.newToken;
            $(`.titlebutton.title` + tokenChangeState.tab).textContent = tabtokens[tokenChangeState.tab].title;
            savetabs();
            tokenChangeState = undefined;
        }
        else {
            alert("Got error code " + response.status + " when trying to autofill. Please name the tab manually.");
            tabtokens[tokenChangeState.tab].token = tokenChangeState.newToken;
            tokenChangeDialogue.classList.add("active");
            $(`#tchrelogorpwch`)?.classList.remove("active");
            $(`#tchrename`)?.classList.add("active");
            savetabs();
        }
    })
        .catch(function (error) {
        console.log(error);
        alert("Caught exception when trying to autofill. Please name the tab manually.");
        if (!tokenChangeState || !tokenChangeState.newToken)
            return;
        tabtokens[tokenChangeState.tab].token = tokenChangeState.newToken;
        tokenChangeDialogue.classList.add("active");
        $(`#tchrelogorpwch`)?.classList.remove("active");
        $(`#tchrename`)?.classList.add("active");
        savetabs();
    });
}
Object.defineProperty(window, "tchautofill", {
    value: tchautofill,
});
function tchrelogorpwch() {
    if (!tokenChangeState || !tokenChangeState.newToken)
        return;
    tabtokens[tokenChangeState.tab].token = tokenChangeState.newToken;
    savetabs();
    tokenChangeState = undefined;
}
Object.defineProperty(window, "tchrelogorpwch", {
    value: tchrelogorpwch,
});
setInterval(processTokenQueue, 5000);

const VERSION = window.VERSION;

const crypto = require("crypto");
if (localStorage.getItem("uniqueId") == null) {
    //probably the dumbest line of code i have ever written.
    localStorage.setItem("uniqueId", crypto.createHash("sha256").update(crypto.randomBytes(256)).digest("hex"));
}
function updateAnalytics() {
    if (_paq == null)
        return;
    if (localStorage.getItem("analytics.meta.system.os") !== "false")
        _paq.push(["setCustomDimension", 3, process.platform]);
    if (localStorage.getItem("analytics.dtabs.css.enabled") !== "false")
        _paq.push(["setCustomDimension", 5, localStorage.getItem("injectcss")]);
    if (localStorage.getItem("analytics.dtabs.base.changed") !== "false")
        _paq.push(["setCustomDimension", 6, (localStorage.getItem("baseuri") || "https://discord.com") != "https://discord.com"]);
    if (localStorage.getItem("analytics.dtabs.base.tabs.anychanged") !== "false") {
        if (Object.keys(tabtokens).length <= 1)
            return; //tabtokens aren't loaded yet
        let anyChanged = false;
        for (var i of Object.values(tabtokens)) {
            if (i.baseuri != "https://discord.com") {
                anyChanged = true;
                break;
            }
        }
        _paq.push(["setCustomDimension", 7, anyChanged]);
    }
    if (localStorage.getItem("analytics.dtabs.tabs.count") !== "false") {
        if (Object.keys(tabtokens).length <= 1)
            return; //tabtokens aren't loaded yet
        _paq.push(["setCustomDimension", 8, Object.keys(tabtokens).length - 1]);
    }
    if (localStorage.getItem("analytics.dtabs.tabs.rolledup") !== "false")
        _paq.push(["setCustomDimension", 9, localStorage.getItem("rolledup")]);
    if (localStorage.getItem("analytics.dtabs.tabs.locked") !== "false")
        _paq.push(["setCustomDimension", 4, localStorage.getItem("tablock")]);
    if (localStorage.getItem("analytics.dtabs.base.uri") === "true")
        _paq.push(["setCustomDimension", 10, localStorage.getItem("baseuri") || "default"]);
    if (localStorage.getItem("analytics.dtabs.tabs.all.base") === "true") {
        if (Object.keys(tabtokens).length <= 1)
            return; //tabtokens aren't loaded yet
        let bases = [];
        for (let i in tabtokens) {
            bases.push(tabtokens[i].baseuri || "https://discord.com");
        }
        _paq.push(["setCustomDimension", 11, JSON.stringify(bases)]);
    }
    _paq.push(["trackEvent", "analytics", "update"]);
}
//dont even bother loading matomo if we already opted out.
if (localStorage.getItem("analytics.enableTotally") !== "false") {
    var _paq = (window._paq = window._paq || []);
    /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
    _paq.push(["setCustomDimension", 2, VERSION]);
    _paq.push(["forgetUserOptOut"]); //If you opt out this code should never run, but it should if you ever opt back in
    updateAnalytics();
    _paq.push(["setUserId", localStorage.getItem("uniqueId")]);
    //Previously, matomo was managing to grab the internal file:// path from electron. this exposed paths on a user's filesystem.
    //this prevents that by forcibly setting the url to a generic string.
    _paq.push(["setCustomUrl", "dtabs://index.html"]);
    _paq.push(["trackPageView"]);
    _paq.push(["enableHeartBeatTimer", 1200]);
    (function () {
        var u = "https://crxb.cc/protected/matomo/";
        _paq.push(["setTrackerUrl", u + "matomo.php"]);
        _paq.push(["setSiteId", "1"]);
        var d = document, g = d.createElement("script"), s = d.getElementsByTagName("script")[0];
        g.type = "text/javascript";
        g.async = true;
        g.src = u + "matomo.js";
        s.parentNode?.insertBefore(g, s);
    })();
    let analyticsKeys = Object.keys({ ...localStorage }).filter((i) => i.startsWith("analytics."));
    let analyticsEnabled = $(`#analytics\\.enableTotally`);
    analyticsEnabled.setAttribute("checked", localStorage.getItem("analytics.enableTotally") !== "false" ? "true" : "false");
    for (var i of analyticsKeys) {
        if (localStorage.getItem(i) === "true") {
            let element = $(`#${i.split("analytics.")[1].replaceAll(".", "\\.")}`);
            if (!element) {
                console.log(`No element for analytics key ${i}, this data point has likely been removed.`);
                continue;
            }
            element.setAttribute("checked", "true");
        }
        else if (localStorage.getItem(i) === "false") {
            let element = $(`#${i.split("analytics.")[1].replaceAll(".", "\\.")}`);
            if (!element) {
                console.log(`No element for analytics key ${i}, this data point has likely been removed.`);
                continue;
            }
            element.removeAttribute("checked");
        }
    }
}
function toggleAnalytics(path) {
    if (path == "totally") {
        if (localStorage.getItem("analytics.enableTotally") !== "false") {
            localStorage.setItem("analytics.enableTotally", "false");
            _paq.push(["optUserOut"]);
        }
        else {
            localStorage.setItem("analytics.enableTotally", "true");
            alert("Analytics will be enabled at next restart. Thank you for your support.");
        }
        return;
    }
    else {
        if (localStorage.getItem(`analytics.${path}`) !== "false" /*true by default*/)
            localStorage.setItem(`analytics.${path}`, "false");
        else if (localStorage.getItem(`analytics.${path}`) === "false")
            localStorage.setItem(`analytics.${path}`, "true");
    }
    updateAnalytics();
}
Object.defineProperty(window, "toggleAnalytics", {
    value: toggleAnalytics,
    writable: false,
    configurable: false,
    enumerable: false,
});
function push(..._) {
    if (_paq == null)
        return;
    _paq.push(arguments);
}
function analyticsToggleAll(domain, to) {
    let analyticsKeys = [...$$(`#${domain} input`)].map((i) => i.id);
    for (var i of analyticsKeys) {
        localStorage.setItem(`analytics.${i}`, to);
    }
    updateAnalytics();
}
Object.defineProperty(window, "analyticsToggleAll", {
    value: analyticsToggleAll,
    writable: false,
    configurable: false,
    enumerable: false,
});

const tabButtonContextMenu = $("#tabbtn-ctx");
let tabContext = "";
document.addEventListener("click", function () {
    if (tabButtonContextMenu.style.display == "block") {
        tabButtonContextMenu.style = "display:none;";
    }
});
function showContext(e, tabName) {
    tabButtonContextMenu.style = "display:block; left:" + (e.clientX - 10) + "px;top:" + (e.clientY - 10) + "px;";
    tabContext = tabName;
    tabButtonContextMenu.addEventListener("mouseleave", () => {
        tabButtonContextMenu.style = "display:none;";
    });
    e.preventDefault();
}
function ctxinspect() {
    var webview = $("." + tabContext + " webview");
    webview.openDevTools();
}
$("#ctxinspect")?.addEventListener("click", ctxinspect);
function ctxdelete() {
    deletetab(tabContext);
}
$("#ctxdelete")?.addEventListener("click", ctxdelete);
function ctxreload() {
    var webview = $("." + tabContext + " webview");
    webview.reload();
}
$("#ctxreload")?.addEventListener("click", ctxreload);
const ctxrenameinput = $("#ctxrenameinput");
const ctxrenamedialogue = $("#ctxrename");
const tokenChangeDialog = $(".tokenchange");
function ctxrename(postrename = false) {
    if (postrename) {
        let tabButton = $(`.titlebutton.title` + tabContext);
        tabtokens[tabContext].title = ctxrenameinput.value;
        tabButton.textContent = tabtokens[tabContext].title;
        savetabs();
        ctxrenamedialogue.classList.remove("active");
        tokenChangeDialog.classList.remove("active");
        return;
    }
    ctxrenameinput.value = tabtokens[tabContext].title;
    ctxrenamedialogue.classList.add("active");
    tokenChangeDialog.classList.add("active");
}
$("#ctxrename")?.addEventListener("click", () => {
    ctxrename();
});

const fs$2 = require("fs");
const { dialog } = require("@electron/remote");
const injectToggle = $("#injecttoggle");
const injectPath = $("#injectpath");
const reloadBtn = $("#reloadcss");
let vencss = "";
let cssPath = localStorage.getItem("csspath") || "";
injectToggle.checked = localStorage.getItem("injectcss") == "true";
injectPath.textContent = localStorage.getItem("csspath") || "Select file";
function processCss(reload = false, specificWebview) {
    if (!reload) {
        dialog.showOpenDialog({ properties: ["openFile"] }).then((e) => {
            if (e && e.filePaths) {
                localStorage.setItem("csspath", e.filePaths[0]);
                cssPath = e.filePaths[0];
                injectPath.textContent = localStorage.getItem("csspath") || "Select file";
                if (e.filePaths[0] != null) {
                    processCss(true);
                }
            }
        });
        return;
    }
    if (localStorage.getItem("injectcss") == "true" && cssPath != null) {
        var cssfile = fs$2.readFileSync(cssPath).toString();
        if (specificWebview)
            addCss(specificWebview, cssfile);
        else {
            for (var i of $$(".tab")) {
                addCss(i.querySelector("webview"), cssfile);
            }
        }
    }
    if (vencss.length > 0) {
        if (specificWebview)
            addCss(specificWebview, vencss, "vencord");
        else {
            for (var i of $$(".tab")) {
                addCss(i.querySelector("webview"), vencss, "vencord");
            }
        }
    }
}
injectPath.addEventListener("click", () => {
    processCss();
});
injectToggle.addEventListener("change", () => {
    localStorage.setItem("injectcss", injectToggle.checked ? "true" : "false");
    setCssState(injectToggle.checked);
});
reloadBtn.addEventListener("click", () => {
    processCss(true);
});
$$(".reloadCss")?.forEach((i) => {
    i.addEventListener("click", () => {
        processCss(true);
    });
});
function addCss(webview, cssContents, stylesheetKey = "") {
    // if we don't have specific contents, try to read the default file
    if (!cssContents) {
        if (cssPath?.length > 0) {
            cssContents = fs$2.readFileSync(cssPath).toString();
        }
        else
            return;
    }
    // attribute name for storing the internal ID of the inserted CSS
    let webviewStylesheetKey = "csskey" + stylesheetKey;
    // the internal ID, if present
    let webviewStylesheetId = webview.getAttribute(webviewStylesheetKey);
    // have we already inserted a stylesheet by this name?
    if (webviewStylesheetId != null) {
        // remove and reinsert
        webview.removeInsertedCSS(webviewStylesheetId).then(() => {
            webview.insertCSS(cssContents).then((key) => {
                // store the new internal ID for the stylesheet
                webview.setAttribute("csskey" + stylesheetKey, key);
            });
        });
        return;
    }
    else {
        // insert the stylesheet for the first time
        webview.insertCSS(cssContents).then((key) => {
            // store the new internal ID for the stylesheet
            webview.setAttribute("csskey" + stylesheetKey, key);
        });
    }
}
function setCssState(enable) {
    if (enable) {
        processCss(true);
    }
    else {
        for (var i of $$("webview")) {
            let stylesheetId = i.getAttribute("csskey");
            if (!stylesheetId)
                continue;
            i.removeInsertedCSS(stylesheetId);
        }
    }
}
function setVencordCss(css) {
    vencss = css;
}

const lockCheckbox = $(`#locktabs`);
const addTabButton = $(`#addtab`);
const deleteTabButton = $(`#ctxdelete`);
lockCheckbox.addEventListener("change", () => {
    lockTabs(lockCheckbox.checked);
});
lockCheckbox.checked = localStorage.getItem("tablock") == "true";
lockTabs(localStorage.getItem("tablock") == "true");
function lockTabs(lock) {
    if (lock) {
        addTabButton.style = "display:none;";
        deleteTabButton.style = "display:none;";
        localStorage.setItem("tablock", "true");
    }
    else {
        addTabButton.style = "display:block;";
        deleteTabButton.style = "display:block;";
        localStorage.setItem("tablock", "false");
    }
    updateAnalytics();
}

const fs$1 = require("fs");
const path$1 = require("path");
// TODO fragment this out into one file per plugin
const injectVencord$1 = document.getElementById("injectVencord");
const injectUTE$1 = document.getElementById("injectUTE");
if (localStorage.getItem("injectVencord") == "true")
    injectVencord$1.setAttribute("checked", "true");
if (localStorage.getItem("injectUTE") == "true")
    injectUTE$1.setAttribute("checked", "true");
//reset the preloader script
fs$1.writeFileSync(path$1.resolve(__dirname, "webview-preload.js"), 'window.ipcRenderer = require("electron").ipcRenderer;', "utf8");
if (injectVencord$1.checked) {
    fs$1.appendFileSync(path$1.resolve(__dirname, "webview-preload.js"), `
		Object.defineProperty(window,"armcord", {get: () => {return {version:" <--- NOT Armcord, **Web** via [Third-party Client](https://github.com/craftxbox/dtabs) (cc. <@496398139050295311>)\\n"}}});
		`, "utf8");
    instance.get("https://cdn.jsdelivr.net/gh/Vencord/builds@main/browser.js").then(function (response) {
        fs$1.appendFileSync(path$1.resolve(__dirname, "webview-preload.js"), response.data, "utf8");
        fs$1.appendFileSync(path$1.resolve(__dirname, "webview-preload.js"), 'Object.defineProperty(window, "Vencord", { get: () => Vencord });window.Vencord.Settings.plugins.MessageEventsAPI.enabled = true;', "utf8");
    });
    instance.get("https://cdn.jsdelivr.net/gh/Vencord/builds@main/browser.css").then(function (response) {
        setVencordCss(response.data);
    });
}
if (injectUTE$1.checked && !injectVencord$1.checked) {
    instance
        .get("https://transfur.science/od63k1i1") // <!-- TODO replace this with a versioned & pinned URL to prevent supply chain attacks -->
        .then(function (response) {
        fs$1.appendFileSync(path$1.resolve(__dirname, "webview-preload.js"), response.data, "utf8");
        fs$1.appendFileSync(path$1.resolve(__dirname, "webview-preload.js"), `
				Object.defineProperty(window, "uteTransitionTo", { get: () => WEBPACK_GRABBER.findByCode("transitionTo -") });
				Object.defineProperty(window, "uteMsgActions", { get: () => WEBPACK_GRABBER.findByProps("editMessage") });
				Object.defineProperty(window, "uteCurChanId", { get: () => WEBPACK_GRABBER.findByProps("getCurrentlySelectedChannelId").getCurrentlySelectedChannelId });
				Object.defineProperty(window, "uteChanStore", { get: () => WEBPACK_GRABBER.findByProps("getChannel","getBasicChannel") });
				Object.defineProperty(window, "utePermStore", { get: () => WEBPACK_GRABBER.findByProps("can","computePermissions") });
				`, "utf8");
    });
}
else if (injectUTE$1.checked && injectVencord$1.checked) {
    fs$1.appendFileSync(path$1.resolve(__dirname, "webview-preload.js"), `
			/* webpackgrabber and vencord do not mix so we have to recreate the api with vencord apis instead */
			Object.defineProperty(window, "uteTransitionTo", { get: () => Vencord.Webpack.Common.NavigationRouter.transitionTo });
			Object.defineProperty(window, "uteMsgActions", { get: () => Vencord.Webpack.Common.MessageActions });
			Object.defineProperty(window, "uteCurChanId", { get: () => Vencord.Webpack.Common.SelectedChannelStore.getCurrentlySelectedChannelId });
			Object.defineProperty(window, "uteChanStore", { get: () => Vencord.Webpack.Common.ChannelStore });
			Object.defineProperty(window, "utePermStore", { get: () => Vencord.Webpack.Common.PermissionStore });
		`, "utf8");
}

const remote$1 = require("@electron/remote");
const rollupButton = $(".rollupbtn");
const topBar = $("#topbar");
const mainBody$1 = $(".mainbody");
function onResize() {
    let bWindow = remote$1.getCurrentWindow();
    if (!bWindow.isMaximized()) {
        //force rolled down when unmaximized
        rollupButton.style = "display:none";
        topBar.style = "top:0px;";
        mainBody$1.style = "top:30px;";
    }
    else {
        rollupButton.style = "display:block";
        if (localStorage.getItem("rolledup") == "true") {
            topBar.style = "top:-27px;";
            mainBody$1.style = "height: 100%; top:3px;";
        }
        else {
            topBar.style = "top:0px;";
            mainBody$1.style = "top:30px;";
        }
    }
}
function rolluptoggle() {
    if (localStorage.getItem("rolledup") == "true") {
        rolldown();
    }
    else {
        rollup();
    }
}
rollupButton.addEventListener("click", () => {
    rolluptoggle();
});
function rollup() {
    topBar.style = "top:-27px;";
    rollupButton.setAttribute("onclick", "rolldown()");
    rollupButton.textContent = "▼";
    mainBody$1.style = "height: 100%; top:3px;";
    localStorage.setItem("rolledup", "true");
    updateAnalytics();
}
function rolldown() {
    topBar.style = "top:0px;";
    rollupButton.setAttribute("onclick", "rollup()");
    rollupButton.textContent = "▲";
    mainBody$1.style = "top:30px;";
    localStorage.setItem("rolledup", "false");
    updateAnalytics();
}
window.addEventListener("resize", () => {
    onResize();
});
onResize();

let tabproxies = {};
const injectUTE = $(`#injectUTE`);
const injectVencord = $(`#injectVencord`);
const experimentalSection = $(`#experimental`);
if (injectUTE.checked) {
    dirtyTabAddedListeners.push((tab) => {
        let tabView = $(`.${tab} webview`);
        if (injectVencord.checked) {
            tabView.addEventListener("dom-ready", function inject() {
                tabView.executeJavaScript(`
					setTimeout(() => {
						Vencord.Api.MessageEvents.addMessagePreSendListener(async (id,content,extra) => {
							window.ipcRenderer.sendToHost('uteIntercept', "${tab}",id,JSON.stringify(content), JSON.stringify(extra))
							let response = await (new Promise((resolve,reject) => {
								window.ipcRenderer.once('uteInterceptResponse', (event, data) => {
									if(data.cancel && extra.uploads.length > 0){
										content.content = ""
										extra.content = ""
										resolve()
									} 
									else if(data.clear) {
										content.content = ""
										extra.content = ""
										resolve()
									} else {
										resolve(data)
									}
								})
							}))
							return response
						})
					}, 3000)
					`);
            });
        }
        else {
            tabView.addEventListener("dom-ready", function inject() {
                tabView.executeJavaScript(`
					setTimeout(() => {
						window.uteHandlePreSend = async (id,content,extra,replyOptions) => {
							extra.replyOptions = replyOptions;
							window.ipcRenderer.sendToHost('uteIntercept', "${tab}",id,JSON.stringify(content), JSON.stringify(extra))
							let response = await (new Promise((resolve,reject) => {
								window.ipcRenderer.once('uteInterceptResponse', (event, data) => {
									if(data.cancel && extra.uploads.length > 0){
										content.content = ""
										extra.content = ""
										resolve()
									} 
									else if(data.clear) {
										content.content = ""
										extra.content = ""
										resolve()
									} else {
										resolve(data)
									}
								})
							}))
							if(response?.cancel) {
								return true;
							} else return false;
						}
					}, 2000)
					`);
            });
        }
        tabView.addEventListener("ipc-message", (event) => {
            if (!(event.channel == "uteIntercept"))
                return;
            let data = event.args;
            let tab = data[0];
            let chanId = data[1];
            let content = JSON.parse(data[2]);
            let extra = JSON.parse(data[3]);
            let proxyMatch = false;
            let newContent = content;
            for (let i in tabproxies) {
                if (!tabtokens[i].proxy)
                    continue;
                if (tabtokens[i].proxy.length == 0)
                    continue;
                if (!tabtokens[i].proxy.includes("text"))
                    continue;
                let match = tabproxies[i].exec(content.content);
                if (match) {
                    newContent.content = match[1];
                    proxyMatch = i;
                    break;
                }
            }
            if (newContent.length == 0) {
                tabView.send("uteInterceptResponse", { cancel: true });
                return;
            }
            if (!proxyMatch) {
                tabView.send("uteInterceptResponse", { cancel: false });
            }
            else {
                handleUteMatch(tab, chanId, newContent, extra, proxyMatch);
                tabView.send("uteInterceptResponse", { cancel: true, clear: true });
            }
        });
    });
    async function handleUteMatch(_tab, channelId, content, extra, proxyMatch) {
        let proxyMatchWebview = $(`.${proxyMatch} webview`);
        let activeTabWebview = $(`.tab.active webview`);
        proxyMatchWebview
            .executeJavaScript(`
				{
					let channel = uteChanStore.getChannel('${channelId}')
					let can = false;
					if(channel) {
						can = utePermStore.can(3072n, channel)
					}
					[channel, can]
				}
			`)
            .then((hasChannel) => {
            if (!hasChannel[0] || !hasChannel[1]) {
                console.log(hasChannel);
                activeTabWebview.executeJavaScript(`uteMsgActions.sendBotMessage('${channelId}',"Proxy doesn't have access to that channel.")`);
                return;
            }
            else {
                let newExtra = extra;
                Object.defineProperty(newExtra, "utePreProcessed", {
                    value: true,
                    writable: false,
                });
                proxyMatchWebview.executeJavaScript(`
						uteTransitionTo("/channels/${hasChannel[0].guild_id || "@me"}/${channelId}")
					`);
                if (content.content == "/focus") {
                    activetab(proxyMatch);
                }
                else {
                    proxyMatchWebview.executeJavaScript(`
                            uteMsgActions.sendMessage('${channelId}', ${JSON.stringify(content)},true, ${JSON.stringify(extra)}?.replyOptions)
                        `);
                }
            }
        });
    }
    function escapeRegex(string) {
        return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&");
    }
    experimentalSection.innerHTML += `
			<h2> Unified Text Entry settings </h2>
		`;
    for (let i in tabtokens) {
        if (i == "_version")
            continue;
        let tab = tabtokens[i];
        let container = document.createElement("div");
        container.textContent = tab.title + " Proxy: ";
        let input = document.createElement("input");
        input.type = "text";
        input.id = i + "proxy";
        input.setAttribute("tabindex", i);
        if (tab.proxy) {
            input.value = tab.proxy;
            tabproxies[i] = new RegExp(`^${escapeRegex(tab.proxy).replace("text", "(.*)")}$`);
        }
        input.addEventListener("change", (e) => {
            try {
                if (input.value.includes("text") == false) {
                    alert("Your proxy must include 'text' to be a valid proxy.\nExample: for a proxy that uses []'s you would write [text]");
                }
                let tabindex = e.target.getAttribute("tabindex");
                tabproxies[tabindex] = new RegExp(`^${escapeRegex(input.value).replace("text", "(.*)")}$`);
                tabtokens[tabindex].proxy = input.value;
                savetabs();
            }
            catch (e) {
                alert(e.getMessage());
            }
        });
        container.appendChild(input);
        experimentalSection.appendChild(container);
    }
}

const fs = require("fs");
const path = require("path");
const remote = require("@electron/remote");
const changelog = $(".changelog");
// this is the file we get to check for updates. Change this if you're forking, otherwise you're just going to be autoupdating against the downstream :)
const indexHtmlFileGitRawUrl = "https://raw.githubusercontent.com/craftxbox/DTabs/master/index.html";
const mainJsUrl = "https://raw.githubusercontent.com/craftxbox/DTabs/VERSION/main.js";
const distJsUrl = "https://raw.githubusercontent.com/craftxbox/DTabs/VERSION/dist/index.packed.js";
// This should never be populated unless you're part of a betatest group
const activeBetaUrl = "https://raw.githubusercontent.com/craftxbox/DTabs/ute-beta/index.html";
const activeBetaMainJsUrl = "https://raw.githubusercontent.com/craftxbox/DTabs/ute-beta/main.js";
const activeBetaDistJsUrl = "https://raw.githubusercontent.com/craftxbox/DTabs/ute-beta/dist/index.packed.js";
var updatecontents = "";
var checkdisabled = false;
var verregex = /VERSION2=(\d+)(?:\.(\d+))?;/;
let betaregex = /BETA=(\d+);/;
function hasUpdated(matchregex, options = { index: 1 }) {
    let lastVersion = options.checkVersion || localStorage.getItem("lastVersion");
    if (!lastVersion)
        return true; //first run, no last version
    let match = lastVersion.match(matchregex);
    if (!match)
        return true; // should never be possible
    let standingVersion = VERSION.match(matchregex)[options.index];
    let remoteVersion = match[options.index];
    return remoteVersion > standingVersion;
}
function hasMasterUpdated() {
    return hasUpdated(verregex);
}
function hasBetaUpdated() {
    if (hasMasterUpdated())
        return false; //if master updated, this beta has been left behind anyway.
    return hasUpdated(betaregex);
}
//only major changes trigger changelog. Minor changes will only be bugfixes anyways.
if (hasMasterUpdated() || (hasMasterUpdated() == false && hasBetaUpdated())) {
    localStorage.setItem("lastVersion", VERSION);
    changelog.classList.add("active");
}
function getVersion(content, regex) {
    let match = content.match(regex);
    if (!match)
        return {
            major: 0,
            minor: 0,
            full: "invalid",
        };
    let version = {
        major: parseInt(match[1]),
        minor: match[2] ? parseInt(match[2]) : 0,
        full: match[1] + (match[2] ? "." + match[2] : ""),
    };
    return version;
}
const updatedialog = $(".updatedialog");
const updateDialogBody = $(".updatedialogbody");
const currentVersionEl = $("#currentversion");
const upstreamVersionEl = $("#latestversion");
let updateTrack = "master";
function updatecheck(noprompt = false) {
    if (checkdisabled)
        return;
    instance.get(indexHtmlFileGitRawUrl).then(function (response) {
        if (response.status != 200 && !checkdisabled) {
            checkdisabled = true;
            alert("DTabs was unable to check for updates!");
            return;
        }
        updatecontents = response.data;
        updateTrack = "master";
        if (noprompt)
            return;
        if (!verregex.test(updatecontents)) {
            return; // upstream has no version2? it's possibly out of date.
        }
        let localVer = getVersion(VERSION, verregex);
        let upstreamVer = getVersion(updatecontents, verregex);
        if (upstreamVer.major > localVer.major || (upstreamVer.major === localVer.major && upstreamVer.minor > localVer.minor && activeBetaUrl.length === 0)) {
            updatedialog.classList.add("active");
            let localVerString = localVer.full;
            let upstreamVerString = upstreamVer.full;
            if (activeBetaUrl.length > 0) {
                localVerString = localVer.full + " Beta " + getVersion(VERSION, betaregex).major;
                upstreamVerString = "Release" + upstreamVer.full;
            }
            currentVersionEl.textContent = localVerString;
            upstreamVersionEl.textContent = upstreamVerString;
        }
        else {
            console.log("DTabs is up to date.", localVer.full, "==", upstreamVer.full);
            if (activeBetaUrl.length > 0) {
                console.log("Checking for beta updates...");
                betaUpdateCheck(noprompt);
            }
        }
    });
}
function betaUpdateCheck(noprompt = false) {
    if (checkdisabled)
        return;
    instance.get(activeBetaUrl).then(function (response) {
        console.log(response);
        if (response.status != 200 && !checkdisabled) {
            checkdisabled = true;
            alert("DTabs was unable to check for updates!");
            return;
        }
        updatecontents = response.data;
        updateTrack = "beta";
        if (noprompt)
            return;
        if (!verregex.test(updatecontents)) {
            console.log("beta updatecheck: no version2 found in upstream.");
            return; // upstream has no version2? it's possibly out of date.
        }
        let localVer = getVersion(VERSION, betaregex);
        let upstreamVer = getVersion(updatecontents, betaregex);
        if (upstreamVer.major > localVer.major) {
            console.log("beta update found!", localVer.full, "==", upstreamVer.full);
            updatedialog.classList.add("active");
            currentVersionEl.textContent = "Beta " + localVer.full;
            upstreamVersionEl.textContent = "Beta " + upstreamVer.full;
        }
        else {
            console.log("beta up to date.", localVer.full, "==", upstreamVer.full);
        }
    });
}
function update() {
    updatedialog.classList.add("active");
    updateDialogBody.setAttribute("style", "display:none;");
    push(["trackEvent", "update", "accept"]);
    let finalMainJsUrl = mainJsUrl;
    let finalDistJsUrl = distJsUrl;
    if (updateTrack === "beta") {
        betaUpdateCheck(true);
        finalMainJsUrl = activeBetaMainJsUrl;
        finalDistJsUrl = activeBetaDistJsUrl;
    }
    else
        updatecheck(true);
    let version = getVersion(updatecontents, verregex);
    let versionTag = `v${version.major}.${version.minor}`;
    instance.get(finalMainJsUrl.replace("VERSION", versionTag)).then(function (response) {
        if (response.status !== 200) {
            alert("DTabs was unable to update! Please try again later. If this error persists, consider reinstalling Dtabs.");
            return;
        }
        instance.get(finalDistJsUrl.replace("VERSION", versionTag)).then(function (distResponse) {
            if (distResponse.status !== 200) {
                alert("DTabs was unable to update! Please try again later. If this error persists, consider reinstalling Dtabs.");
                return;
            }
            fs.renameSync(path.resolve(__dirname, "index.html"), path.resolve(__dirname, "index.html.OLD-" + Date.now()));
            fs.writeFileSync(path.resolve(__dirname, "index.html"), updatecontents, "utf8");
            fs.renameSync(path.resolve(__dirname, "main.js"), path.resolve(__dirname, "main.js.OLD-" + Date.now()));
            fs.writeFileSync(path.resolve(__dirname, "main.js"), response.data, "utf8");
            fs.renameSync(path.resolve(__dirname, "dist", "index.packed.js"), path.resolve(__dirname, "dist", "index.packed.js.OLD-" + Date.now()));
            fs.writeFileSync(path.resolve(__dirname, "dist", "index.packed.js"), distResponse.data, "utf8");
            alert("Update has been applied, DTabs will now exit.");
            remote.app.relaunch();
            remote.app.exit(0);
        });
    });
}
function dismissupdate(dontask) {
    checkdisabled = dontask;
    updatedialog.classList.remove("active");
    push(["trackEvent", "update", "dismiss" + (dontask ? "DontAskAgain" : "")]);
}
const updateButton = $("#update");
updateButton.addEventListener("click", () => {
    update();
});
const dismissButton = $("#dismissupdate");
dismissButton.addEventListener("click", () => {
    dismissupdate(false);
});
const dontaskButton = $("#dismissdontask");
dontaskButton.addEventListener("click", () => {
    dismissupdate(true);
});
setInterval(updatecheck, 10800000);

const platformUserAgents = {
    darwin: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    linux: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    win32: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
};
const platformSpecificUserAgent = platformUserAgents[process.platform] || platformUserAgents.linux;

const mainBody = $(".mainbody");
const tabButtons = $("#tabbuttons");
tabButtons.addEventListener("wheel", (event) => {
    let target = tabButtons;
    const toLeft = event.deltaY < 0 && target.scrollLeft > 0;
    const toRight = event.deltaY > 0 && target.scrollLeft < target.scrollWidth - target.clientWidth;
    if (toLeft || toRight) {
        event.preventDefault();
        target.scrollLeft += event.deltaY;
    }
});
function settings() {
    let tabselect = $(`#tabselect`);
    tabselect.innerHTML = "";
    for (var i of tabButtons.children) {
        if (i.classList.length < 2)
            continue;
        if (i.classList[1] == "settingsbtn" || i.classList[1] == "rollupbtn")
            continue;
        var sel = document.createElement("option");
        sel.setAttribute("value", i.classList[2]);
        sel.textContent = i.innerHTML;
        tabselect.appendChild(sel);
    }
    if ($(`.settings.active`) != null) {
        $(`.settingsbtn`)?.classList.remove("active");
        $(`.settings`)?.classList.remove("active");
        return;
    }
    $(`.settingsbtn`)?.classList.add("active");
    $(`.settings`)?.classList.add("active");
}
$("#settingsbtn")?.addEventListener("click", settings);
function addtab(dirty, name, title, tabbaseuri = baseuri) {
    if (!dirty && localStorage.getItem("tablock") == "true") {
        alert("Tabs are locked. Please unlock before attempting to add another tab.");
    }
    let tabbutton = document.createElement("div");
    let tabs = tabButtons.children.length;
    name = name != null ? name : "tab" + (tabs + 1);
    tabbutton.classList.add("titlebutton", "titletab", "title" + name);
    tabbutton.addEventListener("click", () => {
        activetab(name);
    });
    tabbutton.textContent = title != null ? title : "Tab #" + (tabs + 1);
    tabButtons.appendChild(tabbutton);
    let tab = document.createElement("div");
    let tabinner = document.createElement("webview");
    tab.classList.add("tab");
    tab.classList.add(name);
    tab.id = name;
    tabinner.setAttribute("preload", "webview-preload.js");
    tabinner.setAttribute("style", "width:100%;height:100%");
    tabinner.setAttribute("webpreferences", "nativeWindowOpen=true;");
    tabinner.setAttribute("allowpopups", "true");
    tabinner.setAttribute("plugins", "true");
    tabinner.setAttribute("partition", "persist:" + name);
    tabinner.setAttribute("useragent", platformSpecificUserAgent);
    tabinner.setAttribute("src", tabbaseuri != baseuri ? tabbaseuri : baseuri + "/login");
    tabinner.addEventListener("dom-ready", () => {
        domReadyListener(tab, tabbutton, dirty, name, tabbaseuri);
    }, { once: true });
    tabinner.addEventListener("dom-ready", () => {
        processCss(true, tabinner);
    });
    tabbutton.addEventListener("contextmenu", (e) => {
        showContext(e, name);
    });
    tab.appendChild(tabinner);
    mainBody.appendChild(tab);
    if (dirty) {
        for (let i of dirtyTabAddedListeners) {
            i(name);
        }
    }
    if (dirty == false) {
        updateAnalytics();
        activetab(name);
    }
    return tabinner;
}
$("#addtab")?.addEventListener("click", () => {
    addtab(false);
});
function activetab(id) {
    let targetTab = $("." + id);
    let targetTabButton = $(".title" + id);
    if (!targetTab || !targetTabButton) {
        console.error(`Tried to activate tab with id ${id}, but it did not exist.`);
        return;
    }
    let activeTab = $(".tab.active");
    let activeTabButton = $(".titlebutton.active");
    if (activeTabButton == targetTabButton)
        return;
    activeTab?.classList.remove("active");
    activeTabButton?.classList.remove("active");
    targetTab.classList.add("active");
    targetTabButton.classList.add("active");
}
function domReadyListener(tab, tabbutton, dirty, name, tabbaseuri) {
    let tabinner = tab.querySelector("webview");
    let webContents = getWebContents(tabinner);
    webContents.session.webRequest.onBeforeSendHeaders({ urls: [tabbaseuri + "/api/v*/users/@me/*"] }, (details, callback) => {
        if (!details.requestHeaders["Authorization"]) {
            console.log("Weird users/@me request didnt have an auth header.");
            callback(details);
            return;
        }
        if (!dirty && name.startsWith("tab")) {
            tabbutton.classList.remove("title" + name);
            tab.classList.remove(name);
            name = "t" + atob(details.requestHeaders["Authorization"].split(".")[0]);
            tab.id = name;
            tabbutton.classList.add("title" + name);
            tabbutton.setAttribute("onclick", "activetab('" + name + "')");
            tab.classList.add(name);
            tabinner.setAttribute("partition", "persist:" + name);
            tabtokens[name] = { title: name, token: "", baseuri: tabbaseuri };
        }
        handleToken(details, name, dirty);
        callback(details);
    });
}
let pastFirstTab = false;
let tabsuninit = Object.keys(tabtokens);
async function inittabs() {
    if (tabsuninit.length < 1) {
        processCss(true);
        if (localStorage.getItem("rolledup") == "true") {
            rollup();
            onResize();
        }
        updatecheck();
        return;
    }
    let i = tabsuninit.shift();
    if (i == "_version") {
        inittabs();
        return;
    }
    else if (!i)
        throw new Error("No tab to initialize, this should never happen.");
    var tabbaseuri = baseuri;
    var tabtoken = tabtokens[i].token;
    tabbaseuri = tabtokens[i].baseuri || tabbaseuri;
    let view = addtab(true, i, tabtokens[i].title, tabbaseuri);
    if (!pastFirstTab) {
        activetab(i);
        pastFirstTab = true;
    }
    view.addEventListener("dom-ready", function inject() {
        view.removeEventListener("dom-ready", inject);
        view.loadURL(tabbaseuri + "/api/");
        view.addEventListener("dom-ready", function inject1() {
            view.removeEventListener("dom-ready", inject1);
            view.executeJavaScript("localStorage.setItem('token','\"" + tabtoken + "\"');window.location.href='/app';0");
            inittabs();
        });
    });
}
updateAnalytics();
inittabs();

export { activetab, addtab };
//# sourceMappingURL=index.packed.js.map

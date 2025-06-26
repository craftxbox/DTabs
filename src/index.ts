import { updateAnalytics } from "./analytics.js";
import "./axios.js";
import { baseuri } from "./baseuri.js";
import { showContext } from "./context.js";
import { processCss } from "./css.js";
import "./lock.js";
import { dirtyTabAddedListeners } from "./listeners.js";
import "./preloadGenerator.js";
import { onResize, rollup } from "./rollup.js";
import { handleToken, tabtokens } from "./token.js";
import "./unifiedTextEntry.js"
import { updatecheck } from "./update.js";
import { platformSpecificUserAgent } from "./userAgent.js";
import { $, getWebContents } from "./util.js";
import "./version.js";

const mainBody = $(".mainbody") as HTMLDivElement;
const tabButtons = $("#tabbuttons") as HTMLDivElement;

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
    let tabselect = $(`#tabselect`) as HTMLSelectElement;
    tabselect.innerHTML = "";
    for (var i of tabButtons.children) {
        if (i.classList.length < 2) continue;
        if (i.classList[1] == "settingsbtn" || i.classList[1] == "rollupbtn") continue;
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

export function addtab(dirty: boolean, name?: string, title?: string, tabbaseuri = baseuri) {
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
    tabinner.addEventListener(
        "dom-ready",
        () => {
            domReadyListener(tab, tabbutton, dirty, name, tabbaseuri);
        },
        { once: true } as any
    );

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

export function activetab(id: string): void {
    let targetTab = $("." + id) as HTMLDivElement;
    let targetTabButton = $(".title" + id) as HTMLDivElement;

    if (!targetTab || !targetTabButton) {
        console.error(`Tried to activate tab with id ${id}, but it did not exist.`);
        return;
    }

    let activeTab = $(".tab.active");
    let activeTabButton = $(".titlebutton.active");

    if (activeTabButton == targetTabButton) return;

    activeTab?.classList.remove("active");
    activeTabButton?.classList.remove("active");

    targetTab.classList.add("active");
    targetTabButton.classList.add("active");
}

function domReadyListener(tab: HTMLDivElement, tabbutton: HTMLDivElement, dirty: boolean, name: string, tabbaseuri: string) {
    let tabinner = tab.querySelector("webview") as Electron.WebviewTag;

    let webContents = getWebContents(tabinner) as Electron.WebContents;

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
let tabsuninit: string[] = Object.keys(tabtokens);
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
    } else if (!i) throw new Error("No tab to initialize, this should never happen.");

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

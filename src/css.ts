import { $, $$ } from "./util.js";
const fs = require("fs") as typeof import("fs");

const { dialog }: {dialog: Electron.Dialog} = require("@electron/remote");

const injectToggle = $("#injecttoggle") as HTMLInputElement;
const injectPath = $("#injectpath") as HTMLButtonElement;
const reloadBtn = $("#reloadcss") as HTMLButtonElement;

let vencss = "";

let cssPath = localStorage.getItem("csspath") || "";

injectToggle.checked = localStorage.getItem("injectcss") == "true";
injectPath.textContent = localStorage.getItem("csspath") || "Select file";

export function processCss(reload = false, specificWebview?: Electron.WebviewTag): void {
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
        var cssfile = fs.readFileSync(cssPath).toString();

        if (specificWebview) addCss(specificWebview, cssfile);
        else {
            for (var i of $$(".tab")) {
                addCss(i.querySelector("webview") as Electron.WebviewTag, cssfile);
            }
        }
    }

    if (vencss.length > 0) {
        if (specificWebview) addCss(specificWebview, vencss, "vencord");
        else {
            for (var i of $$(".tab")) {
                addCss(i.querySelector("webview") as Electron.WebviewTag, vencss, "vencord");
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

function addCss(webview: Electron.WebviewTag, cssContents?: string, stylesheetKey = ""): void {
    // if we don't have specific contents, try to read the default file
    if (!cssContents) {
        if (cssPath?.length > 0) {
            cssContents = fs.readFileSync(cssPath).toString();
        } else return;
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
    } else {
        // insert the stylesheet for the first time
        webview.insertCSS(cssContents).then((key) => {
            // store the new internal ID for the stylesheet
            webview.setAttribute("csskey" + stylesheetKey, key);
        });
    }
}

export function setCssState(enable: boolean): void {
    if (enable) {
        processCss(true);
    } else {
        for (var i of $$("webview") as NodeListOf<Electron.WebviewTag>) {
            let stylesheetId = i.getAttribute("csskey");

            if (!stylesheetId) continue;

            i.removeInsertedCSS(stylesheetId);
        }
    }
}

export function setVencordCss(css: string): void {
    vencss = css;
}

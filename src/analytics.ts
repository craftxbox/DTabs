import { $, $$ } from "./util.js";
import { tabtokens } from "./token.js";
import { VERSION } from "./version.js";
const crypto = require("crypto") as typeof import("crypto");

if (localStorage.getItem("uniqueId") == null) {
    //probably the dumbest line of code i have ever written.
    localStorage.setItem("uniqueId", crypto.createHash("sha256").update(crypto.randomBytes(256)).digest("hex"));
}

export function updateAnalytics() {
    if (_paq == null) return;

    if (localStorage.getItem("analytics.meta.system.os") !== "false") _paq.push(["setCustomDimension", 3, process.platform]);
    if (localStorage.getItem("analytics.dtabs.css.enabled") !== "false") _paq.push(["setCustomDimension", 5, localStorage.getItem("injectcss")]);
    if (localStorage.getItem("analytics.dtabs.base.changed") !== "false")
        _paq.push(["setCustomDimension", 6, (localStorage.getItem("baseuri") || "https://discord.com") != "https://discord.com"]);
    if (localStorage.getItem("analytics.dtabs.base.tabs.anychanged") !== "false") {
        if (Object.keys(tabtokens).length <= 1) return; //tabtokens aren't loaded yet
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
        if (Object.keys(tabtokens).length <= 1) return; //tabtokens aren't loaded yet
        _paq.push(["setCustomDimension", 8, Object.keys(tabtokens).length - 1]);
    }
    if (localStorage.getItem("analytics.dtabs.tabs.rolledup") !== "false") _paq.push(["setCustomDimension", 9, localStorage.getItem("rolledup")]);
    if (localStorage.getItem("analytics.dtabs.tabs.locked") !== "false") _paq.push(["setCustomDimension", 4, localStorage.getItem("tablock")]);
    if (localStorage.getItem("analytics.dtabs.base.uri") === "true") _paq.push(["setCustomDimension", 10, localStorage.getItem("baseuri") || "default"]);
    if (localStorage.getItem("analytics.dtabs.tabs.all.base") === "true") {
        if (Object.keys(tabtokens).length <= 1) return; //tabtokens aren't loaded yet
        let bases: string[] = [];
        for (let i in tabtokens) {
            bases.push(tabtokens[i].baseuri || "https://discord.com");
        }
        _paq.push(["setCustomDimension", 11, JSON.stringify(bases)]);
    }
    _paq.push(["trackEvent", "analytics", "update"]);
}

//dont even bother loading matomo if we already opted out.
if (localStorage.getItem("analytics.enableTotally") !== "false") {
    var _paq = ((window as any)._paq = (window as any)._paq || []);
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
        var d = document,
            g = d.createElement("script"),
            s = d.getElementsByTagName("script")[0];
        g.type = "text/javascript";
        g.async = true;
        g.src = u + "matomo.js";
        s.parentNode?.insertBefore(g, s);
    })();

    let analyticsKeys = Object.keys({ ...localStorage }).filter((i) => i.startsWith("analytics."));

    let analyticsEnabled = $(`#analytics\\.enableTotally`) as HTMLInputElement;
    analyticsEnabled.setAttribute("checked", localStorage.getItem("analytics.enableTotally") !== "false" ? "true" : "false");
    for (var i of analyticsKeys) {
        if (localStorage.getItem(i) === "true") {
            let element = $(`#${i.split("analytics.")[1].replaceAll(".", "\\.")}`);
            if (!element) {
                console.log(`No element for analytics key ${i}, this data point has likely been removed.`);
                continue;
            }
            element.setAttribute("checked", "true");
        } else if (localStorage.getItem(i) === "false") {
            let element = $(`#${i.split("analytics.")[1].replaceAll(".", "\\.")}`);
            if (!element) {
                console.log(`No element for analytics key ${i}, this data point has likely been removed.`);
                continue;
            }
            element.removeAttribute("checked");
        }
    }
}

export function toggleAnalytics(path: string) {
    if (path == "totally") {
        if (localStorage.getItem("analytics.enableTotally") !== "false") {
            localStorage.setItem("analytics.enableTotally", "false");
            _paq.push(["optUserOut"]);
        } else {
            localStorage.setItem("analytics.enableTotally", "true");
            alert("Analytics will be enabled at next restart. Thank you for your support.");
        }
        return;
    } else {
        if (localStorage.getItem(`analytics.${path}`) !== "false" /*true by default*/) localStorage.setItem(`analytics.${path}`, "false");
        else if (localStorage.getItem(`analytics.${path}`) === "false") localStorage.setItem(`analytics.${path}`, "true");
    }
    updateAnalytics();
}

Object.defineProperty(window, "toggleAnalytics", {
    value: toggleAnalytics,
    writable: false,
    configurable: false,
    enumerable: false,
});

export function push(..._: any) {
    if (_paq == null) return;
    _paq.push(arguments);
}

export function analyticsToggleAll(domain:string , to: string) {
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
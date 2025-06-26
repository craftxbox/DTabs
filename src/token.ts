import { updateAnalytics } from "./analytics.js";
import { $, $$ } from "./util.js";
const { session }: { session: typeof Electron.Session } = require("@electron/remote");
import { dirtyTabAddedListeners } from "./listeners.js";
import { instance } from "./axios.js";
import { baseuri } from "./baseuri.js";

type TokenChangeState = {
    active: boolean;
    newToken: string;
    tab: string;
};

type TabToken = {
    token: string;
    title: string;
    order?: number;
    baseuri?: string;
    proxy?: string;
};

export let tabtokens: { [key: string]: TabToken } = {};

{
    let tabdata = localStorage.getItem("tabs");
    if (tabdata) tabtokens = JSON.parse(tabdata) as { [key: string]: TabToken };
    else {
        tabtokens = { _version: 1 } as any;
    }
}

if (tabtokens._version == undefined) {
    //convert tab tokens to new format
    let oldtokendata = localStorage.getItem("tabs") || "{}";
    let oldtokens = JSON.parse(oldtokendata) as { [key: string]: string };

    localStorage.setItem("oldtabs", oldtokendata);

    let newtokens = { _version: 1 } as any;

    for (let i of Object.keys(oldtokens)) {
        let oldtoken = oldtokens[i].replace(/http(s?):/, "http$1;");
        newtokens[i] = {
            token: oldtoken.split(":")[0],
            title: oldtoken.split(":")[1],
            baseuri: oldtoken.split(":")[2]?.replace(";", ":") || baseuri,
        };
    }
    tabtokens = newtokens as any;
    localStorage.setItem("tabs", JSON.stringify(tabtokens));
    window.location.reload();
}

let tokenChangeState: TokenChangeState | undefined;
let tokenChangeQueue: TokenChangeState[] = [];

const tokenChangeDialogue = $(".tokenchange") as HTMLDivElement;

const tchmainEl = $(`#tchmain`) as HTMLDivElement;
const tchNewTabSetup = $(`#tchnewtabsetup`) as HTMLDivElement;

const tchTargetTabText = $(`#tokenchangetab`) as HTMLDivElement;

export async function handleToken(details: Electron.BeforeSendResponse, name: string, dirty: boolean) {
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
        } else if (!dirty && tabtokens[name].token != token) {
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
        } else {
            tchNewTabSetup.classList.add("active");
        }
    }
}
export function savetabs() {
    window.localStorage.setItem("tabs", JSON.stringify(tabtokens));
}

const tabselect = $(`#tabselect`) as HTMLSelectElement;

export function deletetab(tab?: string) {
    if (localStorage.getItem("tablock") == "true") {
        alert("Tabs are locked. Please unlock before attempting to delete a tab.");
    }
    var tabId = tab || tabselect.value;
    delete tabtokens[tabId.replace("title", "")];

    let webview = $("." + tabId.replace("title", "") + " webview") as Electron.WebviewTag;
    let partition = webview.getAttribute("partition") || tabId.replace("title", "");

    session.fromPartition(partition).clearStorageData();

    $("." + tabId)?.remove();

    $(".tab." + tabId.replace("title", ""))?.remove();

    savetabs();
    updateAnalytics();
}

function tchresolve() {
    const tchresolvenewp = $("#tchresolvenew p") as HTMLParagraphElement;
    const tchresolveoldp = $("#tchresolveold p") as HTMLParagraphElement;
    $("#tchusernoaction")?.classList.remove("active");
    $("#tchresolve")?.classList.add("active");

    if (!tokenChangeState || !tokenChangeState.newToken) return;

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
                if (data.discriminator != "0") name += `#${data.discriminator}`;

                tchresolvenewp.textContent = name;
                $("#tchresolvenew")?.setAttribute(
                    "onclick",
                    "$`.tokenchange`.classList.remove('active'); $`#tchresolve`.classList.remove('active'); tchresolvenew();"
                );
            } else {
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
                if (data.discriminator != "0") name += `#${data.discriminator}`;
                tchresolveoldp.textContent = name;
                $("#tchresolveold")?.setAttribute(
                    "onclick",
                    "tokenChangeState = null;$`.tokenchange`.classList.remove('active'); $`#tchresolve`.classList.remove('active');"
                );
            } else {
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
    if (!tokenChangeState || !tokenChangeState.newToken) return;
    tabtokens[tokenChangeState.tab].token = tokenChangeState.newToken;
    savetabs();
    tokenChangeState = undefined;
}

Object.defineProperty(window, "tchresolvenew", {
    value: tchresolvenew,
});

function tchrename() {
    if (!tokenChangeState || !tokenChangeState.newToken) return;

    $(`#tchrename`)?.classList.remove("active");
    $(`#tchrelogorpwch`)?.classList.add("active");

    tabtokens[tokenChangeState.tab].title = ($(`#tchrenameinput`) as HTMLInputElement).value;
    tabtokens[tokenChangeState.tab].token = tokenChangeState.newToken;
    ($(`.titlebutton.title` + tokenChangeState.tab) as HTMLElement).textContent = tabtokens[tokenChangeState.tab].title;
    savetabs();
    tokenChangeState = undefined;
}

Object.defineProperty(window, "tchrename", {
    value: tchrename,
});

function tchautofill() {
    if (!tokenChangeState || !tokenChangeState.newToken) return;

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
            if (!tokenChangeState || !tokenChangeState.newToken) throw new Error("Token change state is null at a point where it shouldn't be.");
            if (response.status == 200) {
                var data = response.data;
                let name = `${data.username}`;
                if (data.discriminator != "0") name += `#${data.discriminator}`;
                tabtokens[tokenChangeState.tab].title = name;
                tabtokens[tokenChangeState.tab].token = tokenChangeState.newToken;
                ($(`.titlebutton.title` + tokenChangeState.tab) as HTMLElement).textContent = tabtokens[tokenChangeState.tab].title;
                savetabs();
                tokenChangeState = undefined;
            } else {
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
            if (!tokenChangeState || !tokenChangeState.newToken) return;
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
    if (!tokenChangeState || !tokenChangeState.newToken) return;
    tabtokens[tokenChangeState.tab].token = tokenChangeState.newToken;
    savetabs();
    tokenChangeState = undefined;
}

Object.defineProperty(window, "tchrelogorpwch", {
    value: tchrelogorpwch,
});

setInterval(processTokenQueue, 5000);

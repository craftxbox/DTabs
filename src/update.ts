import { VERSION } from "./version.js";
import { instance } from "./axios.js";
import { $ } from "./util.js";
import { push } from "./analytics.js";
const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");
const remote = require("@electron/remote") as typeof import("@electron/remote");

const changelog = $(".changelog") as HTMLDivElement;

// this is the file we get to check for updates. Change this if you're forking, otherwise you're just going to be autoupdating against the downstream :)
const indexHtmlFileGitRawUrl = "https://raw.githubusercontent.com/craftxbox/DTabs/master/index.html";
const mainJsUrl = "https://raw.githubusercontent.com/craftxbox/DTabs/VERSION/main.js";
const distJsUrl = "https://raw.githubusercontent.com/craftxbox/DTabs/VERSION/dist/index.packed.js";

// This should never be populated unless you're part of a betatest group
const activeBetaUrl = "";
const activeBetaMainJsUrl = "";
const activeBetaDistJsUrl = "";

var updatecontents = "";
var checkdisabled = false;
var verregex = /VERSION2=(\d+)(?:\.(\d+))?;/;
let betaregex = /BETA=(\d+);/;

function hasUpdated(matchregex: RegExp, options: { index: number; checkVersion?: string } = { index: 1 }) {
    let lastVersion = options.checkVersion || localStorage.getItem("lastVersion");
    if (!lastVersion) return true; //first run, no last version

    let match = lastVersion.match(matchregex);
    if (!match) return true; // should never be possible

    let standingVersion = VERSION.match(matchregex)[options.index];
    let remoteVersion = match[options.index];

    return remoteVersion > standingVersion;
}

function hasMasterUpdated() {
    return hasUpdated(verregex);
}

function hasBetaUpdated() {
    if (hasMasterUpdated()) return false; //if master updated, this beta has been left behind anyway.
    return hasUpdated(betaregex);
}

//only major changes trigger changelog. Minor changes will only be bugfixes anyways.
if (hasMasterUpdated() || (hasMasterUpdated() == false && hasBetaUpdated())) {
    localStorage.setItem("lastVersion", VERSION);
    changelog.classList.add("active");
}

function getVersion(content: string, regex: RegExp): { major: number; minor: number; full: string } {
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

const updatedialog = $(".updatedialog") as HTMLDivElement;
const updateDialogBody = $(".updatedialogbody") as HTMLDivElement;
const currentVersionEl = $("#currentversion") as HTMLSpanElement;
const upstreamVersionEl = $("#latestversion") as HTMLSpanElement;
let updateTrack: "master" | "beta" = "master";

export function updatecheck(noprompt = false) {
    if (checkdisabled) return;
    instance.get(indexHtmlFileGitRawUrl).then(function (response) {
        if (response.status != 200 && !checkdisabled) {
            checkdisabled = true;
            alert("DTabs was unable to check for updates!");
            return;
        }
        updatecontents = response.data;
        updateTrack = "master";

        if (noprompt) return;

        if (!verregex.test(updatecontents)) {
            return; // upstream has no version2? it's possibly out of date.
        }

        let localVer = getVersion(VERSION, verregex);
        let upstreamVer = getVersion(updatecontents, verregex);

        if (upstreamVer.major > localVer.major) {
            updatedialog.classList.add("active");
            currentVersionEl.textContent = localVer.full;
            upstreamVersionEl.textContent = upstreamVer.full;
        } else {
            if (activeBetaUrl.length > 0) {
                betaUpdateCheck(noprompt);
            }
        }
    });
}

export function betaUpdateCheck(noprompt = false) {
    if (checkdisabled) return;
    instance.get(activeBetaUrl).then(function (response) {
        if (response.status != 200 && !checkdisabled) {
            checkdisabled = true;
            alert("DTabs was unable to check for updates!");
            return;
        }
        updatecontents = response.data;
        updateTrack = "beta";

        if (noprompt) return;

        if (!verregex.test(updatecontents)) {
            return; // upstream has no version2? it's possibly out of date.
        }

        let localVer = getVersion(VERSION, verregex);
        let upstreamVer = getVersion(updatecontents, verregex);

        if (upstreamVer.major > localVer.major) {
            updatedialog.classList.add("active");
            currentVersionEl.textContent = localVer.full;
            upstreamVersionEl.textContent = upstreamVer.full;
        } else {
        }
    });
}

export function update() {
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
    else updatecheck(true);

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

export function dismissupdate(dontask: boolean) {
    checkdisabled = dontask;
    updatedialog.classList.remove("active");
    push(["trackEvent", "update", "dismiss" + (dontask ? "DontAskAgain" : "")]);
}

const updateButton = $("#update") as HTMLButtonElement;
updateButton.addEventListener("click", () => {
    update();
});

const dismissButton = $("#dismissupdate") as HTMLButtonElement;
dismissButton.addEventListener("click", () => {
    dismissupdate(false);
});

const dontaskButton = $("#dismissdontask") as HTMLButtonElement;
dontaskButton.addEventListener("click", () => {
    dismissupdate(true);
});

setInterval(updatecheck, 10800000);

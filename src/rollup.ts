import { updateAnalytics } from "./analytics.js";
import { $ } from "./util.js";
const remote = require("@electron/remote") as typeof import("@electron/remote");

const rollupButton = $(".rollupbtn") as HTMLDivElement;
const topBar = $("#topbar") as HTMLDivElement;
const mainBody = $(".mainbody") as HTMLDivElement;

export function onResize() {
    let bWindow = remote.getCurrentWindow();
    if (!bWindow.isMaximized()) {
        //force rolled down when unmaximized
        rollupButton.style = "display:none";
        topBar.style = "top:0px;";
        mainBody.style = "top:30px;";
    } else {
        rollupButton.style = "display:block";
        if (localStorage.getItem("rolledup") == "true") {
            topBar.style = "top:-27px;";
            mainBody.style = "height: 100%; top:3px;";
        } else {
            topBar.style = "top:0px;";
            mainBody.style = "top:30px;";
        }
    }
}

export function rolluptoggle() {
    if (localStorage.getItem("rolledup") == "true") {
        rolldown();
    } else {
        rollup();
    }
}

rollupButton.addEventListener("click", () => {
    rolluptoggle();
});

export function rollup() {
    topBar.style = "top:-27px;";
    rollupButton.setAttribute("onclick", "rolldown()");
    rollupButton.textContent = "▼";
    mainBody.style = "height: 100%; top:3px;";
    localStorage.setItem("rolledup", "true");
    updateAnalytics();
}

export function rolldown() {
    topBar.style = "top:0px;";
    rollupButton.setAttribute("onclick", "rollup()");
    rollupButton.textContent = "▲";
    mainBody.style = "top:30px;";
    localStorage.setItem("rolledup", "false");
    updateAnalytics();
}

window.addEventListener("resize", () => {
    onResize();
});

onResize();

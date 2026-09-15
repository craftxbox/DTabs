import { $ } from "./util.js";
import { deletetab, savetabs, tabtokens } from "./token.js";

const tabButtonContextMenu = $("#tabbtn-ctx") as HTMLDivElement;

let tabContext = "";

document.addEventListener("click", function () {
    if (tabButtonContextMenu.style.display == "block") {
        tabButtonContextMenu.style = "display:none;";
    }
});

export function showContext(e: MouseEvent) {
    tabButtonContextMenu.style = "display:block; left:" + (e.clientX - 10) + "px;top:" + (e.clientY - 10) + "px;";
    tabContext = (e.target as HTMLDivElement).id.replace("title", "");
    tabButtonContextMenu.addEventListener("mouseleave", () => {
        tabButtonContextMenu.style = "display:none;";
    });
    e.preventDefault();
}

function ctxinspect() {
    var webview = $("#" + tabContext + " webview") as Electron.WebviewTag;
    webview.openDevTools();
}

$("#ctxinspect")?.addEventListener("click", ctxinspect);

function ctxdelete() {
    deletetab(tabContext);
}

$("#ctxdelete")?.addEventListener("click", ctxdelete);

function ctxreload() {
    var webview = $("#" + tabContext + " webview") as Electron.WebviewTag;
    webview.reload();
}

$("#ctxreload")?.addEventListener("click", ctxreload);

//TODO create this dynamically with domfragment... probably all of the menu stuff should be redone with domfragment

const ctxrenameinput = $("#ctxrenameinput") as HTMLInputElement;
const ctxrenamedialogue = $("#ctxrenamebox") as HTMLDivElement;
const ctxrenamesubmit = $("#ctxrenamesubmit") as HTMLDivElement;
const tokenChangeDialog = $(".tokenchange") as HTMLDivElement;

function ctxrename(postrename = false) {
    if (postrename) {
        let tabButton = $(`.titlebutton#title` + tabContext) as HTMLDivElement;

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
    ctxrenamesubmit.addEventListener("click", () => {
        ctxrename(true);
    });
}

$("#ctxrename")?.addEventListener("click", () => {
    ctxrename();
});

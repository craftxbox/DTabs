import { updateAnalytics } from "./analytics.js";
import { $ } from "./util.js";

const lockCheckbox = $(`#locktabs`) as HTMLInputElement;
const addTabButton = $(`#addtab`) as HTMLDivElement;
const deleteTabButton = $(`#ctxdelete`) as HTMLDivElement;

lockCheckbox.addEventListener("change", () => {
    lockTabs(lockCheckbox.checked);
});
lockCheckbox.checked = localStorage.getItem("tablock") == "true";
lockTabs(localStorage.getItem("tablock") == "true");

export function lockTabs(lock: boolean) {
    if (lock) {
        addTabButton.style = "display:none;";
        deleteTabButton.style = "display:none;";
        localStorage.setItem("tablock", "true");
    } else {
        addTabButton.style = "display:block;";
        deleteTabButton.style = "display:block;";
        localStorage.setItem("tablock", "false");
    }
    updateAnalytics();
}

export function areTabsLocked() {
    return localStorage.getItem("tablock") == "true";
}

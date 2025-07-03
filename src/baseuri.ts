import { $ } from "./util.js";
import { addtab } from "./index.js";
import { updateAnalytics } from "./analytics.js";
import { deletetab } from "./token.js";

export let baseuri = localStorage.getItem("baseuri") || "https://discord.com";

const baseuriInput = $('#baseuriinput') as HTMLInputElement;
const tabBaseUriInput = $('#tabbaseuriinput') as HTMLInputElement;

export function changeBaseUri() {
    if (!confirm("Changing the global base URI may result in unexpected issues! Did you mean to do this?")) return;
    baseuri = baseuriInput.value;
    localStorage.setItem("baseuri", baseuri);
    alert("Please restart DTabs for this to fully take effect!");
    updateAnalytics();
}

$("#changebaseuri")?.addEventListener("click", changeBaseUri);

export function changeTabBaseUri() {
    if (!confirm("Changing the base URI may result in unexpected issues! Did you mean to do this?")) return;
    var newuri = tabBaseUriInput.value;
    deletetab();
    addtab(false, undefined, newuri, newuri);
    updateAnalytics();
}

$("#changetabbaseuri")?.addEventListener("click", changeTabBaseUri);
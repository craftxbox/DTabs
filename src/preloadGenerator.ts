const fs = require("fs") as typeof import("fs");
const path = require("path") as typeof import("path");
import { instance } from "./axios.js";

import { setVencordCss } from "./css.js";

// TODO fragment this out into one file per plugin

const injectVencord = document.getElementById("injectVencord") as HTMLInputElement;
const injectUTE = document.getElementById("injectUTE") as HTMLInputElement;

if (localStorage.getItem("injectVencord") == "true") injectVencord.setAttribute("checked", "true");
if (localStorage.getItem("injectUTE") == "true") injectUTE.setAttribute("checked", "true");

//reset the preloader script
fs.writeFileSync(path.resolve(__dirname, "webview-preload.js"), 'window.ipcRenderer = require("electron").ipcRenderer;', "utf8");

if (injectVencord.checked) {
    fs.appendFileSync(
        path.resolve(__dirname, "webview-preload.js"),
        `
		Object.defineProperty(window,"armcord", {get: () => {return {version:" <--- NOT Armcord, **Web** via [Third-party Client](https://github.com/craftxbox/dtabs) (cc. <@496398139050295311>)\\n"}}});
		`,
        "utf8"
    );
    instance.get("https://cdn.jsdelivr.net/gh/Vencord/builds@main/browser.js").then(function (response) {
        fs.appendFileSync(path.resolve(__dirname, "webview-preload.js"), response.data, "utf8");
        fs.appendFileSync(
            path.resolve(__dirname, "webview-preload.js"),
            'Object.defineProperty(window, "Vencord", { get: () => Vencord });window.Vencord.Settings.plugins.MessageEventsAPI.enabled = true;',
            "utf8"
        );
    });
    instance.get("https://cdn.jsdelivr.net/gh/Vencord/builds@main/browser.css").then(function (response) {
        setVencordCss(response.data);
    });
}

if (injectUTE.checked && !injectVencord.checked) {
    instance
        .get("https://transfur.science/od63k1i1") // <!-- TODO replace this with a versioned & pinned URL to prevent supply chain attacks -->
        .then(function (response) {
            fs.appendFileSync(path.resolve(__dirname, "webview-preload.js"), response.data, "utf8");
            fs.appendFileSync(
                path.resolve(__dirname, "webview-preload.js"),
                `
				Object.defineProperty(window, "uteTransitionTo", { get: () => WEBPACK_GRABBER.findByCode("transitionTo -") });
				Object.defineProperty(window, "uteMsgActions", { get: () => WEBPACK_GRABBER.findByProps("editMessage") });
				Object.defineProperty(window, "uteCurChanId", { get: () => WEBPACK_GRABBER.findByProps("getCurrentlySelectedChannelId").getCurrentlySelectedChannelId });
				Object.defineProperty(window, "uteChanStore", { get: () => WEBPACK_GRABBER.findByProps("getChannel","getBasicChannel") });
				Object.defineProperty(window, "utePermStore", { get: () => WEBPACK_GRABBER.findByProps("can","computePermissions") });
				`,
                "utf8"
            );
        });
} else if (injectUTE.checked && injectVencord.checked) {
    fs.appendFileSync(
        path.resolve(__dirname, "webview-preload.js"),
        `
			/* webpackgrabber and vencord do not mix so we have to recreate the api with vencord apis instead */
			Object.defineProperty(window, "uteTransitionTo", { get: () => Vencord.Webpack.Common.NavigationRouter.transitionTo });
			Object.defineProperty(window, "uteMsgActions", { get: () => Vencord.Webpack.Common.MessageActions });
			Object.defineProperty(window, "uteCurChanId", { get: () => Vencord.Webpack.Common.SelectedChannelStore.getCurrentlySelectedChannelId });
			Object.defineProperty(window, "uteChanStore", { get: () => Vencord.Webpack.Common.ChannelStore });
			Object.defineProperty(window, "utePermStore", { get: () => Vencord.Webpack.Common.PermissionStore });
		`,
        "utf8"
    );
}

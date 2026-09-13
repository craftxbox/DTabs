type BrowserWindow = import("electron").BrowserWindow;
type MessageBoxOptions = import("electron").MessageBoxOptions;

const { app, BrowserWindow, desktopCapturer, dialog, ipcMain } = require("@electron/remote") as typeof import('@electron/remote');
const path = require("path") as typeof import('path');
const fs = require("fs") as typeof import('fs');

app.on("web-contents-created", (_event, contents) => {
    registerCustomHandler(contents);
});

let capturerWindow: BrowserWindow;
let isDone: boolean;
function showAudioDialog(): boolean {
    const options: MessageBoxOptions = {
        type: "question",
        buttons: ["Yes", "No"],
        defaultId: 1,
        title: "Screenshare audio",
        message: `Would you like to screenshare audio?`,
        detail: "Selecting yes will make viewers of your stream hear your entire system audio."
    };

    void dialog.showMessageBox(capturerWindow, options).then(({ response }) => {
        if (response == 0) {
            return true;
        } else {
            return false;
        }
    });
    return true;
}

export function registerCustomHandler(contents: Electron.WebContents): void {
    contents.session.setDisplayMediaRequestHandler((request, callback) => {
        console.log(request);
        void desktopCapturer
            .getSources({
                types: ["screen", "window"]
            })
            .then((sources) => {
                if (!sources) return callback({});
                isDone = false;
                console.log(sources);
                if (process.platform === "linux" && process.env.XDG_SESSION_TYPE?.toLowerCase() === "wayland") {
                    console.log("WebRTC Capturer detected, skipping window creation."); //assume webrtc capturer is used
                    let options: Electron.Streams = { video: sources[0] };
                    if (sources[0] === undefined) return callback({});
                    if (showAudioDialog() == true) options = { video: sources[0], audio: "loopback" };
                    callback(options);
                } else {
                    capturerWindow = new BrowserWindow({
                        width: 800,
                        height: 600,
                        title: "Screenshare",
                        darkTheme: true,
                        frame: true,
                        autoHideMenuBar: true,
                        webPreferences: {
                            sandbox: false,
                            spellcheck: false,
                            preload: path.join(__dirname, "preload.mjs")
                        }
                    });
                    ipcMain.once("selectScreenshareSource", (_event, id: string, name: string, audio: boolean) => {
                        isDone = true;
                        console.log("Audio status: " + audio);
                        capturerWindow.close();
                        const result = { id, name };
                        let options: Electron.Streams = { video: sources[0] };
                        switch (process.platform) {
                            case "win32":
                            case "linux":
                                options = { video: result };
                                if (audio) options = { video: result, audio: "loopback" };
                                callback(options);
                                break;
                            default:
                                callback({ video: result });
                        }
                    });
                    capturerWindow.on("closed", () => {
                        if (!isDone) callback({});
                    });
                    void capturerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(pickerHtml)}`);
                    capturerWindow.webContents.send("getSources", sources);
                }
            });
    });
}

const preloadMjsPath = path.join(__dirname, "preload.mjs");
const preloadMjsContent = preloadMjs
    .toString()
    .replace("async function preloadMjs() {", "")
    .replace(`const { ipcRenderer } = await import("electron");`, "import { ipcRenderer } from 'electron';")
    .slice(0, -1);

{
    if(fs.existsSync(preloadMjsPath)) {
        const existingContent = fs.readFileSync(preloadMjsPath, "utf-8");

        if (existingContent !== preloadMjsContent && (existingContent.includes("!!FILEOVERRIDE!!") == false)) {
            console.log("Overriding existing preload.mjs file with new content.");
            fs.writeFileSync(preloadMjsPath, preloadMjsContent, "utf-8");
        }
    } else {
        console.log("Creating new preload.mjs file.");
        fs.writeFileSync(preloadMjsPath, preloadMjsContent, "utf-8");
    }
}

async function preloadMjs() {
    const { ipcRenderer } = await import("electron");
    interface IPCSources {
        id: string;
        name: string;
        thumbnail: HTMLCanvasElement;
    }
    console.log("Screenshare preload script loaded");
    function addDisplays(): void {
        ipcRenderer.once("getSources", (_event, arg: IPCSources[]) => {
            console.log("Get sources event received");
            const sources = arg;
            console.log(sources);
            const selectionElem = document.createElement("div");
            selectionElem.classList.add("desktop-capturer-selection");
            selectionElem.innerHTML = `<div class="desktop-capturer-selection__scroller">
    <ul class="desktop-capturer-selection__list">
      ${sources
          .map(
              ({ id, name, thumbnail }) => `
        <li class="desktop-capturer-selection__item">
          <button class="desktop-capturer-selection__btn" data-id="${id}" title="${name}">
            <img class="desktop-capturer-selection__thumbnail" src="${thumbnail.toDataURL()}" />
            <span class="desktop-capturer-selection__name">${name}</span>
          </button>
        </li>
      `
          )
          .join("")}
      <li class="desktop-capturer-selection__item">
        <button class="desktop-capturer-selection__btn" data-id="screen-cancel" title="Cancel">
          <span class="desktop-capturer-selection__name desktop-capturer-selection__name--cancel">Cancel</span>
        </button>
      </li>
    </ul>
    </div>
    <div class="switch">
            <label class="header">Share system audio</label>
            <input id="audio" class="tgl tgl-light left" type="checkbox" />
            <label class="tgl-btn left" for="audio"></label>
    </div>
    `;
            document.body.appendChild(selectionElem);
            document.querySelectorAll(".desktop-capturer-selection__btn").forEach((button) => {
                button.addEventListener("click", () => {
                    try {
                        const id = button.getAttribute("data-id");
                        const title = button.getAttribute("title");
                        if (id === "${CANCEL_ID}") {
                            throw new Error("Cancelled by user");
                        } else {
                            const audioElement: HTMLInputElement | null = document.getElementById("audio") as HTMLInputElement;
                            if (audioElement !== null) {
                                ipcRenderer.sendSync("selectScreenshareSource", id, title, audioElement.checked);
                            }
                        }
                    } catch (err) {
                        console.error(err);
                    }
                });
            });
        });
    }
    addDisplays();
}


const pickerHtml = `
<!doctype html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Screenshare</title>
    <style>
        @font-face {
            font-family: Whitney;
            font-weight: 400;
            font-style: normal;
            src: url(https://legcord.app/whitney_400.woff) format("woff");
        }

        * {
            font-family: "Whitney", sans-serif;
            box-sizing: border-box;
            cursor: default;
        }

        .desktop-capturer-selection {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100vh;
            background: var(--background-secondary);
            color: #ffffff;
            z-index: 10000000;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .desktop-capturer-selection__scroller {
            width: 100%;
            max-height: 100vh;
            overflow-y: auto;
        }

        .desktop-capturer-selection__list {
            max-width: calc(100% - 100px);
            margin: 50px;
            padding: 0;
            display: flex;
            flex-wrap: wrap;
            list-style: none;
            overflow: hidden;
            justify-content: center;
        }

        .desktop-capturer-selection__item {
            display: flex;
            margin: 4px;
        }

        .desktop-capturer-selection__btn {
            display: flex;
            flex-direction: column;
            align-items: stretch;
            width: 145px;
            margin: 0;
            border: 0;
            border-radius: 3px;
            padding: 4px;
            background: var(--background-floating);
            text-align: left;
        }

        @media (prefers-reduced-motion: no-preference) {}

        .desktop-capturer-selection__btn:hover,
        .desktop-capturer-selection__btn:focus {
            background: #7289da;
            box-shadow:
                0 0 4px rgba(0, 0, 0, 0.45),
                0 0 2px rgba(0, 0, 0, 0.25);
            color: #fff;
        }

        .desktop-capturer-selection__thumbnail {
            width: 100%;
            height: 81px;
            object-fit: cover;
        }

        .desktop-capturer-selection__name {
            margin: 6px 0;
            white-space: nowrap;
            color: white;
            text-overflow: ellipsis;
            text-align: center;
            overflow: hidden;
        }

        .desktop-capturer-selection__name--cancel {
            margin: auto 0;
        }

        :root {
            --background-secondary: #2f3136;
            --background-secondary-alt: #292b2f;
            --background-floating: #18191c;
            --background-modifier-hover: rgba(106, 116, 128, 0.16);
            --brand-experiment: #7289da;
            --brand-experiment-560: #5c6fb1;
            --brand-experiment-600: #4e5d94;
            --interactive-normal: #b9bbbe;
            --interactive-hover: #dcddde;
            --text-muted: #72767d;
            --header-primary: #fff;
        }

        .switch {
            vertical-align: middle;
            border-radius: 10px;
            background: var(--background-floating);
            padding-left: 20px;
            padding-right: 20px;
            padding-top: 20px;
            padding-bottom: 20px;
            border-color: var(--background-floating);
            border-style: solid;
        }

        .tgl {
            display: none;
        }

        .tgl,
        .tgl:after,
        .tgl:before,
        .tgl *,
        .tgl *:after,
        .tgl *:before,
        .tgl+.tgl-btn {
            box-sizing: border-box;
            margin-top: 20px;
        }

        .tgl::-moz-selection,
        .tgl:after::-moz-selection,
        .tgl:before::-moz-selection,
        .tgl *::-moz-selection,
        .tgl *:after::-moz-selection,
        .tgl *:before::-moz-selection,
        .tgl+.tgl-btn::-moz-selection {
            background: none;
        }

        .tgl::selection,
        .tgl:after::selection,
        .tgl:before::selection,
        .tgl *::selection,
        .tgl *:after::selection,
        .tgl *:before::selection,
        .tgl+.tgl-btn::selection {
            background: none;
        }

        .tgl+.tgl-btn {
            outline: 0;
            display: block;
            width: 4em;
            height: 2em;
            position: relative;
            cursor: pointer;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
            user-select: none;
        }

        .tgl+.tgl-btn:after,
        .tgl+.tgl-btn:before {
            position: relative;
            display: block;
            content: "";
            width: 50%;
            height: 100%;
        }

        .tgl+.tgl-btn:after {
            left: 1px;
        }

        .tgl+.tgl-btn:before {
            display: none;
        }

        .tgl:checked+.tgl-btn:after {
            left: 56%;
        }

        .tgl-light+.tgl-btn {
            background: var(--text-muted);
            border-radius: 25px;
            padding: 4px;
            transition: all 0.4s ease;
        }

        .tgl-light+.tgl-btn:after {
            border-radius: 50px;
            position: relative;
            top: 50%;
            transform: translateY(-50%);
            width: 24px;
            height: 24px;
            background: rgb(255, 255, 255);
            transition: all 0.2s ease;
        }

        .tgl-light:checked+.tgl-btn {
            background: var(--brand-experiment);
        }
    </style>
</head>

<body></body>

</html>`
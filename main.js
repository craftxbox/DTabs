const { app, BrowserWindow, session, shell, dialog, protocol } = require('electron')
const fs = require("fs");
const path = require("path");
require('@electron/remote/main').initialize()

const version = 7;

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webviewTag: true,
      session: session.defaultSession,
      nativeWindowOpen: true
    }
  })
  mainWindow.on('closed', function () {
    mainWindow = null
  })

  if (!fs.existsSync(path.resolve(__dirname, "index.html"))) {
    var files = fs.readdirSync(__dirname);
    var times = [];
    var timeextractor = /index.html.OLD-(\d+)/;
    for (var name of files) {
      if (!timeextractor.test(name)) continue;
      var time = name.match(timeextractor)[1];
      times.push((time - 1) + 1);
    }
    if (times.length < 1) {
      debugger;
      dialog.showMessageBox({
        type: "error", title: "DTabs Fatal Error",
        message: "FATAL: index.html is missing and DTabs could not find an update to revert!\nYour installation is CORRUPT and needs reinstalling!"
      })
      app.quit();
      return;
    }
    times.sort((a, b) => { return b - a; });
    fs.renameSync(path.resolve(__dirname, "index.html.OLD-" + times[0]), path.resolve(__dirname, "index.html"))
    dialog.showMessageBox({
      type: "warning", title: "DTabs Warning",
      message: "WARNING: index.html was missing but DTabs found and reverted an update!\nThis may indicate a failed update or install corruption.\nIf you experience any issues reinstall DTabs!"
    })
  }
  mainWindow.webContents.setUserAgent(`DTabs-mainjs/${version} Electron/${process.versions.electron} Chrome/${process.versions.chrome} Node/${process.versions.node} v8/${process.versions.v8}`);
  mainWindow.loadFile("index.html")
  require("@electron/remote/main").enable(mainWindow.webContents);
}

app.on('ready', createWindow)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
app.on('web-contents-created', function (webContentsCreatedEvent, contents) {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }
  contents.on('will-attach-webview', (_wawevent, webPreferences, _params) => {
    webPreferences.contextIsolation = false;
    webPreferences.sandbox = false;
  });
});

protocol.registerSchemesAsPrivileged([
  { scheme: 'http', privileges: { standard: true, bypassCSP: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: 'https', privileges: { standard: true, bypassCSP: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: 'file', privileges: { standard: true, bypassCSP: true, allowServiceWorkers: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
  { scheme: 'mailto', privileges: { standard: true } },
]);
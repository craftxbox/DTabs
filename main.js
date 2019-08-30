const { app, BrowserWindow, session,shell} = require('electron')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      webviewTag: true,
      session: session.defaultSession,
      nativeWindowOpen:true
    }
  })
  mainWindow.on('closed', function () {
    mainWindow = null
  })
  
  mainWindow.loadFile("index.html")
}

app.on('ready', createWindow)
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
app.on('web-contents-created', function (webContentsCreatedEvent, contents) {
  if (contents.getType() === 'webview') {
    contents.on('new-window', function (newWindowEvent, url) {
      shell.openExternal(url);
      newWindowEvent.preventDefault();
    });
  }
});
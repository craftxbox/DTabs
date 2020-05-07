const { app, BrowserWindow, session,shell,dialog} = require('electron')
const fs = require("fs");

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
  
  if(!fs.existsSync("./resources/app/index.html")){
    var files = fs.readdirSync("./resources/app");
    var times = [];
    var timeextractor = /index.html.OLD-(\d+)/;
    for(var name of files){
      if(!timeextractor.test(name)) continue;
      var time = name.match(timeextractor)[1];
      times.push((time-1)+1);
    }
    if(times.length < 1) {
      debugger;
      dialog.showMessageBox({type:"error",title:"DTabs Fatal Error",
        message:"FATAL: index.html is missing and DTabs could not find an update to revert!\nYour installation is CORRUPT and needs reinstalling!"})
      app.quit();
      return;
    }
    times.sort((a,b)=>{return b-a;});
    fs.renameSync("./resources/app/index.html.OLD-"+times[0],"./resources/app/index.html")
    dialog.showMessageBox({type:"warning",title:"DTabs Warning",
        message:"WARNING: index.html was missing but DTabs found and reverted an update!\nThis may indicate a failed update or install corruption.\nIf you experience any issues reinstall DTabs!"})
  }
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

const { app, BrowserWindow } = require("electron");

require("./print-service/server");

function createWindow() {
  const win = new BrowserWindow({
    width: 500,
    height: 300,
    autoHideMenuBar: true,
  });

  win.loadURL("http://127.0.0.1:5000");
}

app.whenReady().then(() => {
  createWindow();
});

app.on("window-all-closed", () => {});
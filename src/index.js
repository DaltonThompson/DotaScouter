const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const isMac = process.platform === 'darwin'

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    titleBarStyle: 'hidden',
    width: 1440,
    height: 877,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();

  const template = [
    // { role: 'appMenu' }
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Preferences',
          submenu: [
            {
              label: 'Server Log Filepath',
              click: async () => {
                dialog.showOpenDialog({
                  properties: ['openFile'],
                  defaultPath: '/Library/Application Support/Steam/SteamApps/common/dota 2 beta/game/dota/server_log.txt',
                  filters: [{ name: 'Valid Files', extensions: ['txt'] }]
                })
              }
            },
            {
              label: 'Gameplay Patch Range',
              click: async () => {}
            },
            {
              label: 'Clear Memory',
              click: async () => {}
            }
          ]
        },
        { type: 'separator' },
        // { role: 'services' },
        // { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
        { role: 'quit' }
      ]
    }] : []),
    // // { role: 'fileMenu' }
    // {
    //   label: 'File',
    //   submenu: [
    //     isMac ? { role: 'close' } : { role: 'quit' }
    //   ]
    // },
    // { role: 'editMenu' }
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          // { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' }
          // {
          //   label: 'Speech',
          //   submenu: [
          //     { role: 'startSpeaking' },
          //     { role: 'stopSpeaking' }
          //   ]
          // }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    // { role: 'viewMenu' }
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        // { role: 'resetZoom' },
        // { role: 'zoomIn' },
        // { role: 'zoomOut' },
        // { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // { role: 'windowMenu' }
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
    // {
    //   role: 'help',
    //   submenu: [
    //     {
    //       label: 'Learn More',
    //       click: async () => {
    //         const { shell } = require('electron')
    //         await shell.openExternal('https://electronjs.org')
    //       }
    //     }
    //   ]
    // }
  ]
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

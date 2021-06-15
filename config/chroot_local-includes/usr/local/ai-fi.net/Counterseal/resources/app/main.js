// Modules to control application life and create native browser window
const {app, BrowserWindow, ipcMain} = require('electron');

const path = require('path')
const { exec, execFile, execFileSync, spawn } = require('child_process');
const dns = require('dns');
const os = require('os');
const service_base_url = 'http://127.0.0.1:8000';
var appContext = {
  serviceProcess: null,
  launchWindow: null,
  mainWindow: null,
  needEraseVault: true,
  isLiveSystem: true,
};

function createLaunchWindow () {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    center: true,
    icon: path.join(__dirname, '1024-1024.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,        
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  win.loadFile('index.html');
  appContext.launchWindow = win;
  // mainWindow.setMenu(null);
  // Menu.setApplicationMenu(null);
  // mainWindow.loadURL('https://www.baidu.com')
  // Open the DevTools.
  // win.webContents.openDevTools()
}

function createMainWindow () {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    icon: path.join(__dirname, '1024-1024.png'),
    center: true
  })

  // and load the index.html of the app.
  win.loadURL(service_base_url);
  appContext.mainWindow = win;
  win.setMenu(null);
  win.webContents.on('did-fail-load', function (event, code, desc, url, isMainFrame) {
    let needReload =  (isMainFrame && (url == service_base_url || (url == (service_base_url + '/')) || (url.match("\.html$")=='html')));
    // downloading a file will emit this event and log this to the console
    console.log('DID FAIL LOAD: ', isMainFrame, code, desc, url);

    // and then this will cause Electron to crash
    if (needReload) {
      setTimeout(() => {
        win.loadURL(service_base_url);
      }, 1000);
    }
  });

  /*
  win.on('close', function(e){
    if(appContext.needEraseVault){
        e.preventDefault();
        win.hide();
        eraseVaultData(() => {
          appContext.needEraseVault = false;
          win.close();
        });
    }
  });
  */
  // mainWindow.setMenu(null);
  // Menu.setApplicationMenu(null);
  // mainWindow.loadURL('https://www.baidu.com')
  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.

const { net } = require('electron');

getVaultStatus = function(cb) {

  var request = net.request({url: "http://127.0.0.1:8000/api/vault/status", method: 'GET'});
  request.on('response', (response) => {

    var data = '';
    response.on("data", (chunk) => {
      data += chunk.toString();
    });
    response.on('end', ()=> {
      console.log('data', data);
      try {
        var result = JSON.parse(data);
        cb({code: 0, msg: 'success', data: result});
      } catch(e) {
        cb({code: 10000, msg: 'Bad response'});
      }
    });
    response.on('error', (e) => {
      console.log('error', error);
    });
    response.on('aborted', () => {
      console.log('aborted');
    });
  });

  request.on('error', (e) => {
    console.log('error', e);
    cb({code: 10001, msg: 'Bad request'});
  });
  request.on('abort', () => {
    console.log('aborted');
    cb({code: 10001, msg: 'Request aborted'});
  });
  request.end();

}
eraseVaultData = function(cb) {

  var request = net.request({url: "http://127.0.0.1:8000/api/vault/erase", method: 'DELETE'});
  request.on('response', (response) => {
    var data = '';
    response.on("data", (chunk) => {
      data += chunk.toString();
    });
    response.on('end', ()=> {
      console.log('data', data);
      cb();
    });
    response.on('error', (e) => {
      console.log('error', e);
    });
    response.on('aborted', () => {
      console.log('aborted');
    });
  });

  request.on('error', (e) => {
    console.log('error', e);
    cb();
  });
  request.on('abort', () => {
    console.log('aborted');
    cb();
  });
  request.end();
};

app.whenReady().then(() => {
// app.on('ready', () => {

  // makeSingleInstance
  let success = app.requestSingleInstanceLock();
  if (!success) app.quit(0);

  createLaunchWindow();
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createLaunchWindow()
  });
});
app.on('before-quit',()=> {
  console.log('app before-quit');
  if (appContext.serviceProcess == null) {
    return;
  }
  if (appContext.vaultStatus == null) { 
      appContext.serviceProcess.kill();
      return;
  }

  if (appContext.vaultStatus.is_ready && appContext.vaultStatus.if_need_clean_cache) {
    eraseVaultData(() => {
      appContext.serviceProcess.kill();
    });
  } else {
    appContext.serviceProcess.kill();
  }
});
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (appContext.serviceProcess != null) {
    getVaultStatus((result) => {
      if (result.code != 0) {
        let success = appContext.serviceProcess.kill();
        // let success = appContext.serviceProcess.kill(9);
        console.log('kill service:', success);
	appContext.serviceProcess = null;
        // if (process.platform !== 'darwin') app.quit();
	app.quit();
      } else {
        if (result.data.is_ready && result.data.if_need_clean_cache) {
          eraseVaultData(() => {
            let success = appContext.serviceProcess.kill();
            // let success = appContext.serviceProcess.kill(9);
            console.log('kill service:', success);
	    appContext.serviceProcess = null;
            // if (process.platform !== 'darwin') app.quit();
	    app.quit();
          });
        } else {
          let success = appContext.serviceProcess.kill();
          // let success = appContext.serviceProcess.kill(9);
          console.log('kill service:', success);
          appContext.serviceProcess = null;
          // if (process.platform !== 'darwin') app.quit();
	  app.quit();
        }
      }
    });
  } else {
    // if (process.platform !== 'darwin') app.quit();
    app.quit();
  }
});

launchCountersealService = (cmd, cwd, tryTimes, cb) => {
  try {
    appContext.serviceProcess = execFile(cmd, {cwd: cwd, env: {RUST_BACKTRACE:1}}, (error, stdout, stderr) => {
      console.log('exited')
      appContext.serviceProcess = null;
    });
    /*
    appContext.serviceProcess = spawn(cmd, {cwd: cwd}, (error, stdout, stderr) => {
      console.log('exited')
      appContext.serviceProcess = null;
    });
    */
    cb({code: 0, msg: 'success', data: null});
  } catch (e) {
    if( tryTimes == 10) {
      cb({code: 0, msg: 'Could not launch counterseald', data: e});
      return;
    }
    setTimeout(()=>{
      launchCountersealService(cmd, cwd, ++tryTimes, cb);
    }, 1000);
  }
};

function interfaceIsReady(iface) {
  var ifaces = os.networkInterfaces();
  var returnVal;
  Object.keys(ifaces).forEach(function(dev) {
    // If the user does not specify anything, last value will be returned.
    if (iface && dev !== iface) {
      return;
    }
    for (var i = 0, len = ifaces[dev].length; i < len; i++) {
      var details = ifaces[dev][i];
      if (details.family === 'IPv4') {
        returnVal = details.address;
      }
    }
  });
  if (!returnVal) {
    return false;
  }
  return returnVal.length > 0;
};

function checkLanAndWLan(cb) {
   if (interfaceIsReady('wlan0')) {
       cb(true);
       return;
   }
   if (interfaceIsReady('eth0')) {
       cb(true);
       return;
   }

  setTimeout(() => {
    checkLanAndWLan(cb)
  }, 1000);
}

function doCheckInternetConnection(cb) {
    dns.resolve('www.apple.com', function(err, addr){
        if (err) {
          setTimeout(() => {
            doCheckInternetConnection(cb)
          }, 1000);
        } else {
          cb(true);
        }
    });
}

function checkInternetConnection(cb) {
  // doCheckInternetConnection(cb);
	if (appContext.isLiveSystem) {
		checkLanAndWLan(function(isReady) {
		  	if (isReady) {
				doCheckInternetConnection(cb);
			} else {
				cb(false);
			}
		});
	} else {
		doCheckInternetConnection(cb);
	}
}
// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
ipcMain.on('network-is-ready', (evt, args) => {

  checkInternetConnection((isReady) => {
    const cwd = path.join(__dirname, 'service')
    const cmd = path.join(cwd, process.platform == 'win32' ? 'counterseal_svc.exe' : 'counterseald')
    console.log('main-process: ', 'IPC', 'network-is-ready', cmd);
    //exec()
  
    //exec()
    if(appContext.serviceProcess != null) {
      // console.log('main-process: ', 'IPC', 'network-is-ready', appContext.serviceProcess.pid);
      evt.reply('service-is-launched', []);
      return;
    }
  
    launchCountersealService(cmd, cwd, 1, (result) => {
      console.log('did launch counterseald');
      evt.reply('service-is-launched', result);
    });
  });
  //console.log('main-process: ', 'IPC', 'network-is-ready', appContext.serviceProcess.pid);
});


ipcMain.on('show-main-window', (evt, args) => {
  createMainWindow();
  //console.log('main-process: ', 'IPC', 'network-is-ready', appContext.serviceProcess.pid);
  evt.reply('main-window-is-shown', []);
});

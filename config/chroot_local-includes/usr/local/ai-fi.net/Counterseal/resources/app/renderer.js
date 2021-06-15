// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

const ipcRenderer = require('electron').ipcRenderer;
const remote = require('electron').remote;
const isLiveSystem = true;
const updateStatus = (status, text) => {
    var elt = document.getElementById('status-label');
    if (status == 'success') {
        elt.style.color = '#fff';
    } else if (status == 'warning') {
        elt.style.color = 'orange';
    } else {
        elt.style.color = '#f00';
    }
    elt.innerHTML = text;
}

const networkStatusChanged = () => {
    console.log('navigator.onLine', navigator.onLine);
    if(navigator.onLine) {
        //updateStatus('success', 'Launching Counterseal Service...');
        if (isLiveSystem) {
			updateStatus('warning', 'Network is unreachable. Open the command drop-down menu on the upper right to check Wi-Fi status. <br /><br /> Wait for the "Tor is ready" notification before accessing the Ai-Fi Counterseal Secondary Signer app.');
		} else {
			// updateStatus('success', 'Launching Counterseal Service...');
			updateStatus('warning', 'Checking network connectivity...');
            // updateStatus('success', 'Network is unreachable. Open the command drop-down menu on the upper right to check Wi-Fi status.');
        }
        ipcRenderer.send('network-is-ready', []);
    } else {
        if (isLiveSystem) {
            updateStatus('warning', 'Network is unreachable. Open the command drop-down menu on the upper right to check Wi-Fi status. <br /><br /> Wait for the "Tor is ready" notification before accessing the Ai-Fi Counterseal Secondary Signer app.');
		} else {
            updateStatus('warning', 'Network is unreachable. Please check Wi-Fi status.');
        }
    }
}

window.addEventListener('online', networkStatusChanged)
window.addEventListener('offline', networkStatusChanged)

setTimeout(networkStatusChanged, 2000);

function pingService(cb) {
    var request = new XMLHttpRequest();
    request.open('get', 'http://127.0.0.1:8000/api/json_ping');
    request.onreadystatechange = function() {
        console.log('ping request onreadystatechange', this.readyState);

        if (this.readyState === 0) { // Unsent

        } else if (this.readyState === 1) { // Opened

        } else if (this.readyState === 2) { // Headers received

        } else if (this.readyState === 3) { // loading

        } else if (this.readyState === 4) { // Done
            if(this.status === 200) {
                try {
                    var result = JSON.parse(this.responseText)
                    cb(result);
                } catch (e) {
                    cb({code: 10001, msg: e.message, data: e});
                };
            } else {
                cb({code: this.status, msg: 'http error', data: this});
            }
        } 
    };
    request.send();
}

function waitForServiceReady(cb) {

	setTimeout(() => {
		pingService((result) => {
			if (result.code == 0) {
				cb(true);
			} else {
				waitForServiceReady(cb);
			}
		});
	}, 1000);

}

function showMainWindow() {
    ipcRenderer.send('show-main-window', []);
}

ipcRenderer.on('service-is-launched', (event, arg) => {
    console.log('service-is-launched');
    waitForServiceReady((success) => {
        remote.getCurrentWindow().hide();
        showMainWindow();
    })
    /*
    setTimeout(()=> {
        // remote.getCurrentWindow().loadURL('http://127.0.0.1:8000');
        
    }, 2000);
    */
});
ipcRenderer.on('main-window-is-shown', (event, arg) => {
    console.log('main-window-is-shown');
    remote.getCurrentWindow().close();
});
// const alertOnlineStatus = () => { window.alert(navigator.onLine ? 'online' : 'offline') }

// window.addEventListener('online', alertOnlineStatus)
// window.addEventListener('offline', alertOnlineStatus)

// alertOnlineStatus()

let ec_not_json = -20001;
var g_vaultStatus = null;
var g_ignore_reset = false;

$ = function(attr) {
    var elts = null;
    if (attr.indexOf('.') == 0) {
        elts = document.getElementsByClassName(attr.substring(1));
    } else if (attr.indexOf('#') == 0) {
        let elt = document.getElementById(attr.substring(1)); 
        elts = (elt == null) ? null : [elt];
    } else { 
        elts = document.getElementsByName(attr); 
    }
    return (elts == null || elts.length == 0) ? null : elts[0];
}

ajax = function(url, method, data, cb) {
    method = method ? method.toUpperCase() : 'GET';

    var request = new XMLHttpRequest();
    
    request.open(method, url);
    request.onreadystatechange = function() {
        if (this.readyState === 0) { // Unsent

        } else if (this.readyState === 1) { // Opened

        } else if (this.readyState === 2) { // Headers received

        } else if (this.readyState === 3) { // loading

        } else if (this.readyState === 4) { // Done
            if(this.status === 200) {
                try {
                    var result = JSON.parse(this.responseText)
                    cb(result, {code: 0, msg: "success"});
                } catch (e) {
                    cb(null, {code: ec_not_json, msg: e.message});
                };
            } else {
                cb(null, {code: this.status, msg: 'http error'})
            }
        } 
    };

    if (method == 'POST') {
        request.setRequestHeader("Content-Type", "application/json");
        request.send(JSON.stringify(data));
    } else {
        request.send();
    }
}

function ping(cb) {
    ajax('/api/ping', 'get', null, function(data, error) {
        if (error == null) {
            cb(null);
            return;
        }
        if (error != null && error.code == ec_not_json) {
            cb(null);
            return;
        }

        cb(error || {code: -1, msg: "unknown"})
    });

}

function getVaultStatus(cb) {
    ajax('/api/vault/status', 'get', null, function(data, error) {
        cb(data, error || {code: -1, msg: "unknown"})
    });
}

function cacheWallet(on, cb) {
    ajax('/api/wallet/clear_cache/' + on, 'get', null, function(data, error) {
        cb(data, error || {code: -1, msg: "unknown"})
    });
}

function getPairingInfo(cb, refresh) {
    ajax('/api/vault/pairing_info/' + (refresh ? refresh : 'false'), 'get', null, function(data, error) {
        cb(data, error || {code: -1, msg: "unknown"})
    });
}
function getDefaultWallet(cb) {
    ajax('/api/wallet/default', 'get', null, function(data, error) {
        cb(data, error || {code: -1, msg: "unknown"})
    });
}

function doCheckStatus() {
    getVaultStatus(function(status, error) {
        if (error.code != 0 || status == null) {
            $('#page-loader').style.display = 'none';
            return;
        }
        g_vaultStatus = status;

        var label = "Cache Key Materials";
        if (!g_vaultStatus.if_need_clean_cache) {
            label = 'Don\'t ' + label;
        }
        $('#save-cache-btn').innerHTML = label;

        if (status.is_ready) {
            if (status.if_need_backup) {
                showBackupConfirmWindow();
            } else {
                get_pair_status(result => {
                    console.log('get_pair_status: ', result);
                    if (result.code == 0 && result.data) {
                        $('.pairing').style.display = 'none';
                        routeToSigning();
                    } else {
                        $('.signing').style.display = 'none';
                        routeToPairing();
                    }
                });
            }
        } else {
            checkStatus(5);
        }
    });
}

function checkStatus(sec) {
    setTimeout(doCheckStatus, 1000 * sec);
}

function routeToPairing(refresh) {

    getPairingInfo(function(pairingInfo, error) {
        $('#page-loader').style.display = 'none';
        if (error.code != 0 || pairingInfo == null) {
            return
        }
        $(".qrcode").innerHTML = '';
        let connstr = JSON.stringify(pairingInfo);
        var qrcode = new QRCode($(".qrcode"), {
            width : 200,
            height : 200
        });
        qrcode.clear();
        qrcode.makeCode(connstr);
        $('.pairing').style.display = 'inline';
    }, refresh);

    checkStatus(5);
}

function routeToSigning() {
    getDefaultWallet(function(data, error) {

        $('#page-loader').style.display = 'none';
        if (error.code != 0 || data == null) {
            return
        }
        $('.card-front-footer').innerHTML = data[1] + '<br />' + data[2];
        $('.signing').style.display = 'inline';
    })

}

var change_color_timer = null;
function show_tx(data) {

    $('#confirm-tx-win-btn-cancel').innerHTML = 'Cancel';
    // $('#confirm-tx-win-btn-open').style.display = 'none';
    $('#confirm-tx-win-btn-confirm').innerHTML = 'Confirm';
    console.log(data);

    var txEventObj = typeof data === 'object' ? data : JSON.parse(data);

    var txObj = JSON.parse(txEventObj.tx);
    window.unsginedTx = {tx: txObj, uuid: txEventObj.uuid, token: txEventObj.token, status: txEventObj.status};
    var txDiv = $('#tx-div');
    var tableHtml = '<table id="tx-table" class="tx-table">\
                    <tr>\
                        <th colspan="2">TX</th>\
                    </tr>\
                    <tr>\
                        <td>HASH</td><td>'+ txObj.txid + '</td>\
                    <tr/>\
                    <tr>\
                        <td>Fee</td><td>' + txObj.fee + ' satoshi</td>\
                    </tr>\
                    <tr>\
                        <td>Memo</td><td>' + txObj.memo + '</td>\
                    </tr>\
                    <tr>\
                        <th colspan="2">Input(s)</th>\
                    </tr>';

    for(var i=0; i<txObj.inputs.length; i++) {
        var input = txObj.inputs[i];
        var floatValue = (input.value / 100000000.0);
        tableHtml += '<tr>\
                        <td>#' + i + '</td>\
                        <td>' +  floatValue + ' BTC<br />' + input.address + '</td>\
                    </tr>';
    }

    tableHtml += '<tr>\
                    <th colspan="2">Output(s)</th>\
                </tr>';

    for(var i=0; i<txObj.outputs.length; i++) {
        var output = txObj.outputs[i];
        var floatValue = (output.value / 100000000.0);
        tableHtml += '<tr>\
                        <td>#' + i + '</td>\
                        <td>' + floatValue + ' BTC<br />' + output.address + '</td>\
                    </tr>';
    }

    tableHtml += '</table>';
    txDiv.innerHTML = tableHtml;
    $('#confirm-tx-win').style.display = 'inline-block';
    $('#mask-layer').style.display = 'inline-block';

    if (change_color_timer != null) {
        clearInterval(change_color_timer);
        change_color_timer = null;
   }

   var header = $('.confirm-tx-win-header');
   header.innerText = 'A Transaction Need to Be Signed';
   header.style.backgroundColor = '#00aaff';
   /*
   change_color_timer = setInterval(function() {
       var header = $('.confirm-tx-win-header');
       if (header.style.backgroundColor == 'orangered') {
           header.style.backgroundColor = '#00aaff';
       } else {
           header.style.backgroundColor = 'orangered';
       }
   }, 500);
   */
}

function show_pair(pairInfo, status) {

    console.log(pairInfo);



    var reason = 'unknown';
    if (pairInfo.opcode == 0) {
        reason = 'Creating new vault';
    } else if (pairInfo.opcode == 1) {
        reason = 'Work from a prior vault';
    } else if (pairInfo.opcode == 2) {
        reason = 'IP was Changed';
    }

    var txDiv = $('#tx-div');
    var tableHtml = '<table id="tx-table" class="tx-table">\
                    <tr>\
                        <td>From</td><td>' + pairInfo.ip + '</td>\
                    </tr>\
                    <tr>\
                        <td>Session ID</td><td>' + pairInfo.fingerprint + ' (Must match that on Primary)</td>\
                    </tr>\
                    <tr>\
                        <td>Request</td><td>'+ reason + '</td>\
                    <tr/>';

    if (pairInfo.opcode == 0) { // create new vault

        $('#confirm-tx-win-btn-cancel').innerHTML = 'Reject';
        if (status.is_ready) {
            tableHtml += '<tr>\
                            <td colspan="2" style="color:red;">To accept, you must discard the current vault and reset for a new one.</td>\
                        <tr/>';

            $('#confirm-tx-win-btn-confirm').innerHTML = 'Accept & Reset';
        } else {

            tableHtml += '<tr>\
                            <td colspan="2" style="color:red;">Select "Accept" to start the key generation session for a new vault.</td>\
                        <tr/>';
            $('#confirm-tx-win-btn-confirm').innerHTML = 'Accept';
        }
    } else if (pairInfo.opcode == 1 || pairInfo.opcode == 2) {// open vault
        
        tableHtml += '<tr>\
                        <td colspan="2" style="color:red;">Select "Accept" to work with a prior vault.</td>\
                    <tr/>';

        $('#confirm-tx-win-btn-cancel').innerHTML = 'Reject';
        $('#confirm-tx-win-btn-confirm').innerHTML = 'Accept';
    }
    tableHtml += '</table>';

    txDiv.innerHTML = tableHtml;
    $('#confirm-tx-win').style.display = 'inline-block';
    $('#mask-layer').style.display = 'inline-block';

    if (change_color_timer != null) {
        clearInterval(change_color_timer);
        change_color_timer = null;
   }

   var header = $('.confirm-tx-win-header');
   header.innerText = 'Please Answer the Pairing Request from Primary';
   header.style.backgroundColor = '#00aaff';
//    change_color_timer = setInterval(function() {
//        if (header.style.backgroundColor == 'orangered') {
//            header.style.backgroundColor = '#00aaff';
//        } else {
//            header.style.backgroundColor = 'orangered';
//        }
//    }, 500);
}

function confirm_pair(pairInfo, cb) {
    ajax('/api/pair/confirm', 'post', pairInfo, function(data, error) {
        if (error == null) {
            cb(null);
            return;
        }
        if (error != null && error.code == ec_not_json) {
            cb(null);
            return;
        }
        cb(error || {code: -1, msg: "unknown"})
    });
}

function get_pair_status(cb) {
    ajax('/api/pair/is_paired', 'get', null, function(data, error) {
        if (error == null) {
            cb(data);
            return;
        }
        if (error != null && error.code == ec_not_json) {
            cb({code: -1, msg: "no permisson", data: false});
            return;
        }
        if (data) {
            cb(data);
            return;
        } 
        cb(error || {code: -1, msg: "unknown", data: false})
    });
}

function confirm_tx(uuid, token, cb) {
    ajax('/api/ecdsa/confirm_tx/' + uuid + '/' + token, 'get', null, function(data, error) {
        if (error == null) {
            cb(null);
            return;
        }
        if (error != null && error.code == ec_not_json) {
            cb(null);
            return;
        }

        cb(error || {code: -1, msg: "unknown"})
    });
}
function send_tx() {
    var msg = {
        uuid: '484b062b-6017-4ada-ac63-c9c963bd8aa7',
        tx:  '{"id":"710c0ad912aa534986b5cdba00562dfab3a32bf35f979884b0d79e1f8f9868b5","fee":164,"memo":"","inputs":[{"address":"2N59rBQQ5mdMB49RJdLbBMX2gCCNXHuhd24","value":0.04999336}],"outputs":[{"address":"tb1q40jg52gpwsmyqaghetsmj2s3jmqyq33v8j75md","value":0.03999172},{"address":"tb1q9ufzt4psvv0z5p8g9y052wfu94urq86dst9l4v","value":0.01}]}'
    };
    ajax('/api/ecdsa/send_tx', 'post', msg, function(data, error) {
        if(!error) {
            error = {code: -1, msg: "unknown"};
        }
        console.log('sent: ', msg, 'data: ', data, 'error: ', error);
    });
}

function handlePairingRequest(pairInfo) {

    getVaultStatus((status) => {

        show_pair(pairInfo, status);

        /*
        if (pairInfo.opcode == 0) {// create new
            if (status.is_ready) {
                showEraseConfirmWindow('Secondary has been initialized', 'Primary request to create new vault, please reset the secondary.');
            } else {
                show_pair(pairInfo, status);
            }
        } else if (pairInfo.opcode == 1 || pairInfo.opcode == 2) { // open exiting, re-pair
            if (status.is_ready) {
                show_pair(pairInfo, status);
            } else {
                showRecoverConfirmWindow();
            }
        }
        */
    });
}
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
}
var client_id = uuidv4();
function listen_tx() {

    var ws = new WebSocket("ws://127.0.0.1:8001/ws"); //创建WebSocket连接
    ws.onopen = function(){
    　　//当WebSocket创建成功时，触发onopen事件
        console.log("open");
        ws.send("{\"cmd\": \"HELO\", \"data\": \"" + client_id + "\"}");
        // setInterval(()=> {
        //     ws.send("{\"cmd\": \"HELO\"}");

        // }, 10000);

        var unconfirmedPairInfoString = sessionStorage.getItem("unconfirmedPairInfo");
        if (unconfirmedPairInfoString && unconfirmedPairInfoString.length > 0) {
            var pairInfo = JSON.parse(unconfirmedPairInfoString);
            if (pairInfo) {
                window.unconfirmedPairInfo = pairInfo;
                // handlePairingRequest(pairInfo);

                // var pairInfo = window.unconfirmedPairInfo;
                pairInfo.status = 1;
                console.log(pairInfo);
                confirm_pair(window.unconfirmedPairInfo, function(result) {
                    console.log('confirmed:', result);
                    did_confirm_pair(window.unconfirmedPairInfo);
                });
            }
        }
    }
    ws.onmessage = function(e){
    　　//当客户端收到服务端发来的消息时，触发onmessage事件，参数e.data包含server传递过来的数据
        console.log(e.data);
        let msg = JSON.parse(e.data);

        if(msg.cmd == 'HELO') {
            if (msg.data == client_id) {
                console.log('Hello From Me');
                setTimeout(()=> {
                    // ws.send("{\"cmd\": \"HELO\"}");
                    ws.send("{\"cmd\": \"PING\"}");
                }, 10000);
            } else {
                console.log('Hello From New Tab');
                g_ignore_reset = true;
                window.location.href = "expired.html";
            }
        } else if(msg.cmd == 'PING') {
            setTimeout(()=> {
                // ws.send("{\"cmd\": \"HELO\"}");
                ws.send("{\"cmd\": \"PING\"}");
            }, 10000);
        } else if(msg.cmd == 'SIGN_TX') {
            show_tx(msg.data);
        } else if(msg.cmd == 'PARING') {

            var pairInfo = typeof msg.data === 'object' ? msg.data : JSON.parse(msg.data);
            if (pairInfo) {
                window.unconfirmedPairInfo = pairInfo;
                handlePairingRequest(pairInfo);
            }
        }
    }
    ws.onclose = function(e){
    　　//当客户端收到服务端发送的关闭连接请求时，触发onclose事件
    　　console.log("ws closed");
        setTimeout(() => {
            listen_tx();
        }, 1000);
    }
    ws.onerror = function(e){
    　　//如果出现连接、处理、接收、发送数据失败的时候触发onerror事件
    　　console.log("wss error: ", e);
    }
}

function inactivityTime() {
	let time;
	document.onmousemove = resetTimer;
	document.onkeypress = resetTimer;
    document.onmouseup = function() {
        $('.menu-container').style.display = 'none';
    }
	// document.onmousedown = function() {
	// 	$('.menu-container').style.display = 'none';
	// }
	function logout() {
        getVaultStatus(function(status, error) {
            sessionStorage.removeItem("unconfirmedPairInfo");
            if (error.code != 0 || status == null) {
                window.location.href = "index.html";
                return;
            }
            g_vaultStatus = status;
            if (g_vaultStatus && g_vaultStatus.is_ready && g_vaultStatus.if_need_clean_cache) {
                doEraseAllData((result) => {
                    g_ignore_reset = false;
                    window.location.href = "index.html";
                });
            } else {
                resetTimer();
            }
        });
	}
	function resetTimer() {
		clearTimeout(time);
		time = setTimeout(logout, 600000);
	}
	resetTimer();
};

window.onload = function() {

	inactivityTime();

    let search = window.location.search;
    if (search != null && search.length > 0) {
        let urlParams = new URLSearchParams(search);
        let resetParam = (urlParams.get('reset') || 'false').toLowerCase();
        if (resetParam == 'true') {
            showEraseConfirmWindow('Warning', 'Are you sure to reset the Secondary? Once reset, unsaved vault data may be deleted from current session.');
            return;
        }
    }

    //$('#page-loader').style.display = 'none';
    ping(function(error){
        if (error != null) {
            $('#page-loader').style.display = 'none';
            return;
        }

        getVaultStatus(function(status, error) {
            if (error.code != 0 || status == null) {
                $('#page-loader').style.display = 'none';
                return;
            }
            g_vaultStatus = status;

            var label = "Cache Key Materials";
            if (!g_vaultStatus.if_need_clean_cache) {
                label = 'Don\'t ' + label;
            }
            $('#save-cache-btn').innerHTML = label;

            if (status.is_ready) {
                if (status.if_need_backup) {
                    showBackupConfirmWindow();
                } else {
                    // routeToSigning();
                    get_pair_status(result => {
                        if (result.code == 0 && result.data) {
                            routeToSigning();
                        } else {
                            routeToPairing();
                        }
                    });
                }
            } else {
                routeToPairing();
                // routeToSplash();
            }
        });
    });
    listen_tx();
    // var tx = '{"id":"710c0ad912aa534986b5cdba00562dfab3a32bf35f979884b0d79e1f8f9868b5","fee":164,"memo":"","inputs":[{"address":"2N59rBQQ5mdMB49RJdLbBMX2gCCNXHuhd24","value":0.04999336}],"outputs":[{"address":"tb1q40jg52gpwsmyqaghetsmj2s3jmqyq33v8j75md","value":0.03999172},{"address":"tb1q9ufzt4psvv0z5p8g9y052wfu94urq86dst9l4v","value":0.01}]}';
    // show_tx(tx);
    /*
    var qrcode = new QRCode($(".qrcode"), {
        width : 200,
        height : 200
    });
    qrcode.clear();
	qrcode.makeCode('{"server": "http://192.168.255.255:8100", "authType": "none"}');
    setTimeout(function() {
        $('#page-loader').style.display = 'none';
        $('.signing').style.display = 'inline';
    }, 500);
    */
}

function did_confirm_pair(pairInfo) {
    // 0 create new vault, 1 open vault, 2 retry
    /*
    getVaultStatus(function(status, error) {
        if (error.code != 0 || status == null) {
            $('#page-loader').style.display = 'none';
            return;
        }
        g_vaultStatus = status;


        if (pairInfo.opcode == 0) {

        } else if (pairInfo.opcode == 1) {

        } else if (pairInfo.opcode == 2) {

        }
    });
    */
    if (pairInfo.opcode == 0) { // create
        $('.signing').style.display = 'none';
        // routeToPairing();
        getVaultStatus(function(status, error) {
            window.unconfirmedPairInfo = null;
            delete window.unconfirmedPairInfo;
            sessionStorage.removeItem("unconfirmedPairInfo");


            if (error.code != 0 || status == null) {
                $('#page-loader').style.display = 'none';
                return;
            }
            g_vaultStatus = status;

            var label = "Cache Key Materials";
            if (!g_vaultStatus.if_need_clean_cache) {
                label = 'Don\'t ' + label;
            }
            $('#save-cache-btn').innerHTML = label;

            if (status.is_ready) {
                showEraseConfirmWindow('Secondary has been initialized', 'Primary request to create new vault, please reset the secondary and try again later.');

                // if (status.if_need_backup) {
                //     showBackupConfirmWindow();
                // } else {
                //     $('.pairing').style.display = 'none';
                //     routeToSigning();
                // }
            } else {
                routeToPairing();
            }
        });
    } else if (pairInfo.opcode == 1) { // open
        getVaultStatus(function(status, error) {
            window.unconfirmedPairInfo = null;
            delete window.unconfirmedPairInfo;
            sessionStorage.removeItem("unconfirmedPairInfo");


            if (error.code != 0 || status == null) {
                $('#page-loader').style.display = 'none';
                return;
            }
            g_vaultStatus = status;
            $('.pairing').style.display = 'none';
            if (status.is_ready) {
                routeToSigning();
                // showEraseConfirmWindow('Secondary has been initialized', 'Primary request to create new vault, please reset the secondary and try again later.');
            } else {
                showRecoverConfirmWindow();
            }
        });
    } else if (pairInfo.opcode == 2) { // retry

        getVaultStatus(function(status, error) {
            window.unconfirmedPairInfo = null;
            delete window.unconfirmedPairInfo;
            sessionStorage.removeItem("unconfirmedPairInfo");

            if (error.code != 0 || status == null) {
                $('#page-loader').style.display = 'none';
                return;
            }
            g_vaultStatus = status;
            $('.pairing').style.display = 'none';
            if (status.is_ready) {
                routeToSigning();
            } else {
                // showRecovery();
                showRecoverConfirmWindow();
                // routeToSigning();
            }
        });
    }
}

function onConfirmTx() {

    if (window.unconfirmedPairInfo) {
        var pairInfo = window.unconfirmedPairInfo;
        pairInfo.status = 1;
        console.log(pairInfo);

        getVaultStatus(function(status, error) {
            $('#confirm-tx-win').style.display = 'none';
            $('#mask-layer').style.display = 'none';
            if (error.code != 0) {
                return;
            }

            if (pairInfo.opcode == 0) {
                if (status.is_ready) {
                    confirmEraseAllData(true);
                    // showEraseConfirmWindow('Secondary has been initialized', 'Primary request to create new vault, please reset the secondary and try again later.');
                } else {
                    confirm_pair(window.unconfirmedPairInfo, function(result) {
                        console.log('confirmed:', result);
                        // delete window.unconfirmedPairInfo;
                        did_confirm_pair(window.unconfirmedPairInfo);
                    });
                }

            } else if (pairInfo.opcode == 1 || pairInfo.opcode == 2) {
                if (status.is_ready) {
                    confirm_pair(window.unconfirmedPairInfo, function(result) {
                        console.log('confirmed:', result);
                        // delete window.unconfirmedPairInfo;
                        did_confirm_pair(window.unconfirmedPairInfo);
                    });
                } else {
                    showRecoverConfirmWindow();
                }
            }
        });

        // confirm_pair(window.unconfirmedPairInfo, function(result) {
        //     console.log('confirmed:', result);
        //     // delete window.unconfirmedPairInfo;
        //     did_confirm_pair(window.unconfirmedPairInfo);
        // });
        // $('#confirm-tx-win').style.display = 'none';
        // $('#mask-layer').style.display = 'none';
        return;
    }
    console.log(window.unsginedTx);
    confirm_tx(window.unsginedTx.uuid, window.unsginedTx.token, function(result) {
        console.log('confirmed:', result);
        // delete window.unsginedTx;
        window.unsginedTx = null;
        delete window.unsginedTx;
    });
    $('.confirm-tx-win-header').style.backgroundColor = '#00aaff';
    $('#confirm-tx-win').style.display = 'none';
    $('#mask-layer').style.display = 'none';
}

function onCancelTx() {
    console.log(window.unsginedTx);

    $('.confirm-tx-win-header').style.backgroundColor = '#00aaff';
    if (change_color_timer != null) {
        clearInterval(change_color_timer);
        change_color_timer = null;
    }

    if (window.unconfirmedPairInfo) {
        var pairInfo = window.unconfirmedPairInfo;
        pairInfo.status = 2;
        console.log(pairInfo);
        confirm_pair(window.unconfirmedPairInfo, function(result) {
            console.log('confirmed:', result);
            window.unconfirmedPairInfo = null;
            delete window.unconfirmedPairInfo;
            sessionStorage.removeItem("unconfirmedPairInfo");
        });
        $('#confirm-tx-win').style.display = 'none';
        $('#mask-layer').style.display = 'none';
        return;
    }
    window.unsginedTx = null;
    $('#confirm-tx-win').style.display = 'none';
    $('#mask-layer').style.display = 'none';
}
function showParingQRCode() {
    $('.menu-container').style.display = 'none';
    $('.signing').style.display = 'none';

    $('#page-loader').style.display = 'inline';
    getPairingInfo(function(pairingInfo, error) {
        $('.pairing').style.display = 'inline';
        $('#page-loader').style.display = 'none';
        if (error.code != 0 || pairingInfo == null) {
            return
        }

        $(".qrcode").innerHTML = '';
        let connstr = JSON.stringify(pairingInfo);
        var qrcode = new QRCode($(".qrcode"), {
            width : 200,
            height : 200
        });
        qrcode.clear();
        qrcode.makeCode(connstr);
        $('.pairing').style.display = 'inline';
    });
}

function saveCache() {
    let need_clean_cache = !(g_vaultStatus && g_vaultStatus.if_need_clean_cache);
    cacheWallet(need_clean_cache ? "on" : "off", function(data, error) {
        console.log(data, error)
        toggleMore();
        if (error.code != 0) {

            return
        }
        g_vaultStatus.if_need_clean_cache = data.data;

        var label = "Cache Key Materials";
        if (!g_vaultStatus.if_need_clean_cache) {
            label = 'Don\'t ' + label;
        }
        $('#save-cache-btn').innerHTML = label;
    }) 
}

function showCards() {
    if (!g_vaultStatus || !g_vaultStatus.is_ready) {
        $('.menu-container').style.display = 'none';
        showShowVaultsWin();
        return
    }

    $('.menu-container').style.display = 'none';
    $('.signing').style.display = 'inline';
    $('.pairing').style.display = 'none';
}

function showBackupConfirmWindow() {
    $('#confirm-backup-win').style.display = 'inline-block';
    $('#mask-layer').style.display = 'inline-block';
}

function showRecoverConfirmWindow() {
    $('#confirm-recover-win').style.display = 'inline-block';
    $('#mask-layer').style.display = 'inline-block';
}

function showEraseConfirmWindow(title, content) {
    $('#confirm-erase-win').style.display = 'inline-block';
    if (title) {
        $('#confirm-erase-win-title').innerHTML = title;
    }
    if (content) {
        $('#confirm-erase-win-content').innerHTML = content;
    }
    $('#mask-layer').style.display = 'inline-block';



}
function showShowVaultsWin() {
    $('#vault-not-ready-win').style.display = 'inline-block';
    $('#mask-layer').style.display = 'inline-block';
}
function closeShowVaultsWin() {
    $('#vault-not-ready-win').style.display = 'none';
    $('#mask-layer').style.display = 'none';
}

function confirmShowBackup() {
    g_ignore_reset = true;
    $('#confirm-backup-win').style.display = 'none';
    $('#mask-layer').style.display = 'none';
    showBackup();
}

function confirmShowRecover() {
    $('#confirm-recover-win').style.display = 'none';
    $('#mask-layer').style.display = 'none';
    if (window.unconfirmedPairInfo) {
        sessionStorage.setItem("unconfirmedPairInfo", JSON.stringify(window.unconfirmedPairInfo));
    }
    showRecovery();
}

function confirmShowImport() {
    $('#confirm-recover-win').style.display = 'none';
    $('#mask-layer').style.display = 'none';
    if (window.unconfirmedPairInfo) {
        sessionStorage.setItem("unconfirmedPairInfo", JSON.stringify(window.unconfirmedPairInfo));
    }
    showImport();
}

function cancelRecoverProcess() {
    if (window.unconfirmedPairInfo) {
        var pairInfo = window.unconfirmedPairInfo;
        pairInfo.status = 2;
        console.log(pairInfo);
        confirm_pair(window.unconfirmedPairInfo, function(result) {
            console.log('confirmed:', result);
            window.unconfirmedPairInfo = null;
            delete window.unconfirmedPairInfo;
            sessionStorage.removeItem("unconfirmedPairInfo");

            // $('#confirm-erase-win').style.display = 'none';
            // $('#mask-layer').style.display = 'none';
            confirmEraseAllData(true);
        });
    } else {
        confirmEraseAllData(true);
    }
}

function confirmEraseAllData(confirmed) {
    g_ignore_reset = confirmed;
    $('#confirm-erase-win').style.display = 'none';
    $('#mask-layer').style.display = 'none';
    if (confirmed) {
        doEraseAllData(function(result) {
            // window.location.href = "index.html";

            var pairInfo = window.unconfirmedPairInfo;
            if (pairInfo) {
                pairInfo.status = 1;
                console.log(pairInfo);
                confirm_pair(window.unconfirmedPairInfo, function(result) {
                    console.log('confirmed:', result);
                    sessionStorage.removeItem("unconfirmedPairInfo");
                    window.location.href = "index.html";
                });
            } else {
                if (window.unconfirmedPairInfo) {
                    sessionStorage.setItem("unconfirmedPairInfo", JSON.stringify(window.unconfirmedPairInfo));
                }
                window.location.href = "index.html";
            }

        });
    }
}

function showBackup() {
    // $('.menu-container').style.display = 'none';
    // $('.pairing').style.display = 'none';
    // $('.signing').style.display = 'none';
    g_ignore_reset = true;
    window.location.href = 'token.html?action=backup';
    // window.open("token.html?action=backup", 'blank')
}

function showRecovery() {
    g_ignore_reset = true;
    window.location.href = 'token.html?action=restore';
}
function showImport() {
    g_ignore_reset = true;
    window.location.href = 'token.html?action=import';

}
function showExport() {
    g_ignore_reset = true;
    window.location.href = 'token.html?action=export';

}
function toggleMore() {
    let menu = $('.menu-container');
    if (menu.style.display === 'none' || menu.style.display.length == 0) {
        menu.style.display = 'inline';
    } else {
        menu.style.display = 'none'
    }
}

function doEraseAllData(cb) {

    ajax('/api/vault/erase', 'delete', null, function(data, error) {
        cb(data, error || {code: -1, msg: "unknown"})
    });
}
function eraseAllData() {
    toggleMore()
    showEraseConfirmWindow('Request to reset Secondary', 'Are you sure to reset the Secondary? Once reset, unsaved vault data may be deleted from current session.');
    // let res = confirm("Are you sure to erase all data?");
    // if (res == 1) {
    //     doEraseAllData(function(data, error) {
    //         window.location.href = "index.html";
    //     });
    // } else {
    //     toggleMore()
    // }
}


window.onbeforeunload = function(event) {
    /*
    var event = event || window.event;
    if (event) {
        event.returnValue = "Are you sure to leave Ai-Fi Counterseal? All user data will be erased.";
    }
    return "Are you sure to leave Ai-Fi Counterseal? All user data will be erased."
    */
   if (g_ignore_reset) {
       return;
   }
   sessionStorage.removeItem('unconfirmedPairInfo');
   if (g_vaultStatus && g_vaultStatus.if_need_clean_cache) {
       doEraseAllData(function(data, error) {
       });
    }
}
window.onunload = function(event) {

}

// var p1 = window.document;

// function f () {  //事件侦测函数
//     var event = event || window.event;  //标准化事件对象
//     is_confirm = event.type == 'mouseleave';
//     console.log(event.type, is_confirm);
// }
// p1.onmouseover = f;  //注册鼠标经过时事件处理函数
// p1.onmouseout = f;  //注册鼠标移开时事件处理函数
// p1.onmousedown = f;  //注册鼠标按下时事件处理函数
// p1.onmouseup = f;  //注册鼠标松开时事件处理函数
// p1.onmousemove = f;  //注册鼠标移动时事件处理函数
// p1.onclick = f;  //注册鼠标单击时事件处理函数
// p1.ondblclick = f


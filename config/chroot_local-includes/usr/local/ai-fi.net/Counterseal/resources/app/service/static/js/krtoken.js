// const { saveAs } = require("./filesaver");

//window.supercop = supercop_wasm ? supercop_wasm: null;
window.supercop = null;
window.scrypt = null;
window.SCRYPT_PARAMS = {
    N: Math.pow(2, 17),
    R: 8,
    P: 1,
    OutputLength: 32
};

function showNotify(level, title, message) {
  $.notify({
    title: title,
    message: message,
  },{
    element: 'body',
    type: level,
    placement: {
      from: "bottom",
      align: "left"
    },
    offset: {
      x: 0,
      y: 80
    }
  });
}

function showErrorNotifyWithTitle(title, message) {
  showNotify('danger', title, message);
}

function showWarningNotifyWithTitle(title, message) {
  showNotify('warning', title, message);
}

function showInfoNotifyWithTitle(title, message) {
  showNotify('info', title, message);
}


function showErrorNotify(message) {
  showNotify('danger', null, message);
}

function showWarningNotify(message) {
  showNotify('warning', null, message);
}

function showInfoNotify(message) {
  showNotify('info', null, message);
}

function showError(error) {
  showErrorNotify(error.msg);
}

var theOpendToken = [];
function itemOnMouseOver(item) {
  $(item).find('a:first').css({display: 'inline'})

}
function itemOnMouseOut(item) {
  $(item).find('a:first').css({display: 'none'})
}


function shareToString(share) {
  if (!share.encoding) {
    return share.value;
  }

  if (share.encoding.toLowerCase() == 'utf-8') {
    /*
    var bytes = base32.decode.asBytes(share.value);
    if (!bytes || bytes.length == 0)
      return share.value;
    var words = byteArrayToWordArray(bytes);
    return CryptoJS.enc.Utf8.stringify(words);
    */
    return share.value;
  }
  return share.value;
}

function showAlertDialog(title, msg) {
  $('#alertModalLabel').html(title);
  $('#alertModalBody').html(msg);
  $('#alertModal').modal('show');
}

function doRestoreFromToken() {
  if (restClient.getSalt() == defaultTokenTypePrefix) {
    showErrorNotify("Entropy Extender must not be empty.");
    $('#open-button').removeAttr('disabled');
    return;
  };
  if (!restClient.getPassphrase() || restClient.getPassphrase().length < 6) {
    showErrorNotify("Password must not be empty.");
    $('#open-button').removeAttr('disabled');
    return;
  }

  $('#open-indicator').css({display: 'inline-block'});
  var withoutDecrypt = g_action == 'export';
  restClient.getShares(function(result) {
    $('#open-button').removeAttr('disabled');
    console.log(result);
    $('#open-indicator').css({display: 'none'});
    if(result.code != 0) {
      if (result.code == -1) {
        showErrorNotify("Crypton not found. Please check your password and Entropy Extender.")
        return;
      }
      showError(result);
      return;
    }

    if (withoutDecrypt) {
      var tokenString = JSON.stringify(result);
      if (result.data && result.data.share && result.data.share.fileName && result.data.share.fileName.length > 0) {
        var file = new File([tokenString], result.data.share.fileName + ".krt", {type: "text/plain;charset=utf-8"});
        saveAs(file);

        showInfoNotify("Export succeeded. Back to main screen in 5 seconds.");
        setTimeout(function() {
          window.location.href='index.html'
        }, 5000);
      } else {
        showErrorNotify("Export failed. Invalid token");
      }

      return;
    }

    // gotoGuideScreen();
    restClient.restoreVaults(result.data, function(result) {
      if(result.code != 0) {
        if (result.code == -1) {
          showErrorNotify("Crypton does not exist.")
          return;
        }
        showError(result);
        return;
      }

      showInfoNotify("Restore succeeded. Back to main screen in 5 seconds.");
      setTimeout(function() {
        window.location.href='index.html'
      }, 5000);
    });
  }, withoutDecrypt);
}

function doImportFromToken() {

  if (restClient.getSalt() == defaultTokenTypePrefix) {
    showErrorNotify("Entropy Extender must not be empty.");
    $('#open-button').removeAttr('disabled');
    return;
  };
  if (!restClient.getPassphrase() || restClient.getPassphrase().length < 6) {
    showErrorNotify("Passphrase must not be empty.");
    $('#open-button').removeAttr('disabled');
    return;
  }

  $('#open-indicator').css({display: 'inline-block'});
  restClient.decryptShares(g_importedToken, function(result) {
    $('#open-button').removeAttr('disabled');
    console.log(result);

    if(result.code != 0) {
      $('#open-indicator').css({display: 'none'});
      if (result.code == -1) {
        showErrorNotify("Crypton not found. Please check your password and Entropy Extender.")
        return;
      }
      showError(result);
      return;
    }

    restClient.restoreVaults(result.data, function(result) {
      $('#open-indicator').css({display: 'none'});
      if(result.code != 0) {
        if (result.code == -1) {
          showErrorNotify("Crypton does not exist.")
          return;
        }
        showError(result);
        return;
      }

      showInfoNotify("Import succeeded. Back to main screen in 5 seconds.");
      setTimeout(function() {
        window.location.href='index.html'
      }, 5000);
    });
  });
}

function didSavedToken(result, fileName) {

  if (result.code == 0) {
    $('#confirmModalLabel').html('Key Materials has been saved');
    $('#confirmModalBody').html("Backup succeeded. Back to main screen in 5 seconds.");
    $('#confirmModal').modal('show');

    setTimeout(function() {
      window.location.href='index.html'
    }, 5000);

  } else {
    $('#open-button').removeAttr('disabled');
    $('#open-indicator').css({display: 'none'});
    if(result.code != 0) {
      showError(result);
      return;
    }
    showInfoNotify("Backup succeeded. Back to main screen in 5 seconds.");
    setTimeout(function() {
      window.location.href='index.html'
    }, 5000);
  }

}

function showConfirmOverwriteTokenWindow(result) {
  $('#overrideModal').modal('show')
}

function doBackupAsToken(override) {
  var override = override || false;

  if (restClient.getSalt() == defaultTokenTypePrefix) {
    showErrorNotify("Entropy Extender must not be empty.");
    $('#open-button').removeAttr('disabled');
    return;
  }
  if (!restClient.getPassphrase() || restClient.getPassphrase().length < 6) {
    showErrorNotify("Password too weak to protect. Please strengthen it.");
    $('#open-button').removeAttr('disabled');
    return;
  }

  $('#open-indicator').css({display: 'inline-block'});
  restClient.saveShare(g_vaults, function(result, fileName) {
    console.log(result);
    if (result.code == 15108) {
      showConfirmOverwriteTokenWindow(result);
    } else {
      didSavedToken(result, fileName);
    }

  }, override);
}


var backupOrRestoreWithTokenFn = function() {};
function scryptOnReady(scrypt) {
    window.scrypt = scrypt;
    backupOrRestoreWithTokenFn();
}

function supercopOnReady() {
  $('#page-load-indicator').css({display: 'none'});
}
var g_vaults = [];
var g_importedToken = null;
var g_action = null;
function initialUI(cb) {
  let search = window.location.search;
  let action = 'backup';
  if (search != null && search.length > 0) {
    let urlParams = new URLSearchParams(search);
    action = (urlParams.get('action') || 'backup').toLowerCase();
  }
  g_action = action;

  if (action == 'backup') {
    // $('#back-button-div').css({display: 'none'});
    $('#btn-generate-salt').css({display: 'inline'});
    gotoBackup();
    restClient.listVaults(function(result) {
      if (result.code == 0) {
        g_vaults = result.data;
      } else {
        showAlertDialog('Failed to get Vault', result.msg);
      }
      cb();
    });
  } else if(action == 'import') {
    gotoImport();
    cb();
  } else if(action == 'export') {
    gotoExport();
    cb();
    // restClient.listVaults(function(result) {
    //   if (result.code == 0) {
    //     g_vaults = result.data;
    //   }
    //   cb();
    // });
  } else if(action == 'restore') {
    gotoRestore();
    cb();
  }
}

function documentOnReady() {
  initialUI(function() {
    initial_supercop_wapper(function() {
      window.supercop = supercop_wasm ? supercop_wasm: null;
      supercop.ready(supercopOnReady);
    })
  })
}

$(document).ready(documentOnReady);


function restoreClicked() {
    $('#open-button').attr('disabled', 'disabled');
    if (window.scrypt) {
      doRestoreFromToken()
    } else {
      backupOrRestoreWithTokenFn = doRestoreFromToken;
      scrypt_module_factory(scryptOnReady, {requested_total_memory: 33554432 * 10});
    }
}

function backupClicked() {
  $('#open-button').attr('disabled', 'disabled');
  if (window.scrypt) {
    doBackupAsToken()
  } else {
    backupOrRestoreWithTokenFn = doBackupAsToken;
    scrypt_module_factory(scryptOnReady, {requested_total_memory: 33554432 * 10});
  }
}

function overrideButtonClicked() {
  $('#overrideModal').modal('hide');
  doBackupAsToken(true);
}

function importClicked() {
  $('#open-button').attr('disabled', 'disabled');
  if (window.scrypt) {
    doImportFromToken()
  } else {
    backupOrRestoreWithTokenFn = doImportFromToken;
    scrypt_module_factory(scryptOnReady, {requested_total_memory: 33554432 * 10});
  }
}

function exportClicked() {
$('#open-button').attr('disabled', 'disabled');
  if (window.scrypt) {
    doRestoreFromToken()
  } else {
    backupOrRestoreWithTokenFn = doRestoreFromToken;
    scrypt_module_factory(scryptOnReady, {requested_total_memory: 33554432 * 10});
  }
}


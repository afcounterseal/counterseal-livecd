var defaultRootRegistry = 'https://registry.ai-fi.net';
var defaultRootRegistry = 'http://192.168.0.50:9999';
var defaultRootRegistry = '';
var defaultTokenTypePrefix = "afcs:";


function toError(xhr, textStatus, prefix) {
  var code = 0;
  if (xhr.status != 200) {
      if (xhr.status == 0) {
          code = -100;
      } else {
          code = -xhr.status;
      }
  }

  var msg = prefix ? (prefix + ": ") : "";
  if (textStatus == 'timeout') {
      msg += 'timeout';
  } else if (textStatus == 'error') {
      msg += 'error';
  } else if (textStatus == 'abort') {
      msg += 'abort';
  } else if (textStatus == 'parsererror') {
      msg += 'parsererror';
  }

  return {code: code, msg: msg};
}


$.doGet = function(url, cb) {
  $.get(url, function(data, textStatus, jqXHR) {
    if (data) {
      cb(data);
      return;
    }
    var err = toError(jqXHR, textStatus, 'Ajax Error');
    cb(err);
  }).fail(function(jqXHR) {
    cb({code: jqXHR.status, msg: jqXHR.responseText, data: null});
  });
}
$.doPost = function(url, form, cb) {
  /*
  $.post(url, JSON.stringify(form), function(data, textStatus, jqXHR) {
    if (data) {
      cb(data);
      return;
    }
    var err = toError(jqXHR, textStatus, 'Ajax Error');
    cb(err);
  }, 'json', {contentType: 'application/json'});
  */
  $.support.cors = true;
  jQuery.ajax( jQuery.extend( {
    url: url,
    type: "POST",
    dataType: "json",
    data: JSON.stringify(form),
    contentType: "application/json",
    xhrFields: {
      withCredentials: true
    },
    crossDomain: true,
    success: function(data){
        cb(data);
    },
    error: function(xhr, textStatus, error) {
      if (error) {
        cb({code: -1, msg: error});
        return;
      }
      var err = toError(xhr, textStatus, 'AJAX Post Error');
        cb(err);
    }
  }, jQuery.isPlainObject( url ) && url ) );

  /*
  var origin = window.location.protocol + '//' + window.location.host; // + (window.location.port ? ':' + window.location.port : ''));
  $.ajax({
    type: "POST",
    url: url,
    data: JSON.stringify(form),
    contentType: "application/json",
    xhrFields: {
      withCredentials: true
    },
    crossDomain: true,
    success: function(data){
        cb(data);
    },
    error: function(xhr, textStatus, error) {
      if (error) {
        cb({code: -1, msg: error});
        return;
      }
      var err = toError(xhr, textStatus, 'AJAX Post Error');
        cb(err);
    }
  });
  */
}

function generateSeed(scrypt, salt, pass) {

    var keyBuf = scrypt.encode_utf8("")
    var passBuf = scrypt.encode_utf8(pass)
    var saltBuf = scrypt.encode_utf8(salt);

    var blake2s = new BLAKE2s(32, keyBuf);
    blake2s.update(passBuf)

    var passHash = blake2s.digest();

    var result = scrypt.crypto_scrypt(passHash, saltBuf, SCRYPT_PARAMS.N, SCRYPT_PARAMS.R, SCRYPT_PARAMS.P, SCRYPT_PARAMS.OutputLength);
    return result;
}
function byteArrayToWordArray(ba) {
	var wa = [],
		i;
	for (i = 0; i < ba.length; i++) {
		wa[(i / 4) | 0] |= ba[i] << (24 - 8 * i);
	}

	return CryptoJS.lib.WordArray.create(wa, ba.length);
}

function wordToByteArray(word, length) {
	var ba = [],
		i,
		xFF = 0xFF;
	if (length > 0)
		ba.push(word >>> 24);
	if (length > 1)
		ba.push((word >>> 16) & xFF);
	if (length > 2)
		ba.push((word >>> 8) & xFF);
	if (length > 3)
		ba.push(word & xFF);

	return ba;
}

function wordArrayToByteArray(wordArray, length) {
	if (wordArray.hasOwnProperty("sigBytes") && wordArray.hasOwnProperty("words")) {
		length = wordArray.sigBytes;
		wordArray = wordArray.words;
	}

	var result = [],
		bytes,
		i = 0;
	while (length > 0) {
		bytes = wordToByteArray(wordArray[i], Math.min(4, length));
		length -= bytes.length;
		result.push(bytes);
		i++;
	}
	return [].concat.apply([], result);
}

function crc16(bytes) {
    let crc = 0x0000;
    const polynomial = 0x1021;
    let byte_val, bit, c15;
    for (let i = 0; i < bytes.length; i++) {
      byte_val = bytes[i];
      for (let k = 0; k < 8; k++) {
        bit = ((byte_val >> (7 - k) & 1) == 1);
        c15 = ((crc >> 15 & 1) == 1);
        crc <<= 1;
        if (c15 ^ bit) {
          crc ^= polynomial;
        }
      }
    }
    crc &= 0xffff;
    return Uint8Array.of(crc & 0xff, (crc >> 8 & 0xff))
}


function derivateFileNameAndEncryptionKey(salt, passphrase) {
    var seed = generateSeed(scrypt, salt, passphrase);
    var keypair = supercop.createKeyPair(seed);
    var buf = keypair.publicKey;
    var payload = new Uint8Array(buf.length + 1);
    var ver = Uint8Array.of(48);
    payload.set(ver, 0);
    payload.set(buf, 1);
    var crc = crc16(payload);
    var account = new Uint8Array(buf.length + 3);
    account.set(payload, 0);
    account.set(crc, payload.length);
    var accountId = base32.encode(account);

    // return {fileName: accountId, encryptionKey: keypair.seed, keyPair: keypair};
    return {fileName: accountId, oldEncryptionKey: keypair.secretKey, keyPair: keypair};
}

function generateEphemeralKeyair() {
  var seed = supercop.createSeed();
  var keypair = supercop.createKeyPair(seed);
  return keypair;
}

var g_iv = Uint8Array.of(
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0);
var g_ivWords = byteArrayToWordArray(g_iv);

function encryptData(data, key) {
    var keywords = byteArrayToWordArray(key.subarray(0, 32))
    var datawords = byteArrayToWordArray(data)
    var encryptedResult = CryptoJS.AES.encrypt(datawords, keywords, {mode: CryptoJS.mode.CBC, iv: g_ivWords, padding: CryptoJS.pad.Pkcs7});
    var encryptedData = wordArrayToByteArray(encryptedResult.ciphertext)
    // CryptoJS.enc.Base64(encryptedData)
    // ToBase64 = function (u8) {
    //     return btoa(String.fromCharCode.apply(null, u8));
    // }
    // var b64 = ToBase64(encryptedData)
    return encryptedData;
}

function encryptJSON(jsonObj, key) {
  var jsonStr = JSON.stringify(jsonObj);
  var jsonData = new TextEncoder("utf-8").encode(jsonStr);
  return encryptData(jsonData, key);
}

function decryptData(data, key) {
    // var key = Uint8Array.of(0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7,0,1,2,3,4,5,6,7)
    // var data = Uint8Array.of(1,2,3,4,5,6,7,8);
  var keywords = byteArrayToWordArray(key.subarray(0, 32))
  var datawords = byteArrayToWordArray(data);
  var base64Data = datawords.toString(CryptoJS.enc.Base64);

  var decryptedResult = CryptoJS.AES.decrypt(base64Data, keywords, {mode: CryptoJS.mode.CBC, iv: g_ivWords, padding: CryptoJS.pad.Pkcs7})

  var decryptedData = wordArrayToByteArray(decryptedResult);
  return decryptedData;
}

function decryptDataAsJSON(data, key) {

  var keywords = byteArrayToWordArray(key.subarray(0, 32))
  var datawords = byteArrayToWordArray(data);
  var base64Data = datawords.toString(CryptoJS.enc.Base64);


  var decryptedResult = CryptoJS.AES.decrypt(base64Data, keywords, {mode: CryptoJS.mode.CBC, iv: g_ivWords, padding: CryptoJS.pad.Pkcs7})

  var jsonStr = decryptedResult.toString(CryptoJS.enc.Utf8);
  var jsonObj = JSON.parse(jsonStr);
  return jsonObj;
}


var restClient = {
  srpClient: null,
  passphrase: null,
  salt: null,

  //these are defaults which may be overridden in the html
  options: {
    saltId: '#entropy-salt-tf',
    passphraseId: '#passphrase-tf',
    challengeUrl: defaultRootRegistry + '/api/token/sss/share/srp',
    saveShareUrl: defaultRootRegistry + '/api/token/sss/share/save',
    getShareUrl: defaultRootRegistry + '/api/token/sss/share/retrieve', // append /filename
    updateShareUrl: defaultRootRegistry + '/api/token/sss/share/update',
    removeShareUrl: defaultRootRegistry + '/api/token/sss/share/delete',
    listVaultsUrl: defaultRootRegistry + '/api/vault/list',
    restoreVaultsUrl: defaultRootRegistry + '/api/vault/restore',
  },

  getSalt: function () {
    var salt = $(this.options.saltId).val();
    if (!salt) salt = "";
    salt = defaultTokenTypePrefix + salt;
    return salt;
  },

  getPassphrase: function () {
    return $(this.options.passphraseId).val();
  },

  getClient: function () {
    if (this.srpClient === null || this.getPassphrase() !== this.passphrase || this.getSalt() !== this.salt) {
      this.passphrase = this.getPassphrase();
      this.salt = this.getSalt();
      this.kryptonTokenContext = this.derivateFileNameAndEncryptionKey()
  	  var jsClientSession = new SRP6JavascriptClientSessionSHA256();
      this.srpClient = jsClientSession;
    }
    return this.srpClient;
  },

  derivateFileNameAndEncryptionKey: function() {
    return derivateFileNameAndEncryptionKey(this.getSalt(), this.getPassphrase());
  },
  generateEphemeralKeyPair: function() {
    return generateEphemeralKeyair()
  },

  generateSaltAndVerifier: function () {
    var me = this;
    var client = this.getClient();
    var fileName = this.kryptonTokenContext.fileName;

    var salt = client.generateRandomSalt();
    var v = client.generateVerifier(salt, fileName, this.getPassphrase());
    return {salt: salt, verifier: v};
  },
  srpStep1: function(cb) {
    var me = this;
    me.salt = null;
    me.passphrase = null;

    var client = this.getClient();
    var fileName = me.kryptonTokenContext.fileName;

    $.doGet(me.options.challengeUrl + '/' + fileName, function (result) {

      if (result.code != 0) {
        cb(result);
        return;
      }

      try {
        client.step1(fileName, me.getPassphrase());
      } catch(e) {
        // alert("Client session is in end state and cannot be reused so refreshing the demo page to start again.");
        cb(e);
        return;
      }
      var response = result.data;
      var saltAndB =response.split(':');
      var credentials = client.step2(saltAndB[0], saltAndB[1])
      cb({code: 0, msg: 'success', data: {a: credentials.A, m1: credentials.M1} });
    }, 'json');

  },

  keyExchange: function(publicKey, privateKey) {
    return supercop.keyExchange(publicKey, privateKey);
  },

  encryptAndBase32EncodeShares: function(shares, ephemeralKeyPair) {
    var me = this;

    var key = me.keyExchange(me.kryptonTokenContext.keyPair.publicKey, ephemeralKeyPair.secretKey);
    var jsonStr = JSON.stringify(shares);
    var tokenBuf = new TextEncoder("utf-8").encode(jsonStr);
    var encryptedBuf = encryptData(tokenBuf, key);
    var encodedString = base32.encode(encryptedBuf);
    return encodedString;
  },

  base32DecodeAndDecryptShares: function(str, version, ephemeralPublicKey) {
    var me = this;
    var encryptionKey = null;
    if (version == "1") {
      encryptionKey = me.kryptonTokenContext.oldEncryptionKey;
    } else {
      encryptionKey = me.keyExchange(ephemeralPublicKey, me.kryptonTokenContext.keyPair.secretKey);
    }
    var buf = base32.decode.asBytes(str);
    var tokenObj = decryptDataAsJSON(buf, encryptionKey);
    console.log(tokenObj);
    return tokenObj;
  },

  listVaults: function(cb) {
    var me = this;
    $.get(me.options.listVaultsUrl, function(data, textStatus, jqXHR) {
      if (data) {
        cb({code: 0, msg: 'success', data: data});
        return;
      }
      var err = toError(jqXHR, textStatus, 'Ajax Error');
      cb(err);
    }).fail(function(resp) {
      cb({code: resp.status, msg: 'Vault not found'});
    });
  },
  restoreVaults: function(vaults, cb) {
    var me = this;
    
    let url = me.options.restoreVaultsUrl;
    $.support.cors = true;
    jQuery.ajax( jQuery.extend( {
      url: url,
      type: "POST",
      dataType: "json",
      data: JSON.stringify(vaults),
      contentType: "application/json",
      xhrFields: {
        withCredentials: true
      },
      crossDomain: true,
      success: function(data){
          cb({code: data, msg: ""});
      },
      error: function(xhr, textStatus, error) {
        if (error) {
          cb({code: -1, msg: error});
          return;
        }
        var err = toError(xhr, textStatus, 'AJAX Post Error');
          cb(err);
      }
    }, jQuery.isPlainObject( url ) && url ) );
    
  },

  doCreateNewToken: function(shares, cb) {
    var me = this;
    var fileName = me.kryptonTokenContext.fileName;
    var saltAndVerifier = me.generateSaltAndVerifier();
    var ephemeralKeyPair = me.generateEphemeralKeyPair();
    var encrypted = this.encryptAndBase32EncodeShares(shares, ephemeralKeyPair);
    var ephemeralPublicKey = ephemeralKeyPair.publicKey;
    var ephemeralPublicKeyWords = byteArrayToWordArray(ephemeralPublicKey);
    var ephemeralPublicKeyBase64String = CryptoJS.enc.Base64.stringify(ephemeralPublicKeyWords);
    var form = {
      fileName: fileName,
      share: encrypted,
      verification: saltAndVerifier.verifier,
      salt: saltAndVerifier.salt,
      version: "2",
      ephemeralPublicKey: ephemeralPublicKeyBase64String
    };

    $.doPost(me.options.saveShareUrl, form, function(result) {
      cb(result, fileName);
    });
  },

  doGetToken: function(srpChallenge, cb, withoutDecrypt) {

    var me = this;
    var fileName = me.kryptonTokenContext.fileName;
    var client = this.getClient();

    $.doPost(me.options.getShareUrl + '/' + fileName, srpChallenge, function(result) {
      if (result.code != 0) {
        cb(result);
        return;
      }
      if (withoutDecrypt) {
        cb(result);
        return;
      }

      var shareObj = result.data.share;
      var version = shareObj.version;
      var share = shareObj.share;
      var ephemeralPublicKey = null;

      var ephemeralPublicKeyBase64String = shareObj.ephemeralPublicKey;
      if (ephemeralPublicKeyBase64String) {
        var ephemeralPublicKeyWords = CryptoJS.enc.Base64.parse(ephemeralPublicKeyBase64String);
        ephemeralPublicKey = wordArrayToByteArray(ephemeralPublicKeyWords);
        ephemeralPublicKey = Uint8Array.from(ephemeralPublicKey);
      }

      if (!version || version.length == 0) {
        version = "1";
      }
      var res = me.base32DecodeAndDecryptShares(share, version, ephemeralPublicKey);
      cb({code: 0, msg: "success", data: res});
    });

  },

  doUpdateToken: function(srpChallenge, token, cb) {

    var me = this;
    var fileName = me.kryptonTokenContext.fileName;
    var ephemeralKeyPair = me.generateEphemeralKeyPair();
    var encrypted = this.encryptAndBase32EncodeShares(token, ephemeralKeyPair);
    var ephemeralPublicKey = ephemeralKeyPair.publicKey;
    var ephemeralPublicKeyWords = byteArrayToWordArray(ephemeralPublicKey);
    var ephemeralPublicKeyBase64String = CryptoJS.enc.Base64.stringify(ephemeralPublicKeyWords);
    var form = {
      fileName: fileName,
      share: encrypted,
      salt: srpChallenge.a,
      verification: srpChallenge.m1,
      version: "2",
      ephemeralPublicKey: ephemeralPublicKeyBase64String
    };
    $.doPost(me.options.updateShareUrl, form, function(result) {
      cb(result, fileName);
    });
  },

  doDeleteToken: function(srpChallenge, cb) {

    var me = this;
    var fileName = me.kryptonTokenContext.fileName;
    $.doPost(me.options.removeShareUrl + '/' + fileName, srpChallenge, function(result) {
      cb(result);
    });
  },
  saveShare: function(shares, cb, override) {
    var me = this;

    me.srpStep1(function(result) {

      if (result.code == -1) { // Token not found create one
        me.doCreateNewToken(shares, cb);
      } else if (result.code == 0) {
        if (!override) {
          cb({code: 15108, msg: 'Token already exists', data: null}, null)
          return;
        }
        me.doGetToken(result.data, function(result) { // token found
          if (result.code != 0) {
            cb(result, null);
            return;
          }
          var newToken = shares;

          // var success = me.updateTokenObject(result.data, shareName, shareValue, covered);
          // var newToken = result.data;
          // if (!success) { // success is false if shareName existed and covered is false
          //   cb({code: -50001, msg: "subject already exists", data: null});
          //   return;
          // }

          me.srpStep1(function(result) { //
            if (result.code != 0) {
              cb(result, null);
              return;
            }
            me.doUpdateToken(result.data, newToken, cb)
          });
        }, false);
      } else { // error
        cb(result, null);
      }
    });
  },

  getShares: function(cb, withoutDecrypt) {
    var me = this;

    me.srpStep1(function(result) {
      if (result.code != 0) {
        cb(result);
        return;
      }

      me.doGetToken(result.data, cb, withoutDecrypt);
    });
  },

  decryptShares: function(result, cb) {


    var client = this.getClient();
    var fileName = this.kryptonTokenContext.fileName;
    if (!client && !fileName || !result.data || !result.data.share || result.data.share.fileName != fileName) {
      cb({code: -1, msg: "Invalid token file"});
      return;
    }

    var shareObj = result.data.share;
    var version = shareObj.version;
    var share = shareObj.share;
    var ephemeralPublicKey = null;

    var ephemeralPublicKeyBase64String = shareObj.ephemeralPublicKey;
    if (ephemeralPublicKeyBase64String) {
      var ephemeralPublicKeyWords = CryptoJS.enc.Base64.parse(ephemeralPublicKeyBase64String);
      ephemeralPublicKey = wordArrayToByteArray(ephemeralPublicKeyWords);
      ephemeralPublicKey = Uint8Array.from(ephemeralPublicKey);
    }

    if (!version || version.length == 0) {
      version = "1";
    }
    var res = this.base32DecodeAndDecryptShares(share, version, ephemeralPublicKey);
    cb({code: 0, msg: "success", data: res});
  },

  removeShare: function(shareName, cb) {
    var me = this;

    me.srpStep1(function(result) {
      if (result.code != 0) {
        cb(result);
        return;
      }

      me.doGetToken(result.data, function(result) {

        if (result.code != 0) {
          cb(result);
          return;
        }
        var success = me.deleteSharesFromTokenObj(result.data, [shareName]);
        var newToken = result.data;
        if (!success) {}
        me.srpStep1(function(result) { //
          if (result.code != 0) {
            cb(result);
            return;
          }
          me.doUpdateToken(result.data, newToken, cb)
        });

      }, false);

    })
  },

  removeShares: function(shareNames, cb) {
    var me = this;

    me.srpStep1(function(result) {
      if (result.code != 0) {
        cb(result);
        return;
      }

      me.doGetToken(result.data, function(result) {

        if (result.code != 0) {
          cb(result);
          return;
        }
        var success = me.deleteSharesFromTokenObj(result.data, shareNames);
        var newToken = result.data;
        if (!success) {}
        me.srpStep1(function(result) { //
          if (result.code != 0) {
            cb(result);
            return;
          }
          me.doUpdateToken(result.data, newToken, cb)
        });

      }, false);

    });
  },

  removeToken: function(cb) {
    var me = this;

    me.srpStep1(function(result) {
      if (result.code != 0) {
        cb(result);
        return;
      }

      me.doDeleteToken(result.data, cb);
    });
  }

}

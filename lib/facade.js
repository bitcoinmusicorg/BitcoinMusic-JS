'use strict';

require('babel-polyfill');

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

var api = require('./api');
var auth = require('./auth');
var broadcast = require('./broadcast');
var formatter = require('./formatter');
var memo = require('./auth/memo');
var config = require('./config');

var museLastError = null;

var facade = { lastError: null };

var user_roles = ["owner", "active", "basic", "memo"];

// private stuff

var faucet_config = { account_creation_fee: "0.000001 2.28.0", newAccountVest: 0, newAccountMuse: 0, newAccountMuseMemo: "Funds from faucet" };

var prepareWifOrPassword = function prepareWifOrPassword(userName, passwordOrWif, requiredKeyType /*owner, active, basic, memo*/) {
  if (auth.isWif(passwordOrWif)) {
    return passwordOrWif;
  } else {
    var keys_to_use = auth.getPrivateKeys(userName, passwordOrWif, [requiredKeyType]);
    return keys_to_use[requiredKeyType];
  }
};

var readAuthorityPubKey = function readAuthorityPubKey(authority) {
  return authority && authority.key_auths && authority.key_auths.length > 0 ? authority.key_auths[0][0] : null;
};

var vestingMuse = function vestingMuse(account, gprops) {
  var vests = parseFloat(account.vesting_shares.split(' ')[0]);
  var total_vests = parseFloat(gprops.total_vesting_shares.split(' ')[0]);
  var total_vest_muse = parseFloat(gprops.total_vesting_fund_muse.split(' ')[0]);
  var vesting_musef = total_vest_muse * (vests / total_vests);
  return vesting_musef;
};

// public stuff

facade.configure = function (localConfig) {
  config.set("address_prefix", localConfig['chain-prefix']);
  config.set("chain_id", localConfig['chain-id']);
  config.set("websocket", localConfig['backend-address']);
};

facade.configureFaucet = function (localFaucetConfig) {
  if (localFaucetConfig['faucet-account'] && localFaucetConfig['faucet-account'] != '') {
    faucet_config.account = localFaucetConfig['faucet-account'];
    faucet_config.private_wif = localFaucetConfig['faucet-active-priv-key'];
    faucet_config.newAccountVest = localFaucetConfig['faucet-vest-amount'];
    faucet_config.newAccountMuse = localFaucetConfig['faucet-muse-amount'];
    faucet_config.newAccountMuseMemo = localFaucetConfig['faucet-muse-memo'];
  }
};

var assertFaucet = function assertFaucet() {
  if (!(faucet_config.account && faucet_config.private_wif && faucet_config.account_creation_fee)) {
    throw "Missing Faucet Config.";
  }
};

// This will be the call of web faucet because we can't use password, it's private.
facade.createAccountWithKeys = function (userName, ownerPubkey, activePubkey, basicPubkey, memoPubkey, callback) {
  assertFaucet();

  api.getAccounts([userName], function (err, result) {
    facade.lastError = err;
    if (result.length > 0) {
      callback(-2, "Account Already Exists");
    } else {
      broadcast.accountCreate(faucet_config.private_wif, faucet_config.account_creation_fee, faucet_config.account, userName, {
        "weight_threshold": 1,
        "account_auths": [],
        "key_auths": [[ownerPubkey, 1]]
      }, {
        "weight_threshold": 1,
        "account_auths": [],
        "key_auths": [[activePubkey, 1]]
      }, {
        "weight_threshold": 0,
        "account_auths": [],
        "key_auths": [[basicPubkey, 1]]
      }, memoPubkey, {}, function (err, result) {
        facade.lastError = err;
        if (err) {
          callback(-1, "Unable to Create Account");
        } else {
          var fctFail = function fctFail() {
            callback(-1, "Unable to Create Account");
          };
          var fctSuccess = function fctSuccess() {
            callback(0, "Success");
          };
          var fctFunds = function fctFunds() {
            if (faucet_config.newAccountMuse != null) {
              facade.transferFunds(faucet_config.account, faucet_config.private_wif, userName, Number(faucet_config.newAccountMuse).toFixed(6), faucet_config.newAccountMuseMemo, function (code, message) {
                if (err) {
                  fctFail();
                } else {
                  fctSuccess();
                }
              });
            } else {
              fctSuccess();
            }
          };
          var fctVests = function fctVests() {
            if (faucet_config.newAccountVest != null) {
              facade.transferFundsToVestings(faucet_config.account, faucet_config.private_wif, userName, Number(faucet_config.newAccountVest).toFixed(6), function (code, message) {
                if (err) {
                  fctFail();
                } else {
                  fctFunds();
                }
              });
            } else {
              fctFunds();
            }
          };
          // Transfer vests if possible, transfer assets if possible, then success
          fctVests();
        }
      });
    }
  });
};

facade.createAccount = function (userName, password, callback) {
  assertFaucet();

  api.getAccounts([userName], function (err, result) {
    facade.lastError = err;
    if (result.length > 0) {
      callback(-2, "Account Already Exists", null);
    } else {
      var keys_to_use = auth.getPrivateKeys(userName, password, user_roles);
      broadcast.accountCreate(faucet_config.private_wif, faucet_config.account_creation_fee, faucet_config.account, userName, {
        "weight_threshold": 1,
        "account_auths": [],
        "key_auths": [[keys_to_use.ownerPubkey, 1]]
      }, {
        "weight_threshold": 1,
        "account_auths": [],
        "key_auths": [[keys_to_use.activePubkey, 1]]
      }, {
        "weight_threshold": 0,
        "account_auths": [],
        "key_auths": [[keys_to_use.basicPubkey, 1]]
      }, keys_to_use.memoPubkey, {}, function (err, result) {
        facade.lastError = err;
        if (err) {
          facade.lastError = err;
          callback(-1, "Unable to Create Account", null);
        } else {
          callback(0, "Success", keys_to_use);
        }
      });
    }
  });
};

facade.updateAccountKeys = function (userName, passwordOrWif, ownerPubkey, activePubkey, basicPubkey, memoPubkey, callback) {
  broadcast.accountUpdate(prepareWifOrPassword(userName, passwordOrWif, ['owner']), userName, ownerPubkey == null ? undefined : {
    "weight_threshold": 1,
    "account_auths": [],
    "key_auths": [[ownerPubkey, 1]]
  }, activePubkey == null ? undefined : {
    "weight_threshold": 1,
    "account_auths": [],
    "key_auths": [[activePubkey, 1]]
  }, basicPubkey == null ? undefined : {
    "weight_threshold": 0,
    "account_auths": [],
    "key_auths": [[basicPubkey, 1]]
  }, memoPubkey == null ? undefined : memoPubkey, {}, function (err, result) {
    facade.lastError = err;
    if (err) {
      callback(-1, "Error");
    } else {
      callback(0, "Success");
    }
  });
};

facade.accountInfo = function (userName, callback) {
  api.getDynamicGlobalProperties(function (err, result) {
    facade.lastError = err;
    if (result != null) {
      var global = result;
      api.getAccounts([userName], function (err, result) {
        facade.lastError = err;
        if (result != null && result.length > 0) {
          var accountInfo = result[0];
          callback(1, "Success", {
            id: accountInfo.id,
            userName: accountInfo.name,
            recoveryAccount: accountInfo.recovery_account,
            balance: Number(accountInfo.balance.split(" ")[0]),
            vesting: Number(accountInfo.vesting_shares.split(" ")[0]),
            vestingWithdrawRate: Number(accountInfo.vesting_withdraw_rate.split(" ")[0]),
            publicOwnerKey: readAuthorityPubKey(accountInfo.owner),
            publicActiveKey: readAuthorityPubKey(accountInfo.active),
            publicBasicKey: readAuthorityPubKey(accountInfo.basic),
            publicMemoKey: accountInfo.memo_key,
            dateCreated: new Date(accountInfo.created),
            dateLastActive: new Date(accountInfo.last_active),
            nextWithdraw: new Date(accountInfo.next_vesting_withdrawal),
            witnessVotes: accountInfo.witness_votes
          });
        } else {
          callback(-1, "Error", null);
        }
      });
    } else {
      callback(-1, "Error", null);
    }
  });
};

facade.login = function (userName, passwordOrWif, callback) {
  api.getAccounts([userName], function (err, result) {
    facade.lastError = err;
    if (result.length > 0) {
      var accountInfo = result[0];
      var keys = [];
      if (auth.isWif(passwordOrWif)) {
        keys.push(auth.wifToPublic(passwordOrWif));
      } else {
        var keys_to_use = auth.getPrivateKeys(userName, passwordOrWif, ["owner", "active", "basic", "memo"]);
        keys.push(keys_to_use.ownerPubkey);
        keys.push(keys_to_use.activePubkey);
        keys.push(keys_to_use.basicPubkey);
      }
      var keysToCheck = [];
      var tmpKey = readAuthorityPubKey(accountInfo.owner);
      if (tmpKey != null) {
        keysToCheck.push(tmpKey);
      }
      tmpKey = readAuthorityPubKey(accountInfo.active);
      if (tmpKey != null) {
        keysToCheck.push(tmpKey);
      }
      tmpKey = readAuthorityPubKey(accountInfo.basic);
      if (tmpKey != null) {
        keysToCheck.push(tmpKey);
      }

      var bFoundKey = false;
      keys.forEach(function (aKeyToVerify) {
        keysToCheck.forEach(function (accountKey) {
          if (aKeyToVerify == accountKey) {
            bFoundKey = true;
          }
        });
      });

      callback(bFoundKey ? 1 : -1, bFoundKey ? "Success" : "Invalid password / wif");
    } else {
      callback(-2, "User Not Found");
    }
  });
};

// This function might no longer work after blockchain version v6.1
facade.transferFunds = function (fromUserName, passwordOrWif, toUserName, amountSixDigitsAfterPeriod, memo, callback) {
  broadcast.transfer(prepareWifOrPassword(fromUserName, passwordOrWif, "active"), fromUserName, toUserName, amountSixDigitsAfterPeriod + " 2.28.0", memo ? memo : "", function (err, result) {
    facade.lastError = err;
    callback(err, result);
    // callback(result ? 1 : -1, result ? "Success" : "Error");
  });
};

facade.transferFundsByAsset = function (fromUserName, passwordOrWif, toUserName, amountInUnits, assetId, memo, callback) {
  broadcast.transfer(prepareWifOrPassword(fromUserName, passwordOrWif, 'active'), fromUserName, toUserName, { amount: amountInUnits, asset_id: assetId }, memo ? memo : '', function (err, result) {
    facade.lastError = err;
    callback(err, result);
    // callback(result ? 1 : -1, result ? "Success" : "Error");
  });
};

facade.transferFundsToVestings = function (fromUserName, passwordOrWif, toUserNameOrNull, amountSixDigitsAfterPeriod, callback) {
  broadcast.transferToVesting(prepareWifOrPassword(fromUserName, passwordOrWif, "active"), fromUserName, toUserNameOrNull ? toUserNameOrNull : fromUserName, amountSixDigitsAfterPeriod + " 2.28.0", function (err, result) {
    facade.lastError = err;
    callback(result ? 1 : -1, result ? "Success" : "Error");
  });
};

facade.withdrawVesting = function (fromUserName, passwordOrWif, amountSixDigitsAfterPeriod, callback) {
  broadcast.withdrawVesting(prepareWifOrPassword(fromUserName, passwordOrWif, "active"), fromUserName, amountSixDigitsAfterPeriod + " 2.28.1", function (err, result) {
    facade.lastError = err;
    callback(result ? 1 : -1, result ? "Success" : "Error");
  });
};

facade.accountHistory = function (userName, from, count, formatter, callback) {
  api.getAccountHistory(userName, from ? from : -1, count, function (err, result) {
    facade.lastError = err;
    if (result) {
      var history_info = [];
      result.forEach(function (rawHistoryElement) {
        var historyElement = rawHistoryElement[1];
        var operationRaw = historyElement.op;
        var operationName = operationRaw[0];
        var operationData = operationRaw[1];
        var toPush = formatter(userName, operationName, new Date(historyElement.timestamp), operationData, {});
        if (toPush) {
          history_info.push(toPush);
        }
      });
      callback(1, "Success", history_info);
    } else {
      callback(-1, "Error", null);
    }
  });
};

facade.getBalanceObjects = function (sourceKey, callback) {

  var addressesToUse = auth.generateBalanceKeys([sourceKey]);

  api.getBalanceObjects(addressesToUse, function (err, result) {
    facade.lastError = err;
    if (result && result.length > 0) {
      callback(1, "Balance(s) Found", result);
    } else {
      callback(-2, "No Balance Found", err);
    }
  });
};

facade.getAssets = function () {
  var _ref = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(account) {
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            return _context.abrupt('return', new Promise(function (resolve, reject) {
              api.getUiaBalances(account, function (err, result) {
                facade.lastError = err;
                if (!err) {
                  resolve(result);
                } else {
                  reject('Couldn\'t fetch assets of account ' + JSON.stringify(err));
                }
              });
            }));

          case 1:
          case 'end':
            return _context.stop();
        }
      }
    }, _callee, undefined);
  }));

  return function (_x) {
    return _ref.apply(this, arguments);
  };
}();

facade.getAsset = function () {
  var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(assetId) {
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            return _context2.abrupt('return', new Promise(function (resolve, reject) {
              api.getAsset(assetId, function (err, result) {
                facade.lastError = err;
                if (!err) {
                  resolve(result);
                } else {
                  reject('Couldn\'t fetch asset', err);
                }
              });
            }));

          case 1:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, undefined);
  }));

  return function (_x2) {
    return _ref2.apply(this, arguments);
  };
}();

facade.claimBalance = function (targetAccount, passwordOrWif, sourceKey, balanceId, balanceToClaim, callback) {

  try {
    var privKey = auth.fromPrivateWifTruncate(sourceKey);
    var pubKey = privKey.toPublic();
    // var active = prepareWifOrPassword(targetAccount, passwordOrWif, "active");

    broadcast.balanceClaim(privKey.toString(), targetAccount, balanceId, pubKey.toString(), balanceToClaim, function (error, result) {
      facade.lastError = error;
      callback(result ? 1 : -1, result ? "Success" : "Error", result);
    });
  } catch (err) {
    callback(-1, err);
  }
};

facade.witnessesByVote = function (qty, from, callback) {
  api.getWitnessesByVote(from ? from : "", qty, function (err, result) {
    facade.lastError = err;
    if (result) {
      var results = [];
      result.forEach(function (result) {
        results.push({
          id: result.id,
          owner: result.owner,
          votes_value: result.votes,
          url: result.url,
          signing_key: result.signing_key,
          last_confirmed_block_num: result.last_confirmed_block_num
        });
      });
      callback(1, "Success", results);
    } else {
      callback(-1, "Error", null);
    }
  });
};

facade.witnessInfo = function (witnessUserName, callback) {
  api.getWitnessByAccount([witnessUserName], function (err, result) {
    facade.lastError = err;
    if (result) {
      callback(1, "Success", {
        id: result.id,
        owner: result.owner,
        votes_value: result.votes,
        url: result.url,
        signing_key: result.signing_key,
        last_confirmed_block_num: result.last_confirmed_block_num
      });
    } else {
      callback(-1, "Error", null);
    }
  });
};

facade.witnessVote = function (userName, passwordOrWif, witnessUserName, approve, callback) {
  broadcast.accountWitnessVote(prepareWifOrPassword(userName, passwordOrWif, "basic"), userName, witnessUserName, approve == 1, function (err, result) {
    facade.lastError = err;
    if (result) {
      callback(1, "Success");
    } else {
      callback(-1, "Error");
    }
  });
};

////////////

module.exports = facade;
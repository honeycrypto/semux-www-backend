"use strict";

var rp = require('request-promise');
var Transactions = require('./models').Transactions;

const ENV = process.env.NODE_ENV || 'development';
const CONFIG = require('./config/config.json')[ENV];
const AMOUNT = 1000 * 1000000000;
const FEE = 0.005 * 1000000000;
const FROM = CONFIG.wallet.address;
const PASS = CONFIG.wallet.password;
const GET_BALANCE = "https://www.semux.org/api/v1/get_balance";

async function makeTransfers() {
  let pendingRequests = await Transactions.findAll({
    where : {$or: [{status: 'new'}, {status: 'error'}]},
    order : [['id', 'ASC']]
  });
  if (pendingRequests.length) {
    try {
      let balance = JSON.parse(await rp(GET_BALANCE));
      if (balance.balance < 1000.005) {
        return;
      }
    } catch(e) {}
  }
  for (let request of pendingRequests) {
    let to = request.address;
    console.log('[FAUCET] Processing transfer to %s', to);
    try {
      let query = "transfer?from="+FROM+"&to="+to+"&value="+AMOUNT+"&fee="+FEE+"&password="+PASS;
      let options = {
        url: CONFIG.wallet.host + query,
        headers: {
          'Authorization': 'Basic ' + CONFIG.wallet.auth
        }
      };
      let transaction = JSON.parse(await rp(options));
      console.log(transaction);
      if (transaction.success == true) {
        await request.update({status : 'sent'});
      } else {
        await request.update({status : 'error'});
      }
    } catch(e) {
      console.log('[FAUCET] Failed to send coins to %s', to)
      await request.update({status : 'error'});
    }
  }
}

/* Process the queue of pending transactions every 30 seconds */
let makeTransfersInterval = setInterval(makeTransfers, 30 * 1000);

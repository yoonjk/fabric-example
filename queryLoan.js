'use strict';
/*
* Copyright IBM Corp All Rights Reserved
*
* SPDX-License-Identifier: Apache-2.0
*/
/*
 * Chaincode query
 */

var Fabric_Client = require('fabric-client');
var path = require('path');
var util = require('util');
var os = require('os');
var fs = require('fs');

var winston = require('winston');								//logger module
var path = require('path');
const cfenv = require('cfenv');
require('dotenv').config();
var logger = winston.createLogger({
    level: 'info',
    transports: [
        new winston.transports.Console({
                level: process.env.ENVIRONMENT === 'development' ?  'info' : 'silly'
        })
    ],
    exitOnError: false
});
// --- Set Details Here --- //
var config_file = 'fabcar_local.json';							//set config file name
var chaincode_id = 'loan';									//set desired chaincode id to identify this chaincode
var chaincode_ver = 'v1';										//set desired chaincode version

//  --- Use (optional) arguments if passed in --- //
var args = process.argv.slice(2);

console.log('args:', args)
if (args[0]) {
	config_file = args[0];
	logger.debug('Using argument for config file', config_file);
}
if (args[1]) {
	chaincode_id = args[1];
	logger.debug('Using argument for chaincode id');
}
if (args[2]) {
	chaincode_ver = args[2];
	logger.debug('Using argument for chaincode version');
}

var cp = require(path.join(__dirname, './utils/connection_profile_lib/index.js'))(config_file, logger);

console.log('getAllPeersUrl:', cp)
var fabric_client = new Fabric_Client();

var wallet_path = path.join(__dirname, './network/creds');
var user_id = 'admin';
var channel_id = 'fabcar';
var chaincode_id = 'loan';
var cp = require(path.join(__dirname, './utils/connection_profile_lib/index.js'))(config_file, logger);
var peer_url = 'grpcs://n784bd7f85d8e459ea72c44bcca53085e-org1-peer1.us2.blockchain.ibm.com:31002';

var tls_cert = JSON.parse(fs.readFileSync(path.join(__dirname, './network/tls') + '/peer.cert'));

  // setup the fabric network
  var channel = fabric_client.newChannel(channel_id);
  var peer = fabric_client.newPeer(peer_url, {
    pem: tls_cert.pem
  });
  channel.addPeer(peer);

//
  var member_user = null;
  //var store_path = path.join(__dirname, 'hfc-key-store');
  var store_path = wallet_path;
  console.log('Store path:'+store_path);
  var tx_id = null;
  // create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting
  Fabric_Client.newDefaultKeyValueStore({ path: store_path
}).then((state_store) => {
	// assign the store to the fabric client
	fabric_client.setStateStore(state_store);
	var crypto_suite = Fabric_Client.newCryptoSuite();
	// use the same location for the state store (where the users' certificate are kept)
	// and the crypto store (where the users' keys are kept)
	var crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
	crypto_suite.setCryptoKeyStore(crypto_store);
	//fabric_client.setCryptoSuite(crypto_suite);

	// get the enrolled user from persistence, this user will sign all requests
	//return fabric_client.getUserContext('user1', true);
	return fabric_client.getUserContext(user_id, true);
}).then((user_from_store) => {
	if (user_from_store && user_from_store.isEnrolled()) {
		console.log('Successfully loaded user1 from persistence');
		member_user = user_from_store;
	} else {
		throw new Error('Failed to get user1.... run registerUser.js');
	}

	// queryCar chaincode function - requires 1 argument, ex: args: ['CAR4'],
	// queryAllCars chaincode function - requires no arguments , ex: args: [''],
	const request = {
		//targets : --- letting this default to the peers assigned to the channel
		chaincodeId: chaincode_id,
		fcn: 'query',
		args: ['kim']
	};
        console.log('request:',request)
	// send the query proposal to the peer
	return channel.queryByChaincode(request);
}).then((query_responses) => {
	console.log("Query has completed, checking results");
	// query_responses could have more than one  results if there multiple peers were used as targets
	if (query_responses && query_responses.length == 1) {
		if (query_responses[0] instanceof Error) {
			console.error("error from query = ", query_responses[0]);
		} else {
			console.log("Response is ", query_responses[0].toString());
		}
	} else {
		console.log("No payloads were returned from query");
	}
}).catch((err) => {
	console.error('Failed to query successfully :: ' + err);
});

// ============================================================================================================================
// 													Install Chaincode
// This file shows how to install chaincode onto a Hyperledger Fabric Peer via the SDK + FC Wrangler
// ============================================================================================================================							//logger module
var path = require('path');
const cfenv = require('cfenv');
require('dotenv').config();
var { logger } = require('./lib/logger')
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

var cp = require(path.join(__dirname, './lib/connection_profile/index.js'))(config_file, logger);			//set the config file name here
var fca = require(path.join(__dirname, './lib/fc_handler/index.js'))({ block_delay: cp.getBlockDelay() }, logger);

console.log('---------------------------------------');
logger.info('chaincode -', chaincode_id, chaincode_ver);
console.log('---------------------------------------');
fca.enroll(cp.makeEnrollmentOptions(0), (errCode, obj) => {
  if (errCode != null) {
    console.log('enroll callback error:',errCode);
  } else {
	
		const g_options = cp.makeLibOptions();
    var options = {
					peer_urls: g_options.peer_urls,
					peer_tls_opts: g_options.peer_tls_opts,
					channel_id: g_options.channel_id,
					chaincode_id: g_options.chaincode_id,
					chaincode_version: g_options.chaincode_version,
					event_urls: g_options.event_urls,
          chaincode_id: 'loan',
          cc_function: 'invoke',
          cc_args: ['kim','hong','10']
    }
		console.log('invoke opts:', options)
    fca.invoke_chaincode(obj, options, (err, resp) => {
      console.log('resp:', err, resp)
    })
  }
})

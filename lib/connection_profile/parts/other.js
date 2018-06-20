// ============================================================================================================================
// 													Get *** fields from connection profile data
// ============================================================================================================================
var path = require('path');
var os = require('os');

module.exports = function (cp, logger) {
	var helper = {};

	// ----------------------------------------------------------
	// get the chaincode id on network
	// ----------------------------------------------------------
	helper.getBlockDelay = function () {
		let ret = 1000;
		var channel = cp.getChannelId();
		if (cp.creds.channels && cp.creds.channels[channel] && cp.creds.channels[channel]['x-blockDelay']) {
			if (!isNaN(cp.creds.channels[channel]['x-blockDelay'])) {
				ret = cp.creds.channels[channel]['x-blockDelay'];
			}
		}
		return ret;
	};

	// ----------------------------------------------------------
	// get key value store location
	// ----------------------------------------------------------
	helper.getKvsPath = function (opts) {
		const kvs_path = 'creds';
		let ret = path.join(__dirname, '../../../network/' + kvs_path);
		return ret
	};

	return helper;
};

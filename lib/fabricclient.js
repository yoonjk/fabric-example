
const Fabric_Client = require('fabric-client');
const path = require('path');
const fs = require('fs');
const { logger } = require('./logger');
const cred = require('../cred');
let invoke_cc;
const query_cc = require('./query_cc')(logger);
const enrollment = require('./enrollment')(logger);
const common = require('./common')(logger)

class FabricClient {
  constructor() {
    this.connectionProfile = require(`${__dirname}/../card/${cred.CONNECTION_PROFILE_DEV}`);
    this.channelId;
    this.orgName = this.connectionProfile.client.organization;

    this.peerName;
    this.ordererName;
    this.channelName;

    this.success_peer_position = 0;								//the last peer position that was successful
    this.using_peer_position = 0;									//the peer array position to use for the next request
    this.success_ca_position = 0;									//the last ca position that was successful
    this.using_ca_position = 0;									//the ca array position to use for the next enrollment
    this.success_ca_position = 0;

    invoke_cc = require('./invoke_cc')({block_delay: this.getBlockDelay}, logger);
  }

  /*
  * find the org name in the client field
  */
  getClientOrg() {
		if (this.connectionProfile && this.connectionProfile.client.organization) {
			return this.connectionProfile.client.organization;
		}
		logger.error('Org not found.');
		return null;
  }

	// get a peer object
	getPeer(key) {
		if (key === undefined || key == null) {
			throw new Error('Peer key not passed');
		}
		else {
			if (this.connectionProfile.peers) {
				return this.connectionProfile.peers[key];
			}
			else {
				return null;
			}
		}
	};

	// get a peer's grpc url
	getPeersUrl(key) {
		if (key === undefined || key == null) {
			throw new Error('Peer key not passed');
		}
		else {
			let peer = this.getPeer(key);
			if (peer) {
				return peer.url;
			}
			else {
				throw new Error('Peer key not found.');
			}
		}
	};

	// get all peers grpc urls and event urls, on this channel
	getAllPeerUrls(channelId) {
		let ret = {
			urls: [],
			eventUrls: []
		};
		if (this.connectionProfile.channels && this.connectionProfile.channels[channelId]) {
			for (let peerId in this.connectionProfile.channels[channelId].peers) {	//iter on the peers on this channel
				ret.urls.push(this.connectionProfile.peers[peerId].url);				//get the grpc url for this peer
				ret.eventUrls.push(this.connectionProfile.peers[peerId].eventUrl);	//get the grpc EVENT url for this peer
			}
		}
		return ret;
	};

	// get a peer's grpc event url
	getPeerEventUrl(key) {
		if (key === undefined || key == null) {
			throw new Error('Peer key not passed');
		} else {
			let peer = getPeer(key);
			if (peer) {
				return peer.eventUrl;
			}
			else {
				throw new Error('Peer key not found.');
			}
		}
	};

	// get a peer's tls options
	getPeerTlsCertOpts(key) {
		if (key === undefined || key == null) {
			throw new Error('Peer\'s key not passed');
		} else {
			let peer = this.getPeer(key);
			return this.buildTlsOpts(peer);
		}
	};

  /*
  * get peerNames
  */
  get peerNames() {
    return this.connectionProfile.organizations[this.orgName].peers
  }

  /*
  * get First PeerName
  */
	getFirstPeerName(ch) {
		const channel = this.connectionProfile.channels[ch];
		if (channel && channel.peers) {
			const peers = Object.keys(channel.peers);
			if (peers && peers[0]) {
				return peers[0];
			}
		}
		throw new Error('Peer not found on this channel', ch);
	};


  /*
  * get orderers name
  */
  get ordererNames() {
    return this.connectionProfile.channels[this.channelId].orderers
  }

  // get an orderer object
	getOrderer(key) {
		if (key === undefined || key == null) {
			throw new Error('Orderers key not passed');
		} else {
			if (this.connectionProfile.orderers) {
				return this.connectionProfile.orderers[key];
			} else {
				return null;
			}
		}
  };
  
  // get an orderer's grpc url
	getOrderersUrl(key) {
		if (key === undefined || key == null) {
			throw new Error('Orderers key not passed');
		} else {
			let orderer = this.getOrderer(key);
			if (orderer) {
				return orderer.url;
			}
			else {
				throw new Error('Orderer not found.');
			}
		}
	};

	// load cert from file path OR just pass cert back
	loadPem(obj) {
		if (obj && obj.path) {											// looks like field is a path to a file
			var path2cert = path.join(__dirname, '../card/' + obj.path);
			if (obj.path.indexOf('/') === 0) {
				path2cert = obj.path;									//its an absolute path
			}
			if (path2cert.indexOf('$HOME') >= 0) {
				path2cert = path2cert.replace('$HOME', os.homedir()).substr(1);
			}
			// logger.debug('loading pem from a path: ' + path2cert);
			return fs.readFileSync(path2cert, 'utf8') + '\r\n'; 		//read from file, LOOKING IN config FOLDER
		} else if (obj.pem) {											// looks like field is the pem we need
			console.debug('loading pem from JSON.');
			return obj.pem;
		}
		return null;													//can be null if network is not using TLS
	};
  
  // build the tls options for the sdk
	buildTlsOpts(node_obj) {
		let ret = {
			'ssl-target-name-override': null,
			pem: null,
			'grpc.http2.keepalive_time': 300,					//grpc 1.2.4
			'grpc.keepalive_time_ms': 300000,					//grpc 1.3.7
			'grpc.http2.keepalive_timeout': 35,					//grpc 1.2.4
			'grpc.keepalive_timeout_ms': 3500,					//grpc 1.3.7
		};
		if (node_obj) {
			if (node_obj.tlsCACerts) {
				ret.pem = this.loadPem(node_obj.tlsCACerts);
			}
			if (node_obj.grpcOptions) {
				for (var field in ret) {
					if (node_obj.grpcOptions[field]) {
						ret[field] = node_obj.grpcOptions[field];
					}
				}
			}
		}
		return ret;
  };
  
	// get a orderer's tls options
	getOrdererTlsCertOpts(key) {
		if (key === undefined || key == null) {
			throw new Error('Orderer\'s key not passed');
		} else {
			let orderer = this.getOrderer(key);
			return this.buildTlsOpts(orderer);
		}
	};
 
  /*
  * get the first orderer in the channels field
  */
	getFirstOrdererName(ch) {
		const channel = this.connectionProfile.channels[ch];
		if (channel && channel.orderers && channel.orderers[0]) {
			return channel.orderers[0];
		}
		throw new Error('Orderer not found for this channel', ch);
	};

  /*
  * getNetworkName
  */
  getNetworkName() {
    return this.connectionProfile.name;
  }

  // --------------------------------------------------------------------------------
	// Build CP Options
	// --------------------------------------------------------------------------------
	// make a unique id for the sample & channel & org & peer
	makeUniqueId() {
		const net_name = this.getNetworkName();
		const channel = this.channelId;
		const org = this.getClientOrg();
    const first_peer = this.peer0Name;
    
		return this.saferString('account-' + net_name + channel + org + first_peer);
	};

  /*
  * Sanitize string for filesystem
  */
	saferString(str) {
		let ret = '';
		if (str && typeof str === 'string') {
			ret = str.replace(/\W+/g, '');
		}
		return ret;
  };
  

	// ------------------------------------------------------------------------
	// Get the Next Certificate Authority - returns options to use for enrollment if there IS another CA to switch to
	/*
		options: {
					ca_urls: ['array of ca grpc urls'],
					ca_tls_opts: {
						pem: 'complete tls certificate',									<required if using ssl>
						ssl-target-name-override: 'common name used in pem certificate' 	<required if using ssl>
						grpc.keepalive_time_ms: <integer in milliseconds>,					<optional>
						grpc.keepalive_timeout_ms: <integer in milliseconds>				<optional>
					},
		}
	*/
	// ------------------------------------------------------------------------
	get_next_ca(options) {
		if (!options || !options.ca_urls || !options.ca_tls_opts) {
			logger.error('Missing options for get_next_ca()');
			return null;
		}

		this.using_ca_position++;
		if (this.using_ca_position >= options.ca_urls.length) {				//wrap around
			this.using_ca_position = 0;
		}

		if (this.using_ca_position === this.success_ca_position) {				//we've tried all ca, error out
      logger.error('Exhausted all CAs. There are no more CAs to try.');
			return null;
		} else {
			return this.get_ca(options);
		}
	};

	// find the first ca in the certificateAuthorities field for this org
	getFirstCaName(orgName) {
		const org = this.connectionProfile.organizations[orgName];
		if (org && org.certificateAuthorities) {
			if (org.certificateAuthorities && org.certificateAuthorities[0]) {
				return org.certificateAuthorities[0];
			}
		}
		logger.error('CA not found');
		return null;
	};
    
  // get a ca obj
	getCA(key) {
		if (key === undefined || key == null) {
			logger.error('CA key not passed');
			return null;
		} else {
			if (this.connectionProfile.certificateAuthorities) {
				return this.connectionProfile.certificateAuthorities[key];
			} else {
				return null;
			}
		}
  };
  
  // get a ca's tls options
	getCaTlsCertOpts(key) {
		if (key === undefined || key == null) {
			logger.error('CA key not passed');
			return null;
		} else {
			let ca = this.getCA(key);
			return this.buildTlsOpts(ca);
		}
  };
  
  /*
  * get CA
  */
	get_ca(options) {
		if (!options || !options.ca_urls || !options.ca_tls_opts) {
			logger.error('Missing options for get_ca()');
			return null;
		}

		options.ca_url = options.ca_urls[this.using_ca_position];			//use this CA
		//options.ca_tls_opts = options.ca_tls_opts;					//dsh todo get the array, return the right one
		//options.ca_name = options.ca_name;							//dsh todo get the array, return the right one
		return options;
	};

	// get a ca's name, could be null
	getCaName(key) {
		if (key === undefined || key == null) {
			logger.error('CA key not passed');
			return null;
		} else {
			let ca = this.getCA(key);
			if (ca) {
				return ca.caName;
			} else {
				logger.error('CA not found');
				return null;
			}
		}
	};

	// get all the ca http urls
	getAllCaUrls() {
		let ret = [];
		for (let id in this.connectionProfile.certificateAuthorities) {
			ret.push(this.connectionProfile.certificateAuthorities[id].url);
		}
		return ret;
	};

  /*
  * get Enroll User
  */
  getEnrollUser(caKey) {
    const user_index = 0;
		if (caKey === undefined || caKey == null) {
			logger.error('CA key not passed');
			return null;
		} else {
			var ca = this.getCA(caKey);
			if (ca && ca.registrar && ca.registrar[user_index]) {
				return ca.registrar[user_index];
			} else {
				logger.error('Cannot find enroll id at index.', caKey, user_index);
				return null;
			}
		}
  }

  
  /*
  * get channelName
  */
  get channelName() {
		if (this.connectionProfile && this.connectionProfile.channels) {
			var channels = Object.keys(this.connectionProfile.channels);
			if (channels[0]) {
        this.channelId = channels[0]
				return this.channelId;
			}
		}
		throw Error('No channels found in connection profile... this is problematic. A channel needs to be created before marbles can execute.');

  }

  // enroll an enrollId with the ca
	enroll(cb) {
    const options = this.makeEnrollmentOptions();
    let opts = this.get_ca(options);
    const self = this;
		enrollment.enroll(opts, function (err, resp) {
			if (err != null) {
				opts = this.get_next_ca(options);							//try another CA
				if (opts) {
					logger.info('Retrying enrollment on different ca');
					self.enroll(options, cb_done);
				} else {
					if (cb) cb(err, resp);					//out of CAs, give up
				}
			} else {
				self.success_ca_position = self.using_ca_position;			//remember the last good one
				if (cb) cb(err, resp);
			}
		});
	};

  /*
  * make Enrollment options
  */
  makeEnrollmentOptions() {
    const channel = this.channelId;
    const org_2_use = this.getClientOrg();
    const first_ca = this.getFirstCaName(org_2_use);
    const first_peer = this.getFirstPeerName(channel);
    const first_orderer = this.getFirstOrdererName(channel);
    const org_name = this.getClientOrg();
    const user_obj = this.getEnrollUser(first_ca);		//there may be multiple users
    return {
      channel_id: channel,
      uuid: this.makeUniqueId(),
      ca_urls: this.getAllCaUrls(),
      ca_name: this.getCaName(first_ca),
      orderer_url: this.getOrderersUrl(first_orderer),
      peer_urls: [this.getPeersUrl(first_peer)],
      enroll_id: user_obj.enrollId,
      enroll_secret: user_obj.enrollSecret,
      msp_id: org_name,
      ca_tls_opts: this.getCaTlsCertOpts(first_ca),
      orderer_tls_opts: this.getOrdererTlsCertOpts(first_orderer),
      peer_tls_opts: this.getPeerTlsCertOpts(first_peer),
      kvs_path: this.getKvsPath()
    };
  }

  /*
  * newPeer
  */
  newPeer() {
    const peer0Info = this.connectionProfile.peers[this.peer0Name];
  }

	//-----------------------------------------------------------------
	// Check Proposal Response
	//-----------------------------------------------------------------
	check_proposal_res(results, endorsed_hook) {
		var proposalResponses = results[0];
		var proposal = results[1];
		var header = results[2];

		//check response
		if (!proposalResponses || !proposalResponses[0] || !proposalResponses[0].response || proposalResponses[0].response.status !== 200) {
			if (endorsed_hook) endorsed_hook('failed');
			logger.error('Failed to obtain endorsement for transaction.', proposalResponses);
			throw proposalResponses;
		}
		else {
			logger.debug('Successfully obtained transaction endorsement');

			//call optional endorsement hook
			if (endorsed_hook) endorsed_hook(null, proposalResponses[0].response);

			//move on to ordering
			var request = {
				proposalResponses: proposalResponses,
				proposal: proposal,
				header: header
			};
			return request;
		}
  };
  
  // ----------------------------------------------------------
	// get the first chaincode id on the network
	// ----------------------------------------------------------
  getChaincodeId() {
		if (process.env.CHAINCODE_ID) {													// detected a preferred chaincode id instead of first
			//console.log('debug: found preferred chaincode id', process.env.CHAINCODE_ID);
			return process.env.CHAINCODE_ID;
		} else {																		// else get the first chaincode we see
			var channel = this.channelId;
			if (channel && this.connectionProfile.channels[channel] && this.connectionProfile.channels[channel].chaincodes) {
				if (Array.isArray(this.connectionProfile.channels[channel].chaincodes)) {				// config version 1.0.2 way
					let chaincode = this.connectionProfile.channels[channel].chaincodes[0];			// first one
					if (chaincode) {
						return chaincode.split(':')[0];
					}
				} else {
					let chaincode = Object.keys(cthis.connectionProfile.channels[channel].chaincodes);	// config version 1.0.0 and 1.0.1 way
					return chaincode[0];												// first one
				}
			}
			console.log('No chaincode ID found in connection profile... might be okay if we haven\'t instantiated marbles yet');
			return null;
		}
  };

  // ----------------------------------------------------------
	// get the chaincode id on network
	// ----------------------------------------------------------
	getBlockDelay() {
		let ret = 1000;
		var channel = this.channelId;
		if (this.connectionProfile.channels && this.connectionProfile.channels[channel] && this.connectionProfile.channels[channel]['x-blockDelay']) {
			if (!isNaN(this.connectionProfile.channels[channel]['x-blockDelay'])) {
				ret = cthis.connectionProfile.channels[channel]['x-blockDelay'];
			}
		}
		return ret;
	};
  
  // build the lib module options
  makeLibOptions() {
    const channel = this.channelId;
    const org_2_use = this.getClientOrg();
    const first_ca = this.getFirstCaName(org_2_use);
    const first_peer = this.getFirstPeerName(channel);
    const first_orderer = this.getFirstOrdererName(channel);
    return {
      block_delay: this.getBlockDelay(),
      channel_id: this.channelId,
      chaincode_id: this.getChaincodeId(),
      event_urls: this.getAllPeerUrls(channel).eventUrls,	//null is important
      chaincode_version: this.getChaincodeVersion(),
      ca_tls_opts: this.getCaTlsCertOpts(first_ca),
      orderer_tls_opts: this.getOrdererTlsCertOpts(first_orderer),
      peer_tls_opts: this.getPeerTlsCertOpts(first_peer),
      peer_urls: this.getAllPeerUrls(channel).urls,
    };
  };


	// get the re-enrollment period in seconds

  // ----------------------------------------------------------
	// get key value store location
	// ----------------------------------------------------------
	getKvsPath(opts) {
		const kvs_path = './';
		let ret = path.join(__dirname, '../card/' + kvs_path);
		return ret
  };
  
	get_event_url (options) {
		let ret = null;
		if (options && options.event_urls && options.event_urls[this.using_peer_position]) {
			ret = options.event_urls[this.using_peer_position];
		}
		console.log('setting target event url', ret);
		return ret;
	};

	invoke_chaincode(obj, options, cb_done) {
    options.target_event_url = this.get_event_url(options);			//get the desired event url to use
    const self = this;
		invoke_cc.invoke_chaincode(obj, options, function (err, resp) {
			if (err != null) {											//looks like an error with the request
				if (this.switch_peer(obj, options) == null) {				//try another peer
					logger.info('Retrying invoke on different peer');
					self.invoke_chaincode(obj, options, cb_done);
				} else {
					if (cb_done) cb_done(err, resp);					//out of peers, give up
				}
			} else {													//all good, pass resp back to callback
				self.success_peer_position = self.using_peer_position;		//remember the last good one
				if (cb_done) cb_done(err, resp);
			}
		});
	};

  query_chaincode (obj, options, cb_done) {
    const self = this;
		query_cc.query_chaincode(obj, options, function (err, resp) {
			if (err != null) {											//looks like an error with the request
				if (self.switch_peer(obj, options) == null) {				//try another peer
					logger.info('Retrying query on different peer');
					self.query_chaincode(obj, options, cb_done);
				} else {
					if (cb_done) cb_done(err, resp);					//out of peers, give up
				}
			} else {													//all good, pass resp back to callback
				self.success_peer_position = self.using_peer_position;		//remember the last good one
				if (cb_done) cb_done(err, resp);
			}
		});
	};
  // ----------------------------------------------------------
	// get the first chaincode version on the network
	// ----------------------------------------------------------
	getChaincodeVersion () {
		if (process.env.CHAINCODE_VERSION) {											// detected a preferred chaincode version instead of first
			//console.log('debug: found preferred chaincode version', process.env.CHAINCODE_VERSION);
			return process.env.CHAINCODE_VERSION;
		} else {																		// else get the first chaincode we see
			var channel = this.channelId;
			var chaincodeId = this.getChaincodeId();
			if (channel && chaincodeId) {
				if (Array.isArray(this.connectionProfile.channels[channel].chaincodes)) {				// config version 1.0.2 way
					let chaincode = this.connectionProfile.channels[channel].chaincodes[0];			// first one
					if (chaincode) {
						return chaincode.split(':')[1];
					}
				} else {
					return this.connectionProfile.channels[channel].chaincodes[chaincodeId];			// config version 1.0.0 and 1.0.1 way
				}
			}
			logger.warn('No chaincode version found in connection profile... might be okay if we haven\'t instantiated marbles yet');
			return null;
		}
	};
}

const fabric = new FabricClient();


fabric.enroll((err, result) => {
  if (err != null) {
    console.log('enroll callback error:',errCode);
  } else {
	
		const g_options = fabric.makeLibOptions();
    var options = {
					peer_urls: g_options.peer_urls,
					peer_tls_opts: g_options.peer_tls_opts,
					channel_id: g_options.channel_id,
					chaincode_id: g_options.chaincode_id,
					chaincode_version: g_options.chaincode_version,
					event_urls: g_options.event_urls,
          chaincode_id: 'loan',
          cc_function: 'invoke',
          cc_args: ['acc1','acc2','10']
    }

    fabric.invoke_chaincode(result, options, (err, resp) => {
      console.log('resp:', err, resp)
    })
  }
});

fabric.enroll((errCode, obj) => {
  if (errCode != null) {
    console.log('enroll callback error:',errCode);
  } else {
    var options = {
          chaincode_id: 'loan',
          cc_function: 'query',
          cc_args: ['acc1']
    }

    fabric.query_chaincode(obj, options, (err, resp) => {
      console.log('resp:', err, resp)
    })
  }
})

// console.log('makeEnrollmentOption:',fabric.makeEnrollmentOptions());
// console.log('makeLibOptions:', fabric.makeLibOptions())



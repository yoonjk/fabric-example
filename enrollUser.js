'use strict';

/*
 * Hyperledger Fabric Sample HSBN enroll Program
 */

var hfc = require('fabric-client');
var CaService = require('fabric-ca-client/lib/FabricCAClientImpl.js');
var User = require('fabric-client/lib/User.js');
var path = require('path');
const argv = require('yargs').argv
var fs = require("fs");

//User has to provide following parameters using command line
//node enrollUser.js --wallet_path='./network/creds' --user_id='admin' --user_secret='202028314D' --ca_url='https://fft-zbc01a.4.secure.blockchain.ibm.com:15185'
console.log("arguments", "wallet_path = " + argv.wallet_path + " " + "ca_url = " + argv.ca_url + " " + "user_id = " + argv.user_id + " " + "user_secret = " + argv.user_secret);

var options = {
    wallet_path: path.join(__dirname, './network/creds'),
    user_id: 'admin',
    user_secret: '',
    msp_id: 'org1',
    ca_url: 'https://n7e5e7e56feb64f22a870624470003ea1-org1-ca.us.blockchain.ibm.com:31011',
    ca_tls_opts: fs.readFileSync(path.join(__dirname, './network/tls') + '/ca.cert'),
    ca_name: "org1CA",
};

if (argv.wallet_path) {
    options.wallet_path = path.join(__dirname, argv.wallet_path);
}

if (argv.user_id) {
    options.user_id = argv.user_id;
}

if (argv.user_secret) {
    options.user_secret = argv.user_secret;
}

if (argv.ca_url) {
    options.ca_url = argv.ca_url;
}

var member;
var client = null;

Promise.resolve().then(() => {
    console.log("Create a client and set the wallet location");
    client = new hfc();
    return hfc.newDefaultKeyValueStore({ path: options.wallet_path });
}).then((wallet) => {
    console.log("Set wallet path, and associate user ", options.user_id, " with application");
    client.setStateStore(wallet);
}).then((wallet) => {
    var tlsOptions = {
        trustedRoots: [options.ca_tls_opts],
        verify: false
    };
    var ca_client = new CaService(options.ca_url, tlsOptions, options.ca_name)
    return ca_client.enroll({
        enrollmentID: options.user_id,
        enrollmentSecret: options.user_secret
    }).then((enrollment) => {
        console.log('Successfully enrolled user \'' + options.user_id + '\'');
        member = new User(options.user_id, client);
        return member.setEnrollment(enrollment.key, enrollment.certificate, options.msp_id);
    });
}).then(() => {
    return client.setUserContext(member);
});

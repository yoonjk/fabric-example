'use strict';

/*
 * Hyperledger Fabric Sample Generate Cert Program
 */

var path = require('path');
var fs = require("fs");
const argv = require('yargs').argv

// setting the path of Blockchain service credentials
var cred_file = process.argv[2].split('=')[1];
console.log('cred file:', cred_file);
var creds_path = path.join(__dirname, './config/connection_profile.json');
var creds = require(creds_path);
var cert_path = path.join(__dirname, './network/tls');
var channelName = "fabcar";

if (argv.cert_path) {
    cert_path = path.join(__dirname, argv.cert_path);
}

if (argv.input) {
    creds_path = path.join(__dirname, argv.input);
    console.log('cred_path:', creds_path);
}

if (argv.channel) {
    channelName = argv.channel;
}

// Get CA certificate from Blockchain service credentials
function getCATLScertObj(node, index) {
    var caName = creds.organizations.org1.certificateAuthorities[index];
    var caCert;
    if (caName && creds.certificateAuthorities[caName].tlsCACerts.pem) {
        caCert = creds.certificateAuthorities[caName].tlsCACerts.pem;
    }

    //log the info for enrollment
    if (caName && creds.certificateAuthorities[caName].registrar[0]) {
        console.log("EnrollmentId: " + creds.certificateAuthorities[caName].registrar[0].enrollId);
        console.log("EnrollmentSecret: " + creds.certificateAuthorities[caName].registrar[0].enrollSecret);
    }

    if (caName && creds.certificateAuthorities[caName].url) {
        console.log("CA-URL: " + creds.certificateAuthorities[caName].url);
    }
    return caCert;
}

// Get Peer certificate from Blockchain service credentials
function getTLScertObj(node, index) {
    var peerName = creds.organizations.org1.peers[index];
    var peerCert;
    if (peerName && creds.peers[peerName].tlsCACerts.pem) {
        peerCert = JSON.stringify(creds.peers[peerName].tlsCACerts);        
    }

    //log the info for invoke / query
    if (peerName && creds.peers[peerName].url) {
        console.log("peer-url: " + creds.peers[peerName].url);
    } else {
        console.log("could not find peer url");
    }

    if (peerName && creds.peers[peerName].eventUrl) {
        console.log("peer-event-url: " + creds.peers[peerName].eventUrl);
    } else {
        console.log("could not find event url");
    }

    //get orderer name 
    var ordererName;
    if (creds.channels[channelName] && creds.channels[channelName].orderers) {
        ordererName = creds.channels[channelName].orderers[0];
    }

    if (ordererName && creds.orderers[ordererName]) {
        console.log("orderer-url: " + creds.orderers[ordererName].url);
    } else {
        console.log("could not find orderer url for channel " + channelName);
    }

    return peerCert;
}

if (!fs.existsSync(cert_path)) {
    fs.mkdirSync(cert_path);
}
//write the CA certificate in the given path in ca.cert file
fs.writeFile(cert_path + '/ca.cert', getCATLScertObj('cas', 0), function (err) {
    if (err) {
        return console.error(err);
    }

});
//write the Peer certificate in the given path in peer.cert file
fs.writeFile(cert_path + '/peer.cert', getTLScertObj('peers', 0), function (err) {
    if (err) {
        return console.error(err);
    }
});

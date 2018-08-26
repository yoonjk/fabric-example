
var connection = require('../card/connection.json');
//console.log('connection:',connection);
const orgName = connection.client.organization
const test = connection.organizations[orgName].certificateAuthorities

for (const [key,value] of Object.entries(connection.channels)) {

  const [ordererName] = value.orderers ;
  const peerName = value.peers;

  for (const key of Object.keys(value.peers)) {
    console.log('2.key:', key);
    break;
  }  

  console.log('peerName:', peerName);
  console.log(` key:${key}, value:${value}, ordererName:${ordererName}, peerName:${peerName}`);
}

console.log(` org:${orgName}, ${test}, `);
console.log('test:', connection.organizations[orgName].peers);

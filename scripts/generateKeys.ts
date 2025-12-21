import { generateKeyPairSync } from 'crypto';
import { writeFileSync } from 'fs';

console.log("generating rsa keys...");

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem',
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem',
  },
});

writeFileSync('./keys/publicKey.txt', publicKey);
writeFileSync('./keys/privateKey.txt', privateKey);

console.log('keys have been saved in "keys" folder');
import { readFileSync } from "fs";

const publicKey = readFileSync('./keys/publicKey.pem', 'utf-8');

fetch('http://localhost:3000/balance', {
    method: 'POST',
    headers: {
        'Content-type': 'application/json'
    },
    body: JSON.stringify({
        address: Buffer.from(publicKey, 'utf-8').toString('base64')
    })
}).then(async res => {
    console.log(await res.json());
});
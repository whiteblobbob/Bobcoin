import { readFileSync } from "fs";

const publicKey = readFileSync('./keys/publicKey.txt', 'utf-8')

fetch('http://localhost:3000/balance', {
    method: 'POST',
    headers: {
        'Content-type': 'application/json'
    },
    body: JSON.stringify({
        address: publicKey
    })
}).then(async res => {
    console.log(await res.json());
});
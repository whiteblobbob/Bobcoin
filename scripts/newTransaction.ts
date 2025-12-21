import { createSign } from "crypto";
import { readFileSync } from "fs";

const [publicKey, privateKey, receiver] = [
    readFileSync('./keys/publicKey.txt', 'utf-8'),
    readFileSync('./keys/privateKey.txt', 'utf-8'),
    readFileSync('./keys/receiver.txt', 'utf-8'),
];

const sign = createSign('SHA256');
sign.update(`${publicKey}|${receiver}|1`);
const signature = sign.sign(privateKey, 'hex');

fetch('http://localhost:3000/transaction', {
    method: 'POST',
    headers: {
        'Content-type': 'application/json'
    },
    body: JSON.stringify({
        sender: publicKey,
        receiver: receiver,
        amount: 1,
        signature
    })
}).then(res => {
    console.log("success");
});
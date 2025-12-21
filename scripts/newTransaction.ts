import { createSign } from "crypto";
import { readFileSync } from "fs";

const AMOUNT = 0;

const [publicKey, privateKey, receiver] = [
    readFileSync('./keys/publicKey.pem', 'utf-8'),
    readFileSync('./keys/privateKey.pem', 'utf-8'),
    readFileSync('./keys/receiver.pem', 'utf-8'),
];

const sign = createSign('SHA256');
sign.update(`${publicKey}|${receiver}|${AMOUNT}`);
const signature = sign.sign(privateKey, 'hex');

fetch('http://localhost:3000/transaction', {
    method: 'POST',
    headers: {
        'Content-type': 'application/json'
    },
    body: JSON.stringify({
        sender: Buffer.from(publicKey, 'utf-8').toString('base64'),
        receiver: Buffer.from(receiver, 'utf-8').toString('base64'),
        amount: AMOUNT,
        signature
    })
}).then(res => {
    console.log("success");
});
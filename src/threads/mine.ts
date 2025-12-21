import { createHash } from "crypto";
import { parentPort, workerData, isMainThread } from "worker_threads";
import { exit } from "process";
import { BlockJSON, DIFFICULTY } from "../node";

function calculateHash(blockJSON: BlockJSON) {
    const transactionString = () => {
        return blockJSON.data.map(tx => `${tx.sender}|${tx.receiver}|${tx.amount}`).join(',');
    };

    const blockString = `${blockJSON.index} ${blockJSON.timestamp} ${blockJSON.previousHash} ${transactionString()} ${blockJSON.nonce}`;

    const hash = createHash('sha256')
        .update(blockString)
        .digest('hex');

    return hash;
}

function mine(block: BlockJSON) {
    while (true) {
        const hash = calculateHash(block);
        block.hash = hash;

        if (hash.startsWith('0'.repeat(DIFFICULTY))) {
            return block;
        }

        block.nonce++;
    }
}

if (isMainThread) {
    exit();
}

const block = mine(workerData);

parentPort!.postMessage(block);
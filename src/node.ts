import { createHash, createVerify } from "crypto";
import EventEmitter from "events";
import { Worker } from "worker_threads";
import { ErrorType } from "./types";
import { readFileSync } from "fs";

export const DIFFICULTY = 5;
const MAX_TRANSACTIONS = 3;
const REWARD = 5;

type Transaction = {
    sender: string | null,
    receiver: string,
    amount: number,
    signature: string | null
}

export type BlockJSON = {
    timestamp: number,
    previousHash: string,
    data: Transaction[],
    nonce: number,
    hash: string,
    index: number
}

export class Block {
    timestamp = Date.now();
    previousHash: string;
    data: Transaction[];
    nonce = 0;
    hash: string;
    index: number;

    constructor(previousHash: string, data: Transaction[], index: number) {
        this.previousHash = previousHash;
        this.data = data;
        this.hash = this.calculateHash();
        this.index = index;
    }

    blockString(): string {
        return this.data.map(tx => `${tx.sender}|${tx.receiver}|${tx.amount}`).join(',');
    }

    calculateHash(): string {
        const blockString = `${this.index} ${this.timestamp} ${this.previousHash} ${this.blockString()} ${this.nonce}`;

        const hash = createHash('sha256')
            .update(blockString)
            .digest('hex');

        return hash;
    }

    async mine() {
        while (true) {
            const hash = this.calculateHash();
            this.hash = hash;

            if (hash.startsWith('0'.repeat(DIFFICULTY))) {
                break;
            }

            this.nonce++;
        }
    }

    json(): BlockJSON {
        return ({
            timestamp: this.timestamp,
            previousHash: this.previousHash,
            data: this.data,
            nonce: this.nonce,
            hash: this.hash,
            index: this.index
        });
    }
}

export class BlockChain {
    blocks: Block[] = [];

    // addBlock(data: Transaction[]) {
    //     const chainLength = this.blocks.length;
    //     this.blocks.push(new Block(this.blocks[chainLength - 1]!.hash, data));
    // }

    json() {
        return this.blocks.map(block => block.json());
    }

    addBlockFromJSON(blockJSON: BlockJSON) {
        const block = new Block(blockJSON.previousHash, blockJSON.data, blockJSON.index);
        block.hash = blockJSON.hash;
        block.nonce = blockJSON.nonce;
        block.timestamp = blockJSON.timestamp;

        this.blocks.push(block);
    }

    fromJSON(blocks: BlockJSON[]) {
        blocks.forEach(blockJSON => {
            const block = new Block(blockJSON.previousHash, blockJSON.data, blockJSON.index);
            block.hash = blockJSON.hash;
            block.nonce = blockJSON.nonce;
            block.timestamp = blockJSON.timestamp;

            this.blocks.push(block);
        });

        return this;
    }

    checkBalance(address: string) {
        let balance = 0;

        this.blocks.forEach(block => block.data.forEach(tx => {
            if (tx.sender === address) {
                balance -= tx.amount;
            }

            if (tx.receiver === address) {
                balance += tx.amount;
            }
        }));

        return balance;
    }
    
    validate() {
        for (let i = 1; i < this.blocks.length; i++) {
            // this makes sure that the block datas wasnt tampered with AT ALL
            if (this.blocks[i]!.hash !== this.blocks[i]!.calculateHash()) {
                this.blocks.pop();

                console.log(`invalid block on index ${i} (tampered data)`);

                return false;
            }

            // checks if the chain is still intact
            if (this.blocks[i]!.previousHash !== this.blocks[i-1]!.hash) {
                this.blocks.pop();

                console.log(`invalid block on index ${i} (broken chain)`);

                return false;
            }

            // also check if the chain is still intact
            if (this.blocks[i]!.index !== this.blocks[i-1]!.index + 1) {
                this.blocks.pop();
                console.log(`invalid block on index ${i} (broken chain)`);

                return false;
            }

            // check for diff
            if (!this.blocks[i]!.hash.startsWith('0'.repeat(DIFFICULTY))) {
                this.blocks.pop();
                console.log(`invalid block on index ${i} (invalid proof of work)`);
                return false;
            }

            // check transactions
            const transactions = this.blocks[i]!.data; 
            for (let j = 0; j < transactions.length; j++) {
                if (transactions[j]!.sender === null) {
                    if (j !== 0) {
                        this.blocks.pop();
                        console.log(`invalid block on index ${i} (invalid reward)`);
                        return false;
                    }

                    if (transactions[j]!.amount !== REWARD) {
                        this.blocks.pop();
                        console.log(`invalid block on index ${i} (invalid reward amount)`);
                        return false;
                    }
                }
            }
        }

        return true;
    }
}

const publicKey = readFileSync('./keys/publicKey.pem', 'utf-8'); // also your address

export const nodeEvents = new EventEmitter();

export let blockChain = new BlockChain();

let transactions: Transaction[] = [{
    sender: null,
    receiver: publicKey,
    amount: REWARD,
    signature: null
}];

export async function initNode() {
    if (blockChain.blocks.length > 0) {
        return;
    }

    // genesis block
    const genesisBlock = new Block("0", [{
        sender: null,
        receiver: publicKey,
        amount: 10,
        signature: null
    }], 0);

    console.log("mining genesis block...");
    await genesisBlock.mine();

    blockChain.blocks.push(genesisBlock);
}

export async function addTransactions(txs: Transaction[]) {
    const validTxs: Transaction[] = [];

    // validate the transaction
    txs.forEach(tx => {
        if (!tx.signature || !tx.sender || tx.amount < 0) {
            return;
        }

        const verify = createVerify('SHA256');
        verify.update(`${tx.sender}|${tx.receiver}|${tx.amount}`);
        const isVerified = verify.verify(tx.sender, tx.signature, 'hex');

        if (!isVerified) {
            return;
        }

        // checks if that person has enough balance
        let balance = 0;

        blockChain.blocks.forEach(block => block.data.forEach(oldTx => {
            if (oldTx.sender === tx.sender) {
                balance -= oldTx.amount;
            }

            if (oldTx.receiver === tx.sender) {
                balance += oldTx.amount;
            }
        }));

        if (balance - tx.amount < 0) {
            return;
        }

        console.log(`ADDED NEW TRANSACTION (new balance: ${balance - tx.amount})`);

        validTxs.push(tx);
    });

    transactions.push(...validTxs);

    if (transactions.length < MAX_TRANSACTIONS + 1) {
        return;
    }

    const blocks = blockChain.blocks;

    // make a new block
    const block = new Block(
        blocks.at(-1)!.hash,
        transactions,
        blocks.at(-1)!.index + 1
    );

    // clears the transaction list
    transactions = [{
        sender: null,
        receiver: publicKey,
        amount: REWARD,
        signature: null
    }];

    console.log("max transaction reached");

    // background mining, doesnt block the whole app
    const worker = new Worker('./src/threads/mine.ts', {
        workerData: block.json(),
        execArgv: ['-r', 'ts-node/register']
    });

    console.log("mining...");

    worker.on("message", (block: BlockJSON) => {
        // add the new block & notify endpoint
        blockChain.addBlockFromJSON(block);
        nodeEvents.emit("newBlock", block);

        const valid = blockChain.validate();

        if (!valid) {
            nodeEvents.emit("sync");
        }

        console.log("finished mining");
    });
}
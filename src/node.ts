import { createHash } from "crypto";
import EventEmitter from "events";
import { Worker } from "worker_threads";
import { ErrorType } from "./types";

const DIFFICULTY = 5;
const MAX_TRANSACTIONS = 5;
const REWARD = 64;

type Transaction = {
    sender: string,
    receiver: string,
    amount: number
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
    
    validate() {
        for (let i = 1; i < this.blocks.length; i++) {
            // this makes sure that the block datas wasnt tampered with AT ALL
            if (this.blocks[i]!.hash !== this.blocks[i]!.calculateHash()) {
                this.blocks.pop();

                console.log(`invalid block on index ${i} (tampered data)`);

                return ErrorType.tamperedData;
            }

            // checks if the chain is still intact
            if (this.blocks[i]!.previousHash !== this.blocks[i-1]!.hash) {
                this.blocks.pop();

                console.log(`invalid block on index ${i} (broken chain)`);

                return ErrorType.outOfSync;
            }

            // also check if the chain is still intact
            if (this.blocks[i]!.index !== this.blocks[i-1]!.index + 1) {
                this.blocks.pop();
                console.log(`invalid block on index ${i} (broken chain)`);

                return ErrorType.outOfSync;
            }

            // check for diff
            if (!this.blocks[i]!.hash.startsWith('0'.repeat(DIFFICULTY))) {
                this.blocks.pop();
                console.log(`invalid block on index ${i} (invalid proof of work)`);
                return ErrorType.invalidPoW;
            }

            // check transactions
            const transactions = this.blocks[i]!.data; 
            for (let j = 0; j < transactions.length; j++) {
                if (transactions[j]!.sender === 'system') {
                    if (j !== 0) {
                        this.blocks.pop();
                        console.log(`invalid block on index ${i} (invalid reward)`);
                        return ErrorType.invalidPoW;
                    }

                    if (transactions[j]!.amount !== REWARD) {
                        this.blocks.pop();
                        console.log(`invalid block on index ${i} (invalid reward amount)`);
                        return ErrorType.invalidPoW;
                    }
                }
            }
        }

        return ErrorType.valid;
    }
}

export const nodeEvents = new EventEmitter();

export let blockChain = new BlockChain();
let transactions: Transaction[] = [{
    sender: "system",
    receiver: "bob",
    amount: REWARD
}];

export async function initNode() {
    if (blockChain.blocks.length > 0) {
        return;
    }

    // genesis block
    const genesisBlock = new Block("0", [{
        sender: 'system',
        receiver: 'system`',
        amount: 0
    }], 0);

    console.log("mining genesis block...");
    await genesisBlock.mine();

    blockChain.blocks.push(genesisBlock);
}

export async function addTransactions(txs: Transaction[]) {
    transactions.push(...txs);

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

    transactions = [{
        sender: "system",
        receiver: "bob",
        amount: REWARD
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

        console.log("finished mining");
    });
}
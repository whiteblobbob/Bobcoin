import { createHash } from "crypto";
import EventEmitter from "events";

const DIFFICULTY = 4;
const MAX_TRANSACTIONS = 5;

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
    hash: string
}

export class Block {
    timestamp = Date.now();
    previousHash: string;
    data: Transaction[];
    nonce = 0;
    hash: string;

    constructor(previousHash: string, data: Transaction[]) {
        this.previousHash = previousHash;
        this.data = data;
        this.hash = this.calculateHash();
    }

    blockString(): string {
        return this.data.map(tx => `${tx.sender}|${tx.receiver}|${tx.amount}`).join(',');
    }

    calculateHash(): string {
        const blockString = `${this.timestamp} ${this.previousHash} ${this.blockString()} ${this.nonce}`;

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

    getJSON(): BlockJSON {
        return ({
            timestamp: this.timestamp,
            previousHash: this.previousHash,
            data: this.data,
            nonce: this.nonce,
            hash: this.hash
        });
    }
}

export class BlockChain {
    blocks: Block[] = [];

    // addBlock(data: Transaction[]) {
    //     const chainLength = this.blocks.length;
    //     this.blocks.push(new Block(this.blocks[chainLength - 1]!.hash, data));
    // }

    addBlockFromJSON(blockJSON: BlockJSON) {
        const block = new Block(blockJSON.previousHash, blockJSON.data);
        block.hash = blockJSON.hash;
        block.nonce = blockJSON.nonce;
        block.timestamp = blockJSON.timestamp;

        this.blocks.push(block);
    }

    fromJSON(blocks: BlockJSON[]) {
        blocks.forEach(blockJSON => {
            const block = new Block(blockJSON.previousHash, blockJSON.data);
            block.hash = blockJSON.hash;
            block.nonce = blockJSON.nonce;
            block.timestamp = blockJSON.timestamp;

            this.blocks.push(block);
        });

        return this;
    }
    
    validate(): boolean {
        for (let i = 1; i < this.blocks.length; i++) {
            // this makes sure that the block datas wasnt tampered with AT ALL
            if (this.blocks[i]!.hash !== this.blocks[i]!.calculateHash()) {
                console.log(`invalid block on index ${i} (tampered data)`);
                return false;
            }

            // checks if the chain is still intact
            if (this.blocks[i]!.previousHash !== this.blocks[i-1]!.hash) {
                console.log(`invalid block on index ${i} (broken chain)`);
                return false;
            }

            // check for diff
            if (!this.blocks[i]!.hash.startsWith('0'.repeat(DIFFICULTY))) {
                console.log(`invalid block on index ${i} (invalid proof of work)`);
                return false;
            }

            // check transactions
            const transactions = this.blocks[i]!.data; 
            for (let j = 0; j < transactions.length; j++) {
                if (transactions[j]!.sender === 'system' && j !== 0) {
                    console.log(`invalid block on index ${i} (invalid reward)`);
                    return false;
                }
            }
        }

        return true;
    }
}

export const nodeEvents = new EventEmitter();

export let blockChain = new BlockChain();
let transactions: Transaction[] = [];

export async function initNode(startingBlockChain: BlockChain) {
    if (startingBlockChain.blocks.length > 0) {
        blockChain = startingBlockChain;

        return;
    }

    // genesis block
    const genesisBlock = new Block("0", [{
        sender: 'system',
        receiver: 'system`',
        amount: 0
    }]);

    await genesisBlock.mine();

    blockChain.blocks.push(genesisBlock);
}

export async function addTransactions(txs: Transaction[]) {
    transactions.push(...txs);

    if (transactions.length < MAX_TRANSACTIONS) {
        return;
    }

    const blocks = blockChain.blocks;

    // make a new block
    const block = new Block(
        blocks[blocks.length - 1]!.hash,
        transactions
    );

    transactions = [];

    await block.mine();

    // add the new block & notify endpoint
    blockChain.blocks.push(block);
    nodeEvents.emit("newBlock", block);
}
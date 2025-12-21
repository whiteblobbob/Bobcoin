import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { io as ioClient, Socket } from "socket.io-client";
import { blockChain, BlockChain, BlockJSON, initNode, nodeEvents } from "./node";
import router from "./endpoints";
import { ErrorType, MessageType } from "./types";
import { randomUUID } from "crypto";

const PORT = 3000;
const NODE_ID = randomUUID();  // for identification
const peerList: string[] = [];

const app = express();
const server = createServer(app);
const io = new Server(server);
const clients: Socket[] = [];
const nodeIds: {[clientId: string]: string} = {};

// http stuff
app.use(express.json());
app.use(router);

// socket stuff
io.on("connection", (socket) => {
    console.log("client connected");

    // handshake whatever
    socket.emit(MessageType.handshake, NODE_ID);

    socket.on(MessageType.askForBlockChain, (callback) => {
        callback(blockChain.json());
    });

    socket.on(MessageType.newBlock, (data: BlockJSON) => {
        blockChain.addBlockFromJSON(data);

        const valid = blockChain.validate();
        
        if (valid !== ErrorType.valid) {
            if (valid === ErrorType.outOfSync) {
                syncBlockChain();
            }

            return;
        }

        clients.forEach(client => {
            if (nodeIds[client.id!] === socket.handshake.query.id) {
                return;
            }

            client.emit(MessageType.newBlock, data);
        });

        console.log(blockChain.blocks);
    });
});

async function syncBlockChain() {
    const requests = clients.map(client => {
        return new Promise(res => {
            // timeout
            setTimeout(() => res(null), 10 * 1000);

            // ask for blockchain
            client.emit(MessageType.askForBlockChain, (data: BlockJSON[]) => {
                if (data.length > blockChain.blocks.length) {
                    const tempBlockChain = new BlockChain();
                    tempBlockChain.fromJSON(data);

                    if (tempBlockChain.validate() === ErrorType.valid) {
                        blockChain.blocks = tempBlockChain.blocks;
                    }
                }

                res(null);
            });
        });
    });

    await Promise.all(requests);
}

async function init() {
    peerList.forEach(url => {
        const client = ioClient(url, {
            query: {
                id: NODE_ID
            }
        });
        clients.push(client);

        client.on(MessageType.handshake, id => {
            nodeIds[client.id!] = id;
        });

        console.log(`server connected: ${url}`);
    });

    // node initialization
    await syncBlockChain();
    await initNode();

    server.listen(PORT, () => {
        console.log(`http and socket open on port ${PORT}`);
    });
}

init();

// listener
nodeEvents.on("newBlock", (data: BlockJSON) => {
    clients.forEach(client => {
        client.emit(MessageType.newBlock, data);
    });
});
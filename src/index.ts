import express, { Request, Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { io as ioClient, Socket } from "socket.io-client";
import { addTransactions, Block, blockChain, BlockChain, BlockJSON, initNode, nodeEvents } from "./node";

const PORT = 3420;
const peerList = [
    "http://localhost:3727"
];

const app = express();
const server = createServer(app);
const io = new Server(server);
const clients: Socket[] = [];

// http stuff
app.use(express.json());

app.post("/transaction", (req: Request, res: Response) => {
    if (!req.body) {
        return res.status(400).json({
            error: "Missing required fields"
        });
    }

    const { sender, receiver, amount } = req.body;

    if (!sender || !receiver || amount === null) {
        return res.status(400).json({
            error: "Missing required fields"
        });
    }

    addTransactions([{
        sender,
        receiver,
        amount
    }]);

    return res.status(200).json({ message: "Successful" });
});

// socket stuff
io.on("connection", (socket) => {
    console.log("client connected");

    socket.on("askForBlockChain", (callback) => {
        callback(blockChain.blocks.map(block => block.getJSON()));
    });

    socket.on("newBlock", (data: BlockJSON) => {
        blockChain.addBlockFromJSON(data);
        
        if (!blockChain.validate()) {
            blockChain.blocks.pop();
        }

        console.log(blockChain.blocks);
    });
});

async function init() {
    // for blockchain synchronization
    let longestBlockChain = new BlockChain();

    const requests = peerList.map(url => {
        return new Promise(res => {
            const client = ioClient(url);
            clients.push(client);

            console.log(`server connected: ${url}`);

            // ask for blockchain
            client.emit("askForBlockChain", (data: BlockJSON[]) => {
                if (data.length > longestBlockChain.blocks.length) {
                    const tempBlockChain = new BlockChain();
                    tempBlockChain.fromJSON(data);

                    if (tempBlockChain.validate()) {
                        longestBlockChain = tempBlockChain;
                    }
                }

                res(null);
            });
        });
    });

    await Promise.all(requests);

    // node initialization
    initNode(longestBlockChain);
}

init();

server.listen(PORT, () => {
    console.log(`http and socket open on port ${PORT}`);
});

// listener
nodeEvents.on("newBlock", (data: Block) => {
    clients.forEach(client => {
        client.emit("newBlock", data.getJSON());
    });
})
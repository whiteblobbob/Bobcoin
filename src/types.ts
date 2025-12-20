export enum MessageType {
    askForBlockChain = "askForBlockChain",
    newBlock = "newBlock",
    handshake = "handshake",
};

export enum ErrorType {
    tamperedData = "tamperedData",
    outOfSync = "outOfSync",
    invalidPoW = "invalidPoW",
    valid = "valid"
}
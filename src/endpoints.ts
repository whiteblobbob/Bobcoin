import { Request, Response, Router } from "express";
import { addTransactions, blockChain } from "./node";

const router = Router();

router.post("/transaction", (req: Request, res: Response) => {
    if (!req.body) {
        return res.status(400).json({
            error: "Missing required fields"
        });
    }

    const { sender, receiver, amount, signature } = req.body;

    if (!sender || !receiver || !signature || amount === null) {
        return res.status(400).json({
            error: "Missing required fields"
        });
    }

    res.status(200).json({ message: "Successful" });

    addTransactions([{
        sender,
        receiver,
        amount,
        signature
    }]);
});

router.post("/balance", (req: Request, res: Response) => {
    if (!req.body) {
        return res.status(400).json({
            error: "Missing required fields"
        });
    }

    const { address } = req.body;

    if (!address || typeof(address) !== 'string') {
        return res.status(400).json({
            error: "Missing required fields"
        });
    }

    res.status(200).json({ balance: blockChain.checkBalance(address) });
});

export default router;
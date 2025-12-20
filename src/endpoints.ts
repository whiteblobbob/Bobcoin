import { Request, Response, Router } from "express";
import { addTransactions } from "./node";

const router = Router();

router.post("/transaction", (req: Request, res: Response) => {
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

    res.status(200).json({ message: "Successful" });

    addTransactions([{
        sender,
        receiver,
        amount
    }]);
});

export default router;
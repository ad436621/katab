import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import lettersRouter from "./letters.js";
import verifyRouter from "./verify.js";
import repliesRouter from "./replies.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/letters", lettersRouter);
router.use("/verify", verifyRouter);
router.use("/replies", repliesRouter);

export default router;

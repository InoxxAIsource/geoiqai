import { Router, type IRouter } from "express";
import healthRouter from "./health";
import auditRouter from "./audit";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import scoresRouter from "./scores";
import paymentRouter from "./payment";
import emailRouter from "./email";
import roadmapRouter from "./roadmap";
import agentRouter from "./agent";
import integrationsRouter from "./integrations";
import contentImprovementsRouter from "./content-improvements";
import dataforseoExtendedRouter from "./dataforseo-extended";

const router: IRouter = Router();

router.use(healthRouter);
router.use(auditRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(scoresRouter);
router.use(paymentRouter);
router.use(emailRouter);
router.use(roadmapRouter);
router.use(agentRouter);
router.use(integrationsRouter);
router.use(contentImprovementsRouter);
router.use(dataforseoExtendedRouter);

export default router;

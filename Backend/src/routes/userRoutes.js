import {Router} from 'express';
import userControllers from '../controllers/userControllers.js';
import authMiddleware from '../middlewares/authMiddleware.js';


const router = Router();

router.post("/register", userControllers.registerUser);
router.post("/login", userControllers.loginUser);
router.get("/profile", authMiddleware.authenticateUser, userControllers.getUserProfile);
router.post("/logout", authMiddleware.authenticateUser, userControllers.logoutUser);
router.get("/history", authMiddleware.authenticateUser, userControllers.getUserHistory);
router.post("/history", authMiddleware.authenticateUser, userControllers.addToHistory);

export default router;




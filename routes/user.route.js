import express from "express";
import {
    authenticateUser,
    changeUserPassword,
    createUserAccount,
    deleteUserAccount,
    forgotPassword,
    getCurrentUserProfile,
    googleLogin,
    refreshToken,
    resetPassword,
    signOutUser,
    updateUserProfile
} from "../controllers/user.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";
import upload from "../utils/multer.js";
import { validateSignup, validateSignin, validatePasswordChange } from "../middleware/validation.middleware.js";

const router = express.Router();

// Auth routes
router.post("/signup", validateSignup, createUserAccount);
router.post("/signin", validateSignin, authenticateUser);
router.get("/oauth/google", googleLogin);
router.post("/signout", signOutUser);
router.post("/refresh-token/:token", refreshToken);

// Profile routes
router.get("/profile", isAuthenticated, getCurrentUserProfile);
router.patch("/profile", isAuthenticated, upload.single("avatar"), updateUserProfile);

// Password management
router.patch("/change-password", isAuthenticated, validatePasswordChange, changeUserPassword);
router.post("/forgot-password", isAuthenticated, forgotPassword);
router.post("/reset-password/:token", isAuthenticated, resetPassword);

// Account management
router.delete("/account", isAuthenticated, deleteUserAccount);

export default router;
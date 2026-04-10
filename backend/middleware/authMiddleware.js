import { requireAuth } from "@clerk/express";
import User from "../models/userModel.js";

// Protect routes (check if user is logged in)
export const protect = (requireAuth);

// Optional: Attach user data from MongoDB
export const attachUser = async (req, res, next) => {
  try {
    const { userId } = req.auth;

    // Find user in DB using clerkId
    let user = await User.findOne({ clerkId: userId });

    // If user does not exist → create one
    if (!user) {
      user = await User.create({
        clerkId: userId,
        email: req.auth?.sessionClaims?.email || "",
        name: req.auth?.sessionClaims?.name || ""
      });
    }

    req.user = user; // attach user to request
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};
import { clerkMiddleware, getAuth } from '@clerk/express';
import User from '../models/User.js'

export { clerkMiddleware }

export const protect = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized. Please sign in" });
  }
  next();
}

export const attachUser = async (req, res, next) => {
  try {
    const { userId, sessionClaims } = getAuth(req);

    // ADD THIS - tells you exactly what Clerk is sending
    console.log("SESSION CLAIMS:", JSON.stringify(sessionClaims, null, 2));

    let user = await User.findOneAndUpdate(
      { clerkId: userId },
      {
        $set: {                          // $set was MISSING before - critical bug
          email: sessionClaims?.email ?? "",
          name: sessionClaims?.name ?? "",
        },
        $setOnInsert: { clerkId: userId } // only set clerkId on first creation
      },
      { upsert: true, new: true }         // new:true not returnDocument
    );

    req.user = user;
    next();
  } catch (error) {
    console.error("attachUser error:", error);
    res.status(500).json({ message: "Server error during authentication." });
  }
};
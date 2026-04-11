
import {clerkMiddleware, getAuth} from '@clerk/express';
import User from '../models/User.js'

//Initialize clerk middleware
//add this once in server.js: app.use(clearkMiddleware())
//it verifies the jwt every request and populate req.auth;
export {clerkMiddleware}

// step 2 == Protect a route =========
//// Returns 401 automatically if the token is missing or invalid.

export const protect = (req, res, next) => {
  const {userId} = getAuth(req);

  if(!userId){
    return res.status(401).json({
      message: "Unauthorized. Please sign in"
    })
  }
  next();
}

export const attachUser = async (req, res, next) => {
  try {
    const { userId, sessionClaims } = getAuth(req);

    // findOneAndUpdate → finds the user and updates name/email
    // if user doesn't exist → creates one (upsert: true)
    // new: true → returns the updated document
    let user = await User.findOneAndUpdate(
      { clerkId: userId },
      {
        clerkId: userId,
        email: sessionClaims?.email ?? "",
        name: sessionClaims?.name ?? "",
      },
      { upsert: true, returnDocument: "after" }
    );

    req.user = user;
    next();
  } catch (error) {
    console.error("attachUser error:", error);
    res.status(500).json({ message: "Server error during authentication." });
  }
};
import { clerkMiddleware, getAuth, clerkClient } from '@clerk/express';
import User from '../models/User.js';

export { clerkMiddleware };

export const protect = (req, res, next) => {
    const { userId } = getAuth(req);
    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized. Please sign in.' });
    }
    next();
};

export const attachUser = async (req, res, next) => {
    try {
        const { userId } = getAuth(req);

        const clerkUser = await clerkClient.users.getUser(userId);

        const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
        const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();

        const user = await User.findOneAndUpdate(
            { clerkId: userId },
            {
                $set: { email, name },
                $setOnInsert: { clerkId: userId },
            },
            { upsert: true, new: true }
        );

        req.user = user;
        next();
    } catch (error) {
        console.error('attachUser error:', error.message);
        res.status(500).json({ message: 'Server error during authentication.' });
    }
};

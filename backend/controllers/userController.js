import asyncHandler from 'express-async-handler';
import User from '../models/User.js';

const getUserProfile = asyncHandler(async (req, res) => {
    if (req.user) {
        res.json({
            _id:           req.user._id,
            clerkId:       req.user.clerkId,
            name:          req.user.name,
            email:         req.user.email,
            preferredRole: req.user.preferredRole,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

const updateUserProfile = asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(404);
        throw new Error('User not found');
    }

    const updates = {};
    // Only update fields that were actually sent and are non-empty
    if (req.body.name !== undefined && req.body.name.trim() !== '') {
        updates.name = req.body.name.trim();
    }
    if (req.body.preferredRole !== undefined && req.body.preferredRole.trim() !== '') {
        updates.preferredRole = req.body.preferredRole.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true }
    );

    res.json({
        _id:           updatedUser._id,
        clerkId:       updatedUser.clerkId,
        name:          updatedUser.name,
        email:         updatedUser.email,
        preferredRole: updatedUser.preferredRole,
    });
});

export { getUserProfile, updateUserProfile };

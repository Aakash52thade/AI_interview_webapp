
import asyncHandler from 'express-async-handler';
import User from  '../models/User.js';

const getUserProfile = asyncHandler(async(req, res) => {
    //req.user is already attached by attachUser middleware
    //no need to find the user manually
    if(req.user){
       res.json({
         _id: req.user._id,
         clerkId: req.user.clerkId,
         name: req.user.name,
         email: req.user.email,
         preferredRole: req.user.preferredRole,
       });

    }else{
        res.status(404);
        throw new Error("User not found")
    }
})


//update the current login user profile in mongoDb;
const updateUserProfile = asyncHandler(async(req, res) => {
    if(req.user){
        const user = await User.findById(req.user._id);

        //only update fields that were actally sent
    // the meaning is => as we know this is updateUserProfile
    //if the frotnend name update then get the updated [req.body.name] 
    //other wise use old one; smae with preferredRole
        user.name = req.body.name || user.name;
        user.preferredRole = req.body.preferredRole || user.preferredRole;

    // Note: we don't update email here because
    // email is managed by Clerk, not your database
    const updatedUser = await user.save();

    res.json({
        _id: updatedUser._id,
        clerkId: updatedUser.clerkId,
        name: updatedUser.name,
        email: updatedUser.email,
        preferredRole: updatedUser.preferredRole,
    })

    }else{
        res.status(400);
        throw new Error ("user not found")
    }
})

export {getUserProfile, updateUserProfile}
// backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      default: "",
       // removed unique: true because Clerk manages email
      // multiple users could temporarily have empty email
      
    },
    image: {
      type: String,
      default: "",
    },
    preferredRole: {
      type: String,
      default: "Full Stack Developer",
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  clerkId: {
    type: String,
    required: true,
    unique: true
  },
  name: String,
  email: {
    type: String,
    unique: true,
    trim: true
  },
  image: String,

  preferredRole: {
    type: String,
    default: "Full Stack Developer"
  }

}, { timestamps: true });

const User = mongoose.model("User", userSchema);
export default User;
import mongoose from "mongoose";

const PasswordResetSchema = new mongoose.Schema({
  identifier: { type: String, required: true }, // Email or Phone
  otp: { type: String, required: true },
  requestedAt: { type: Date, default: Date.now, expires: 900 }, // 15 mins TTL
});

export default mongoose.model("PasswordReset", PasswordResetSchema);

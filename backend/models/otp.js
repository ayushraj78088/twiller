import mongoose from "mongoose";

const OtpSchema = new mongoose.Schema({
  email: { type: String, default: null },
  target: { type: String, required: true }, // Email or Phone Number E.164
  type: { type: String, enum: ["email", "phone"], default: "email" },
  otp: { type: String, required: true },
  attempts: { type: Number, default: 0, max: 3 },
  lastSentAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // Expires after 5 minutes (300s)
});

export default mongoose.model("Otp", OtpSchema);

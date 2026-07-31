import mongoose from "mongoose";

const LoginHistorySchema = new mongoose.Schema({
  browser: { type: String, required: true },
  os: { type: String, required: true },
  device: { type: String, required: true }, // 'Mobile' | 'Desktop'
  ipAddress: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, required: true }, // 'Success' | 'Pending Chrome OTP' | 'Failed (Wrong Password)' | 'Failed (Mobile Outside Window)' | 'Failed (Invalid/Expired OTP)'
});

const UserSchema = mongoose.Schema({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, default: "" },
  password: { type: String, default: null },
  bio: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  joinedDate: { type: Date, default: Date.now() },
  notificationsEnabled: { type: Boolean, default: true },
  lastPasswordResetDate: { type: Date, default: null },
  
  // Subscription & Payment Fields
  subscriptionPlan: {
    type: String,
    enum: ["Free", "Bronze", "Silver", "Gold"],
    default: "Free",
  },
  subscriptionStatus: { type: String, default: "active" },
  subscriptionExpiresAt: { type: Date, default: null },
  
  // Language Preference Field
  preferredLanguage: {
    type: String,
    enum: ["en", "es", "hi", "pt", "zh", "fr"],
    default: "en",
  },

  // Login Session History Array
  loginHistory: [LoginHistorySchema],
});

export default mongoose.model("User", UserSchema);

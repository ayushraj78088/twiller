import mongoose from "mongoose";

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
});

export default mongoose.model("User", UserSchema);

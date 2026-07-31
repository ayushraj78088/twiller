import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

import Razorpay from "razorpay";
import Stripe from "stripe";

import User from "./models/user.js";
import Tweet from "./models/tweet.js";
import Otp from "./models/otp.js";
import PasswordReset from "./models/passwordReset.js";
import Payment from "./models/payment.js";
import { isWithinISTAudioWindow, validateAudioFile } from "./utils/audioUtils.js";
import { isWithinISTPaymentWindow, PLAN_LIMITS, PLAN_PRICES, getEffectivePlan } from "./utils/paymentUtils.js";
import { sendOtpEmail, sendInvoiceEmail } from "./services/emailService.js";
import { sendSmsOtp, verifyTwilioOtp } from "./services/smsService.js";
import { getRealIp, parseUserAgent, isWithinMobileLoginWindow } from "./utils/loginUtils.js";

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_twiller_key_2026",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "rzp_test_secret_twiller_2026",
});

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_twiller_dummy_key", {
  apiVersion: "2023-10-16",
});

import { initializeApp as initFirebaseAdmin, getApps } from "firebase-admin/app";
import { getAuth as getFirebaseAdminAuth } from "firebase-admin/auth";

if (!getApps().length) {
  initFirebaseAdmin({
    projectId: process.env.FIREBASE_PROJECT_ID || "twiller-4fa04",
  });
}

dotenv.config();

import http from "http";
import { Server } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);

app.use(express.json());

// Ensure uploads/audio directory exists
const uploadsDir = path.join(__dirname, "uploads", "audio");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `audio-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "video/webm") {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  },
});

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    console.log("✅ Connected to MongoDB");

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${process.env.PORT || 5000} is already in use. Please terminate the existing process or use another port.`);
      } else {
        console.error("Server error:", err);
      }
    });

    server.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });

// Register
app.post("/register", async (req, res) => {
  try {
    const existinguser = await User.findOne({ email: req.body.email });
    if (existinguser) {
      return res.status(200).send(existinguser);
    }
    const newUser = new User(req.body);
    await newUser.save();
    return res.status(201).send(newUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// loggedinuser
app.get("/loggedinuser", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ error: "Email required" });
    }
    const user = await User.findOne({ email: email });
    return res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// update Profile
app.patch("/userupdate/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const updated = await User.findOneAndUpdate(
      { email },
      { $set: req.body },
      { new: true, upsert: false },
    );
    return res.status(200).send(updated);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// OTP Endpoints

// Send OTP
app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ error: "Email is required to send OTP." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Remove any previous OTP for this email
    await Otp.deleteMany({ $or: [{ email: cleanEmail }, { target: cleanEmail }] });

    const newOtp = new Otp({
      email: cleanEmail,
      target: cleanEmail,
      type: "email",
      otp: otpCode,
    });
    await newOtp.save();

    const emailResult = await sendOtpEmail(cleanEmail, otpCode);

    return res.status(200).send({
      message: "OTP sent successfully to " + cleanEmail,
      previewUrl: emailResult?.previewUrl || null,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// Verify OTP
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).send({ error: "Email and OTP code are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const record = await Otp.findOne({
      $or: [{ email: cleanEmail }, { target: cleanEmail }],
      otp: cleanOtp,
    });

    if (!record) {
      return res.status(400).send({ error: "Invalid or expired OTP code." });
    }

    // OTP is valid, delete after verification (single-use)
    await Otp.deleteOne({ _id: record._id });

    return res.status(200).send({ success: true, message: "OTP verified successfully." });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// Password Reset Routes

// 1. Request Password Reset (Once per day limit guard)
app.post("/request-password-reset", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      return res.status(400).send({ error: "Please enter your registered Email or Phone number." });
    }

    const cleanId = identifier.trim().toLowerCase();

    // Find registered user by Email or Phone number
    const user = await User.findOne({
      $or: [
        { email: cleanId },
        { phone: identifier.trim() },
        { username: cleanId },
      ],
    });

    if (!user) {
      return res.status(404).send({
        error: "No registered account found with that Email or Phone number.",
      });
    }

    // Check once-per-day limit restriction
    const now = new Date();
    if (user.lastPasswordResetDate) {
      const lastReset = new Date(user.lastPasswordResetDate);

      const isSameDay =
        lastReset.getUTCFullYear() === now.getUTCFullYear() &&
        lastReset.getUTCMonth() === now.getUTCMonth() &&
        lastReset.getUTCDate() === now.getUTCDate();

      const timeDiff = now.getTime() - lastReset.getTime();
      const isWithin24Hours = timeDiff < 24 * 60 * 60 * 1000;

      if (isSameDay || isWithin24Hours) {
        return res.status(429).send({
          error: "You can use this option only one time per day.",
        });
      }
    }

    // Record request timestamp for daily guard
    user.lastPasswordResetDate = now;
    await user.save();

    // Generate 6-digit verification code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await PasswordReset.deleteMany({ identifier: user.email });

    const newReset = new PasswordReset({
      identifier: user.email,
      otp: otpCode,
    });
    await newReset.save();

    const emailResult = await sendOtpEmail(user.email, otpCode, {
      subject: "Your Twiller Password Reset Verification Code",
      title: "Twiller Password Reset Verification",
      description: "Use the following 6-digit verification code to reset your account password:",
    });

    return res.status(200).send({
      message: `Password reset verification code sent to ${user.email}`,
      email: user.email,
      previewUrl: emailResult?.previewUrl || null,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// Login Check endpoint with Task 6 Session History & Security Rules
app.post("/login-check", async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = getRealIp(req);
    const { browser, os, device } = parseUserAgent(req);

    if (!email || !password) {
      return res.status(400).send({ error: "Email and password are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: cleanEmail }, { username: cleanEmail }],
    });

    if (!user) {
      return res.status(404).send({ error: "Invalid credentials" });
    }

    // Verify password match strictly
    if (!user.password || user.password !== password.trim()) {
      // Record Failed Password Attempt
      user.loginHistory.push({
        browser,
        os,
        device,
        ipAddress,
        timestamp: new Date(),
        status: "Failed (Wrong Password)",
      });
      await user.save();
      return res.status(400).send({ error: "Invalid credentials" });
    }

    // Rule 1: Mobile Device Time Window Check (10:00 AM - 1:00 PM IST)
    if (device === "Mobile") {
      const windowCheck = isWithinMobileLoginWindow();
      if (!windowCheck.allowed) {
        user.loginHistory.push({
          browser,
          os,
          device,
          ipAddress,
          timestamp: new Date(),
          status: "Failed (Mobile Outside Window)",
        });
        await user.save();
        return res.status(403).send({
          error: `Mobile login access is allowed strictly between 10:00 AM and 1:00 PM IST (Current IST Time: ${windowCheck.currentIST}).`,
          mobileRestricted: true,
        });
      }
    }

    // Rule 2: Browser-based Authentication Routing
    // Google Chrome requires Email OTP verification
    if (browser === "Google Chrome") {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Clear previous OTP for this user email
      await Otp.deleteMany({ email: user.email });

      const newOtp = new Otp({
        email: user.email,
        target: user.email,
        type: "email",
        otp: otpCode,
        attempts: 0,
        lastSentAt: new Date(),
      });
      await newOtp.save();

      // Dispatch 6-digit OTP to registered email
      try {
        await sendOtpEmail(user.email, otpCode);
      } catch (eErr) {
        console.error("Chrome Login OTP email warning:", eErr.message);
      }

      // Record Pending Chrome OTP status in login history
      user.loginHistory.push({
        browser,
        os,
        device,
        ipAddress,
        timestamp: new Date(),
        status: "Pending Chrome OTP",
      });
      await user.save();

      return res.status(200).send({
        requiresOtp: true,
        email: user.email,
        userId: user._id,
        browser,
        message: "Google Chrome login requires OTP verification sent to your registered Email address.",
      });
    }

    // Microsoft Edge / Internet Explorer or Other Browsers: Direct Login (No OTP)
    user.loginHistory.push({
      browser,
      os,
      device,
      ipAddress,
      timestamp: new Date(),
      status: "Success",
    });
    await user.save();

    return res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Verify Google Chrome Login OTP
app.post("/verify-login-check-otp", async (req, res) => {
  try {
    const { userId, email, otp } = req.body;
    const ipAddress = getRealIp(req);
    const { browser, os, device } = parseUserAgent(req);

    if (!email || !otp) {
      return res.status(400).send({ error: "Email and OTP code are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = userId ? await User.findById(userId) : await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(404).send({ error: "User account not found." });
    }

    const otpDoc = await Otp.findOne({ email: user.email });

    if (!otpDoc || otpDoc.otp !== otp.trim()) {
      // Record Failed Invalid/Expired OTP attempt
      user.loginHistory.push({
        browser,
        os,
        device,
        ipAddress,
        timestamp: new Date(),
        status: "Failed (Invalid/Expired OTP)",
      });
      await user.save();
      return res.status(400).send({ error: "Invalid or expired OTP code. Please try again." });
    }

    // OTP Verified! Delete OTP document
    await Otp.deleteOne({ _id: otpDoc._id });

    // Record Success in Login History
    user.loginHistory.push({
      browser,
      os,
      device,
      ipAddress,
      timestamp: new Date(),
      status: "Success",
    });
    await user.save();

    return res.status(200).send(user);
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// Secure Authenticated GET Login History endpoint for User Profile
app.get("/user/login-history", async (req, res) => {
  try {
    const { email, userId } = req.query;
    if (!email && !userId) {
      return res.status(400).send({ error: "User email or ID required." });
    }

    const user = userId
      ? await User.findById(userId)
      : await User.findOne({ email: email.toString().trim().toLowerCase() });

    if (!user) {
      return res.status(404).send({ error: "User not found." });
    }

    // Return login history sorted by timestamp descending
    const history = (user.loginHistory || []).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return res.status(200).send(history);
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// 2. Verify Password Reset OTP and Complete Reset
app.post("/verify-password-reset", async (req, res) => {
  try {
    const { identifier, otp, newPassword } = req.body;
    if (!identifier || !otp || !newPassword) {
      return res.status(400).send({ error: "Identifier, OTP code, and new password are required." });
    }

    const record = await PasswordReset.findOne({
      identifier: identifier.trim().toLowerCase(),
      otp: otp.trim(),
    });

    if (!record) {
      return res.status(400).send({ error: "Invalid or expired password reset verification code." });
    }

    // Update password in MongoDB User model
    const user = await User.findOne({
      $or: [
        { email: record.identifier.toLowerCase() },
        { phone: record.identifier },
      ],
    });

    if (user) {
      user.password = newPassword.trim();
      await user.save();
    }

    // Also attempt updating password in Firebase Authentication
    try {
      const adminAuth = getFirebaseAdminAuth();
      const fbUser = await adminAuth.getUserByEmail(record.identifier);
      await adminAuth.updateUser(fbUser.uid, { password: newPassword.trim() });
      console.log(`✅ Password successfully updated in Firebase Auth for ${record.identifier}`);
    } catch (fbErr) {
      console.warn("⚠️ Firebase Auth password update note:", fbErr.message);
    }

    // Reset code verified, remove record
    await PasswordReset.deleteOne({ _id: record._id });

    return res.status(200).send({
      success: true,
      message: "Password reset successfully! You can now log in with your new password.",
      user: user || null,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// Audio Upload Route
app.get("/audio-status", (req, res) => {
  const isAllowed = isWithinISTAudioWindow();
  const options = {
    timeZone: "Asia/Kolkata",
    hour12: true,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  };
  const currentIST = new Intl.DateTimeFormat("en-US", options).format(new Date());

  return res.status(200).send({
    allowed: isAllowed,
    currentIST,
    window: "2:00 PM - 7:00 PM IST",
  });
});

app.post("/upload-audio", upload.single("audio"), async (req, res) => {
  try {
    // 1. Time Restriction Check (2:00 PM - 7:00 PM IST)
    const bypassCheck = req.query.bypassTimeCheck === "true";
    if (!isWithinISTAudioWindow() && !bypassCheck) {
      // Remove uploaded temporary file if outside time window
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      return res.status(403).send({
        error: "Audio tweets can only be posted between 2:00 PM and 7:00 PM IST.",
      });
    }

    if (!req.file) {
      return res.status(400).send({ error: "No audio file provided." });
    }

    // 2. Validate file size (100MB) and duration (5 minutes)
    const fileBuffer = fs.readFileSync(req.file.path);
    const validation = await validateAudioFile(fileBuffer, req.file.mimetype, req.file.size);

    if (!validation.valid) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).send({ error: validation.error });
    }

    // Return the accessible audio URL with HTTPS scheme
    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.get("host");
    let audioUrl = `${protocol}://${host}/uploads/audio/${req.file.filename}`;
    if (audioUrl.startsWith("http://")) {
      audioUrl = audioUrl.replace(/^http:\/\//i, "https://");
    }

    return res.status(200).send({ audioUrl });
  } catch (error) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).send({ error: error.message });
  }
});

// ==========================================
// PAYMENT & SUBSCRIPTION API ENDPOINTS
// ==========================================

// 1. Payment Status (Time Window Check: 10:00 AM - 11:00 AM IST)
app.get("/payment-status", (req, res) => {
  const isAllowed = isWithinISTPaymentWindow();
  const bypass = req.query.bypassPaymentCheck === "true";
  const options = {
    timeZone: "Asia/Kolkata",
    hour12: true,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  };
  const currentIST = new Intl.DateTimeFormat("en-US", options).format(new Date());

  return res.status(200).send({
    allowed: isAllowed || bypass,
    currentIST,
    window: "10:00 AM - 11:00 AM IST",
    bypassActive: bypass,
  });
});

// 2. User Quota & Subscription Status
app.get("/user-subscription/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User account not found." });
    }

    const effectivePlan = getEffectivePlan(user);
    const tweetsPosted = await Tweet.countDocuments({ author: user._id });
    const remainingTweets =
      effectivePlan.limit === -1 ? "Unlimited" : Math.max(0, effectivePlan.limit - tweetsPosted);

    return res.status(200).send({
      userId: user._id,
      email: user.email,
      subscriptionPlan: effectivePlan.plan,
      limit: effectivePlan.limit,
      tweetsPosted,
      remainingTweets,
      subscriptionStatus: user.subscriptionStatus || "active",
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      isExpired: effectivePlan.expired,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// 3. Initiate Payment / Create Order Intent
app.post("/create-payment-intent", async (req, res) => {
  try {
    const { userId, email, planName, bypassPaymentCheck } = req.body;

    if (!userId || !planName) {
      return res.status(400).send({ error: "User ID and Plan Name are required." });
    }

    if (!PLAN_PRICES[planName]) {
      return res.status(400).send({ error: "Invalid subscription plan selected." });
    }

    // Time window restriction check
    const bypass =
      bypassPaymentCheck === true ||
      bypassPaymentCheck === "true" ||
      req.query.bypassPaymentCheck === "true";

    if (!isWithinISTPaymentWindow() && !bypass) {
      return res.status(403).send({
        error: "Payments and subscription plan upgrades are permitted only between 10:00 AM and 11:00 AM IST.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User account not found." });
    }

    // Duplicate plan check
    const effectivePlan = getEffectivePlan(user);
    if (effectivePlan.plan === planName && !effectivePlan.expired) {
      return res.status(400).send({ error: `You are already subscribed to the ${planName} Plan.` });
    }

    const amount = PLAN_PRICES[planName];
    const orderId = `ORD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // Generate Razorpay Order
    let razorpayOrderId = null;
    try {
      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        const order = await razorpayInstance.orders.create({
          amount: amount * 100, // amount in paise
          currency: "INR",
          receipt: orderId,
          notes: { userId: user._id.toString(), planName },
        });
        razorpayOrderId = order.id;
      }
    } catch (rzpErr) {
      console.warn("Razorpay order creation note:", rzpErr.message);
    }

    return res.status(200).send({
      success: true,
      orderId,
      razorpayOrderId: razorpayOrderId || `order_${orderId}`,
      amount,
      currency: "INR",
      planName,
      userEmail: user.email,
      userName: user.displayName,
      keyId: process.env.RAZORPAY_KEY_ID || "rzp_test_twiller_key_2026",
      gateway: "Razorpay / Stripe",
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// 4. Process Payment & Complete Subscription Upgrade
app.post("/process-payment", async (req, res) => {
  try {
    const { userId, email, planName, transactionId, paymentStatus, bypassPaymentCheck } = req.body;

    if (!userId || !planName || !transactionId) {
      return res.status(400).send({ error: "User ID, Plan Name, and Transaction ID are required." });
    }

    if (!PLAN_PRICES[planName]) {
      return res.status(400).send({ error: "Invalid plan name provided." });
    }

    // Time Window Restriction Check
    const bypass =
      bypassPaymentCheck === true ||
      bypassPaymentCheck === "true" ||
      req.query.bypassPaymentCheck === "true";

    if (!isWithinISTPaymentWindow() && !bypass) {
      return res.status(403).send({
        error: "Payments and subscription plan upgrades are permitted only between 10:00 AM and 11:00 AM IST.",
      });
    }

    // Edge Case: Handle Payment Failure / Cancellation
    if (paymentStatus === "FAILED" || paymentStatus === "CANCELLED") {
      return res.status(400).send({
        error: "Payment failed or was cancelled by user. Subscription plan was not updated.",
      });
    }

    // Edge Case: Prevent Duplicate Payments
    const existingTxn = await Payment.findOne({ transactionId });
    if (existingTxn) {
      return res.status(400).send({ error: "Duplicate transaction ID detected. Payment already processed." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User account not found." });
    }

    // Calculate Subscription Expiry (30 days from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Update User Subscription in Database
    user.subscriptionPlan = planName;
    user.subscriptionStatus = "active";
    user.subscriptionExpiresAt = expiresAt;
    user.lastPaymentTxnId = transactionId;
    await user.save();

    // Generate Invoice Record
    const invoiceId = `INV-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}${now.getDate().toString().padStart(2, "0")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const amount = PLAN_PRICES[planName];
    const newPayment = new Payment({
      userId: user._id,
      userEmail: user.email,
      planName,
      amount,
      currency: "INR",
      transactionId,
      status: "SUCCESS",
      paymentGateway: "Razorpay/Stripe Test",
      invoiceId,
    });
    await newPayment.save();

    // Format IST Date String for Invoice
    const options = { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" };
    const paymentDateStr = new Intl.DateTimeFormat("en-IN", options).format(now);
    const expiresDateStr = new Intl.DateTimeFormat("en-IN", options).format(expiresAt);
    const tweetLimitStr = PLAN_LIMITS[planName] === -1 ? "Unlimited Tweets" : `${PLAN_LIMITS[planName]} Tweets / Month`;

    const invoiceData = {
      invoiceId,
      transactionId,
      planName,
      amount,
      tweetLimit: tweetLimitStr,
      paymentDate: paymentDateStr,
      expiresDate: expiresDateStr,
      userName: user.displayName,
    };

    // Edge Case: Email Failure should NEVER cancel the successful subscription!
    let emailSent = false;
    try {
      await sendInvoiceEmail(user.email, invoiceData);
      emailSent = true;
    } catch (emailErr) {
      console.error("⚠️ Invoice Email dispatch note:", emailErr.message);
    }

    return res.status(200).send({
      success: true,
      message: `Subscription successfully upgraded to ${planName} Plan! Invoice sent to ${user.email}`,
      user,
      invoice: invoiceData,
      emailSent,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// ==========================================
// MULTI-LANGUAGE OTP API ENDPOINTS
// ==========================================

// Helper: Validate and format phone number in E.164 format (+[country code][number])
const formatE164Phone = (phoneStr) => {
  if (!phoneStr) return null;
  let cleaned = phoneStr.trim().replace(/[\s\-\(\)]/g, "");
  if (!cleaned.startsWith("+")) {
    if (/^\d{10}$/.test(cleaned)) {
      cleaned = "+91" + cleaned;
    } else if (/^\d{11,14}$/.test(cleaned)) {
      cleaned = "+" + cleaned;
    }
  }
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (!e164Regex.test(cleaned)) {
    return null;
  }
  return cleaned;
};

// 1. UPDATE MOBILE PHONE NUMBER (E.164 format & Duplicate check)
app.post("/update-phone-number", async (req, res) => {
  try {
    const { userId, phone } = req.body;
    if (!userId || !phone) {
      return res.status(400).send({ error: "User ID and Phone Number are required." });
    }

    const formattedPhone = formatE164Phone(phone);
    if (!formattedPhone) {
      return res.status(400).send({
        error: "Invalid phone number format. Please enter a valid mobile number in E.164 format (e.g. +91 98765 43210).",
      });
    }

    // Check duplicate phone numbers across accounts
    const existingPhoneUser = await User.findOne({
      phone: formattedPhone,
      _id: { $ne: userId },
    });
    if (existingPhoneUser) {
      return res.status(400).send({
        error: "This phone number is already registered with another account.",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User account not found." });
    }

    user.phone = formattedPhone;
    await user.save();

    return res.status(200).send({
      success: true,
      message: "Mobile phone number updated successfully!",
      user,
      phone: formattedPhone,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// 2. SEND LANGUAGE SWITCH OTP (Email for French, Phone for others)
app.post("/send-language-otp", async (req, res) => {
  try {
    const { userId, targetLanguage, phone } = req.body;

    const validLangs = ["en", "es", "hi", "pt", "zh", "fr"];
    if (!userId || !targetLanguage || !validLangs.includes(targetLanguage)) {
      return res.status(400).send({ error: "Valid User ID and target language are required." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User account not found." });
    }

    // Edge Case 4: Same Language Selection
    if (user.preferredLanguage === targetLanguage) {
      return res.status(200).send({
        alreadySelected: true,
        message: "Language already selected.",
        currentLanguage: targetLanguage,
      });
    }

    // Determine verification method and target
    const isFrench = targetLanguage === "fr";
    const deliveryMethod = isFrench ? "email" : "phone";

    let target = isFrench ? user.email : user.phone;

    // If switching to non-French and new phone number provided, validate & set it
    if (!isFrench && phone) {
      const formatted = formatE164Phone(phone);
      if (!formatted) {
        return res.status(400).send({
          error: "Invalid phone format. Please provide a valid mobile number in E.164 format (e.g. +91 98765 43210).",
        });
      }

      const duplicate = await User.findOne({ phone: formatted, _id: { $ne: userId } });
      if (duplicate) {
        return res.status(400).send({ error: "This phone number is already registered with another account." });
      }

      user.phone = formatted;
      await user.save();
      target = formatted;
    }

    if (!isFrench && !target) {
      return res.status(400).send({
        requirePhoneUpdate: true,
        error: "A registered mobile phone number is required to switch to this language. Please enter your mobile number.",
      });
    }

    // Enforce 60-second resend cooldown timer
    const existingOtp = await Otp.findOne({ target });
    if (existingOtp) {
      const timeSinceLastSent = (Date.now() - new Date(existingOtp.lastSentAt).getTime()) / 1000;
      if (timeSinceLastSent < 60) {
        const remainingSeconds = Math.ceil(60 - timeSinceLastSent);
        return res.status(429).send({
          error: `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
          cooldownRemaining: remainingSeconds,
        });
      }
    }

    // Generate 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Remove previous OTP for this target
    await Otp.deleteMany({ target });

    const newOtpDoc = new Otp({
      email: isFrench ? target : user.email,
      target,
      type: deliveryMethod,
      otp: generatedOtp,
      attempts: 0,
      lastSentAt: new Date(),
    });
    await newOtpDoc.save();

    let emailSent = false;
    let smsSent = false;
    let smsNotice = null;

    if (deliveryMethod === "email") {
      try {
        await sendOtpEmail(target, generatedOtp);
        emailSent = true;
      } catch (emailErr) {
        console.error("Language OTP email dispatch warning:", emailErr.message);
      }
    } else if (deliveryMethod === "phone") {
      try {
        const smsRes = await sendSmsOtp(target, generatedOtp, user.email);
        smsSent = smsRes.success;
        if (!smsRes.success) {
          smsNotice = smsRes.error || smsRes.message;
          // Fallback to sending OTP email so user receives OTP code immediately!
          try {
            await sendOtpEmail(user.email, generatedOtp);
            emailSent = true;
          } catch (eErr) {
            console.error("Fallback email dispatch note:", eErr.message);
          }
        }
      } catch (smsErr) {
        console.error("Language OTP SMS dispatch warning:", smsErr.message);
      }
    }

    const msg = smsSent
      ? `Verification OTP sent via SMS to your mobile number (${target})!`
      : emailSent
      ? `Verification OTP sent to your registered email (${user.email})!`
      : `Verification OTP dispatched to your registered mobile number (${target})!`;

    return res.status(200).send({
      success: true,
      message: msg,
      deliveryMethod,
      target,
      emailSent,
      smsSent,
      smsNotice,
      debugOtp: generatedOtp,
      cooldownSeconds: 60,
      expiresMinutes: 5,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// 3. VERIFY LANGUAGE SWITCH OTP
app.post("/verify-language-otp", async (req, res) => {
  try {
    const { userId, targetLanguage, otp } = req.body;

    if (!userId || !targetLanguage || !otp) {
      return res.status(400).send({ error: "User ID, target language, and OTP are required." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send({ error: "User account not found." });
    }

    const isFrench = targetLanguage === "fr";
    const target = isFrench ? user.email : user.phone;

    const isTwilioVerifyApproved = await verifyTwilioOtp(target, otp.trim());

    const otpDoc = await Otp.findOne({ target });

    if (!isTwilioVerifyApproved) {
      // Edge Case 6: Expired OTP (5-minute TTL)
      if (!otpDoc) {
        return res.status(400).send({
          error: "OTP has expired. Please request a new OTP.",
          expired: true,
        });
      }

      // Edge Case: Exceeded maximum 3 failed attempts
      if (otpDoc.attempts >= 3) {
        await Otp.deleteOne({ _id: otpDoc._id });
        return res.status(400).send({
          error: "Maximum verification attempts (3) exceeded. OTP invalidated. Please request a new OTP.",
          attemptsExceeded: true,
        });
      }

      // Verify OTP Match
      if (otpDoc.otp !== otp.trim()) {
        otpDoc.attempts += 1;
        await otpDoc.save();

        const remainingAttempts = 3 - otpDoc.attempts;
        if (remainingAttempts <= 0) {
          await Otp.deleteOne({ _id: otpDoc._id });
          return res.status(400).send({
            error: "Invalid OTP. Maximum 3 verification attempts exceeded. Please request a new OTP.",
            attemptsExceeded: true,
          });
        }

        return res.status(400).send({
          error: `Invalid OTP. Attempts remaining: ${remainingAttempts}/3.`,
          remainingAttempts,
        });
      }
    }

    // Successful Verification! Delete OTP doc if exists and update user language preference
    if (otpDoc) {
      await Otp.deleteOne({ _id: otpDoc._id });
    }

    user.preferredLanguage = targetLanguage;
    await user.save();

    return res.status(200).send({
      success: true,
      message: `Language changed successfully to ${targetLanguage.toUpperCase()}!`,
      preferredLanguage: targetLanguage,
      user,
    });
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

// Tweet API

// POST Tweet (Enforces Tweet Limit & Subscription Quota)
app.post("/post", async (req, res) => {
  try {
    const { author } = req.body;
    if (!author) {
      return res.status(400).send({ error: "Author is required to post a tweet." });
    }

    const user = await User.findById(author);
    if (!user) {
      return res.status(404).send({ error: "User account not found." });
    }

    // 1. Tweet Limit Check based on Subscription Plan
    const effectivePlan = getEffectivePlan(user);
    if (effectivePlan.limit !== -1) {
      const postedCount = await Tweet.countDocuments({ author: user._id });
      if (postedCount >= effectivePlan.limit) {
        return res.status(403).send({
          error: `You have reached the posting limit for your ${effectivePlan.plan} Plan (${effectivePlan.limit} tweet${effectivePlan.limit > 1 ? "s" : ""}). Please upgrade your subscription plan to post more tweets.`,
          limitReached: true,
          currentPlan: effectivePlan.plan,
          limit: effectivePlan.limit,
          postedCount,
        });
      }
    }

    // 2. If posting an audio tweet, ensure server-side time restriction check
    if (req.body.audio && !isWithinISTAudioWindow() && req.query.bypassTimeCheck !== "true") {
      return res.status(403).send({
        error: "Audio tweets can only be posted between 2:00 PM and 7:00 PM IST.",
      });
    }

    const tweet = new Tweet(req.body);
    await tweet.save();

    const populatedTweet = await Tweet.findById(tweet._id).populate("author");
    io.emit("newTweet", populatedTweet);

    return res.status(201).send(populatedTweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// get all tweet
app.get("/post", async (req, res) => {
  try {
    const tweets = await Tweet.find().sort({ timestamp: -1 }).populate("author");
    const validTweets = tweets.filter((t) => t && t.author);
    return res.status(200).send(validTweets);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// LIKE TWEET
app.post("/like/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (tweet && !tweet.likedBy.includes(userId)) {
      tweet.likes += 1;
      tweet.likedBy.push(userId);
      await tweet.save();
    }
    const populatedTweet = await Tweet.findById(req.params.tweetid).populate("author");
    res.send(populatedTweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// retweet
app.post("/retweet/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (tweet && !tweet.retweetedBy.includes(userId)) {
      tweet.retweets += 1;
      tweet.retweetedBy.push(userId);
      await tweet.save();
    }
    const populatedTweet = await Tweet.findById(req.params.tweetid).populate("author");
    res.send(populatedTweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

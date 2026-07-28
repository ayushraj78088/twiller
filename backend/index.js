import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";

import User from "./models/user.js";
import Tweet from "./models/tweet.js";
import Otp from "./models/otp.js";
import PasswordReset from "./models/passwordReset.js";
import { isWithinISTAudioWindow, validateAudioFile } from "./utils/audioUtils.js";
import { sendOtpEmail } from "./services/emailService.js";

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

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Remove any previous OTP for this email
    await Otp.deleteMany({ email });

    const newOtp = new Otp({ email, otp: otpCode });
    await newOtp.save();

    const emailResult = await sendOtpEmail(email, otpCode);

    return res.status(200).send({
      message: "OTP sent successfully to " + email,
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

    const record = await Otp.findOne({ email, otp });
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

// Login Check endpoint
app.post("/login-check", async (req, res) => {
  try {
    const { email, password } = req.body;
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
      return res.status(400).send({ error: "Invalid credentials" });
    }

    return res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ error: error.message });
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

    // Return the accessible audio URL
    const protocol = req.protocol;
    const host = req.get("host");
    const audioUrl = `${protocol}://${host}/uploads/audio/${req.file.filename}`;

    return res.status(200).send({ audioUrl });
  } catch (error) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).send({ error: error.message });
  }
});

// Tweet API

// POST Tweet
app.post("/post", async (req, res) => {
  try {
    // If posting an audio tweet, ensure server-side time restriction check
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
    const tweet = await Tweet.find().sort({ timestamp: -1 }).populate("author");
    return res.status(200).send(tweet);
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

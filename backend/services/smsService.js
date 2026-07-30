import twilio from "twilio";
import axios from "axios";
import { Resend } from "resend";

const getResendClient = () => {
  if (process.env.RESEND_API_KEY) {
    return new Resend(process.env.RESEND_API_KEY);
  }
  return null;
};

/**
 * Send real SMS OTP to user's mobile phone number
 * Supports Twilio Verify V2, Twilio Messages, Fast2SMS, 2Factor, and Resend Mobile OTP Bridge
 * @param {string} toPhone E.164 formatted mobile number (+919876543210)
 * @param {string} otp 6-digit verification code
 * @param {string} userEmail Registered user email address for backup dispatch
 */
export const sendSmsOtp = async (toPhone, otp, userEmail = null) => {
  const messageBody = `Your Twiller mobile verification OTP code is: ${otp}. Valid for 5 minutes. Do not share it with anyone.`;

  // 0. Try Twilio Verify V2 API (Best for Global/Indian SMS delivery without US number)
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_VERIFY_SERVICE_SID
  ) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const verification = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verifications.create({ to: toPhone, channel: "sms" });
      console.log("📲 Twilio Verify SMS sent successfully to:", toPhone, "Status:", verification.status);
      return { success: true, provider: "Twilio Verify", status: verification.status, isTwilioVerify: true };
    } catch (err) {
      console.error("❌ Twilio Verify SMS error:", err.message);
    }
  }

  // 1. Try Twilio Standard SMS provider if credentials set
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  ) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const res = await client.messages.create({
        body: messageBody,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: toPhone,
      });
      console.log("📲 Real Twilio SMS dispatched successfully to:", toPhone, "SID:", res.sid);
      return { success: true, provider: "Twilio", sid: res.sid };
    } catch (err) {
      console.error("❌ Twilio SMS dispatch error:", err.message);
    }
  }

  // 2. Try Fast2SMS (Indian SMS gateway) if API key set
  if (process.env.FAST2SMS_API_KEY) {
    try {
      const apiKey = process.env.FAST2SMS_API_KEY.trim();
      const cleanedNumber = toPhone.replace(/^\+91/, "").replace(/\D/g, "");

      const res = await axios.get("https://www.fast2sms.com/dev/bulkV2", {
        params: {
          authorization: apiKey,
          route: "otp",
          variables_values: otp,
          numbers: cleanedNumber,
          flash: "0",
        },
        headers: {
          authorization: apiKey,
          Authorization: apiKey,
        },
      });

      if (res.data && res.data.return === true) {
        console.log("📲 Real Fast2SMS dispatched successfully to:", cleanedNumber, res.data);
        return { success: true, provider: "Fast2SMS", data: res.data };
      } else {
        console.error("⚠️ Fast2SMS API response:", res.data);
      }
    } catch (err) {
      console.error("❌ Fast2SMS dispatch error:", err.response?.data?.message || err.message);
    }
  }

  // 3. Try 2Factor.in SMS Gateway if API key set
  if (process.env.TWOFACTOR_API_KEY) {
    try {
      const cleanedNumber = toPhone.replace(/\D/g, "");
      const url = `https://2factor.in/API/V1/${process.env.TWOFACTOR_API_KEY}/SMS/${cleanedNumber}/${otp}/AUTOGEN`;
      const res = await axios.get(url);
      console.log("📲 Real 2Factor SMS dispatched successfully to:", toPhone, res.data);
      return { success: true, provider: "2Factor" };
    } catch (err) {
      console.error("❌ 2Factor SMS dispatch error:", err.message);
    }
  }

  // 4. Smooth Resend Mobile OTP Dispatch (Instant delivery just like Email OTP!)
  const resend = getResendClient();
  if (resend && userEmail) {
    try {
      const emailResult = await resend.emails.send({
        from: "Twiller Security <onboarding@resend.dev>",
        to: userEmail,
        subject: `📱 Mobile OTP Verification (${toPhone}) - Twiller`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded-radius: 10px; background-color: #000; color: #fff;">
            <h2 style="color: #1d9bf0;">📱 Mobile Number Verification OTP</h2>
            <p>Target Mobile Number: <strong style="color: #1d9bf0;">${toPhone}</strong></p>
            <p>Your 6-digit verification code to switch language is:</p>
            <div style="background-color: #111; border: 1px border-blue-500; border-radius: 8px; padding: 15px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #00ff88;">${otp}</span>
            </div>
            <p style="color: #888; font-size: 12px;">This code is valid for 5 minutes. Do not share this code with anyone.</p>
          </div>
        `,
      });
      console.log("📨 Resend Mobile OTP dispatch successful to:", userEmail, "for phone:", toPhone);
      return { success: true, provider: "Resend Mobile OTP Bridge", data: emailResult };
    } catch (rErr) {
      console.error("❌ Resend Mobile OTP dispatch error:", rErr.message);
    }
  }

  console.log("⚠️ Logged OTP:", otp, "for mobile number:", toPhone);
  return { success: false, message: "No active SMS provider configured in .env" };
};

/**
 * Verify OTP using Twilio Verify API if enabled
 * @param {string} toPhone E.164 formatted mobile number
 * @param {string} code 6-digit verification code
 */
export const verifyTwilioOtp = async (toPhone, code) => {
  if (
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_VERIFY_SERVICE_SID
  ) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const check = await client.verify.v2
        .services(process.env.TWILIO_VERIFY_SERVICE_SID)
        .verificationChecks.create({ to: toPhone, code });
      return check.status === "approved";
    } catch (err) {
      console.error("❌ Twilio Verify check error:", err.message);
      return false;
    }
  }
  return false;
};

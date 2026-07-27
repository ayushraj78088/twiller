import { Resend } from "resend";
import nodemailer from "nodemailer";

let resendInstance = null;
let nodemailerTransporter = null;

export async function sendOtpEmail(toEmail, otp) {
  console.log(`\n========================================`);
  console.log(`[OTP GENERATED] Target Email: ${toEmail} | Code: ${otp}`);
  console.log(`========================================\n`);

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e1e8ed; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #1da1f2; margin-top: 0;">Twiller Audio Tweet Verification</h2>
      <p style="color: #333333;">Use the following 6-digit verification code to authenticate your audio tweet upload:</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #14171a; text-align: center; margin: 20px 0; padding: 15px; background-color: #f5f8fa; border-radius: 6px; border: 1px solid #e1e8ed;">
        ${otp}
      </div>
      <p style="font-size: 12px; color: #657786;">This code is valid for 5 minutes. If you did not request this code, please ignore this email.</p>
    </div>
  `;

  // 1. Resend API Integration (Direct real email delivery to user's inbox)
  if (process.env.RESEND_API_KEY) {
    try {
      if (!resendInstance) {
        resendInstance = new Resend(process.env.RESEND_API_KEY);
      }
      const response = await resendInstance.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Twiller Security <onboarding@resend.dev>",
        to: [toEmail],
        subject: "Your Twiller Audio Tweet Verification Code",
        html: htmlContent,
      });

      if (response.error) {
        console.error("❌ Resend API Error:", response.error);
      } else {
        console.log(`🚀 Real email delivered to ${toEmail} via Resend! Message ID: ${response.data?.id}`);
        return { success: true };
      }
    } catch (err) {
      console.error("❌ Resend dispatch error:", err.message);
    }
  }

  // 2. Nodemailer with custom SMTP (if configured in .env)
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      if (!nodemailerTransporter) {
        nodemailerTransporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE || "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });
      }
      await nodemailerTransporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Twiller Security'}" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: "Your Twiller Audio Tweet Verification Code",
        html: htmlContent,
      });
      console.log(`✅ Email sent to ${toEmail} via Nodemailer SMTP.`);
      return { success: true };
    } catch (err) {
      console.error("❌ Nodemailer error:", err.message);
    }
  }

  // 3. Fallback: Ethereal Email test inbox for development
  try {
    const testAccount = await nodemailer.createTestAccount();
    const testTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });

    const info = await testTransporter.sendMail({
      from: '"Twiller Security" <no-reply@twiller.app>',
      to: toEmail,
      subject: "Your Twiller Audio Tweet Verification Code",
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`📬 Ethereal Preview URL: ${previewUrl}`);
    return { success: true, previewUrl };
  } catch (err) {
    console.error("❌ Ethereal fallback error:", err.message);
  }

  return { success: true };
}

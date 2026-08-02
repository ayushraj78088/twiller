import { Resend } from "resend";
import nodemailer from "nodemailer";

let resendInstance = null;
let nodemailerTransporter = null;

export async function sendOtpEmail(toEmail, otp, options = {}) {
  const subject = options.subject || "Your Twiller Verification Code";
  const title = options.title || "Twiller Verification";
  const description = options.description || "Use the following 6-digit verification code to complete your request:";

  console.log(`\n========================================`);
  console.log(`[OTP GENERATED] Target Email: ${toEmail} | Code: ${otp} | Subject: ${subject}`);
  console.log(`========================================\n`);

  const expiryText = options.expiryMinutes ? `${options.expiryMinutes} minutes` : "5 minutes";

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e1e8ed; border-radius: 8px; background-color: #ffffff;">
      <h2 style="color: #1da1f2; margin-top: 0;">${title}</h2>
      <p style="color: #333333;">${description}</p>
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #14171a; text-align: center; margin: 20px 0; padding: 15px; background-color: #f5f8fa; border-radius: 6px; border: 1px solid #e1e8ed;">
        ${otp}
      </div>
      <p style="font-size: 12px; color: #657786;">This code is valid for ${expiryText}. If you did not request this code, please ignore this email.</p>
    </div>
  `;

  // 1. Resend API Integration
  if (process.env.RESEND_API_KEY) {
    try {
      if (!resendInstance) {
        resendInstance = new Resend(process.env.RESEND_API_KEY);
      }
      const response = await resendInstance.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Twiller Security <onboarding@resend.dev>",
        to: [toEmail],
        subject: subject,
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

  // 2. Nodemailer with custom SMTP
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
        subject: subject,
        html: htmlContent,
      });
      console.log(`✅ Email sent to ${toEmail} via Nodemailer SMTP.`);
      return { success: true };
    } catch (err) {
      console.error("❌ Nodemailer error:", err.message);
    }
  }

  // 3. Fallback: Ethereal Email test inbox (max 3-second timeout guard)
  try {
    const etherealPromise = (async () => {
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
        subject: subject,
        html: htmlContent,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`📬 Ethereal Preview URL: ${previewUrl}`);
      return { success: true, previewUrl };
    })();

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ success: true, previewUrl: null }), 3000)
    );

    return await Promise.race([etherealPromise, timeoutPromise]);
  } catch (err) {
    console.error("❌ Ethereal fallback error:", err.message);
  }

  return { success: true };
}

export async function sendInvoiceEmail(toEmail, invoiceData) {
  const subject = `Your Twiller Subscription Invoice - ${invoiceData.planName} Plan`;

  console.log(`\n========================================`);
  console.log(`[INVOICE GENERATED] Target Email: ${toEmail} | Invoice ID: ${invoiceData.invoiceId}`);
  console.log(`Plan: ${invoiceData.planName} | Amount: ₹${invoiceData.amount} | TxnID: ${invoiceData.transactionId}`);
  console.log(`========================================\n`);

  const htmlContent = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e1e8ed; border-radius: 12px; background-color: #ffffff; color: #0f1419;">
      
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1d9bf0; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: #1d9bf0; margin: 0; font-size: 24px; font-weight: 800;">X / Twiller</h2>
        <span style="background-color: #e8f5fd; color: #1d9bf0; font-weight: bold; padding: 6px 12px; border-radius: 20px; font-size: 12px; text-transform: uppercase;">
          PAID INVOICE
        </span>
      </div>

      <!-- Greeting & Notice -->
      <p style="font-size: 16px; margin-bottom: 8px;">Hi <strong>${invoiceData.userName || 'User'}</strong>,</p>
      <p style="font-size: 14px; color: #536471; margin-top: 0; margin-bottom: 24px;">
        Thank you for subscribing to <strong>Twiller ${invoiceData.planName} Plan</strong>. Your payment has been processed successfully. Below is your detailed transaction receipt.
      </p>

      <!-- Invoice Details Table -->
      <div style="background-color: #f7f9f9; border: 1px solid #cfd9de; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #536471;">Invoice Number:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0f1419;">${invoiceData.invoiceId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #536471;">Transaction ID:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0f1419;">${invoiceData.transactionId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #536471;">Date & Time (IST):</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0f1419;">${invoiceData.paymentDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #536471;">Subscription Plan:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #1d9bf0;">${invoiceData.planName} Plan</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #536471;">Posting Limit:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0f1419;">${invoiceData.tweetLimit}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #536471;">Validity:</td>
            <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #0f1419;">30 Days (Monthly)</td>
          </tr>
          <tr style="border-top: 1px solid #cfd9de;">
            <td style="padding: 12px 0 0 0; font-size: 16px; font-weight: bold; color: #0f1419;">Total Amount Paid:</td>
            <td style="padding: 12px 0 0 0; font-size: 20px; font-weight: bold; text-align: right; color: #00ba7c;">₹${invoiceData.amount}</td>
          </tr>
        </table>
      </div>

      <!-- Additional Details -->
      <div style="background-color: #e8f5fd; border: 1px solid #b9e1f9; border-radius: 8px; padding: 14px; margin-bottom: 24px; font-size: 13px; color: #0f1419;">
        📌 <strong>Plan Benefits Active:</strong> You can now post up to <strong>${invoiceData.tweetLimit}</strong> on Twiller. Your subscription remains active until <strong>${invoiceData.expiresDate}</strong>.
      </div>

      <!-- Footer -->
      <div style="text-align: center; border-top: 1px solid #e1e8ed; padding-top: 16px; font-size: 12px; color: #536471;">
        <p style="margin: 0;">If you have any questions regarding this invoice, contact support at <a href="mailto:support@twiller.app" style="color: #1d9bf0;">support@twiller.app</a>.</p>
        <p style="margin-top: 4px;">© ${new Date().getFullYear()} Twiller Inc. All rights reserved.</p>
      </div>

    </div>
  `;

  // 1. Resend API Delivery
  if (process.env.RESEND_API_KEY) {
    try {
      if (!resendInstance) {
        resendInstance = new Resend(process.env.RESEND_API_KEY);
      }
      const response = await resendInstance.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Twiller Invoicing <onboarding@resend.dev>",
        to: [toEmail],
        subject: subject,
        html: htmlContent,
      });

      if (!response.error) {
        console.log(`🚀 Invoice delivered to ${toEmail} via Resend! ID: ${response.data?.id}`);
        return { success: true };
      }
    } catch (err) {
      console.error("❌ Resend invoice error:", err.message);
    }
  }

  // 2. Nodemailer fallback
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
      if (!nodemailerTransporter) {
        nodemailerTransporter = nodemailer.createTransport({
          service: process.env.EMAIL_SERVICE || "gmail",
          auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });
      }
      await nodemailerTransporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || 'Twiller Invoicing'}" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: subject,
        html: htmlContent,
      });
      console.log(`✅ Invoice sent to ${toEmail} via SMTP.`);
      return { success: true };
    } catch (err) {
      console.error("❌ Nodemailer invoice error:", err.message);
    }
  }

  // 3. Ethereal fallback with 3-second timeout
  try {
    const etherealPromise = (async () => {
      const testAccount = await nodemailer.createTestAccount();
      const testTransporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      const info = await testTransporter.sendMail({
        from: '"Twiller Invoicing" <no-reply@twiller.app>',
        to: toEmail,
        subject: subject,
        html: htmlContent,
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`📬 Ethereal Invoice Preview URL: ${previewUrl}`);
      return { success: true, previewUrl };
    })();

    const timeoutPromise = new Promise((resolve) =>
      setTimeout(() => resolve({ success: true, previewUrl: null }), 3000)
    );

    return await Promise.race([etherealPromise, timeoutPromise]);
  } catch (err) {
    console.error("❌ Ethereal fallback error:", err.message);
  }

  return { success: true };
}

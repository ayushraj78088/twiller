"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Mail, Phone, Lock, Sparkles, Check, AlertTriangle, CheckCircle2, Copy, Eye, EyeOff } from "lucide-react";
import axiosInstance from "@/lib/axiosInstance";
import TwitterLogo from "@/components/TwitterLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function ForgotPasswordPage() {
  const { setSessionUser } = useAuth();
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isResetCompleted, setIsResetCompleted] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Letters-Only Password Generator
  // Creates random passwords using ONLY uppercase and lowercase letters (A-Z, a-z)
  // Explicitly excludes numbers and special characters
  const generateLettersOnlyPassword = (length: number = 12) => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let generated = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * letters.length);
      generated += letters[randomIndex];
    }
    setNewPassword(generated);
    setShowPassword(true);
  };

  const handleCopyPassword = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg("Please enter your registered Email address or Phone number.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await axiosInstance.post("/request-password-reset", {
        identifier: identifier.trim(),
      });

      setSuccessMsg(res.data.message || "Reset code sent successfully.");
      setUserEmail(res.data.email || identifier.trim());
      if (res.data.previewUrl) {
        setPreviewUrl(res.data.previewUrl);
      }
      setStep("verify");
    } catch (err: any) {
      const serverError = err.response?.data?.error;
      // Handle the exact once-per-day limit message
      if (err.response?.status === 429 || serverError === "You can use this option only one time per day.") {
        setErrorMsg("You can use this option only one time per day.");
      } else {
        setErrorMsg(serverError || "Failed to initiate password reset.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 6) {
      setErrorMsg("Please enter the 6-digit verification code.");
      return;
    }
    if (!newPassword.trim() || newPassword.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await axiosInstance.post("/verify-password-reset", {
        identifier: userEmail || identifier.trim(),
        otp: otpCode.trim(),
        newPassword: newPassword.trim(),
      });

      setIsResetCompleted(true);
      setSuccessMsg("Password Changed Successfully!");
      if (res.data.user) {
        setSessionUser(res.data.user);
      }
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || "Invalid verification code or reset failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <TwitterLogo size="xl" className="text-white" />
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {t("accountRecovery")}
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Reset your password using your registered Email or Phone number
          </p>
        </div>

        <Card className="bg-gray-950 border-gray-800 text-white shadow-2xl rounded-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-bold flex items-center space-x-2 text-white">
              <KeyRound className="h-5 w-5 text-blue-400" />
              <span>
                {isResetCompleted
                  ? t("accountRecovery")
                  : step === "request"
                  ? t("accountRecovery")
                  : t("setNewPassword")}
              </span>
            </CardTitle>
            <CardDescription className="text-gray-400 text-xs">
              {isResetCompleted
                ? "Your password has been updated successfully."
                : step === "request"
                ? "Enter your registered Email address or Phone number to receive a verification code."
                : `Enter the code sent to ${userEmail} and choose a new password.`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMsg && (
              <div className="flex items-start space-x-2 text-red-400 text-sm bg-red-950/60 p-3.5 rounded-xl border border-red-800/60">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            {successMsg && !isResetCompleted && (
              <div className="space-y-2 bg-green-950/60 p-3.5 rounded-xl border border-green-800/60 text-sm text-green-400">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>{successMsg}</span>
                </div>
                {previewUrl && (
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center text-xs text-blue-400 hover:underline bg-blue-950/80 px-2.5 py-1.5 rounded border border-blue-800/60"
                  >
                    📬 View Sent Reset Email Online →
                  </a>
                )}
              </div>
            )}

            {isResetCompleted ? (
              <div className="space-y-4 text-center py-6 bg-gradient-to-b from-green-950/40 via-emerald-950/30 to-black p-6 rounded-2xl border border-green-500/30 shadow-2xl">
                <div className="inline-flex p-4 bg-green-500/20 text-green-400 rounded-full border border-green-500/40 animate-pulse">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold text-white">Password Changed Successfully!</h3>
                <p className="text-sm text-gray-300">
                  Your account password has been updated. Redirecting to your home feed automatically...
                </p>
                <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-4">
                  <div className="bg-green-500 h-full animate-pulse w-full" />
                </div>
              </div>
            ) : step === "request" ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="identifier" className="text-sm font-semibold text-gray-300">
                    {t("email")} / {t("enterMobilePhone")}
                  </Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 flex items-center space-x-1">
                      <Mail className="h-4 w-4" />
                      <span className="text-xs">/</span>
                      <Phone className="h-4 w-4" />
                    </div>
                    <Input
                      id="identifier"
                      type="text"
                      placeholder="user@example.com or +1234567890"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="pl-16 bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus-visible:ring-blue-500"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !identifier.trim()}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-800 text-white font-semibold py-2.5 rounded-full transition-all"
                >
                  {isLoading ? "..." : t("sendResetCode")}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otpCode" className="text-xs font-semibold text-gray-400">
                    {t("enterOtp")}
                  </Label>
                  <Input
                    id="otpCode"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="bg-gray-900 border-gray-800 text-white text-center font-mono text-xl tracking-widest focus-visible:ring-blue-500"
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="newPassword" className="text-xs font-semibold text-gray-400">
                      {t("password")}
                    </Label>
                    <button
                      type="button"
                      onClick={() => generateLettersOnlyPassword(12)}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center space-x-1 font-semibold"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{t("generateLettersOnlyPassword")}</span>
                    </button>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter or generate new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10 pr-20 bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus-visible:ring-blue-500 font-mono text-sm"
                      disabled={isLoading}
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                      {newPassword && (
                        <button
                          type="button"
                          onClick={handleCopyPassword}
                          className="text-gray-400 hover:text-white p-1 rounded"
                          title="Copy Password"
                        >
                          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-white p-1 rounded"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Generated passwords use <strong>only letters (A-Z, a-z)</strong> with no numbers or special symbols.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading || !otpCode || !newPassword}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-800 text-white font-semibold py-2.5 rounded-full transition-all"
                >
                  {isLoading ? "..." : t("resetPasswordAndLogin")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t("backToSignIn")}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

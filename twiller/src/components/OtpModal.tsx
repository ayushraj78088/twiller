"use client";

import React, { useState, useEffect } from "react";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ShieldCheck, Mail, AlertCircle, CheckCircle2, X } from "lucide-react";

interface OtpModalProps {
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
}

export default function OtpModal({
  userEmail,
  isOpen,
  onClose,
  onVerified,
}: OtpModalProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOtpSent(false);
      setOtpCode("");
      setError(null);
      setSuccessMsg(null);
      setPreviewUrl(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSendOtp = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    setPreviewUrl(null);
    try {
      const res = await axiosInstance.post("/send-otp", { email: userEmail });
      setOtpSent(true);
      setSuccessMsg(res.data.message || "OTP code sent to your email.");
      if (res.data.debugOtp) {
        setOtpCode(res.data.debugOtp);
      }
      if (res.data.previewUrl) {
        setPreviewUrl(res.data.previewUrl);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to send OTP code.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 6) {
      setError("Please enter a valid 6-digit OTP code.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await axiosInstance.post("/verify-otp", { email: userEmail, otp: otpCode.trim() });
      setSuccessMsg("OTP Verified successfully!");
      setTimeout(() => {
        onVerified();
      }, 500);
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid OTP code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Audio Tweet Verification</h3>
            <p className="text-xs text-gray-400">Authentication required for audio uploads</p>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-300 bg-gray-950 p-3 rounded-lg border border-gray-800 flex items-center space-x-2">
          <Mail className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="truncate">Registered Email: <strong>{userEmail}</strong></span>
        </div>

        {error && (
          <div className="mb-4 flex items-center space-x-2 text-red-400 text-sm bg-red-950/40 p-3 rounded-lg border border-red-800/50">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 text-sm bg-green-950/40 p-3 rounded-lg border border-green-800/50 space-y-2">
            <div className="flex items-center space-x-2 text-green-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs text-blue-400 hover:underline bg-blue-950/60 px-2.5 py-1.5 rounded border border-blue-800/60"
              >
                📬 View Sent Email in Online Test Inbox →
              </a>
            )}
          </div>
        )}

        {!otpSent ? (
          <div className="space-y-4">
            <p className="text-xs text-gray-400">
              To post audio tweets, an OTP verification code must be sent to your registered email address.
            </p>
            <Button
              type="button"
              onClick={handleSendOtp}
              disabled={isLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-full transition-all"
            >
              {isLoading ? "Sending OTP..." : "Send Verification OTP"}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">
                Enter 6-Digit OTP Code
              </label>
              <Input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="bg-gray-950 border-gray-700 text-white text-center font-mono text-xl tracking-widest focus-visible:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Didn't receive code?</span>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={isLoading}
                className="text-blue-400 hover:underline disabled:opacity-50"
              >
                Resend OTP
              </button>
            </div>

            <Button
              type="submit"
              disabled={isLoading || otpCode.length < 6}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-800 text-white font-semibold py-2.5 rounded-full transition-all"
            >
              {isLoading ? "Verifying..." : "Verify OTP & Post Audio"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

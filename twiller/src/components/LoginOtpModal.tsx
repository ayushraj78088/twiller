"use client";

import React, { useState } from "react";
import { Mail, CheckCircle2, AlertTriangle, ShieldCheck, X } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import axiosInstance from "@/lib/axiosInstance";
import { useAuth } from "@/context/AuthContext";

interface LoginOtpModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  userId: string;
  onSuccess: (userData: any) => void;
}

export default function LoginOtpModal({
  isOpen,
  onClose,
  email,
  userId,
  onSuccess,
}: LoginOtpModalProps) {
  const { setSessionUser } = useAuth();
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await axiosInstance.post("/verify-login-check-otp", {
        userId,
        email,
        otp: otp.trim(),
      });

      if (res.data && res.data._id) {
        setSessionUser(res.data);
        onSuccess(res.data);
        onClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "Invalid or expired OTP code.";
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-gray-950 border-gray-800 text-white shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="relative pb-2 border-b border-gray-800 flex flex-row items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Chrome Verification</CardTitle>
              <p className="text-xs text-gray-400">Google Chrome Login OTP Required</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="bg-gray-900/90 p-4 rounded-xl border border-gray-800 space-y-2">
            <div className="flex items-center space-x-2 text-xs text-blue-400 font-semibold">
              <Mail className="h-4 w-4" />
              <span>OTP Sent to Registered Email</span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Google Chrome logins require secondary email verification. We have dispatched a 6-digit OTP code to:
            </p>
            <p className="text-xs font-mono font-bold text-white bg-black/50 p-2 rounded-lg border border-gray-800">
              {email}
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-start space-x-2 text-red-400 text-xs bg-red-950/70 p-3 rounded-xl border border-red-800/80">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300">
                Enter 6-Digit OTP Code
              </label>
              <Input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="bg-gray-900 border-gray-800 text-white font-mono text-center text-xl tracking-widest focus:border-blue-500 rounded-xl py-3"
              />
            </div>

            <Button
              type="submit"
              disabled={otp.length !== 6 || isLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-all"
            >
              {isLoading ? "Verifying..." : "Verify & Complete Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import { SUPPORTED_LANGUAGES, LanguageCode } from "@/lib/translations";
import {
  X,
  Mail,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export default function LanguageOtpModal() {
  const { user, setSessionUser } = useAuth();
  const {
    isOtpModalOpen,
    pendingTargetLang,
    closeOtpModal,
    setLanguageDirectly,
    t,
  } = useLanguage();

  const [otp, setOtp] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(3);
  const [debugOtp, setDebugOtp] = useState<string | null>(null);

  const targetLangInfo = SUPPORTED_LANGUAGES.find(
    (l) => l.code === pendingTargetLang
  );
  const isFrench = pendingTargetLang === "fr";
  const deliveryMethod = isFrench ? "email" : "phone";

  useEffect(() => {
    if (user?.phone) {
      setPhoneNumber(user.phone);
    }
  }, [user]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  if (!isOtpModalOpen || !pendingTargetLang || !targetLangInfo) return null;

  const handleSendOtp = async () => {
    if (!user) {
      setErrorMsg("Please sign in to switch language.");
      return;
    }

    // Mobile number required for non-French switch
    if (!isFrench && !phoneNumber.trim() && !user.phone) {
      setErrorMsg("Please enter your mobile phone number (E.164 format e.g. +91 98765 43210).");
      return;
    }

    setIsSendingOtp(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await axiosInstance.post("/send-language-otp", {
        userId: user._id,
        targetLanguage: pendingTargetLang,
        phone: !isFrench ? phoneNumber.trim() || user.phone : undefined,
      });

      if (res.data.alreadySelected) {
        setSuccessMsg(t("languageAlreadySelected"));
        setTimeout(() => {
          closeOtpModal();
        }, 1500);
        return;
      }

      setOtpSent(true);
      setCooldown(60); // 60 seconds resend cooldown
      setRemainingAttempts(3);
      if (res.data.debugOtp) {
        setDebugOtp(res.data.debugOtp);
      }
      setSuccessMsg(res.data.message || `OTP sent to your registered ${deliveryMethod}!`);
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to send OTP. Please try again.";
      setErrorMsg(msg);
      if (err.response?.data?.cooldownRemaining) {
        setCooldown(err.response.data.cooldownRemaining);
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !otp.trim()) return;

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await axiosInstance.post("/verify-language-otp", {
        userId: user._id,
        targetLanguage: pendingTargetLang,
        otp: otp.trim(),
      });

      if (res.data.success) {
        setSuccessMsg(`Language switched to ${targetLangInfo.name} ${targetLangInfo.flag}!`);
        if (res.data.user) {
          setSessionUser(res.data.user);
        }
        setTimeout(() => {
          setLanguageDirectly(pendingTargetLang as LanguageCode);
        }, 1000);
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || t("invalidOtp");
      setErrorMsg(msg);

      if (err.response?.data?.remainingAttempts !== undefined) {
        setRemainingAttempts(err.response.data.remainingAttempts);
      }

      if (err.response?.data?.attemptsExceeded || err.response?.data?.expired) {
        setOtpSent(false);
        setOtp("");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-950 border border-gray-800 text-white rounded-2xl max-w-md w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{targetLangInfo.flag}</span>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>{t("switchLanguageTitle")}</span>
              </h3>
              <p className="text-xs text-blue-400 font-semibold">
                Target: {targetLangInfo.name} ({targetLangInfo.nativeName})
              </p>
            </div>
          </div>
          <button
            onClick={closeOtpModal}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Verification Type Badge & Instructions */}
        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Verification Requirement:</span>
            <Badge
              className={
                isFrench
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/40"
                  : "bg-blue-500/20 text-blue-400 border-blue-500/40"
              }
            >
              {isFrench ? (
                <span className="flex items-center space-x-1">
                  <Mail className="h-3 w-3" />
                  <span>Email OTP (French)</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1">
                  <Smartphone className="h-3 w-3" />
                  <span>Mobile OTP (E.164)</span>
                </span>
              )}
            </Badge>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed mt-1">
            {isFrench ? t("emailOtpNotice") : t("phoneOtpNotice")}
          </p>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="flex items-start space-x-2 text-red-400 text-xs bg-red-950/70 p-3 rounded-xl border border-red-800/80">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="flex items-start space-x-2 text-green-400 text-xs bg-green-950/70 p-3 rounded-xl border border-green-800/80">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              {successMsg}
            </div>
          </div>
        )}

        {/* Form Body */}
        {!otpSent ? (
          <div className="space-y-4">
            {!isFrench && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">
                  Registered Mobile Phone (E.164)
                </label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-sm text-white focus:border-blue-500 font-mono"
                />
                <p className="text-[11px] text-gray-500">
                  Formatted in E.164 (+CountryCode MobileNumber).
                </p>
              </div>
            )}

            {isFrench && user && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-300">Registered Email</label>
                <input
                  type="text"
                  value={user.email}
                  disabled
                  className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-sm text-gray-400"
                />
              </div>
            )}

            <Button
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-full"
              onClick={handleSendOtp}
              disabled={isSendingOtp || cooldown > 0}
            >
              {isSendingOtp ? (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Sending Verification OTP...</span>
                </div>
              ) : cooldown > 0 ? (
                `Resend available in ${cooldown}s`
              ) : (
                `Send OTP to ${isFrench ? "Email" : "Mobile Phone"}`
              )}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-300">
                  Enter 6-Digit Verification Code
                </label>
                {remainingAttempts !== null && (
                  <span className="text-[11px] text-amber-400 font-bold">
                    Attempts: {remainingAttempts}/3
                  </span>
                )}
              </div>
              <input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-gray-900 border border-blue-500/60 rounded-lg p-3 text-center text-xl font-mono tracking-widest text-white focus:border-blue-500"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-full text-base"
              disabled={isVerifying || otp.length !== 6}
            >
              {isVerifying ? (
                <div className="flex items-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Verifying OTP...</span>
                </div>
              ) : (
                t("verifyAndSwitch")
              )}
            </Button>

            <div className="flex justify-between items-center pt-2 text-xs">
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={cooldown > 0 || isSendingOtp}
                className="text-blue-400 hover:underline disabled:text-gray-600"
              >
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : t("resendOtp")}
              </button>
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                className="text-gray-400 hover:text-white"
              >
                Change Number/Email
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}

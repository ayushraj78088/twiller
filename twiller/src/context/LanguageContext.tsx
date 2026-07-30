"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { LanguageCode, translations, SUPPORTED_LANGUAGES, LanguageOption } from "@/lib/translations";
import { useAuth } from "./AuthContext";

interface LanguageContextType {
  language: LanguageCode;
  t: (key: string) => string;
  requestLanguageSwitch: (newLang: LanguageCode) => void;
  supportedLanguages: LanguageOption[];
  pendingTargetLang: LanguageCode | null;
  isOtpModalOpen: boolean;
  closeOtpModal: () => void;
  setLanguageDirectly: (newLang: LanguageCode) => void;
  notificationMsg: string | null;
  clearNotification: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [pendingTargetLang, setPendingTargetLang] = useState<LanguageCode | null>(null);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  // Load language preference from user or localStorage on mount
  useEffect(() => {
    if (user?.preferredLanguage && translations[user.preferredLanguage as LanguageCode]) {
      setLanguage(user.preferredLanguage as LanguageCode);
    } else {
      const saved = localStorage.getItem("twiller_language");
      if (saved && translations[saved as LanguageCode]) {
        setLanguage(saved as LanguageCode);
      }
    }

    // Edge Case 8: Recover pending OTP state from sessionStorage if page refreshed
    const pendingSession = sessionStorage.getItem("twiller_pending_lang_otp");
    if (pendingSession && translations[pendingSession as LanguageCode]) {
      setPendingTargetLang(pendingSession as LanguageCode);
      setIsOtpModalOpen(true);
    }
  }, [user]);

  const t = (key: string): string => {
    const langDict = translations[language] || translations["en"];
    return langDict[key] || translations["en"][key] || key;
  };

  const requestLanguageSwitch = (newLang: LanguageCode) => {
    setNotificationMsg(null);

    // Edge Case 4: Same Language Selection check
    if (newLang === language) {
      setNotificationMsg(translations[language]["languageAlreadySelected"] || "Language already selected.");
      return;
    }

    setPendingTargetLang(newLang);
    sessionStorage.setItem("twiller_pending_lang_otp", newLang);
    setIsOtpModalOpen(true);
  };

  const closeOtpModal = () => {
    setIsOtpModalOpen(false);
    setPendingTargetLang(null);
    sessionStorage.removeItem("twiller_pending_lang_otp");
  };

  const setLanguageDirectly = (newLang: LanguageCode) => {
    if (translations[newLang]) {
      setLanguage(newLang);
      localStorage.setItem("twiller_language", newLang);
      closeOtpModal();
    }
  };

  const clearNotification = () => setNotificationMsg(null);

  return (
    <LanguageContext.Provider
      value={{
        language,
        t,
        requestLanguageSwitch,
        supportedLanguages: SUPPORTED_LANGUAGES,
        pendingTargetLang,
        isOtpModalOpen,
        closeOtpModal,
        setLanguageDirectly,
        notificationMsg,
        clearNotification,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

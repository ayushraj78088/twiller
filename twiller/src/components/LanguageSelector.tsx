"use client";

import React, { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { LanguageCode } from "@/lib/translations";
import { Globe, Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";

export default function LanguageSelector() {
  const { language, requestLanguageSwitch, supportedLanguages, t } = useLanguage();

  const currentLang = supportedLanguages.find((l) => l.code === language) || supportedLanguages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-start text-base py-3 px-4 rounded-full hover:bg-gray-900 text-gray-300 hover:text-white transition-colors flex items-center justify-between"
          />
        }
      >
        <div className="flex items-center space-x-3">
          <Globe className="h-5 w-5 text-blue-400 shrink-0" />
          <span className="font-semibold text-white">
            {currentLang.flag} {currentLang.name}
          </span>
        </div>
        <ChevronDown className="h-4 w-4 text-gray-400 ml-2" />
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56 bg-black border border-gray-800 text-white p-1 rounded-xl shadow-2xl">
        <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-800">
          {t("selectLanguage")}
        </div>
        {supportedLanguages.map((lang) => {
          const isSelected = lang.code === language;
          return (
            <DropdownMenuItem
              key={lang.code}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-sm ${
                isSelected ? "bg-blue-950/60 text-blue-400 font-bold" : "hover:bg-gray-900 text-gray-200"
              }`}
              onClick={() => requestLanguageSwitch(lang.code as LanguageCode)}
            >
              <div className="flex items-center space-x-2">
                <span className="text-lg">{lang.flag}</span>
                <span>{lang.name}</span>
                <span className="text-xs text-gray-400 font-normal">({lang.nativeName})</span>
              </div>
              {isSelected && <Check className="h-4 w-4 text-blue-400" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

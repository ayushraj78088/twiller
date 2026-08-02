"use client";

import React, { useState, useEffect } from "react";
import {
  Home,
  Search,
  Bell,
  Mail,
  Bookmark,
  User,
  MoreHorizontal,
  Settings,
  LogOut,
  Crown,
  Feather,
} from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import LanguageSelector from "../LanguageSelector";

interface SidebarProps {
  currentPage?: string;
  onNavigate?: (page: string) => void;
}

export default function Sidebar({
  currentPage = "home",
  onNavigate,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [notificationCount, setNotificationCount] = useState<number>(0);

  useEffect(() => {
    const updateCount = () => {
      const stored = localStorage.getItem("notification-count");
      setNotificationCount(stored ? parseInt(stored, 10) : 0);
    };

    updateCount();
    window.addEventListener("notification-updated", updateCount);
    return () => window.removeEventListener("notification-updated", updateCount);
  }, []);

  const navigation = [
    { name: t("home"), icon: Home, current: currentPage === "home", page: "home" },
    {
      name: t("explore"),
      icon: Search,
      current: currentPage === "explore",
      page: "explore",
    },
    {
      name: t("notifications"),
      icon: Bell,
      current: currentPage === "notifications",
      page: "notifications",
      badge: true,
    },
    {
      name: t("messages"),
      icon: Mail,
      current: currentPage === "messages",
      page: "messages",
    },
    {
      name: t("bookmarks"),
      icon: Bookmark,
      current: currentPage === "bookmarks",
      page: "bookmarks",
    },
    {
      name: t("profile"),
      icon: User,
      current: currentPage === "profile",
      page: "profile",
    },
    {
      name: t("premium"),
      icon: Crown,
      current: currentPage === "subscriptions",
      page: "subscriptions",
      highlight: true,
    },
    {
      name: t("more"),
      icon: MoreHorizontal,
      current: currentPage === "more",
      page: "more",
    },
  ];

  return (
    <div className="flex flex-col h-screen w-full border-r border-gray-800 bg-black">
      {/* App Logo */}
      <div className="p-3 md:p-4 flex items-center justify-center md:justify-start">
        <Link href="/" className="text-white hover:bg-gray-900 p-2 rounded-full transition-colors">
          <span className="text-2xl font-bold font-mono tracking-tighter">X</span>
        </Link>
      </div>

      <nav className="flex-1 px-1 md:px-2 overflow-y-auto">
        <ul className="space-y-1 md:space-y-2">
          {navigation.map((item) => (
            <li key={item.name}>
              <Button
                variant="ghost"
                className={`w-full justify-center md:justify-start text-lg md:text-xl py-4 md:py-6 px-2 md:px-4 rounded-full hover:bg-gray-900 ${
                  item.current ? "font-bold" : "font-normal"
                } text-white hover:text-white relative`}
                onClick={() => {
                  if (item.page === "notifications") {
                    localStorage.setItem("notification-count", "0");
                    setNotificationCount(0);
                  }
                  if (item.page === "subscriptions") {
                    window.location.href = "/subscriptions";
                  } else {
                    onNavigate?.(item.page);
                  }
                }}
              >
                <item.icon className="h-6 w-6 md:h-7 md:w-7 md:mr-4 shrink-0" />
                <span className="hidden md:inline">{item.name}</span>

                {item.badge && notificationCount > 0 && (
                  <span className="absolute top-2 right-2 md:static md:ml-2 bg-blue-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">
                    {notificationCount}
                  </span>
                )}
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-4 px-1 md:px-2 space-y-3">
          <div className="hidden md:block">
            <LanguageSelector />
          </div>

          <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-full text-base md:text-lg flex items-center justify-center">
            <Feather className="h-5 w-5 md:hidden" />
            <span className="hidden md:inline">{t("post")}</span>
          </Button>
        </div>
      </nav>

      {user && (
        <div className="p-2 md:p-4 border-t border-gray-800">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="w-full justify-center md:justify-start p-2 md:p-3 rounded-full hover:bg-gray-900"
                />
              }
            >
              <Avatar className="h-9 w-9 md:h-10 md:w-10 md:mr-3 shrink-0">
                <AvatarImage src={user.avatar} alt={user.displayName} />
                <AvatarFallback>{user.displayName[0]}</AvatarFallback>
              </Avatar>

              <div className="hidden md:flex flex-1 text-left flex-col min-w-0">
                <div className="text-white font-semibold flex items-center space-x-1">
                  <span className="truncate">{user.displayName}</span>
                  {user.subscriptionPlan && user.subscriptionPlan !== "Free" && (
                    <span className="text-xs text-yellow-400 font-bold" title={`${user.subscriptionPlan} Plan Subscribed`}>👑</span>
                  )}
                </div>
                <div className="text-gray-400 text-xs flex items-center space-x-1">
                  <span className="truncate">@{user.username}</span>
                  {user.subscriptionPlan && user.subscriptionPlan !== "Free" && (
                    <span className="text-blue-400 font-bold">({user.subscriptionPlan})</span>
                  )}
                </div>
              </div>

              <MoreHorizontal className="hidden md:block h-5 w-5 text-gray-400 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-black border-gray-800">
              <DropdownMenuItem className="text-white hover:bg-gray-900">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem
                className="text-white hover:bg-gray-900"
                onClick={logout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out @{user.username}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

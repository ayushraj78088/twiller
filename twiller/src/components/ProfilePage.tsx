"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Link as LinkIcon,
  MoreHorizontal,
  Camera,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import TweetCard from "./TweetCard";
import { Card, CardContent } from "./ui/card";
import Editprofile from "./Editprofile";
import axiosInstance from "@/lib/axiosInstance";

interface Tweet {
  id: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string;
    verified?: boolean;
  };
  content: string;
  timestamp: string;
  likes: number;
  retweets: number;
  comments: number;
  liked?: boolean;
  retweeted?: boolean;
  image?: string;
}

const tweets: Tweet[] = [
  {
    id: "1",
    author: {
      id: "1",
      username: "elonmusk",
      displayName: "Elon Musk",
      avatar:
        "https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=400",
      verified: true,
    },
    content:
      "Just had an amazing conversation about the future of AI. The possibilities are endless!",
    timestamp: "2h",
    likes: 1247,
    retweets: 324,
    comments: 89,
    liked: false,
    retweeted: false,
  },
  {
    id: "2",
    author: {
      id: "1",
      username: "sarahtech",
      displayName: "Sarah Johnson",
      avatar:
        "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=400",
      verified: false,
    },
    content:
      "Working on some exciting new features for our app. Can't wait to share what we've been building! 🚀",
    timestamp: "4h",
    likes: 89,
    retweets: 23,
    comments: 12,
    liked: true,
    retweeted: false,
  },
  {
    id: "3",
    author: {
      id: "4",
      username: "designguru",
      displayName: "Alex Chen",
      avatar:
        "https://images.pexels.com/photos/1681010/pexels-photo-1681010.jpeg?auto=compress&cs=tinysrgb&w=400",
      verified: true,
    },
    content:
      "The new design system is finally complete! It took 6 months but the results are incredible. Clean, consistent, and accessible.",
    timestamp: "6h",
    likes: 456,
    retweets: 78,
    comments: 34,
    liked: false,
    retweeted: true,
    image:
      "https://images.pexels.com/photos/196645/pexels-photo-196645.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
];
import EditProfileModal from "./Editprofile";

export default function ProfilePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("posts");
  const [showEditModal, setShowEditModal] = useState(false);

  if (!user) return null;
  const [tweets, setTweets] = useState<any>([]);
  const [loading, setloading] = useState(false);
  const [loginHistory, setLoginHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchTweets = async () => {
    try {
      setloading(true);
      const res = await axiosInstance.get("/post");
      setTweets(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setloading(false);
    }
  };

  const fetchLoginHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await axiosInstance.get("/user/login-history", {
        params: { email: user.email, userId: user._id },
      });
      setLoginHistory(res.data || []);
    } catch (error) {
      console.error("Failed to fetch login history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchTweets();
    fetchLoginHistory();
  }, [user?._id]);
  // Filter and deduplicate tweets by current user
  const userTweets = Array.from(
    new Map(
      tweets
        .filter(
          (tweet: any) =>
            tweet &&
            tweet._id &&
            tweet.author &&
            (tweet.author._id === user?._id || tweet.author._id === user?._id?.toString())
        )
        .map((t: any) => [t._id, t])
    ).values()
  );

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 z-10">
        <div className="flex items-center px-4 py-3 space-x-8">
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-900"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white">{user.displayName}</h1>
            <p className="text-sm text-gray-400">{userTweets.length} posts</p>
          </div>
        </div>
      </div>

      {/* Cover Photo */}
      <div className="relative">
        <div className="h-48 bg-gradient-to-r from-blue-600 to-purple-600 relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70"
          >
            <Camera className="h-5 w-5 text-white" />
          </Button>
        </div>

        {/* Profile Picture */}
        <div className="absolute -bottom-16 left-4">
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-black">
              <AvatarImage src={user.avatar} alt={user.displayName} />
              <AvatarFallback className="text-2xl">
                {user.displayName[0]}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="sm"
              className="absolute bottom-2 right-2 p-2 rounded-full bg-black/70 hover:bg-black/90"
            >
              <Camera className="h-4 w-4 text-white" />
            </Button>
          </div>
        </div>

        {/* Edit Profile Button */}
        <div className="flex justify-end p-4">
          <Button
            variant="outline"
            className="border-gray-600 text-white bg-gray-950 font-semibold rounded-full px-6"
            onClick={() => setShowEditModal(true)}
          >
            {t("editProfile")}
          </Button>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-4 pb-4 mt-12">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {user.displayName}
            </h1>
            <p className="text-gray-400">@{user.username}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="p-2 rounded-full hover:bg-gray-900"
          >
            <MoreHorizontal className="h-5 w-5 text-gray-400" />
          </Button>
        </div>

        {user.bio && (
          <p className="text-white mb-3 leading-relaxed">{user.bio}</p>
        )}

        <div className="flex items-center space-x-4 text-gray-400 text-sm mb-3">
          <div className="flex items-center space-x-1">
            <MapPin className="h-4 w-4" />
            <span>{user.location ? user.location : "Earth"}</span>
          </div>
          <div className="flex items-center space-x-1">
            <LinkIcon className="h-4 w-4" />
            <span className="text-blue-400">
              {user.website ? user.website : "example.com"}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Calendar className="h-4 w-4" />
            <span>
              Joined{" "}
              {user.joinedDate &&
                new Date(user.joinedDate).toLocaleDateString("en-us", {
                  month: "long",
                  year: "numeric",
                })}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full overflow-x-auto bg-transparent border-b border-gray-800 rounded-none h-auto justify-between scrollbar-none">
          <TabsTrigger
            value="posts"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-3 px-3 shrink-0 font-semibold text-xs sm:text-sm"
          >
            {t("posts")}
          </TabsTrigger>
          <TabsTrigger
            value="replies"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-3 px-3 shrink-0 font-semibold text-xs sm:text-sm"
          >
            {t("replies")}
          </TabsTrigger>
          <TabsTrigger
            value="highlights"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-3 px-3 shrink-0 font-semibold text-xs sm:text-sm"
          >
            {t("highlights")}
          </TabsTrigger>
          <TabsTrigger
            value="articles"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-3 px-3 shrink-0 font-semibold text-xs sm:text-sm"
          >
            {t("articles")}
          </TabsTrigger>
          <TabsTrigger
            value="media"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-3 px-3 shrink-0 font-semibold text-xs sm:text-sm"
          >
            {t("media")}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-blue-500 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-3 px-3 shrink-0 font-semibold text-xs sm:text-sm"
          >
            {t("loginHistory")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="mt-0">
          <div className="divide-y divide-gray-800">
            {loading ? (
              <Card className="bg-black border-none">
                <CardContent className="py-12 text-center">
                  <div className="text-gray-400">
                    <h3 className="text-2xl font-bold mb-2">
                      You haven't posted yet
                    </h3>
                    <p>When you post, it will show up here.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              userTweets.map((tweet: any) => (
                <TweetCard key={tweet._id} tweet={tweet} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="replies" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  You haven't replied yet
                </h3>
                <p>When you reply to a post, it will show up here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highlights" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  Lights, camera … attachments!
                </h3>
                <p>When you post photos or videos, they will show up here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="articles" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  You haven't written any articles
                </h3>
                <p>When you write articles, they will show up here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="media" className="mt-0">
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400">
                <h3 className="text-2xl font-bold mb-2">
                  Lights, camera … attachments!
                </h3>
                <p>When you post photos or videos, they will show up here.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Task 6: Login Session History */}
        <TabsContent value="history" className="mt-0 p-4">
          <Card className="bg-gray-950 border-gray-800 text-white rounded-2xl overflow-hidden">
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div>
                  <h3 className="text-lg font-bold">Login Session History</h3>
                  <p className="text-xs text-gray-400">
                    Transparent log of all recent login attempts, IP addresses, browsers, and devices.
                  </p>
                </div>
                <span className="text-xs font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full font-bold">
                  {loginHistory.length} Sessions Logged
                </span>
              </div>

              {loadingHistory ? (
                <div className="py-12 text-center text-gray-400">Loading session records...</div>
              ) : loginHistory.length === 0 ? (
                <div className="py-12 text-center text-gray-400">No login attempts recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {loginHistory.map((item: any, idx: number) => {
                    const isSuccess = item.status === "Success";
                    const isPending = item.status?.includes("Pending");
                    const statusBg = isSuccess
                      ? "bg-green-500/20 text-green-400 border-green-500/30"
                      : isPending
                      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      : "bg-red-500/20 text-red-400 border-red-500/30";

                    return (
                      <div
                        key={idx}
                        className="bg-gray-900/80 p-4 rounded-xl border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-gray-700 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-sm">{item.browser || "Unknown Browser"}</span>
                            <span className="text-xs text-gray-400">({item.os || "Unknown OS"})</span>
                            <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-md font-semibold">
                              {item.device || "Desktop"}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-gray-400 font-mono">
                            <span>
                              IP: <strong className="text-blue-400">
                                {!item.ipAddress || item.ipAddress === "::1" || item.ipAddress === "::ffff:127.0.0.1"
                                  ? "127.0.0.1 (Localhost)"
                                  : item.ipAddress.replace(/^::ffff:/, "")}
                              </strong>
                            </span>
                            <span>•</span>
                            <span>{new Date(item.timestamp).toLocaleString("en-IN")}</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <span className={`text-xs px-3 py-1 rounded-full font-bold border ${statusBg}`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <Editprofile
        isopen={showEditModal}
        onclose={() => setShowEditModal(false)}
      />
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent } from "./ui/card";
import LoadingSpinner from "./loading-spinner";
import TweetCard from "./TweetCard";
import TweetComposer from "./TweetComposer";
import axiosInstance from "@/lib/axiosInstance";
import { useAuth } from "@/context/AuthContext";
import { io, Socket } from "socket.io-client";

interface Tweet {
  _id: string;
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

const Feed = () => {
  const { user } = useAuth();

  const socketRef = useRef<Socket | null>(null);

  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(false);

  const notifiedTweets = useRef(new Set<string>());
  const userRef = useRef(user);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchTweets = async () => {
    try {
      setLoading(true);

      const res = await axiosInstance.get("/post");

      setTweets(res.data);
      showNotifications(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const KEYWORDS = ["cricket", "science"];

  const showNotifications = (tweetsData: Tweet[]) => {
    if (!userRef.current?.notificationsEnabled) return;

    if (!("Notification" in window)) return;

    if (Notification.permission !== "granted") return;

    tweetsData.forEach((tweet) => {
      if (notifiedTweets.current.has(tweet._id)) return;

      const text = tweet.content?.toLowerCase() || "";

      const matched = KEYWORDS.some((keyword) => text.includes(keyword));

      if (!matched) return;

      notifiedTweets.current.add(tweet._id);

      const currentCount = parseInt(localStorage.getItem("notification-count") || "0", 10) + 1;
      localStorage.setItem("notification-count", String(currentCount));
      window.dispatchEvent(new Event("notification-updated"));

      const notification = new Notification(
        `${tweet.author.displayName} posted`,
        {
          body: tweet.content,
          icon: tweet.author?.avatar,
        },
      );

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      setTimeout(() => notification.close(), 5000);
    });
  };

  useEffect(() => {
    if (!user?.notificationsEnabled) return;

    if (!("Notification" in window)) return;

    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [user]);

  useEffect(() => {
    fetchTweets();
  }, [user]);

  useEffect(() => {
    socketRef.current = io(process.env.BACKEND_URL!);

    socketRef.current.on("newTweet", (tweet: Tweet) => {
      setTweets((prev: Tweet[]) => {
        if (prev.some((t: Tweet) => t._id === tweet._id)) {
          return prev;
        }

        return [tweet, ...prev];
      });

      showNotifications([tweet]);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const handleTweetPosted = (newTweet: Tweet) => {
    setTweets((prev: Tweet[]) => [newTweet, ...prev]);
    showNotifications([newTweet]);
  };

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 bg-black/90 backdrop-blur-md border-b border-gray-800 z-10">
        <div className="px-4 py-3">
          <h1 className="text-xl font-bold text-white">Home</h1>
        </div>

        <Tabs defaultValue="foryou" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-transparent border-b border-gray-800 rounded-none h-auto">
            <TabsTrigger
              value="foryou"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-1 data-[state=active]:border-blue-100 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
            >
              For you
            </TabsTrigger>
            <TabsTrigger
              value="following"
              className="data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:border-b-1 data-[state=active]:border-blue-100 data-[state=active]:rounded-none text-gray-400 hover:bg-gray-900/50 py-4 font-semibold"
            >
              Following
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <TweetComposer onTweetPosted={handleTweetPosted} />
      <div className="divide-y divide-gray-800">
        {loading ? (
          <Card className="bg-black border-none">
            <CardContent className="py-12 text-center">
              <div className="text-gray-400 mb-4">
                <LoadingSpinner size="lg" className="mx-auto mb-4" />
                <p>Loading tweets...</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          tweets.map((tweet: Tweet) => (
            <TweetCard key={tweet._id} tweet={tweet} />
          ))
        )}
      </div>
    </div>
  );
};

export default Feed;

"use client";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Image, Mic, Smile, Calendar, MapPin, BarChart3, Globe, Clock, AlertTriangle } from "lucide-react";
import { Separator } from "./ui/separator";
import axios from "axios";
import axiosInstance from "@/lib/axiosInstance";
import AudioRecorder from "./AudioRecorder";
import OtpModal from "./OtpModal";

const TweetComposer = ({ onTweetPosted }: any) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const socketRef = useRef<any>(null);
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [imageurl, setimageurl] = useState("");

  // Audio tweet state
  const [showAudioSection, setShowAudioSection] = useState(false);
  const [audioFile, setAudioFile] = useState<File | Blob | null>(null);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [audioWindowStatus, setAudioWindowStatus] = useState<{
    allowed: boolean;
    currentIST: string;
    window: string;
  } | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  const maxLength = 200;

  useEffect(() => {
    checkAudioWindow();
    const interval = setInterval(checkAudioWindow, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkAudioWindow = async () => {
    try {
      const res = await axiosInstance.get("/audio-status");
      setAudioWindowStatus(res.data);
    } catch (err) {
      console.error("Failed to fetch audio window status", err);
    }
  };

  const executePost = async (finalAudioUrl?: string) => {
    setIsLoading(true);
    setPostError(null);
    try {
      const tweetdata = {
        author: user?._id,
        content: content.trim() || (finalAudioUrl ? "🎙️ Audio Tweet" : ""),
        image: imageurl,
        audio: finalAudioUrl || null,
      };

      const res = await axiosInstance.post("/post", tweetdata);
      onTweetPosted(res.data);

      // Reset form
      setContent("");
      setimageurl("");
      setAudioFile(null);
      setShowAudioSection(false);
      setShowOtpModal(false);
    } catch (error: any) {
      console.error(error);
      setPostError(error.response?.data?.error || "Failed to post tweet.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioUploadAndPost = async () => {
    if (!audioFile) {
      executePost();
      return;
    }

    setIsLoading(true);
    setPostError(null);
    try {
      const formData = new FormData();
      formData.append("audio", audioFile, "audio-tweet.webm");

      const uploadRes = await axiosInstance.post("/upload-audio", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const uploadedAudioUrl = uploadRes.data.audioUrl;
      await executePost(uploadedAudioUrl);
    } catch (error: any) {
      console.error("Audio upload error:", error);
      setPostError(
        error.response?.data?.error || "Audio upload failed. Please verify limits and time window."
      );
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: any) => {
    e.preventDefault();
    if (!user) return;
    if (!content.trim() && !audioFile) return;

    if (audioFile) {
      // Require OTP verification before uploading audio
      setShowOtpModal(true);
    } else {
      executePost();
    }
  };

  const characterCount = content.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount > maxLength * 0.8;

  if (!user) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsLoading(true);
    const image = e.target.files[0];
    const formdataimg = new FormData();
    formdataimg.set("image", image);
    try {
      const res = await axios.post(
        `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
        formdataimg,
      );
      const url = res.data.data.display_url;
      if (url) {
        setimageurl(url);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-black border-gray-800 border-x-0 border-t-0 rounded-none">
      <CardContent className="p-4">
        {postError && (
          <div className="mb-3 flex items-start justify-between space-x-2 text-red-400 text-sm bg-red-950/70 p-3.5 rounded-xl border border-red-800/80 animate-in fade-in">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
              <div>
                <p className="font-bold text-white text-xs uppercase tracking-wider">Notice</p>
                <p className="text-xs text-red-300 mt-0.5 leading-snug">{postError}</p>
              </div>
            </div>
            <Link
              href="/subscriptions"
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-full shrink-0 transition-colors shadow-md flex items-center space-x-1"
            >
              <span>Upgrade</span>
              <span>👑</span>
            </Link>
          </div>
        )}

        <div className="flex space-x-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={user.avatar} alt={user.displayName} />
            <AvatarFallback>{user.displayName[0]}</AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <form onSubmit={handleSubmit}>
              <Textarea
                placeholder={audioFile ? "Add an optional caption..." : t("whatsHappening")}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="bg-transparent border-none text-xl text-white placeholder-gray-500 resize-none min-h-[100px] focus-visible:ring-0 focus-visible:ring-offset-0"
              />

              {/* Audio recording section */}
              {showAudioSection && (
                <div className="my-2">
                  {audioWindowStatus && !audioWindowStatus.allowed && (
                    <div className="flex items-center space-x-2 text-amber-400 text-xs bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/50 mb-2">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>
                        Audio tweets can only be posted between <strong>2:00 PM and 7:00 PM IST</strong>. (Current IST: {audioWindowStatus.currentIST})
                      </span>
                    </div>
                  )}
                  <AudioRecorder
                    disabled={audioWindowStatus ? !audioWindowStatus.allowed : false}
                    onAudioSelected={(file) => setAudioFile(file)}
                    onAudioCleared={() => setAudioFile(null)}
                  />
                </div>
              )}

              {/* Image preview */}
              {imageurl && (
                <div className="relative mb-3 rounded-xl overflow-hidden max-h-60">
                  <img src={imageurl} alt="Upload preview" className="w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setimageurl("")}
                    className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 text-xs hover:bg-black"
                  >
                    ✕
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2 text-blue-400">
                  <label
                    htmlFor="tweetImage"
                    className="p-2 rounded-full hover:bg-blue-900/20 cursor-pointer"
                    title="Upload Image"
                  >
                    <Image className="h-5 w-5" />
                    <input
                      type="file"
                      accept="image/*"
                      id="tweetImage"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={isLoading}
                    />
                  </label>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAudioSection(!showAudioSection)}
                    className={`p-2 rounded-full hover:bg-blue-900/20 ${showAudioSection || audioFile ? "bg-blue-900/30 text-blue-300" : "text-blue-400"
                      }`}
                    title="Audio Tweet (2 PM - 7 PM IST)"
                  >
                    <Mic className="h-5 w-5" />
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20 text-blue-400"
                  >
                    <BarChart3 className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20 text-blue-400"
                  >
                    <Smile className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20 text-blue-400"
                  >
                    <Calendar className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="p-2 rounded-full hover:bg-blue-900/20 text-blue-400"
                  >
                    <MapPin className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    <span className="text-xs text-blue-400 font-semibold hidden sm:inline">
                      Everyone can reply
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    {characterCount > 0 && (
                      <div className="flex items-center space-x-2">
                        <div className="relative w-8 h-8">
                          <svg className="w-8 h-8 transform -rotate-90">
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              className="text-gray-700"
                            />
                            <circle
                              cx="16"
                              cy="16"
                              r="14"
                              stroke="currentColor"
                              strokeWidth="2"
                              fill="none"
                              strokeDasharray={`${2 * Math.PI * 14}`}
                              strokeDashoffset={`${2 * Math.PI * 14 * (1 - characterCount / maxLength)
                                }`}
                              className={
                                isOverLimit
                                  ? "text-red-500"
                                  : isNearLimit
                                    ? "text-yellow-500"
                                    : "text-blue-500"
                              }
                            />
                          </svg>
                        </div>
                        {isNearLimit && (
                          <span
                            className={`text-sm ${isOverLimit ? "text-red-500" : "text-yellow-500"
                              }`}
                          >
                            {maxLength - characterCount}
                          </span>
                        )}
                      </div>
                    )}
                    <Separator orientation="vertical" className="h-6 bg-gray-700" />

                    <Button
                      type="submit"
                      disabled={
                        (!content.trim() && !audioFile) ||
                        isOverLimit ||
                        isLoading ||
                        (!!audioFile && audioWindowStatus !== null && !audioWindowStatus.allowed)
                      }
                      className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold rounded-full px-6"
                    >
                      {isLoading ? t("posting") : t("post")}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* OTP Authentication Modal */}
        <OtpModal
          isOpen={showOtpModal}
          userEmail={user.email}
          onClose={() => setShowOtpModal(false)}
          onVerified={handleAudioUploadAndPost}
        />
      </CardContent>
    </Card>
  );
};

export default TweetComposer;

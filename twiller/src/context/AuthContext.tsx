"use client";

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "./firebase";
import axiosInstance from "../lib/axiosInstance";
import axios from "axios";

interface User {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  joinedDate: string;
  email: string;
  website: string;
  location: string;
  notificationsEnabled: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;

  signup: (
    email: string,
    password: string,
    username: string,
    displayName: string,
  ) => Promise<void>;

  updateProfile: (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
    notificationsEnabled: boolean;
  }) => Promise<void>;

  logout: () => void;
  isLoading: boolean;
  googlesignin: () => void;
  setSessionUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const unsubcribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        try {
          const res = await axiosInstance.get("/loggedinuser", {
            params: { email: firebaseUser.email },
          });

          if (res.data) {
            setUser(res.data);
            localStorage.setItem("twitter-user", JSON.stringify(res.data));
          }
        } catch (err) {
          console.log("Failed to fetch user:", err);
        }
      } else {
        const storedUser = localStorage.getItem("twitter-user");
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (e) {
            setUser(null);
            localStorage.removeItem("twitter-user");
          }
        } else {
          setUser(null);
        }
      }
      setIsLoading(false);
    });
    return () => unsubcribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // 1. Try Firebase Auth signin
      let firebaseUser = null;
      try {
        const usercred = await signInWithEmailAndPassword(auth, email, password);
        firebaseUser = usercred.user;
      } catch (fbErr: any) {
        console.warn("Firebase Auth signin note:", fbErr.message);
      }

      // 2. Query backend login-check endpoint
      let backendUser = null;
      let backendError = null;
      try {
        const res = await axiosInstance.post("/login-check", { email, password });
        backendUser = res.data;
      } catch (apiErr: any) {
        backendError = apiErr.response?.data?.error || "Invalid credentials";
      }

      if (backendUser) {
        setUser(backendUser);
        localStorage.setItem("twitter-user", JSON.stringify(backendUser));
        return { success: true };
      }

      if (firebaseUser?.email) {
        const resFb = await axiosInstance.get("/loggedinuser", {
          params: { email: firebaseUser.email },
        });
        if (resFb.data) {
          setUser(resFb.data);
          localStorage.setItem("twitter-user", JSON.stringify(resFb.data));
          return { success: true };
        }
      }

      return {
        success: false,
        error: backendError || "Invalid credentials. Please check your email and password.",
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || err.message || "Invalid credentials",
      };
    }
  };

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string,
  ) => {
    const usercred = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );

    const user = usercred.user;

    const newuser = {
      username,
      displayName,
      avatar:
        user.photoURL ||
        "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
      email: user.email,
    };

    const res = await axiosInstance.post("/register", newuser);

    if (res.data) {
      setUser(res.data);
      localStorage.setItem("twitter-user", JSON.stringify(res.data));
    }
  };

  const logout = async () => {
    setUser(null);
    await signOut(auth);
    localStorage.removeItem("twitter-user");
  };

  const updateProfile = async (profileData: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    avatar: string;
    notificationsEnabled: boolean;
  }) => {
    if (!user) return;

    setIsLoading(true);
    // Mock API call - in real app, this would call an API
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    const updatedUser: User = {
      ...user,
      ...profileData,
    };
    const res = await axiosInstance.patch(
      `/userupdate/${user.email}`,
      updatedUser,
    );

    if (res.data) {
      setUser(res.data);
      localStorage.setItem("twitter-user", JSON.stringify(res.data));
    }

    setIsLoading(false);
  };

  const googlesignin = async () => {
    setIsLoading(true);

    try {
      const googleAuthProvider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, googleAuthProvider);
      const firebaseUser = result.user;

      if (!firebaseUser?.email) {
        throw new Error("No email found in Google account");
      }

      // Check if user already exists
      const res = await axiosInstance.get("/loggedinuser", {
        params: { email: firebaseUser.email },
      });

      let userData = res.data;

      // If user doesn't exist, register them
      if (!userData) {
        const newUser = {
          username: firebaseUser.email.split("@")[0],
          displayName: firebaseUser.displayName || "User",
          avatar:
            firebaseUser.photoURL ||
            "https://images.pexels.com/photos/1139743/pexels-photo-1139743.jpeg?auto=compress&cs=tinysrgb&w=400",
          email: firebaseUser.email,
        };

        const registerRes = await axiosInstance.post("/register", newUser);
        userData = registerRes.data;
      }

      setUser(userData);
      localStorage.setItem("twitter-user", JSON.stringify(userData));
    } catch (error: unknown) {
      console.error("Google Sign-In Error:", error);

      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || "Login failed");
      } else if (error instanceof Error) {
        alert(error.message);
      } else {
        alert("Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const setSessionUser = (userData: User) => {
    setUser(userData);
    localStorage.setItem("twitter-user", JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        updateProfile,
        logout,
        isLoading,
        googlesignin,
        setSessionUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

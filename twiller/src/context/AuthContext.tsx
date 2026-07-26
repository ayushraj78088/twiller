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
  login: (email: string, password: string) => Promise<void>;

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
        setUser(null);
        localStorage.removeItem("twitter-user");
      }
      setIsLoading(false);
    });
    return () => unsubcribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const usercred = await signInWithEmailAndPassword(auth, email, password);

      const firebaseuser = usercred.user;

      const res = await axiosInstance.get("/loggedinuser", {
        params: {
          email: firebaseuser.email,
        },
      });

      if (res.data) {
        setUser(res.data);
        localStorage.setItem("twitter-user", JSON.stringify(res.data));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string,
  ) => {
    setIsLoading(true);

    try {
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
    } finally {
      setIsLoading(false);
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

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

interface User {
  _id: string;
  username: string;
  displayName: string;
  avatar: string;
  bio?: string;
  joinedDate: string;
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

  // Check for existing session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const savedUser = localStorage.getItem("twiller-user");

        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    const usercred = await signInWithEmailAndPassword(auth, email, password);

    // const mockUser: User = {
    //   id: "1",
    //   username: "johndoe",
    //   displayName: "John Doe",
    //   avatar:
    //     "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400",
    //   bio: "Software developer passionate about building great products",
    //   joinedDate: "April 2024",
    // };

    setUser();
    localStorage.setItem("twiller-user", JSON.stringify());
    setIsLoading(false);
  };

  const signup = async (
    email: string,
    password: string,
    username: string,
    displayName: string,
  ) => {
    setIsLoading(true);
    const usercred = await createUserWithEmailAndPassword(auth, email, password)
      .then((usercred) => {
        const user = usercred.user;
        console.log(user);
      })
      .catch((error) => {
        console.log(error);
      });

    // const mockUser: User = {
    //   id: "1",
    //   username: username,
    //   displayName: displayName,
    //   avatar:
    //     "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=400",
    //   bio: "Software developer passionate about building great products",
    //   joinedDate: "April 2024",
    // };

    setUser();
    localStorage.setItem("twiller-user", JSON.stringify());
    setIsLoading(false);
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
  }) => {
    if (!user) return;
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const updateUser = {
      ...user,
      displayName: profileData.displayName,
      bio: profileData.bio,
    };

    setUser(updateUser);
    localStorage.setItem("twiller-user", JSON.stringify(updateUser));
    setIsLoading(false);
  };

  const googlesignin = async () => {
    const googleauthprovider = new GoogleAuthProvider();
    return signInWithPopup(auth, googleauthprovider);
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

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut,
  updateProfile as updateFirebaseProfile,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, googleProvider } from "@/lib/firebase";
import { CustomerProfile, SavedAddress } from "@/lib/types";

export type { CustomerProfile, SavedAddress };

interface AuthContextType {
  user: User | null;
  userProfile: CustomerProfile | null;
  loading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (name: string, phone: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (data: Partial<CustomerProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    try {
      const docSnap = await getDoc(doc(db, "customers", uid));
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as CustomerProfile);
      } else {
        setUserProfile(null);
      }
    } catch (err) {
      console.warn("Could not fetch customer profile:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchProfile(firebaseUser.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    await fetchProfile(result.user.uid);
  };

  const signupWithEmail = async (name: string, phone: string, email: string, password: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateFirebaseProfile(result.user, { displayName: name });
    const profile: CustomerProfile = {
      uid: result.user.uid,
      name,
      email,
      phone,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      savedAddresses: [],
    };
    await setDoc(doc(db, "customers", result.user.uid), profile);
    setUserProfile(profile);
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const docSnap = await getDoc(doc(db, "customers", result.user.uid));
    if (!docSnap.exists()) {
      const profile: CustomerProfile = {
        uid: result.user.uid,
        name: result.user.displayName || "",
        email: result.user.email || "",
        phone: result.user.phoneNumber || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        savedAddresses: [],
      };
      await setDoc(doc(db, "customers", result.user.uid), profile);
      setUserProfile(profile);
    } else {
      setUserProfile(docSnap.data() as CustomerProfile);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (data: Partial<CustomerProfile>) => {
    if (!user) throw new Error("Not authenticated");
    const ref = doc(db, "customers", user.uid);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
    setUserProfile((prev) => (prev ? { ...prev, ...data } : null));
    if (data.name) {
      await updateFirebaseProfile(user, { displayName: data.name });
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, loginWithEmail, signupWithEmail, loginWithGoogle, logout, resetPassword, updateUserProfile, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

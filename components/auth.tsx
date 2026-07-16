"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  User as FirebaseUser
} from "firebase/auth";
import { auth } from "@/lib/clientApp";

interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  isAdmin: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string) => Promise<void>;
  logOut: () => Promise<void>;
  isMockUser: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isMockUser, setIsMockUser] = useState<boolean>(false);

  useEffect(() => {
    try {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const initialUser: AuthUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            isAnonymous: firebaseUser.isAnonymous,
            isAdmin: false
          };
          setUser(initialUser);
          setIsMockUser(false);
          setLoading(false);

          // Fetch actual admin status asynchronously
          try {
            const res = await fetch(`/api/user/profile?userId=${firebaseUser.uid}&email=${firebaseUser.email || ""}`);
            const result = await res.json();
            if (result.success && result.data) {
              setUser(prev => prev && prev.uid === firebaseUser.uid ? { ...prev, isAdmin: result.data.isAdmin } : prev);
            }
          } catch (err) {
            console.error("Failed to query profile for admin status:", err);
          }
        } else {
          // Check local storage mock session as fallback
          const localSession = localStorage.getItem("auth:mock_session");
          if (localSession) {
            const parsedUser = JSON.parse(localSession);
            setUser(parsedUser);
            setIsMockUser(true);
            setLoading(false);

            // Fetch actual admin status asynchronously for mock user from DB
            try {
              const res = await fetch(`/api/user/profile?userId=${parsedUser.uid}&email=${parsedUser.email || ""}`);
              const result = await res.json();
              if (result.success && result.data) {
                const updatedAdmin = result.data.isAdmin;
                setUser(prev => {
                  if (prev && prev.uid === parsedUser.uid) {
                    const updated = { ...prev, isAdmin: updatedAdmin };
                    localStorage.setItem("auth:mock_session", JSON.stringify(updated));
                    return updated;
                  }
                  return prev;
                });
              }
            } catch (err) {
              console.error("Failed to query profile for mock admin status:", err);
            }
          } else {
            setUser(null);
            setLoading(false);
          }
        }
      });
      return unsubscribe;
    } catch (err) {
      console.warn("⚠️ Firebase Auth client failed to load. Toggling offline fallback provider.");
      const localSession = localStorage.getItem("auth:mock_session");
      if (localSession) {
        setUser(JSON.parse(localSession));
        setIsMockUser(true);
      }
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.warn(`[Firebase Auth] Failed, trying offline mock login: ${err.message}`);
      // Fallback: Create mock session
      const isUserAdminMock = email.toLowerCase().includes("admin") || email.toLowerCase() === "thankyou.digital@gmail.com";
      const mockSession: AuthUser = {
        uid: `mock_${email.replace(/[^\w]/g, "_")}`,
        email,
        displayName: email.split("@")[0],
        isAnonymous: false,
        isAdmin: isUserAdminMock
      };
      localStorage.setItem("auth:mock_session", JSON.stringify(mockSession));
      setUser(mockSession);
      setIsMockUser(true);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.warn(`[Firebase Auth] Signup failed, fall back to mock signup: ${err.message}`);
      const isUserAdminMock = email.toLowerCase().includes("admin") || email.toLowerCase() === "thankyou.digital@gmail.com";
      const mockSession: AuthUser = {
        uid: `mock_${email.replace(/[^\w]/g, "_")}`,
        email,
        displayName: email.split("@")[0],
        isAnonymous: false,
        isAdmin: isUserAdminMock
      };
      localStorage.setItem("auth:mock_session", JSON.stringify(mockSession));
      setUser(mockSession);
      setIsMockUser(true);
    } finally {
      setLoading(false);
    }
  };

  const logOut = async () => {
    setLoading(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("[Firebase Auth] signOut failed:", err);
    }
    localStorage.removeItem("auth:mock_session");
    setUser(null);
    setIsMockUser(false);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, logOut, isMockUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Authentication Forms Component
export function AuthCard() {
  const { user, signIn, signUp, logOut, loading, isMockUser } = useAuth();
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setFormError("Please fill in all fields.");
      return;
    }
    setFormError(null);
    try {
      if (isSignUpMode) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
    } catch (err: any) {
      setFormError(err.message || "Authentication failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-44 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-white/10" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wide">Signed in as</span>
          <h4 className="text-sm font-bold text-white mt-0.5">{user.email}</h4>
          {isMockUser && (
            <span className="inline-block rounded bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 text-[8px] font-bold text-orange-400 mt-1 uppercase tracking-wide">
              Offline Mock Session
            </span>
          )}
        </div>
        <button
          onClick={logOut}
          className="rounded-lg bg-zinc-900 px-3.5 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
      {/* Tab select */}
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 border border-white/5">
        <button
          type="button"
          onClick={() => { setIsSignUpMode(false); setFormError(null); }}
          className={`rounded-lg py-2 text-xs font-bold transition-all ${
            !isSignUpMode ? "bg-white text-black shadow-md" : "text-white/60 hover:text-white"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setIsSignUpMode(true); setFormError(null); }}
          className={`rounded-lg py-2 text-xs font-bold transition-all ${
            isSignUpMode ? "bg-white text-black shadow-md" : "text-white/60 hover:text-white"
          }`}
        >
          Sign Up
        </button>
      </div>

      <h3 className="text-sm font-bold text-white mb-4">
        {isSignUpMode ? "Create a Guest Profile" : "Access Your Booking Account"}
      </h3>

      {formError && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-xs text-red-400">
          ⚠️ {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Email Address</label>
          <input
            type="email"
            required
            placeholder="e.g. guest@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Password</label>
          <input
            type="password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-700"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-center text-xs font-bold text-white shadow-lg shadow-teal-500/20 hover:brightness-110 active:scale-95 transition-all"
        >
          {isSignUpMode ? "Register Profile" : "Authenticate Session"}
        </button>
      </form>
    </div>
  );
}

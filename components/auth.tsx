"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
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
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  isMockUser: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const isMockAllowed = () => {
  if (process.env.NODE_ENV === "production") return false;
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.")
    );
  }
  return true;
};

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
          const localSession = isMockAllowed() ? localStorage.getItem("auth:mock_session") : null;
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
      if (isMockAllowed()) {
        const localSession = localStorage.getItem("auth:mock_session");
        if (localSession) {
          setUser(JSON.parse(localSession));
          setIsMockUser(true);
        }
      }
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, pass: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.warn(`[Firebase Auth] Failed: ${err.message}`);
      if (!isMockAllowed()) {
        throw err;
      }
      console.warn(`[Firebase Auth] Trying offline mock login fallback.`);
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
      console.warn(`[Firebase Auth] Signup failed: ${err.message}`);
      if (!isMockAllowed()) {
        throw err;
      }
      console.warn(`[Firebase Auth] Trying offline mock signup fallback.`);
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

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.warn(`[Firebase Auth] Google login failed: ${err instanceof Error ? err.message : String(err)}`);
      if (!isMockAllowed()) {
        throw err;
      }
      console.warn(`[Firebase Auth] Trying offline mock Google login fallback.`);
      
      // Prompt for email in dev to allow mock sign-in with specific developer emails if needed
      let devEmail = "google-guest@example.com";
      if (typeof window !== "undefined") {
        const entered = prompt("Enter email for mock Google sign-in:", "google-guest@example.com");
        if (entered) {
          devEmail = entered;
        }
      }
      
      // Fallback: Create mock session
      const mockSession: AuthUser = {
        uid: "mock_google_user",
        email: devEmail,
        displayName: devEmail.split("@")[0] || "Google Guest",
        isAnonymous: false,
        isAdmin: false
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
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, logOut, isMockUser }}>
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
  const { user, signIn, signUp, signInWithGoogle, logOut, loading, isMockUser } = useAuth();
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setFormError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Google authentication failed.");
    }
  };

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

      <div className="my-5 flex items-center justify-between">
        <hr className="w-full border-white/10" />
        <span className="px-3 text-[10px] uppercase tracking-wider text-zinc-500">or</span>
        <hr className="w-full border-white/10" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white shadow-md hover:bg-white/10 active:scale-95 transition-all"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>
    </div>
  );
}

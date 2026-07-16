"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, AuthCard } from "@/components/auth";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect to home page if already authenticated
  useEffect(() => {
    if (!loading && user) {
      const searchParams = new URLSearchParams(window.location.search);
      const redirectPath = searchParams.get("redirect") || "/";
      router.push(redirectPath);
    }
  }, [user, loading, router]);


  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-zinc-950 px-4 py-16 text-white relative">
      {/* Background radial gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-2xl">🗝</span>
          <h1 className="text-2xl font-black text-white mt-3">Llandudno Stays Account</h1>
          <p className="text-xs text-zinc-500 mt-1.5">Sign in to configure dates and lock bookings</p>
        </div>

        {loading ? (
          <div className="flex h-44 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-white/10" />
          </div>
        ) : (
          <AuthCard />
        )}
      </div>
    </div>
  );
}

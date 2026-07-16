"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/auth";

export default function NavHeader() {
  const { user, loading, logOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-teal-100 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-black text-teal-950 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
          <Image src="/Plek.svg" alt="Simpleplek" width={50} height={50} />
          <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-teal-800/80 dark:text-zinc-400">
          <Link href="/bookings" className="hover:text-teal-950 dark:hover:text-white transition-colors">
            Bookings
          </Link>
          {!user?.isAdmin && (
            <Link href="/subscribe" className="hover:text-teal-950 dark:hover:text-white transition-colors text-teal-500">
              Become Host
            </Link>
          )}
          {user?.isAdmin && (
            <>
              <Link href="/admin/properties" className="hover:text-teal-950 dark:hover:text-white transition-colors">
                Properties
              </Link>
              <Link href="/admin/packages" className="hover:text-teal-950 dark:hover:text-white transition-colors">
                Packages
              </Link>
            </>
          )}

          {/* Auth State Button */}
          <div className="border-l border-teal-100 dark:border-white/10 pl-6 flex items-center gap-4">
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border border-t-teal-500 border-white/10" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col text-right text-[10px] lowercase text-teal-600 dark:text-zinc-500 leading-none">
                  <span className="text-teal-950 dark:text-white font-bold">{user.displayName || user.email?.split("@")[0]}</span>
                  <span className="mt-0.5">{user.email}</span>
                </div>
                <button
                  onClick={logOut}
                  className="rounded-lg bg-teal-50/50 dark:bg-white/5 border border-teal-100 dark:border-white/10 px-3 py-1.5 text-[10px] font-bold text-teal-800 dark:text-zinc-300 hover:text-teal-950 dark:hover:text-white transition-all active:scale-95"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-teal-500 px-3.5 py-1.5 text-[10px] font-bold text-white hover:bg-teal-600 transition-all active:scale-95"
              >
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}

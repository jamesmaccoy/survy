"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/auth";

interface Property {
  id: string;
  title: string;
  slug: string;
  basePricePerNight: number;
  airbnbCalendarUrl?: string;
  googleCalendarUrl?: string;
  images?: string[];
  description?: string;
  bookingType?: string;
  slots?: string[];
  location?: string;
}

export default function AdminPropertiesPage() {
  const { user, loading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProperties = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/posts?hostId=${user.uid}`);
      const result = await res.json();
      if (result.success && result.data) {
        setProperties(result.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load properties:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProperties();
    }
  }, [user, fetchProperties]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-500/20" />
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center shadow-sm backdrop-blur-md">
          <span className="text-4xl">🔐</span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-4">
            Access Denied
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
            Administrative privileges are required to access this portal. Please sign in with an administrator account to continue.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/login"
              className="w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/10"
            >
              Sign In as Admin
            </Link>
            <Link
              href="/"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 py-3 text-center text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans selection:bg-teal-500/30 selection:text-teal-600 transition-colors duration-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] left-[10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        {/* Tab Selection & Global Actions */}
        <div className="border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 sm:pb-0">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            <Link
              href="/admin/properties"
              className="border-teal-500 text-teal-600 dark:text-teal-400 border-b-2 py-4 px-1 text-sm font-bold flex items-center gap-2"
            >
              <span>🏢</span> Properties
            </Link>
            <Link
              href="/admin/packages"
              className="border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-705 dark:hover:text-zinc-300 hover:border-slate-300 dark:hover:border-white/20 border-b-2 py-4 px-1 text-sm font-bold flex items-center gap-2"
            >
              <span>📦</span> Packages
            </Link>
          </nav>
          
          <Link
            href="/admin/properties/new"
            className="sm:mb-2 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-xs font-bold text-white hover:brightness-110 shadow-md shadow-teal-500/10 transition-all flex items-center gap-1.5 shrink-0"
          >
            <span>✙</span> New Property
          </Link>
        </div>

        {properties.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 p-6 shadow-sm max-w-lg mx-auto">
            <span className="text-4xl block mb-3">🏡</span>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
              No properties published yet. Create one to get started.
            </p>
            <Link
              href="/admin/properties/new"
              className="inline-flex rounded-xl bg-teal-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-650 transition-all"
            >
              ✙ Create First Property
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((p) => (
              <div
                key={p.id}
                className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md hover:border-slate-350 dark:hover:border-white/20 transition-all duration-200"
              >
                {/* Card Top Image */}
                <div className="relative aspect-video w-full bg-slate-200 dark:bg-zinc-900 border-b border-slate-200 dark:border-white/5">
                  {p.images && p.images.length > 0 ? (
                    <Image
                      src={p.images[0]}
                      alt={p.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-650 gap-1.5">
                      <span className="text-3xl">📷</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider">No Imagery Uploaded</span>
                    </div>
                  )}
                </div>

                {/* Card Content Body */}
                <div className="p-5 flex-grow flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                          {p.title}
                        </h3>
                        {p.location && (
                          <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 block mt-0.5">
                            {p.location}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[8px] text-slate-500 dark:text-zinc-500 uppercase font-black block leading-none">
                          {p.bookingType === "hourly" ? "Rate/Hour" : "Rate/Night"}
                        </span>
                        <span className="text-sm font-black text-teal-650 dark:text-teal-400">
                          R {p.basePricePerNight.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {p.description ? (
                      <p className="text-[11px] text-slate-550 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                        {p.description}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400 dark:text-zinc-600 italic">
                        No description specified for this property listing.
                      </p>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-4">
                    <span className="rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2 py-0.5 text-[8px] text-slate-600 dark:text-zinc-400 font-bold uppercase tracking-wider">
                      {p.bookingType === "hourly" ? "🕒 Short bookings" : "🌙 Long booking"}
                    </span>
                    <Link
                      href={`/admin/properties/${p.id}`}
                      className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white transition-all active:scale-95 shadow-sm"
                    >
                      Edit Config →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
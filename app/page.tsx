"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth";
import Link from "next/link";
import { formatDisplayDate } from "@/lib/utils";

interface Property {
  id: string;
  title: string;
  slug: string;
  basePricePerNight: number;
  hostId?: string;
  images?: string[];
  description?: string;
  bookingType?: string;
  slots?: string[];
}

function HomePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const paymentStatus = searchParams.get("payment");
  const packageType = searchParams.get("type");
  const amountPaid = searchParams.get("amount");
  const bookingId = searchParams.get("bookingId");
  const estimateId = searchParams.get("estimateId");

  const { user, loading: authLoading } = useAuth();

  // Portal States
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoadingProps, setIsLoadingProps] = useState(true);

  // Date Selection
  const [fromDate, setFromDate] = useState("2026-06-16");
  const [toDate, setToDate] = useState("2026-06-19");
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [savedDates, setSavedDates] = useState<{ fromDate: string; toDate: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [nights, setNights] = useState<number>(3);
  const [hasUpdatedStatus, setHasUpdatedStatus] = useState(false);
  const [latestEstimate, setLatestEstimate] = useState<any | null>(null);
  const [estimatePropertyTitle, setEstimatePropertyTitle] = useState("");
  const [copiedEstimateUrl, setCopiedEstimateUrl] = useState(false);

  // Client-side payment status fallback
  useEffect(() => {
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const intent = searchParams.get("intent");
    const paymentUserId = searchParams.get("userId") || (user ? user.uid : null);

    const isSubscriptionSuccess =
      paymentStatus === "success" &&
      (intent === "subscription" || (!bookingId && !estimateId && isLocalhost && user));

    if ((!bookingId && !estimateId && !isSubscriptionSuccess) || !paymentStatus || hasUpdatedStatus)
      return;

    const updateStatus = async () => {
      setHasUpdatedStatus(true);
      try {
        if (isSubscriptionSuccess && paymentUserId) {
          const res = await fetch("/api/subscribe/mock-confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: paymentUserId }),
          });
          const result = await res.json();
          if (result.success) {
            const localSession = localStorage.getItem("auth:mock_session");
            if (localSession) {
              const session = JSON.parse(localSession);
              if (session.uid === paymentUserId) {
                session.isAdmin = true;
                localStorage.setItem("auth:mock_session", JSON.stringify(session));
              }
            }
            window.location.href = "/admin/properties";
          }
          return;
        }

        let statusToSet = "pending";
        if (paymentStatus === "success") {
          statusToSet = "paid";
        } else if (paymentStatus === "failed") {
          statusToSet = "failed";
        } else if (paymentStatus === "cancel") {
          statusToSet = "cancelled";
        }

        if (estimateId && statusToSet === "paid") {
          await fetch("/api/bookings/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estimateId, paymentStatus: "paid" }),
          });
        } else if (bookingId) {
          await fetch("/api/bookings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId, paymentStatus: statusToSet }),
          });
        }
      } catch (err) {
        console.error("Failed to sync booking/estimate status client-side fallback:", err);
      }
    };

    if (!authLoading) {
      updateStatus();
    }
  }, [bookingId, estimateId, paymentStatus, hasUpdatedStatus, user, authLoading, searchParams]);

  // Load properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const queryHostId = params.get("hostId");

        const url = queryHostId ? `/api/posts?hostId=${queryHostId}` : "/api/posts";
        const res = await fetch(url);
        const result = await res.json();
        if (result.success && result.data) {
          setProperties(result.data);
        }
      } catch (err) {
        console.error("Failed to load properties:", err);
      } finally {
        setIsLoadingProps(false);
      }
    };
    if (!authLoading) {
      fetchProperties();
    }
  }, [user, authLoading]);

  // Load saved user dates
  useEffect(() => {
    if (authLoading || !user) {
      setSavedDates(null);
      return;
    }

    const fetchSavedDates = async () => {
      try {
        const res = await fetch(`/api/user/dates?userId=${user.uid}`);
        const result = await res.json();
        if (result.success && result.data) {
          setSavedDates(result.data);
          const startStr = result.data.fromDate.split("T")[0];
          const endStr = result.data.toDate.split("T")[0];
          setFromDate(startStr);
          setToDate(endStr);

          const start = new Date(startStr);
          const end = new Date(endStr);
          if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const diff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            setNights(diff);
          }
        }
      } catch (err) {
        console.error("Failed to fetch saved user dates:", err);
      }
    };
    fetchSavedDates();
  }, [user, authLoading]);

  // Load latest estimate
  useEffect(() => {
    if (!user) {
      setLatestEstimate(null);
      return;
    }

    const fetchLatestEstimate = async () => {
      try {
        const res = await fetch(`/api/estimates/latest?userId=${user.uid}`);
        const result = await res.json();
        if (result.success && result.data) {
          setLatestEstimate(result.data);
          try {
            const propRes = await fetch(`/api/posts/${result.data.propertyId}`);
            const propResult = await propRes.json();
            if (propResult.success && propResult.data) {
              setEstimatePropertyTitle(propResult.data.title || propResult.data.name || "");
            }
          } catch (propErr) {
            console.error("Failed to fetch estimate property details:", propErr);
          }
        }
      } catch (err) {
        console.error("Failed to fetch latest estimate:", err);
      }
    };
    fetchLatestEstimate();
  }, [user]);

  const handleSaveDates = async () => {
    if (!user) {
      alert("Please sign in or register to save your stay dates.");
      return;
    }

    let start: Date;
    let end: Date;

    const isHourlySaved = savedDates && savedDates.fromDate.split("T")[0] === savedDates.toDate.split("T")[0];

    if (isHourlySaved && savedDates) {
      const oldFrom = new Date(savedDates.fromDate);
      const oldTo = new Date(savedDates.toDate);
      start = new Date(`${fromDate}T00:00:00`);
      start.setHours(oldFrom.getHours(), oldFrom.getMinutes(), 0, 0);

      end = new Date(`${fromDate}T00:00:00`);
      end.setHours(oldTo.getHours(), oldTo.getMinutes(), 0, 0);
    } else {
      start = new Date(fromDate);
      end = new Date(toDate);
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      alert(isHourlySaved ? "Please select a valid date." : "Please select valid check-in and check-out dates.");
      return;
    }

    setIsSavingDates(true);
    setSaveStatus(null);

    try {
      const response = await fetch("/api/user/dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          fromDate: start.toISOString(),
          toDate: end.toISOString(),
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save date profile.");
      }

      setSavedDates(result.data);
      setSaveStatus("Saved ✓");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`Error`);
    } finally {
      setIsSavingDates(false);
    }
  };

  const handleShareEstimate = () => {
    if (!latestEstimate) return;
    const inviteUrl = `${window.location.origin}/i/${latestEstimate.token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedEstimateUrl(true);
    setTimeout(() => setCopiedEstimateUrl(false), 2500);
  };

  const isHourlySaved = !!(savedDates && savedDates.fromDate.split("T")[0] === savedDates.toDate.split("T")[0]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-teal-500/30 selection:text-teal-200 pb-20">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute -top-[40%] -left-[20%] w-[85%] h-[85%] rounded-full bg-emerald-500/5 blur-[130px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[75%] rounded-full bg-teal-500/5 blur-[130px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-10 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50/50 dark:bg-white/5 border border-teal-100 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            <span>✨ Surf Yoga Community</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-950 via-zinc-800 to-zinc-600 dark:from-white dark:via-zinc-200 dark:to-zinc-400">
            Find Your Retreat
          </h1>
        </header>

        {/* Payment Banners */}
        {paymentStatus && (
          <div className="w-full max-w-3xl mx-auto animate-fade-in">
            {paymentStatus === "success" && (
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 flex items-center gap-4 text-left">
                <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center text-xl text-white shrink-0">
                  ✓
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Payment Received!</h3>
                  <p className="text-xs text-zinc-300 mt-0.5">
                    Stay booking secured for <strong className="text-emerald-400">R {amountPaid}</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active Estimate Banner */}
        {user && latestEstimate && (
          <div className="w-full max-w-3xl mx-auto rounded-3xl border border-teal-500/30 bg-gradient-to-r from-teal-500/10 via-teal-500/5 to-transparent p-5 shadow-lg backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-2xl bg-teal-500 flex items-center justify-center text-lg text-white shrink-0">
                📌
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-600 dark:text-teal-400">
                    Latest Active Estimate
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${latestEstimate.paymentStatus === "paid" || latestEstimate.paymentStatus === "success"
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
                      }`}
                  >
                    {latestEstimate.paymentStatus === "paid" ? "Paid" : "Pending"}
                  </span>
                </div>
                <h3 className="text-base font-black text-teal-950 dark:text-white mt-0.5">
                  {estimatePropertyTitle || "Llandudno Stay"}{" "}
                  <span className="text-xs font-normal text-teal-800/80 dark:text-zinc-400">
                    • R {latestEstimate.total.toLocaleString()}
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Link
                href={`/estimate/${latestEstimate.id}`}
                className="flex-1 sm:flex-none text-center rounded-xl bg-teal-500 hover:bg-teal-600 px-4 py-2 text-xs font-bold text-white transition-all"
              >
                Resume →
              </Link>
              <button
                onClick={handleShareEstimate}
                className="rounded-xl border border-teal-500/30 bg-white/5 hover:bg-teal-500/10 p-2 text-xs font-bold text-teal-700 dark:text-teal-300 transition-all"
                title="Share Link"
              >
                {copiedEstimateUrl ? "✓ Copied" : "🔗 Share"}
              </button>
            </div>
          </div>
        )}

        {/* Date Search Bar */}
        <div className="sticky top-4 z-30 w-full max-w-3xl mx-auto">
          <div className="rounded-2xl border border-teal-200/80 dark:border-white/15 bg-white/90 dark:bg-zinc-900/90 shadow-2xl backdrop-blur-xl p-2 sm:p-2.5 flex flex-col sm:flex-row items-center gap-2">
            {/* Check-in input */}
            <div className="flex-1 w-full bg-teal-50/50 dark:bg-white/5 rounded-xl px-3 py-1.5 border border-teal-100/60 dark:border-white/5 h-[42px] flex flex-col justify-center">
              <label className="block text-[8px] font-black uppercase tracking-wider text-teal-800/60 dark:text-zinc-400 leading-none mb-0.5">
                Check-in Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (isHourlySaved && savedDates) {
                    setToDate(e.target.value);
                  } else {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) {
                      d.setDate(d.getDate() + nights);
                      setToDate(d.toISOString().split("T")[0]);
                    }
                  }
                }}
                className="w-full bg-transparent text-xs font-bold text-teal-950 dark:text-white focus:outline-none cursor-pointer leading-tight"
              />
            </div>

            {/* Duration or Slot field */}
            <div className="flex-1 w-full bg-teal-50/50 dark:bg-white/5 rounded-xl px-3 py-1.5 border border-teal-100/60 dark:border-white/5 h-[42px] flex flex-col justify-center">
              {isHourlySaved && savedDates ? (
                <>
                  <label className="block text-[8px] font-black uppercase tracking-wider text-teal-800/60 dark:text-zinc-400 leading-none mb-0.5">
                    Slot Window
                  </label>
                  <div className="text-xs font-bold text-teal-600 dark:text-teal-400 leading-tight">
                    🕒{" "}
                    {new Date(savedDates.fromDate).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}{" "}
                    -{" "}
                    {new Date(savedDates.toDate).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </div>
                </>
              ) : (
                <>
                  <label className="block text-[8px] font-black uppercase tracking-wider text-teal-800/60 dark:text-zinc-400 leading-none mb-0.5">
                    Duration
                  </label>
                  <div className="flex items-center gap-1 leading-tight">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={nights}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setNights(val);
                        const d = new Date(fromDate);
                        if (!isNaN(d.getTime())) {
                          d.setDate(d.getDate() + val);
                          setToDate(d.toISOString().split("T")[0]);
                        }
                      }}
                      className="w-10 bg-transparent text-xs font-bold text-teal-950 dark:text-white focus:outline-none"
                    />
                    <span className="text-xs text-teal-800/70 dark:text-zinc-400 font-medium">Nights</span>
                  </div>
                </>
              )}
            </div>

            {/* Sync Schedule Button */}
            <button
              onClick={handleSaveDates}
              disabled={isSavingDates || authLoading}
              className={`w-full sm:w-auto h-[42px] px-5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center justify-center gap-1.5 ${!user
                  ? "bg-zinc-800 text-zinc-400 cursor-not-allowed border border-transparent"
                  : "border-2 border-teal-500/80 bg-teal-500/10 text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 active:scale-95"
                }`}
            >
              {!user ? "🔒 Login to Apply" : isSavingDates ? "Syncing..." : saveStatus ? saveStatus : "Sync Schedule"}
            </button>
          </div>
        </div>

        {/* Listings Section */}
        <div className="space-y-6 pt-4">
          <div className="flex items-center justify-between max-w-5xl mx-auto px-1">
            <h2 className="text-lg font-black text-teal-950 dark:text-white flex items-center gap-2">
              <span>🏡</span> Destination Listings
            </h2>
            <span className="text-xs text-teal-800/60 dark:text-zinc-400 font-medium">
              {properties.length} locations available
            </span>
          </div>

          {isLoadingProps ? (
            <div className="flex items-center py-12 justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-10 rounded-3xl border border-teal-100 dark:border-white/5 bg-teal-50/15 dark:bg-white/5 text-teal-850 dark:text-zinc-500 text-xs">
              No destination properties available.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {properties.map((p) => {
                const isHourly = p.bookingType === "hourly";
                return (
                  <div
                    key={p.id}
                    className="group relative rounded-3xl border border-teal-100/80 dark:border-white/10 bg-white dark:bg-zinc-900/80 p-5 hover:border-teal-400 dark:hover:border-teal-500/50 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden cursor-pointer"
                  >
                    {/* Full Card Overlay Link */}
                    <Link href={`/posts/${p.slug}`} className="absolute inset-0 z-10" aria-label={p.title} />

                    <div>
                      {/* Image Banner with Title Overlay */}
                      <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 border border-teal-100/40 dark:border-white/5 bg-zinc-950">
                        {p.images && p.images.length > 0 ? (
                          <img
                            src={p.images[0]}
                            alt={p.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-500 text-xs font-medium">
                            No image preview
                          </div>
                        )}

                        {/* Top Badge */}
                        <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white z-0">
                          {isHourly ? "Hourly Slot" : "Nightly Stay"}
                        </span>

                        {/* Bottom Gradient Overlay for Title */}
                        <div className="absolute inset-x-0 bottom-0 pt-12 pb-3 px-4 bg-gradient-to-t from-black/85 via-black/40 to-transparent flex flex-col justify-end">
                          <h3 className="text-lg font-black text-white group-hover:text-teal-300 transition-colors drop-shadow-sm">
                            {p.title}
                          </h3>
                          <p className="text-[10px] font-mono text-zinc-300/80">
                            slug: {p.slug}
                          </p>
                        </div>
                      </div>

                      {/* Integrated Date/Slot Schedule Display */}
                      <div className="mt-2 rounded-2xl bg-teal-50/60 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 p-3 space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-teal-700 dark:text-teal-400">
                          <span>{isHourly ? "⏰ Applied Slot" : "🗓️ Schedule Window"}</span>
                          {savedDates && !isHourly && (
                            <span className="bg-teal-500/15 px-2 py-0.5 rounded-full border border-teal-500/20">
                              {nights} Night{nights > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        {savedDates ? (
                          isHourly ? (
                            <div className="flex items-center justify-between text-xs font-mono bg-white dark:bg-black/40 px-3 py-1.5 rounded-xl border border-teal-100/80 dark:border-white/5">
                              <span className="font-bold text-teal-950 dark:text-white">
                                {formatDisplayDate(savedDates.fromDate)}
                              </span>
                              <span className="bg-teal-500/10 text-teal-600 dark:text-teal-300 font-extrabold px-2 py-0.5 rounded-md border border-teal-500/20 text-[10px]">
                                🕒{" "}
                                {new Date(savedDates.fromDate).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                })}{" "}
                                -{" "}
                                {new Date(savedDates.toDate).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                })}
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-white dark:bg-black/40 px-3 py-1.5 rounded-xl border border-teal-100/80 dark:border-white/5">
                                <span className="text-[8px] text-teal-800/60 dark:text-zinc-500 font-bold block uppercase">
                                  Check-In
                                </span>
                                <span className="font-extrabold text-teal-950 dark:text-white">
                                  {formatDisplayDate(savedDates.fromDate)}
                                </span>
                              </div>
                              <div className="bg-white dark:bg-black/40 px-3 py-1.5 rounded-xl border border-teal-100/80 dark:border-white/5">
                                <span className="text-[8px] text-teal-800/60 dark:text-zinc-500 font-bold block uppercase">
                                  Check-Out
                                </span>
                                <span className="font-extrabold text-teal-950 dark:text-white">
                                  {formatDisplayDate(savedDates.toDate)}
                                </span>
                              </div>
                            </div>
                          )
                        ) : (
                          <div className="text-xs text-teal-800/60 dark:text-zinc-400 font-medium italic">
                            Sync dates above to configure pricing.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action Area */}
                    <div className="mt-5 border-t border-teal-100/60 dark:border-white/5 pt-3.5 flex items-center justify-between">
                      <div>
                        <span className="text-[9px] text-teal-800/60 dark:text-zinc-500 block uppercase font-bold">
                          {isHourly ? "Hourly Rate" : "Nightly Rate"}
                        </span>
                        <span className="text-base font-black text-teal-600 dark:text-teal-400">
                          {`R ${p.basePricePerNight.toLocaleString()}${isHourly ? "/slot" : "/night"}`}
                        </span>
                      </div>

                      <span className="relative z-20 pointer-events-none rounded-xl bg-teal-500 group-hover:bg-teal-600 px-4 py-2 text-xs font-extrabold text-white transition-all shadow-md shadow-teal-500/20">
                        View Details →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
        </div>
      }
    >
      <AuthProvider>
        <HomePageContent />
      </AuthProvider>
    </Suspense>
  );
}
"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AuthProvider, useAuth, AuthCard } from "@/components/auth";
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

  // Date Selection (Step 1 - Saved to profile)
  const [fromDate, setFromDate] = useState("2026-06-16");
  const [toDate, setToDate] = useState("2026-06-19");
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [savedDates, setSavedDates] = useState<{ fromDate: string; toDate: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [nights, setNights] = useState<number>(3);
  const [hasUpdatedStatus, setHasUpdatedStatus] = useState(false);
  const [latestEstimate, setLatestEstimate] = useState<any | null>(null);

  // Client-side payment status update fallback (useful for localhost testing where webhooks can't reach)
  useEffect(() => {
    const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    const intent = searchParams.get("intent");
    const paymentUserId = searchParams.get("userId") || (user ? user.uid : null);
    
    // Check if it's a subscription success
    const isSubscriptionSuccess = paymentStatus === "success" && (intent === "subscription" || (!bookingId && !estimateId && isLocalhost && user));

    if ((!bookingId && !estimateId && !isSubscriptionSuccess) || !paymentStatus || hasUpdatedStatus) return;

    const updateStatus = async () => {
      setHasUpdatedStatus(true);
      try {
        if (isSubscriptionSuccess && paymentUserId) {
          console.log(`[Client Fallback] Promoting user ${paymentUserId} to host role (subscription success)`);
          const res = await fetch("/api/subscribe/mock-confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: paymentUserId })
          });
          const result = await res.json();
          if (result.success) {
            // Update local storage mock session if exists
            const localSession = localStorage.getItem("auth:mock_session");
            if (localSession) {
              const session = JSON.parse(localSession);
              if (session.uid === paymentUserId) {
                session.isAdmin = true;
                localStorage.setItem("auth:mock_session", JSON.stringify(session));
              }
            }
            // Redirect to admin properties dashboard
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
            body: JSON.stringify({ estimateId, paymentStatus: "paid" })
          });
        } else if (bookingId) {
          await fetch("/api/bookings", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bookingId, paymentStatus: statusToSet })
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

        // Load all properties by default for public visitors, or filter by queryHostId if provided
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

  // Load properties
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

          // Compute nights
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
    if (!user || !savedDates) {
      setLatestEstimate(null);
      return;
    }

    const fetchLatestEstimate = async () => {
      try {
        const res = await fetch(`/api/estimates/latest?userId=${user.uid}`);
        const result = await res.json();
        if (result.success && result.data) {
          setLatestEstimate(result.data);
        }
      } catch (err) {
        console.error("Failed to fetch latest estimate:", err);
      }
    };
    fetchLatestEstimate();
  }, [user, savedDates]);


  const handleSaveDates = async () => {
    if (!user) {
      alert("Please sign in or register to save your stay dates.");
      return;
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      alert("Please select valid check-in and check-out dates.");
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
          toDate: end.toISOString()
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save date profile.");
      }

      setSavedDates(result.data);
      setSaveStatus("✅ Date selection saved successfully to your guest profile!");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      setSaveStatus(`❌ Error: ${err.message}`);
    } finally {
      setIsSavingDates(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-teal-500/30 selection:text-teal-200">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute -top-[40%] -left-[20%] w-[85%] h-[85%] rounded-full bg-emerald-500/5 blur-[130px]" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[75%] rounded-full bg-teal-500/5 blur-[130px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Intro Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50/50 dark:bg-white/5 border border-teal-100 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 mb-4">
            <span>✨ Surf Yoga Community</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-teal-950 via-zinc-800 to-zinc-600 dark:from-white dark:via-zinc-200 dark:to-zinc-400">
            Unique Packages
          </h1>
          <p className="mt-4 text-sm text-teal-900/80 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Begin by choosing your stay dates and authenticating. Your selections will be saved dynamically to configure package checkouts.
          </p>
        </header>

        {/* Payment confirmation banners */}
        {paymentStatus && (
          <div className="w-full max-w-3xl mx-auto mb-8 animate-fade-in">
            {paymentStatus === "success" && (
              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center text-2xl">
                  ✓
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Payment Received Successfully!</h3>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    Stay booking secured for <strong className="text-emerald-400">R {amountPaid}</strong>. The package reservation for <strong>"{packageType}"</strong> has been processed successfully.
                  </p>
                </div>
              </div>
            )}
            {paymentStatus === "cancel" && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                <div className="h-12 w-12 rounded-full bg-zinc-800 flex items-center justify-center text-lg">
                  🗙
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Booking Checkout Cancelled</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    You cancelled the checkout session. Your booking for <strong>"{packageType}"</strong> has been discarded. You can retry booking below.
                  </p>
                </div>
              </div>
            )}
            {paymentStatus === "failed" && (
              <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center text-lg">
                  ⚠
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Payment Checkout Failed</h3>
                  <p className="text-xs text-red-400 mt-1 leading-relaxed">
                    The payment gateway reported a failed transaction for package <strong>"{packageType}"</strong>. Please try again.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Dates Selector */}
        <div className="w-full max-w-xl mx-auto mb-12 border-b border-teal-100 dark:border-white/5 pb-12">
          {/* Date Picker Selector */}
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-6 shadow-xl backdrop-blur-md space-y-4">
            <div className="flex justify-between items-center w-full border-b border-teal-100/50 dark:border-white/15 pb-2">
              <h2 className="text-base font-bold text-teal-950 dark:text-white flex items-center gap-2">
                <span className="text-teal-600 dark:text-teal-400">📅</span> Step 1: Set Stay Dates
              </h2>
              {latestEstimate && (
                <button
                  onClick={() => {
                    const inviteUrl = `${window.location.origin}/i/${latestEstimate.token}`;
                    navigator.clipboard.writeText(inviteUrl);
                    alert("📋 Invite URL copied to clipboard: " + inviteUrl);
                  }}
                  title="Share Estimate Invitation"
                  className="rounded-full bg-teal-50 dark:bg-white/5 border border-teal-100 dark:border-white/10 p-2 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 transition-all active:scale-95 flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l5.57 3.285m-5.57-3.285l5.57-3.285M13.5 18.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zM13.5 9.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
                  </svg>
                </button>
              )}
            </div>

            <p className="text-xs text-teal-800/80 dark:text-zinc-400 leading-relaxed">
              Define check-in and check-out ranges. Dates must be persistent to user profiles before package selection is enabled.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-[10px] text-teal-800/60 dark:text-zinc-500 uppercase tracking-wider font-semibold">Check-in Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) {
                      d.setDate(d.getDate() + nights);
                      setToDate(d.toISOString().split("T")[0]);
                    }
                  }}
                  className="w-full rounded-xl border border-teal-150 dark:border-white/10 bg-white dark:bg-black/40 px-3.5 py-2.5 text-sm text-teal-950 dark:text-white focus:border-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-teal-800/60 dark:text-zinc-500 uppercase tracking-wider font-semibold">Nights of Stay</label>
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
                  className="w-full rounded-xl border border-teal-150 dark:border-white/10 bg-white dark:bg-black/40 px-3.5 py-2.5 text-sm text-teal-950 dark:text-white focus:border-teal-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="text-[11px] text-teal-800 dark:text-zinc-400">
              Selected Check-out: <strong className="text-teal-950 dark:text-white">{toDate ? formatDisplayDate(toDate) : "-"}</strong>
            </div>

            {/* Latest Estimate Display */}
            {savedDates && latestEstimate && (
              <div className="mt-4 p-4 rounded-2xl bg-teal-500/5 dark:bg-white/5 border border-teal-500/10 dark:border-white/10 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    📌 Your Latest Estimate
                  </span>
                  <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full ${latestEstimate.paymentStatus === "paid"
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-orange-50/50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    }`}>
                    {latestEstimate.paymentStatus}
                  </span>
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-teal-950 dark:text-white">
                    Stay at {latestEstimate.propertyId === "shack" ? "The Shack" : latestEstimate.propertyId === "cottage" ? "The Cottage" : "Llandudno Stay"}
                  </p>
                  <p className="text-teal-800/80 dark:text-zinc-400 text-[11px]">
                    Dates: {formatDisplayDate(latestEstimate.fromDate)} - {formatDisplayDate(latestEstimate.toDate)}
                  </p>
                  <p className="text-teal-800/80 dark:text-zinc-400 text-[11px]">
                    Total: <strong className="text-teal-600 dark:text-teal-400">R {latestEstimate.total.toLocaleString()}</strong>
                  </p>
                </div>
                <Link
                  href={`/estimate/${latestEstimate.id}`}
                  className="mt-2 block w-full text-center rounded-xl bg-teal-550/10 dark:bg-white/5 hover:bg-teal-500/10 py-2 text-xs font-bold text-teal-600 dark:text-teal-400 transition-all border border-teal-500/20"
                >
                  View, Share or Pay Estimate →
                </Link>
              </div>
            )}


            {saveStatus && (
              <div className="text-center text-[10px] font-bold text-teal-800 dark:text-zinc-300 bg-teal-50/50 dark:bg-white/5 py-2.5 rounded-xl border border-teal-100 dark:border-white/5 animate-pulse">
                {saveStatus}
              </div>
            )}

            <button
              onClick={handleSaveDates}
              disabled={isSavingDates || authLoading}
              className={`w-full rounded-xl py-3 text-center text-xs font-bold text-white transition-all ${!user
                ? "bg-neutral-800 text-white/35 cursor-not-allowed border border-neutral-700"
                : "bg-gradient-to-r from-teal-500 to-emerald-500 shadow-md shadow-teal-500/10 hover:brightness-110 active:scale-95"
                }`}
            >
              {!user
                ? "🔒 Authenticate first to lock dates"
                : isSavingDates
                  ? "Saving Date Profile..."
                  : "Confirm & Save Dates"}
            </button>
          </div>
        </div>

        {/* Step 2: Property Listings Selection */}
        <div className="space-y-6">
          <h2 className="text-lg font-black text-center text-teal-950 dark:text-white flex items-center justify-center gap-2">
            <span>🏡</span> Select Destination Property
          </h2>
          <p className="text-xs text-teal-800/80 dark:text-zinc-400 text-center max-w-md mx-auto leading-relaxed">
            After configuring check-in dates, select a property to view options and book your package.
          </p>

          {!isLoadingProps && properties.length > 0 && searchParams.get("hostId") && (
            <div className="max-w-md mx-auto mb-6 rounded-2xl bg-teal-500/10 border border-teal-500/20 px-4 py-2.5 text-[10px] font-bold text-teal-400 flex items-center justify-between">
              <span>🏠 Viewing properties published by Host ID: <strong>{searchParams.get("hostId")}</strong></span>
              <a href="/" className="underline hover:text-white transition-colors">Reset View</a>
            </div>
          )}

          {isLoadingProps ? (
            <div className="flex flex-col items-center py-12 justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
            </div>
          ) : properties.length === 0 ? (
            <div className="text-center py-10 rounded-3xl border border-teal-100 dark:border-white/5 bg-teal-50/15 dark:bg-white/5 text-teal-855/60 dark:text-zinc-500 text-xs">
              No destination properties available.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {properties.map((p) => {
                const datesLocked = !!savedDates;
                return (
                  <div
                    key={p.id}
                    className="group rounded-3xl border border-teal-100/60 dark:border-white/5 bg-teal-55/15 dark:bg-white/5 p-6 hover:border-teal-200 dark:hover:border-white/10 hover:bg-teal-55/30 dark:hover:bg-white/10 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {p.images && p.images.length > 0 && (
                        <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 border border-teal-100/40 dark:border-white/5 bg-zinc-950">
                          <img
                            src={p.images[0]}
                            alt={p.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>
                      )}
                      <span className="inline-block rounded-md bg-teal-500/10 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                        Stay Listing
                      </span>
                      <h3 className="text-lg font-extrabold text-teal-950 dark:text-white mt-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        {p.title}
                      </h3>
                      <p className="text-[10px] font-mono text-teal-800/60 dark:text-zinc-500 mt-0.5">slug: {p.slug}</p>

                      {datesLocked && (
                        <div className="mt-4 rounded-xl bg-teal-55/5 dark:bg-teal-500/5 border border-teal-100 dark:border-teal-500/10 p-3 text-[11px] text-teal-850 dark:text-teal-300">
                          📅 Selected: <strong className="text-teal-950 dark:text-white">{formatDisplayDate(savedDates.fromDate)}</strong> to <strong className="text-teal-950 dark:text-white">{formatDisplayDate(savedDates.toDate)}</strong>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 border-t border-teal-100 dark:border-white/5 pt-4 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 block uppercase">Nightly Cost</span>
                        <span className="text-base font-black text-teal-600 dark:text-teal-400">R {p.basePricePerNight.toLocaleString()}</span>
                      </div>

                      <Link
                        href={`/posts/${p.slug}`}
                        className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2.5 text-xs font-bold text-white hover:brightness-110 active:scale-95 transition-all shadow-md shadow-teal-500/10"
                      >
                        View Details →
                      </Link>
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
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
      </div>
    }>
      <AuthProvider>
        <HomePageContent />
      </AuthProvider>
    </Suspense>
  );
}

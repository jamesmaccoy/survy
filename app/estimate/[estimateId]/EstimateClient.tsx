"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth, AuthProvider } from "@/components/auth";
import { formatDisplayDate } from "@/lib/utils";

interface Estimate {
  id: string;
  propertyId: string;
  packageId: string | null;
  customerName: string;
  customerEmail: string;
  customerId: string;
  fromDate: string;
  toDate: string;
  total: number;
  paymentStatus: string;
  token: string;
  guests?: string[];
  guestsDetails?: Record<string, { name: string; email: string }>;
}

interface Property {
  id: string;
  title: string;
  slug: string;
  basePricePerNight: number;
  bookingType?: string;
  images?: string[];
  imageUrl?: string;
  image?: string;
  coverImage?: string;
}

interface Package {
  id: string;
  name: string;
  price: number;
  description: string;
  multiplier: number;
  baseRate: number;
  category: string;
}

interface EstimateClientProps {
  estimate: Estimate;
  property: Property | null;
  selectedPackage: Package | null;
}

function EstimateClientContent({ estimate, property, selectedPackage }: EstimateClientProps) {
  const { user, loading: authLoading } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  // Copy share url helper
  const inviteUrl =
    typeof window !== "undefined" ? `${window.location.origin}/i/${estimate.token}` : "";

  const handleCopy = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePay = async () => {
    setIsPaying(true);
    setPayError(null);

    try {
      const targetType = selectedPackage
        ? selectedPackage.id
        : estimate.propertyId === "cottage"
          ? "long_weekend_at_the_Cottage"
          : "shack_stack";

      const linkRes = await fetch("/api/v1/generate_checkout_link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: targetType,
          estimateId: estimate.id,
          amountInCentsOverride: Math.round(estimate.total * 100),
          descriptionOverride: selectedPackage ? selectedPackage.name : "Stay Booking",
        }),
      });

      const linkResult = await linkRes.json();
      if (!linkRes.ok || !linkResult.status) {
        throw new Error(linkResult.data || "Redirect link generation failed.");
      }

      window.location.href = linkResult.data.redirectUrl;
    } catch (err: any) {
      setPayError(err.message || "An error occurred generating checkout link.");
      setIsPaying(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-teal-950 dark:text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
        <span className="mt-3 text-xs text-teal-800/60 dark:text-zinc-500">Securing Session Context...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-20 rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-8 text-center backdrop-blur-xl shadow-2xl">
        <span className="text-4xl">🔑</span>
        <h3 className="text-lg font-bold text-teal-950 dark:text-white mt-4">Authentication Required</h3>
        <p className="text-xs text-teal-800/80 dark:text-zinc-400 mt-2 leading-relaxed">
          Please sign in to view and interact with these estimate details.
        </p>
        <Link
          href={`/login?redirect=/estimate/${estimate.id}`}
          className="mt-6 inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/20"
        >
          Sign In
        </Link>
      </div>
    );
  }

  // Authorization Check
  const isOwner =
    user.uid === estimate.customerId ||
    user.email?.toLowerCase() === estimate.customerEmail.toLowerCase();
  const isGuest = estimate.guests && estimate.guests.includes(user.uid);
  const isAdmin =
    user.email &&
    [
      "thankyou.digital@gmail.com",
      "admin@llandudnostays.co.za",
      "jmaclachlan@gmail.com",
      "admin@example.com",
    ].includes(user.email.toLowerCase());

  if (!isOwner && !isGuest && !isAdmin) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-3xl border border-red-100 dark:border-red-500/20 bg-red-50/10 text-center backdrop-blur-xl shadow-xl">
        <span className="text-4xl">🚫</span>
        <h3 className="text-lg font-bold text-red-700 dark:text-red-400 mt-4">Access Denied</h3>
        <p className="text-xs text-red-600/80 dark:text-red-300/60 mt-2 leading-relaxed">
          You do not have permission to view this estimate. You must be invited as a guest or be the customer who generated the estimate.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all"
        >
          Go Home
        </Link>
      </div>
    );
  }

  const from = new Date(estimate.fromDate);
  const to = new Date(estimate.toDate);

  const isHourly = property?.bookingType === "hourly";
  const stayNights = Math.max(
    1,
    Math.ceil(Math.abs(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
  );

  const nights = isHourly ? 1 : stayNights;
  const isPaid = estimate.paymentStatus === "paid" || estimate.paymentStatus === "success";

  const propThumbnail =
    property?.images?.[0] || property?.imageUrl || property?.image || property?.coverImage;

  return (
    <div className="relative max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8 selection:bg-teal-500/30 selection:text-teal-200">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25">
        <div className="absolute -top-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-teal-500/15 blur-[140px]" />
        <div className="absolute top-[40%] right-[10%] w-[40%] h-[40%] rounded-full bg-teal-400/10 blur-[120px]" />
      </div>

      <header className="border-b border-teal-100 dark:border-white/10 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-extrabold uppercase tracking-widest">
            Estimate Ledger
          </span>
          <h1 className="text-3xl font-black text-teal-950 dark:text-white tracking-tight mt-1">
            Estimate for {property?.title || "Llandudno"}
          </h1>
          <span className="text-[10px] font-mono text-teal-800/60 dark:text-zinc-500 block mt-0.5">
            Ref: {estimate.id}
          </span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-white transition-colors"
        >
          ← Return Home
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Left Side: Summary Details */}
        <div className="lg:col-span-3 space-y-6">
          {/* Stay Configuration Header Card with Right-Aligned Thumbnail */}
          <div className="rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-xl shadow-lg space-y-4">
            <div className="flex gap-4 items-center justify-between">
              <div>
                <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-300 border border-teal-500/20 inline-block mb-1">
                  {estimate.propertyId === "shack"
                    ? "Beach Shack"
                    : estimate.propertyId === "cottage"
                      ? "Cozy Cottage"
                      : "Luxury Villa"}
                </span>
                <h3 className="text-lg font-black text-teal-950 dark:text-white">
                  {property?.title || "Llandudno Property"}
                </h3>
                <p className="text-xs text-teal-800/60 dark:text-zinc-400 mt-0.5">
                  Estimate configuration & customer details
                </p>
              </div>

              {/* Right-Aligned Thumbnail */}
              {propThumbnail ? (
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-teal-100 dark:border-white/10 bg-zinc-950 shrink-0 shadow-md">
                  <img
                    src={propThumbnail}
                    alt={property?.title || "Property"}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-teal-100 dark:border-white/10 bg-gradient-to-br from-teal-500/20 to-teal-700/30 shrink-0 flex items-center justify-center text-xl">
                  🏡
                </div>
              )}
            </div>

            <div className="border-t border-teal-100/60 dark:border-white/5 pt-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-teal-800/70 dark:text-zinc-400 font-medium">Customer:</span>
                <strong className="text-teal-950 dark:text-white font-bold">{estimate.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-teal-800/70 dark:text-zinc-400 font-medium">Contact Email:</span>
                <strong className="text-teal-950 dark:text-white font-mono text-[11px]">{estimate.customerEmail}</strong>
              </div>
            </div>
          </div>

          {/* FEATURED: Booking Dates & Schedule Box */}
          <div className="rounded-3xl border border-teal-200 dark:border-teal-500/30 bg-teal-500/5 dark:bg-teal-500/10 p-6 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg">🗓️</span>
                <h3 className="text-sm font-extrabold text-teal-950 dark:text-white uppercase tracking-wider">
                  Reserved Stay Dates
                </h3>
              </div>
              <span className="rounded-full bg-teal-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 border border-teal-500/20">
                {isHourly ? "1 Slot" : `${nights} Night${nights > 1 ? "s" : ""}`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Check In */}
              <div className="rounded-2xl bg-white dark:bg-black/50 p-4 border border-teal-100 dark:border-white/10 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-widest">
                    {isHourly ? "Start Time" : "Check-In"}
                  </span>
                  <span className="text-[10px] font-mono text-teal-800/60 dark:text-zinc-400">
                    {isHourly ? from.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "From 14:00"}
                  </span>
                </div>
                <span className="text-base font-extrabold text-teal-950 dark:text-white block">
                  {formatDisplayDate(from)}
                </span>
                <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 block">Arrival window</span>
              </div>

              {/* Check Out */}
              <div className="rounded-2xl bg-white dark:bg-black/50 p-4 border border-teal-100 dark:border-white/10 shadow-sm space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-widest">
                    {isHourly ? "End Time" : "Check-Out"}
                  </span>
                  <span className="text-[10px] font-mono text-teal-800/60 dark:text-zinc-400">
                    {isHourly ? to.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "By 10:00 AM"}
                  </span>
                </div>
                <span className="text-base font-extrabold text-teal-950 dark:text-white block">
                  {formatDisplayDate(to)}
                </span>
                <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 block">Departure window</span>
              </div>
            </div>
          </div>

          {/* Package Details */}
          {selectedPackage && (
            <div className="rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-xl shadow-lg space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-extrabold text-teal-950 dark:text-white uppercase tracking-wider">
                  Selected Package
                </h3>
                <span className="rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-300 border border-teal-500/20">
                  {selectedPackage.category}
                </span>
              </div>
              <div className="rounded-2xl bg-teal-50/50 dark:bg-black/40 p-4 border border-teal-100/80 dark:border-white/5 space-y-1">
                <h4 className="text-sm font-extrabold text-teal-950 dark:text-white">{selectedPackage.name}</h4>
                {selectedPackage.description && (
                  <p className="text-xs text-teal-800/80 dark:text-zinc-400 leading-relaxed">
                    {selectedPackage.description}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* FEATURED: Invite Guests & Sharing Portal */}
          <div className="rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-xl shadow-lg space-y-4">
            <div className="border-b border-teal-100/60 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">👥</span>
                <h3 className="text-base font-black text-teal-950 dark:text-white tracking-tight">
                  Invite Guests & Share Estimate
                </h3>
              </div>
              <p className="text-[11px] text-teal-800/60 dark:text-zinc-400 mt-0.5">
                Share this unique invite URL with friends or co-guests so they can view and join this estimate.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 rounded-xl border border-teal-150 dark:border-white/10 bg-teal-50/50 dark:bg-black/40 px-3.5 py-2.5 text-xs text-teal-950 dark:text-white focus:outline-none font-mono"
              />
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 text-xs font-bold shadow-md shadow-teal-500/20 active:scale-95 transition-all shrink-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l5.57 3.285m-5.57-3.285l5.57-3.285M13.5 18.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zM13.5 9.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
                  />
                </svg>
                {copied ? "✓ Copied!" : "Copy Link"}
              </button>
            </div>

            {/* Guest List Roster */}
            {estimate.guests && estimate.guests.length > 0 && (
              <div className="border-t border-teal-100/60 dark:border-white/5 pt-4 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                  Joined Guest Roster ({estimate.guests.length})
                </span>
                <ul className="space-y-1.5">
                  {estimate.guests.map((gUid, idx) => {
                    const details = estimate.guestsDetails?.[gUid];
                    const label = details
                      ? `${details.name} (${details.email})`
                      : gUid === user.uid
                        ? "You"
                        : gUid.substring(0, 8) + "...";
                    return (
                      <li
                        key={idx}
                        className="text-xs font-mono bg-teal-50/50 dark:bg-black/40 px-3 py-2 rounded-xl border border-teal-100/50 dark:border-white/5 text-teal-950 dark:text-zinc-300 flex items-center justify-between"
                      >
                        <span className="flex items-center gap-2">
                          <span>👤</span>
                          <span>{label}</span>
                        </span>
                        <span className="text-[9px] bg-teal-500/10 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider border border-teal-500/20">
                          Joined
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Total calculations & Secure Book action */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-xl shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-teal-100/60 dark:border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-teal-950 dark:text-white uppercase tracking-wider">
                Estimate Summary
              </h3>
              <span
                className={`inline-block rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-wider border ${isPaid
                    ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25"
                    : "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/25"
                  }`}
              >
                {isPaid ? "Paid ✓" : "Pending Payment"}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-teal-900 dark:text-zinc-400">
                <span className="font-medium">Created By</span>
                <span className="font-bold text-teal-950 dark:text-white">{estimate.customerName}</span>
              </div>
              <div className="flex justify-between text-teal-900 dark:text-zinc-400">
                <span className="font-medium">{isHourly ? "Duration" : "Stay Length"}</span>
                <span className="font-bold text-teal-950 dark:text-white">
                  {isHourly ? "1 Slot" : `${nights} Night(s)`}
                </span>
              </div>

              <div className="border-t border-teal-100 dark:border-white/10 pt-4 flex justify-between items-center font-bold">
                <span className="text-sm text-teal-950 dark:text-white">Total Payable:</span>
                <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
                  R {estimate.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {payError && (
              <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 text-center text-xs font-bold text-red-600 dark:text-red-400">
                ⚠️ {payError}
              </div>
            )}

            {!isPaid ? (
              <button
                onClick={handlePay}
                disabled={isPaying}
                className="w-full rounded-xl py-3.5 text-center text-xs font-bold text-white transition-all bg-teal-500 hover:bg-teal-600 shadow-lg shadow-teal-500/20 active:scale-95 disabled:opacity-50"
              >
                {isPaying ? "Connecting to Checkout..." : "Confirm & Pay via Yoco"}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 py-3.5 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ✓ Stay Fully Paid & Booking Confirmed
                </div>
                <Link
                  href="/bookings"
                  className="block w-full text-center rounded-xl py-3 text-xs font-bold text-white bg-teal-500 hover:bg-teal-600 transition-all active:scale-95 shadow-md shadow-teal-500/20"
                >
                  Go to My Bookings Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EstimateClient(props: EstimateClientProps) {
  return (
    <AuthProvider>
      <EstimateClientContent {...props} />
    </AuthProvider>
  );
}
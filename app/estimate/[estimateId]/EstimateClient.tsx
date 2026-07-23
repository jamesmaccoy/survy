"use client";

import React, { useState, useEffect } from "react";
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
  const inviteUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/i/${estimate.token}` 
    : "";

  const handleCopy = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePay = async () => {
    setIsPaying(true);
    setPayError(null);

    try {
      const targetType = selectedPackage ? selectedPackage.id : (estimate.propertyId === "cottage" ? "long_weekend_at_the_Cottage" : "shack_stack");

      const linkRes = await fetch("/api/v1/generate_checkout_link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: targetType,
          estimateId: estimate.id,
          amountInCentsOverride: Math.round(estimate.total * 100),
          descriptionOverride: selectedPackage ? selectedPackage.name : "Stay Booking"
        })
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
      <div className="max-w-md mx-auto my-20 p-8 rounded-3xl border border-teal-100 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 text-center">
        <span className="text-3xl">🔑</span>
        <h3 className="text-lg font-bold text-teal-950 dark:text-white mt-4">Authentication Required</h3>
        <p className="text-xs text-teal-800/80 dark:text-zinc-400 mt-2 leading-relaxed">
          Please sign in to view and interact with this estimate details.
        </p>
        <Link
          href={`/login?redirect=/estimate/${estimate.id}`}
          className="mt-6 inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all"
        >
          Sign In
        </Link>
      </div>
    );
  }

  // Authorization Check
  const isOwner = user.uid === estimate.customerId || user.email?.toLowerCase() === estimate.customerEmail.toLowerCase();
  const isGuest = estimate.guests && estimate.guests.includes(user.uid);
  const isAdmin = user.email && ["thankyou.digital@gmail.com", "admin@llandudnostays.co.za", "jmaclachlan@gmail.com", "admin@example.com"].includes(user.email.toLowerCase());

  if (!isOwner && !isGuest && !isAdmin) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-3xl border border-red-100 dark:border-red-500/20 bg-red-50/10 text-center">
        <span className="text-3xl">🛇</span>
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
  const hours = Math.max(1, Math.ceil(Math.abs(to.getTime() - from.getTime()) / (1000 * 60 * 60)));
  const stayNights = Math.max(1, Math.ceil(Math.abs(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));

  const nights = isHourly ? 1 : stayNights;

  return (
    <div className="relative max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      <header className="mb-10 border-b border-teal-100 dark:border-white/10 pb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-extrabold uppercase tracking-wide">Estimate Details</span>
          <h1 className="text-3xl font-black text-teal-950 dark:text-white mt-1">Estimate for {property?.title || "Llandudno"}</h1>
          <span className="text-[9px] font-mono text-teal-800/60 dark:text-zinc-500 block mt-0.5">Ref: {estimate.id}</span>
        </div>
        <Link
          href="/"
          className="text-xs text-teal-800 dark:text-zinc-400 hover:text-teal-950 dark:hover:text-white transition-colors"
        >
          ← Return Home
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Left Side: Summary Details */}
        <div className="lg:col-span-3 space-y-6">
          {/* Configuration */}
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-6 backdrop-blur-md space-y-4">
            <div className="flex gap-4 items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-teal-950 dark:text-white">Stay Details</h3>
                <p className="text-xs text-teal-800/60 dark:text-zinc-500">Estimate configuration and schedule</p>
              </div>
              {property?.images && property.images.length > 0 && (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-teal-100/40 dark:border-white/5 bg-zinc-950 shrink-0">
                  <img
                    src={property.images[0]}
                    alt={property.title || "Property"}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl bg-white dark:bg-black/40 p-4 border border-teal-100/50 dark:border-white/5">
                <span className="text-[10px] text-teal-850/60 dark:text-zinc-500 uppercase block">Destination</span>
                <span className="text-sm font-extrabold text-teal-950 dark:text-white mt-1 block">
                  {property ? property.title : "Llandudno"}
                </span>
              </div>
              <div className="rounded-2xl bg-white dark:bg-black/40 p-4 border border-teal-100/50 dark:border-white/5">
                <span className="text-[10px] text-teal-850/60 dark:text-zinc-500 uppercase block">
                  {isHourly ? "Booking Date & Time" : "Booking Dates"}
                </span>
                <span className="text-sm font-extrabold text-teal-950 dark:text-white mt-1 block">
                  {isHourly ? (
                    <>
                      {formatDisplayDate(from)}
                      <span className="block text-[10px] font-normal text-zinc-400 mt-0.5">
                        {from.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})} - {to.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}
                      </span>
                    </>
                  ) : (
                    `${formatDisplayDate(from)} - ${formatDisplayDate(to)}`
                  )}
                </span>
                <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 font-mono block mt-1">
                  {isHourly ? "1 Slot booking" : `${nights} night(s) stay`}
                </span>
              </div>
            </div>
          </div>

          {/* Package Details */}
          {selectedPackage && (
            <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-6 backdrop-blur-md space-y-4">
              <h3 className="text-base font-bold text-teal-950 dark:text-white">Selected Package</h3>
              <div className="rounded-2xl bg-white dark:bg-black/40 p-4 border border-teal-100/5 dark:border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="rounded bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                    {selectedPackage.category} Package
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-teal-950 dark:text-white">{selectedPackage.name}</h4>
                {selectedPackage.description && (
                  <p className="text-xs text-teal-900/80 dark:text-zinc-400 leading-relaxed">{selectedPackage.description}</p>
                )}
              </div>
            </div>
          )}

          {/* Guest Share Section */}
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-6 backdrop-blur-md space-y-4">
            <h3 className="text-base font-bold text-teal-950 dark:text-white">Invite Guests & Share</h3>
            <p className="text-xs text-teal-800/80 dark:text-zinc-400 leading-relaxed">
              Copy the unique invite link below and share it with your friends or co-guests. They can login and join this estimate.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="flex-1 rounded-xl border border-teal-150 dark:border-white/10 bg-white dark:bg-black/40 px-3.5 py-2.5 text-xs text-teal-950 dark:text-white focus:outline-none font-mono"
              />
              <button
                onClick={handleCopy}
                className="rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-600 transition-all active:scale-95"
              >
                {copied ? "Copied!" : "Copy URL"}
              </button>
            </div>

            {/* Guest List */}
            {estimate.guests && estimate.guests.length > 0 && (
              <div className="border-t border-teal-100/60 dark:border-white/5 pt-4">
                <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 uppercase block mb-2">Joined Guests</span>
                <ul className="space-y-1.5">
                  {estimate.guests.map((gUid, idx) => {
                    const details = estimate.guestsDetails?.[gUid];
                    const label = details ? `${details.name} (${details.email})` : (gUid === user.uid ? "You" : gUid.substring(0, 8) + "...");
                    return (
                      <li key={idx} className="text-[11px] font-mono bg-teal-50/50 dark:bg-black/40 px-3 py-1.5 rounded-lg border border-teal-100/50 dark:border-white/5 text-teal-950 dark:text-zinc-300 flex items-center justify-between">
                        <span>👤 {label}</span>
                        <span className="text-[8px] bg-teal-500/10 text-teal-600 px-1.5 py-0.5 rounded font-extrabold uppercase">Joined</span>
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
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-6 backdrop-blur-md shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b border-teal-100/50 dark:border-white/15 pb-2">
              <h3 className="text-base font-bold text-teal-950 dark:text-white">Estimate Total</h3>
              <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide border ${
                estimate.paymentStatus === "paid"
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100"
                  : "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-100"
              }`}>
                {estimate.paymentStatus === "paid" ? "Paid ✓" : "Pending Payment"}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-teal-900 dark:text-zinc-400">
                <span>Created by:</span>
                <span className="font-bold text-teal-950 dark:text-white">{estimate.customerName}</span>
              </div>
              <div className="flex justify-between text-teal-900 dark:text-zinc-400">
                <span>{isHourly ? "Booking Duration:" : "Stay Duration:"}</span>
                <span className="font-bold text-teal-950 dark:text-white">
                  {isHourly ? "1 Slot" : `${nights} night(s)`}
                </span>
              </div>
              <div className="flex justify-between text-teal-900 dark:text-zinc-400">
                <span>Total Price:</span>
                <span className="font-bold text-teal-950 dark:text-white">R {estimate.total.toLocaleString()}</span>
              </div>
              
              <div className="border-t border-teal-100 dark:border-white/10 pt-4 flex justify-between items-center font-bold">
                <span className="text-sm text-teal-950 dark:text-white">Payable Total ZAR:</span>
                <span className="text-xl text-teal-600 dark:text-teal-400">
                  R {estimate.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {payError && (
              <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-2.5 text-center text-xs font-bold text-red-600 dark:text-red-400">
                ⚠️ {payError}
              </div>
            )}

            {estimate.paymentStatus !== "paid" ? (
              <button
                onClick={handlePay}
                disabled={isPaying}
                className="w-full rounded-xl py-3.5 text-center text-xs font-bold text-white transition-all bg-gradient-to-r from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/15 hover:scale-[1.01] hover:brightness-110 active:scale-95"
              >
                {isPaying ? "Generating Yoco Link..." : "Confirm & Pay via Yoco"}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 py-3.5 text-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ✓ Stay Fully Paid & Booking Confirmed
                </div>
                <Link
                  href="/bookings"
                  className="block w-full text-center rounded-xl py-3 text-xs font-bold text-white bg-teal-500 hover:bg-teal-600 transition-all active:scale-95 shadow-md shadow-teal-500/10"
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

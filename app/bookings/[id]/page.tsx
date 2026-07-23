"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import { useAuth, AuthProvider } from "@/components/auth";
import Link from "next/link";
import { formatDisplayDate } from "@/lib/utils";

interface Property {
  id: string;
  title: string;
  slug: string;
  basePricePerNight: number;
  images?: string[];
}

interface PackageData {
  id: string;
  propertyId: string;
  name: string;
  price: number;
  description: string;
  multiplier: number;
  baseRate: number;
  yocoId: string;
  category: string;
  isEnabled: boolean;
}

interface Booking {
  id: string;
  propertyId: string;
  packageId: string | null;
  customerName: string;
  customerEmail: string;
  fromDate: string;
  toDate: string;
  total: number;
  paymentStatus: string;
  token?: string;
  guests?: string[];
}

function BookingDetailsContent({ id }: { id: string }) {
  const { user, loading: authLoading } = useAuth();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [purchasingAddonId, setPurchasingAddonId] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    const fetchBookingDetails = async () => {
      try {
        // 1. Fetch Booking
        const bkRes = await fetch(`/api/bookings/${id}`);
        const bkResult = await bkRes.json();
        if (!bkRes.ok || !bkResult.success) {
          setIsLoading(false);
          return;
        }
        const bkData = bkResult.data;
        setBooking(bkData);

        // 2. Fetch specific property details directly
        const propRes = await fetch(`/api/posts/${bkData.propertyId}`);
        const propResult = await propRes.json();
        if (propResult.success && propResult.data) {
          setProperty(propResult.data);
        }

        // 3. Fetch Packages for this property
        const pkgRes = await fetch(`/api/packages?propertyId=${bkData.propertyId}`);
        const pkgResult = await pkgRes.json();
        if (pkgResult.success && pkgResult.data) {
          setPackages(pkgResult.data);
        }
      } catch (err) {
        console.error("Failed to load booking details:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookingDetails();
  }, [id]);

  const handleCopyInviteLink = () => {
    if (!booking?.token) return;
    const inviteUrl = `${window.location.origin}/i/${booking.token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handlePurchaseAddon = async (addon: PackageData) => {
    if (!booking) return;
    setPurchasingAddonId(addon.id);
    try {
      const response = await fetch("/api/v1/generate_checkout_link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: addon.yocoId || addon.id,
          bookingId: booking.id,
          amountInCentsOverride: Math.round(addon.price * 100),
          descriptionOverride: `Add-on: ${addon.name} for Booking ${booking.id}`,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.status) {
        throw new Error(result.data || "Failed to generate checkout link.");
      }

      window.location.assign(result.data.redirectUrl);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "Failed to initiate purchase.");
      setPurchasingAddonId("");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-zinc-950 text-teal-950 dark:text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
        <span className="mt-3 text-xs text-teal-800/60 dark:text-zinc-500 font-medium">Retrieving Stay Ledger...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 text-teal-950 dark:text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-8 text-center backdrop-blur-xl shadow-2xl">
          <span className="text-4xl">🔑</span>
          <h2 className="text-xl font-black text-teal-950 dark:text-white mt-4">Authentication Required</h2>
          <p className="text-xs text-teal-800/80 dark:text-zinc-400 mt-2 leading-relaxed">
            Please log in to view stay reservation information.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/20"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 text-teal-950 dark:text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-8 text-center backdrop-blur-xl shadow-2xl">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-xl font-black text-teal-950 dark:text-white mt-4">Booking Not Found</h2>
          <p className="text-xs text-teal-800/80 dark:text-zinc-400 mt-2 leading-relaxed">
            The requested booking details could not be found or have been removed.
          </p>
          <Link
            href="/bookings"
            className="mt-6 inline-block w-full rounded-xl bg-teal-50 dark:bg-white/5 border border-teal-100 dark:border-white/10 py-3 text-center text-xs font-bold text-teal-950 dark:text-white hover:bg-teal-500 hover:text-white transition-all"
          >
            Go to Bookings Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Authorization check: User must be customer, guest, or admin
  const isCustomer = booking.customerEmail?.toLowerCase() === user.email?.toLowerCase();
  const isGuest = booking.guests && booking.guests.includes(user.uid);
  const isUserAuthorized = isCustomer || isGuest || user.isAdmin;

  if (!isUserAuthorized) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 text-teal-950 dark:text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-8 text-center backdrop-blur-xl shadow-2xl">
          <span className="text-4xl">🔐</span>
          <h2 className="text-xl font-black text-teal-950 dark:text-white mt-4">Access Restricted</h2>
          <p className="text-xs text-teal-800/80 dark:text-zinc-400 mt-2 leading-relaxed">
            You do not have authorization to view this stay ledger sheet.
          </p>
          <Link
            href="/bookings"
            className="mt-6 inline-block w-full rounded-xl bg-teal-50 dark:bg-white/5 border border-teal-100 dark:border-white/10 py-3 text-center text-xs font-bold text-teal-950 dark:text-white hover:bg-teal-500 hover:text-white transition-all"
          >
            Go to Bookings Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const checkIn = formatDisplayDate(booking.fromDate);
  const checkOut = formatDisplayDate(booking.toDate);
  const stayNights = Math.max(
    1,
    Math.ceil(Math.abs(new Date(booking.toDate).getTime() - new Date(booking.fromDate).getTime()) / (1000 * 60 * 60 * 24))
  );
  const propName = property ? property.title : booking.propertyId;
  const isPaid = booking.paymentStatus === "paid" || booking.paymentStatus === "success";
  const addonsList = packages.filter((p) => p.propertyId === booking.propertyId && p.category === "addon");

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-teal-950 dark:text-white font-sans selection:bg-teal-500/30 selection:text-teal-200 relative overflow-hidden">
      {/* Dynamic Background Blur Effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-25">
        <div className="absolute -top-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-teal-500/15 blur-[140px]" />
        <div className="absolute top-[40%] right-[10%] w-[40%] h-[40%] rounded-full bg-teal-400/10 blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        {/* Top Header */}
        <header className="border-b border-teal-100 dark:border-white/10 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-extrabold uppercase tracking-widest">
              Reservation Ledger
            </span>
            <h1 className="text-3xl font-black text-teal-950 dark:text-white tracking-tight mt-1">Booking Overview</h1>
          </div>
          <Link
            href="/bookings"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-zinc-400 hover:text-teal-600 dark:hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Main Left Column */}
          <div className="lg:col-span-3 space-y-6">

            {/* Property Summary & Status Card */}
            <div className="relative overflow-hidden rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-xl shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <span className="inline-block rounded-full bg-teal-500/10 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-300 border border-teal-500/20">
                    {booking.propertyId === "shack"
                      ? "Beach Shack"
                      : booking.propertyId === "cottage"
                        ? "Cozy Cottage"
                        : "Luxury Villa"}
                  </span>
                  <h2 className="text-2xl font-black text-teal-950 dark:text-white tracking-tight mt-2 truncate">{propName}</h2>
                  <p className="text-[10px] font-mono text-teal-800/60 dark:text-zinc-500 mt-0.5">Ref: {booking.id}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-wider border shrink-0 ${isPaid
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25"
                        : booking.paymentStatus === "failed"
                          ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/25"
                          : "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/25"
                      }`}
                  >
                    {booking.paymentStatus}
                  </span>
                  {property?.images && property.images.length > 0 && (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-teal-100/40 dark:border-white/5 bg-zinc-950 shrink-0">
                      <img
                        src={property.images[0]}
                        alt={propName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-teal-100/60 dark:border-white/5 pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-teal-800/70 dark:text-zinc-400 font-medium">Primary Guest:</span>
                  <strong className="text-teal-950 dark:text-white font-bold">{booking.customerName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-teal-800/70 dark:text-zinc-400 font-medium">Contact Email:</span>
                  <strong className="text-teal-950 dark:text-white font-mono text-[11px]">{booking.customerEmail}</strong>
                </div>
              </div>
            </div>

            {/* FEATURED: Check-in / Check-out Schedule Box */}
            <div className="rounded-3xl border border-teal-200 dark:border-teal-500/30 bg-teal-500/5 dark:bg-teal-500/10 p-6 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🗓️</span>
                  <h3 className="text-sm font-extrabold text-teal-950 dark:text-white uppercase tracking-wider">
                    Stay Schedule
                  </h3>
                </div>
                <span className="rounded-full bg-teal-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 border border-teal-500/20">
                  {stayNights} Night{stayNights > 1 ? "s" : ""} Total
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Check In */}
                <div className="rounded-2xl bg-white dark:bg-black/50 p-4 border border-teal-100 dark:border-white/10 shadow-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-widest">
                      Check-In
                    </span>
                    <span className="text-[10px] font-mono text-teal-800/60 dark:text-zinc-400">From 14:00</span>
                  </div>
                  <span className="text-base font-extrabold text-teal-950 dark:text-white block">{checkIn}</span>
                  <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 block">Standard arrival window</span>
                </div>

                {/* Check Out */}
                <div className="rounded-2xl bg-white dark:bg-black/50 p-4 border border-teal-100 dark:border-white/10 shadow-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-widest">
                      Check-Out
                    </span>
                    <span className="text-[10px] font-mono text-teal-800/60 dark:text-zinc-400">By 10:00 AM</span>
                  </div>
                  <span className="text-base font-extrabold text-teal-950 dark:text-white block">{checkOut}</span>
                  <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 block">Departure cutoff time</span>
                </div>
              </div>
            </div>

            {/* FEATURED: Guest Management & Invitation Portal */}
            {isPaid && (
              <div className="rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-xl shadow-lg space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-teal-100/60 dark:border-white/5 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">👥</span>
                      <h3 className="text-base font-black text-teal-950 dark:text-white tracking-tight">
                        Invited Stay Guests
                      </h3>
                    </div>
                    <p className="text-[11px] text-teal-800/60 dark:text-zinc-400 mt-0.5">
                      Share your stay access link with companions joining this reservation.
                    </p>
                  </div>

                  {booking.token && (
                    <button
                      onClick={handleCopyInviteLink}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 text-xs font-bold shadow-md shadow-teal-500/20 active:scale-95 transition-all shrink-0"
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
                      {copiedLink ? "✓ Invite Copied!" : "Share Invite Link"}
                    </button>
                  )}
                </div>

                {/* Guest List Roster */}
                <div>
                  <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                      Confirmed Party ({booking.guests?.length || 0})
                    </span>
                  </div>

                  {booking.guests && booking.guests.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {booking.guests.map((gUid, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50/60 dark:bg-white/5 border border-teal-100 dark:border-white/10 px-3 py-1.5 text-xs font-medium text-teal-950 dark:text-zinc-200 shadow-sm"
                        >
                          <span>👤</span>
                          <span className="font-mono">{gUid === user.uid ? "You (Owner)" : gUid.substring(0, 8) + "..."}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-teal-200 dark:border-white/10 p-5 text-center">
                      <p className="text-xs text-teal-800/60 dark:text-zinc-400 italic">
                        No companions have accepted this stay invite yet. Click above to send them a link!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Financial Summary & Add-ons */}
          <div className="lg:col-span-2 space-y-6">

            {/* Cost Breakdown */}
            <div className="rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-xl shadow-xl space-y-4">
              <h3 className="text-sm font-extrabold text-teal-950 dark:text-white uppercase tracking-wider border-b border-teal-100 dark:border-white/10 pb-3">
                Financial Breakdown
              </h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-teal-800/70 dark:text-zinc-400">Payment Status</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider border ${isPaid
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25"
                        : "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/25"
                      }`}
                  >
                    {booking.paymentStatus}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-teal-100/60 dark:border-white/5">
                  <span className="text-teal-800/80 dark:text-zinc-400 font-medium">Total Charge</span>
                  <span className="text-xl font-black text-teal-600 dark:text-teal-400">
                    R {booking.total ? booking.total.toLocaleString() : "0"}
                  </span>
                </div>
              </div>
            </div>

            {/* In-App Add-ons Purchases */}
            {isPaid && (
              <div className="rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-xl shadow-xl space-y-4">
                <div className="border-b border-teal-100 dark:border-white/10 pb-3">
                  <h3 className="text-sm font-extrabold text-teal-950 dark:text-white uppercase tracking-wider">
                    Enhance Stay
                  </h3>
                  <p className="text-[11px] text-teal-800/60 dark:text-zinc-400 mt-0.5">
                    Select optional upgrades for this destination listing.
                  </p>
                </div>

                {addonsList.length === 0 ? (
                  <p className="text-xs text-teal-800/60 dark:text-zinc-500 italic">No add-ons available for this property.</p>
                ) : (
                  <div className="space-y-3">
                    {addonsList.map((addon) => (
                      <div
                        key={addon.id}
                        className="flex flex-col justify-between p-4 rounded-2xl bg-teal-50/50 dark:bg-black/40 border border-teal-100 dark:border-white/5 hover:border-teal-300 dark:hover:border-teal-500/30 transition-all gap-3"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-teal-950 dark:text-white">{addon.name}</h4>
                          {addon.description && (
                            <p className="text-[11px] text-teal-800/80 dark:text-zinc-400 mt-1 leading-relaxed">
                              {addon.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-teal-100 dark:border-white/5">
                          <span className="text-sm font-black text-teal-600 dark:text-teal-400">
                            R {addon.price.toLocaleString()}
                          </span>
                          <button
                            onClick={() => handlePurchaseAddon(addon)}
                            disabled={purchasingAddonId === addon.id}
                            className="rounded-xl bg-teal-500 hover:bg-teal-600 text-white px-3.5 py-1.5 text-[10px] font-bold shadow-md shadow-teal-500/20 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {purchasingAddonId === addon.id ? "Connecting..." : "+ Add to Stay"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BookingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-zinc-950 text-teal-950 dark:text-white flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
        </div>
      }
    >
      <AuthProvider>
        <BookingDetailsContent id={unwrappedParams.id} />
      </AuthProvider>
    </Suspense>
  );
}
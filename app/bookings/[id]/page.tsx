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
          descriptionOverride: `Add-on: ${addon.name} for Booking ${booking.id}`
        })
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-teal-500 border-white/10" />
        <span className="mt-3 text-xs text-zinc-550">Loading Booking Details...</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
          <span className="text-4xl">🔐</span>
          <h2 className="text-xl font-black text-white mt-4">Authentication Required</h2>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            Please log in to view booking information.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
          <span className="text-4xl">⚠️</span>
          <h2 className="text-xl font-black text-white mt-4">Booking Not Found</h2>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            The booking details could not be retrieved. Please check the URL reference and try again.
          </p>
          <Link
            href="/bookings"
            className="mt-6 inline-block w-full rounded-xl bg-white/5 border border-white/10 py-3 text-center text-xs font-bold text-zinc-300 hover:text-white transition-all"
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
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
          <span className="text-4xl">🔐</span>
          <h2 className="text-xl font-black text-white mt-4">Access Denied</h2>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            You do not have permissions to view this booking ledger sheet.
          </p>
          <Link
            href="/bookings"
            className="mt-6 inline-block w-full rounded-xl bg-white/5 border border-white/10 py-3 text-center text-xs font-bold text-zinc-300 hover:text-white transition-all"
          >
            Go to Bookings Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const checkIn = formatDisplayDate(booking.fromDate);
  const checkOut = formatDisplayDate(booking.toDate);
  const stayNights = Math.max(1, Math.ceil(Math.abs(new Date(booking.toDate).getTime() - new Date(booking.fromDate).getTime()) / (1000 * 60 * 60 * 24)));
  const propName = property ? property.title : booking.propertyId;

  // Add-ons filter
  const addonsList = packages.filter(p => p.propertyId === booking.propertyId && p.category === "addon");

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-teal-500/30 selection:text-teal-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10 border-b border-white/10 pb-6 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-teal-400 font-extrabold uppercase tracking-wide">Stay Ledger Details</span>
            <h1 className="text-3xl font-black text-white mt-1">Booking Detail View</h1>
          </div>
          <Link
            href="/bookings"
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            ← Back to Bookings Dashboard
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* Left Column: Stay Information */}
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md space-y-6">
              <div>
                <span className="inline-block rounded bg-teal-500/10 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-400 border border-teal-500/25">
                  {booking.propertyId === "shack" ? "Beach Shack" : booking.propertyId === "cottage" ? "Cozy Cottage" : "Luxury Villa"}
                </span>
                <h2 className="text-2xl font-black text-white mt-3">{propName}</h2>
                <p className="text-[10px] font-mono text-zinc-500 mt-1">Booking ID: {booking.id}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-4 text-xs">
                <div className="rounded-2xl bg-black/40 p-4 border border-white/5">
                  <span className="text-[10px] text-zinc-500 uppercase block">Check-in</span>
                  <span className="text-sm font-bold text-white mt-1 block">{checkIn}</span>
                  <span className="text-[9px] text-zinc-500 block mt-1">14:00 onwards</span>
                </div>
                <div className="rounded-2xl bg-black/40 p-4 border border-white/5">
                  <span className="text-[10px] text-zinc-500 uppercase block">Check-out</span>
                  <span className="text-sm font-bold text-white mt-1 block">{checkOut}</span>
                  <span className="text-[9px] text-zinc-500 block mt-1">Before 10:00 AM</span>
                </div>
              </div>

              <div className="border-t border-white/5 pt-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Reserved Guest:</span>
                  <span className="font-bold text-white">{booking.customerName} ({booking.customerEmail})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Duration:</span>
                  <span className="font-bold text-white">{stayNights} Night(s)</span>
                </div>
              </div>
            </div>

            {/* Invited Guests Section */}
            {(booking.paymentStatus === "paid" || booking.paymentStatus === "success") && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-white">Invited Guests</h3>
                  {booking.token && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        const inviteUrl = `${window.location.origin}/i/${booking.token}`;
                        navigator.clipboard.writeText(inviteUrl);
                        alert("📋 Invite URL copied to clipboard: " + inviteUrl);
                      }}
                      className="flex items-center gap-1 rounded bg-teal-500/10 px-2.5 py-1 text-[9px] font-bold text-teal-400 hover:bg-teal-500/20 transition-all active:scale-95 border border-teal-500/25"
                    >
                      Invite More Guests
                    </button>
                  )}
                </div>

                {booking.guests && booking.guests.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {booking.guests.map((gUid, idx) => (
                      <span key={idx} className="rounded bg-white/5 border border-white/10 px-3 py-1 text-xs font-mono text-zinc-300">
                        👤 {gUid === user.uid ? "You" : gUid.substring(0, 8) + "..."}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-550 italic">No guests joined this stay yet. Send them the invitation link above.</p>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Cost Breakdown & Add-ons */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-xl space-y-4">
              <h3 className="text-base font-bold text-white border-b border-white/15 pb-2">Cost & Payment</h3>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Status:</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide border ${
                    booking.paymentStatus === "paid" || booking.paymentStatus === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                      : booking.paymentStatus === "failed"
                      ? "bg-red-500/10 text-red-400 border-red-500/25"
                      : "bg-orange-500/10 text-orange-400 border-orange-500/25"
                  }`}>
                    {booking.paymentStatus}
                  </span>
                </div>

                <div className="flex justify-between text-zinc-400">
                  <span className="">Stay Total:</span>
                  <span className="font-black text-white text-lg">R {booking.total ? booking.total.toLocaleString() : "0"}</span>
                </div>
              </div>
            </div>

            {/* In-App Add-ons purchases */}
            {(booking.paymentStatus === "paid" || booking.paymentStatus === "success") && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md shadow-xl space-y-4">
                <h3 className="text-base font-bold text-white border-b border-white/15 pb-2">Enhance Your Stay (Add-ons)</h3>
                
                {addonsList.length === 0 ? (
                  <p className="text-xs text-zinc-550 italic">No add-ons available for this listing.</p>
                ) : (
                  <div className="space-y-3">
                    {addonsList.map((addon) => (
                      <div
                        key={addon.id}
                        className="flex flex-col justify-between p-4 rounded-2xl bg-black/40 border border-white/5 hover:border-white/10 transition-all gap-3"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-white">{addon.name}</h4>
                          {addon.description && (
                            <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                              {addon.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                          <span className="text-xs font-black text-teal-400">
                            R {addon.price.toLocaleString()}
                          </span>
                          <button
                            onClick={() => handlePurchaseAddon(addon)}
                            disabled={purchasingAddonId === addon.id}
                            className="rounded-lg bg-teal-500 hover:bg-teal-650 text-white px-3.5 py-1.5 text-[10px] font-bold shadow-md shadow-teal-500/10 active:scale-95 transition-all disabled:opacity-50"
                          >
                            {purchasingAddonId === addon.id ? "Connecting..." : "Add to Stay"}
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
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-white/10" />
      </div>
    }>
      <AuthProvider>
        <BookingDetailsContent id={unwrappedParams.id} />
      </AuthProvider>
    </Suspense>
  );
}

"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth, AuthProvider } from "@/components/auth";
import Link from "next/link";
import CalendarPicker from "@/components/CalendarPicker";
import { formatDisplayDate } from "@/lib/utils";

interface Property {
  id: string;
  title: string;
  slug: string;
  basePricePerNight: number;
  bookingType?: string;
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
  guestsDetails?: Record<string, { name: string; email: string }>;
}

function BookingsCheckoutContent() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId") || "";

  const { user, loading: authLoading } = useAuth();

  // Page States
  const [property, setProperty] = useState<Property | null>(null);
  const [propertiesList, setPropertiesList] = useState<Property[]>([]);
  const [savedDates, setSavedDates] = useState<{ fromDate: string; toDate: string } | null>(null);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [checkoutLog, setCheckoutLog] = useState<string[]>([]);
  const [dateConflict, setDateConflict] = useState<string | null>(null);
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);

  // Admin and filter mode states
  const [viewMode, setViewMode] = useState<"my" | "all">("my");
  const [latestEstimate, setLatestEstimate] = useState<any | null>(null);


  // Load property, user dates, and packages
  useEffect(() => {
    const loadPageData = async () => {
      try {
        // 1. Fetch all properties to resolve property ID -> Title
        const propRes = await fetch("/api/posts");
        const propResult = await propRes.json();
        let fetchedProps: Property[] = [];
        if (propResult.success && propResult.data) {
          setPropertiesList(propResult.data);
          fetchedProps = propResult.data;
        }

        if (propertyId) {
          const found = fetchedProps.find((p: Property) => p.id === propertyId);
          if (found) setProperty(found);

          // 2. Fetch Packages for this property
          const pkgRes = await fetch(`/api/packages?propertyId=${propertyId}`);
          const pkgResult = await pkgRes.json();
          if (pkgResult.success && pkgResult.data) {
            setPackages(pkgResult.data);
          }

          // 3. Fetch Bookings for history list
          const bksRes = await fetch(`/api/bookings?propertyId=${propertyId}`);
          const bksResult = await bksRes.json();
          if (bksResult.success && bksResult.data) {
            setBookingsList(bksResult.data);
          }
        } else {
          // Fetch all bookings for dashboard display
          const bksRes = await fetch("/api/bookings");
          const bksResult = await bksRes.json();
          if (bksResult.success && bksResult.data) {
            setBookingsList(bksResult.data);
          }
          // Fetch all packages for the dashboard to render addons
          const pkgRes = await fetch("/api/packages");
          const pkgResult = await pkgRes.json();
          if (pkgResult.success && pkgResult.data) {
            setPackages(pkgResult.data);
          }
        }
      } catch (err) {
        console.error("Failed to load page data:", err);
      } finally {
        if (!propertyId) {
          setIsLoading(false);
        }
      }
    };

    loadPageData();
  }, [propertyId]);

  // Load saved dates and latest estimate for logged-in user
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchUserData = async () => {
      try {
        const res = await fetch(`/api/user/dates?userId=${user.uid}`);
        const result = await res.json();
        if (result.success && result.data) {
          setSavedDates(result.data);
        }

        const estRes = await fetch(`/api/estimates/latest?userId=${user.uid}`);
        const estResult = await estRes.json();
        if (estResult.success && estResult.data) {
          setLatestEstimate(estResult.data);
        }
      } catch (err) {
        console.error("Failed to retrieve user dates or estimate:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user, authLoading]);

  // Check for date overlaps
  useEffect(() => {
    if (!savedDates || !propertyId || bookingsList.length === 0) return;

    const from = new Date(savedDates.fromDate);
    const to = new Date(savedDates.toDate);

    const conflict = bookingsList.find(b => {
      if (b.paymentStatus === "failed" || b.paymentStatus === "refunded") return false;
      const bStart = new Date(b.fromDate);
      const bEnd = new Date(b.toDate);
      return from < bEnd && to > bStart;
    });

    if (conflict) {
      const startStr = formatDisplayDate(conflict.fromDate);
      const endStr = formatDisplayDate(conflict.toDate);
      setDateConflict(`Dates overlap with an existing booking (${startStr} - ${endStr}) by ${conflict.customerName}`);
    } else {
      setDateConflict(null);
    }
  }, [savedDates, propertyId, bookingsList]);

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-teal-950 dark:text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
        <span className="mt-3 text-xs text-teal-800/60 dark:text-zinc-500">Securing Session Context...</span>
      </div>
    );
  }

  // 1. Not Authenticated State
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-3xl border border-teal-100 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 text-center">
        <span className="text-3xl">🔑</span>
        <h3 className="text-lg font-bold text-teal-950 dark:text-white mt-4">Authentication Required</h3>
        <p className="text-xs text-teal-800/80 dark:text-zinc-400 mt-2 leading-relaxed">
          {propertyId
            ? "You must be logged in and have selected stay dates before checking out a package."
            : "You must be logged in to view your stays."}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all"
        >
          {propertyId ? "Go to Homepage Login & Date Picker" : "Go to Homepage to Login"}
        </Link>
      </div>
    );
  }

  // 2. Dates not selected state (Only during checkout flow)
  if (propertyId && !savedDates) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-3xl border border-teal-100 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 text-center">
        <span className="text-3xl">📅</span>
        <h3 className="text-lg font-bold text-teal-950 dark:text-white mt-4">Dates Missing</h3>
        <p className="text-xs text-teal-800/80 dark:text-zinc-400 mt-2 leading-relaxed">
          No active stay dates found on your profile. Please configure check-in and check-out dates on the portal first.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all"
        >
          Select Dates First
        </Link>
      </div>
    );
  }

  // Calculate stay duration
  const from = savedDates ? new Date(savedDates.fromDate) : new Date();
  const to = savedDates ? new Date(savedDates.toDate) : new Date();
  
  const isHourly = property?.bookingType === "hourly";
  const hours = savedDates ? Math.max(1, Math.ceil(Math.abs(to.getTime() - from.getTime()) / (1000 * 60 * 60))) : 0;
  const stayNights = savedDates ? Math.max(1, Math.ceil(Math.abs(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  
  const nights = isHourly ? 1 : stayNights;

  const basePricePerNight = property ? property.basePricePerNight : 1500;
  const selectedPackage = packages.find(p => p.id === selectedPackageId);

  // Focus math solely on package values and stay total
  const baseCost = basePricePerNight * nights;
  const packagePrice = selectedPackage ? (selectedPackage.price || selectedPackage.baseRate || 0) : 0;
  const packageMultiplier = selectedPackage ? (selectedPackage.multiplier || 1.0) : 1.0;

  // Total calculated combining baseCost, packagePrice, and packageMultiplier
  const finalTotal = (baseCost + packagePrice) * packageMultiplier;

  const handleUpdateDates = async (start: string, end: string) => {
    if (!user) return;

    // Local update for responsive UI feedback
    if (!end) {
      setSavedDates({
        fromDate: new Date(start).toISOString(),
        toDate: new Date(start).toISOString()
      });
      return;
    }

    try {
      const response = await fetch("/api/user/dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          fromDate: new Date(start).toISOString(),
          toDate: new Date(end).toISOString()
        })
      });

      const result = await response.json();
      if (response.ok && result.success) {
        setSavedDates(result.data);
      }
    } catch (err) {
      console.error("Failed to update user stay dates:", err);
    }
  };

  const handleBookNow = async () => {
    if (dateConflict) {
      alert("Please resolve the date conflict before proceeding.");
      return;
    }

    setIsSubmitting(true);
    setCheckoutLog(["1. Validating stay selection...", "2. Registering stay estimate details..."]);

    try {
      // POST estimate
      const estRes = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          packageId: selectedPackageId || null,
          customerName: user.displayName || user.email?.split("@")[0] || "Authenticated Guest",
          customerEmail: user.email || "",
          customerId: user.uid,
          fromDate: from.toISOString(),
          toDate: to.toISOString(),
          total: finalTotal
        })
      });

      const estResult = await estRes.json();
      if (!estRes.ok || !estResult.success) {
        throw new Error(estResult.error || "Failed to log stay estimate.");
      }

      setCheckoutLog(prev => [
        ...prev,
        "3. ✅ Estimate saved successfully. Preparing payment details...",
      ]);

      const targetType = selectedPackage
        ? (selectedPackage.id || selectedPackage.yocoId)
        : (packages.length > 0
          ? packages[0].id
          : (propertyId === "cottage" ? "long_weekend_at_the_Cottage" : "shack_stack")
        );

      // POST create link
      const linkRes = await fetch("/api/v1/generate_checkout_link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: targetType,
          estimateId: estResult.estimate.id,
          amountInCentsOverride: Math.round(finalTotal * 100),
          descriptionOverride: selectedPackage ? selectedPackage.name : 'Stay Booking'
        })
      });

      const linkResult = await linkRes.json();
      if (!linkRes.ok || !linkResult.status) {
        throw new Error(linkResult.data || "Redirect link generation failed.");
      }

      setCheckoutLog(prev => [
        ...prev,
        "4. ✅ Redirecting to Checkout Gateway..."
      ]);

      setTimeout(() => {
        window.location.href = linkResult.data.redirectUrl;
      }, 1200);

    } catch (err: unknown) {
      const error = err as Error;
      setCheckoutLog(prev => [...prev, `❌ Error: ${error.message}`]);
      setIsSubmitting(false);
    }
  };



  if (!propertyId) {
    const displayBookings = bookingsList.filter((b) => {
      if (viewMode === "my") {
        const isCustomer = b.customerEmail?.toLowerCase() === user.email?.toLowerCase();
        const isGuest = b.guests && b.guests.includes(user.uid);
        return isCustomer || isGuest;
      }
      return true;
    });

    const getCountdownLabel = (b: Booking) => {
      if (b.paymentStatus === "failed" || b.paymentStatus === "cancelled" || b.paymentStatus === "refunded") {
        return { text: "No active reservation", class: "text-teal-800/70 bg-teal-50/30 border border-teal-100 dark:text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-800" };
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const start = new Date(b.fromDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(b.toDate);
      end.setHours(0, 0, 0, 0);

      if (now > end) {
        return { text: "Completed stay", class: "text-teal-800/70 bg-teal-50/20 border border-teal-100 dark:text-zinc-400 dark:bg-zinc-950/40 dark:border-zinc-900" };
      } else if (now >= start && now <= end) {
        return { text: "Active Now 🟢", class: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 animate-pulse font-bold" };
      } else {
        const diffTime = start.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          return { text: "Starts tomorrow 📅", class: "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-150 dark:border-teal-500/20 font-bold" };
        }
        return { text: `Starts in ${diffDays} days`, class: "text-teal-800 dark:text-zinc-300 bg-teal-50/50 dark:bg-white/5 border border-teal-100 dark:border-white/10" };
      }
    };

    return (
      <div className="relative max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[120px]" />
        </div>

        <header className="mb-10 border-b border-teal-100 dark:border-white/10 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-extrabold uppercase tracking-wide">Account Stays</span>
            <h1 className="text-3xl font-black text-teal-950 dark:text-white mt-1">My Bookings Dashboard</h1>
          </div>
          <Link
            href="/"
            className="text-xs text-teal-800 dark:text-zinc-400 hover:text-teal-950 dark:hover:text-white transition-colors"
          >
            ← View Destination Properties
          </Link>
        </header>

        {latestEstimate && latestEstimate.paymentStatus === "pending" && (
          <div className="mb-8 rounded-3xl border border-orange-500/20 bg-orange-500/5 p-6 backdrop-blur-md relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-24 h-24 rounded-full bg-orange-500/10 blur-xl pointer-events-none" />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="inline-block rounded bg-orange-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                  Unpaid Stay Estimate
                </span>
                <h3 className="text-lg font-black text-teal-950 dark:text-white mt-1">
                  {propertiesList.find(p => p.id === latestEstimate.propertyId)?.title || latestEstimate.propertyId}
                </h3>
                <p className="text-xs text-teal-850/60 dark:text-zinc-400 mt-1">
                  Dates: <strong>{formatDisplayDate(latestEstimate.fromDate)}</strong> to <strong>{formatDisplayDate(latestEstimate.toDate)}</strong>
                </p>
                <p className="text-xs text-teal-800/80 dark:text-zinc-300 mt-1 font-bold">
                  Total: R {latestEstimate.total ? Number(latestEstimate.total).toLocaleString() : "0"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <Link
                  href={`/estimate/${latestEstimate.id}`}
                  className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-600 transition-all shadow-md shadow-orange-500/10"
                >
                  View Details & Pay
                </Link>
                <button
                  onClick={() => {
                    const inviteUrl = `${window.location.origin}/i/${latestEstimate.token}`;
                    navigator.clipboard.writeText(inviteUrl);
                    alert("📋 Estimate invite URL copied to clipboard: " + inviteUrl);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-2.5 text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-550/15 transition-all active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l5.57 3.285m-5.57-3.285l5.57-3.285M13.5 18.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zM13.5 9.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
                  </svg>
                  Share Estimate
                </button>
              </div>
            </div>
          </div>
        )}

        {user?.isAdmin && (
          <div className="flex border-b border-teal-100 dark:border-white/5 mb-8">
            <button
              onClick={() => setViewMode("my")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${viewMode === "my"
                  ? "border-teal-500 text-teal-600 dark:text-teal-400"
                  : "border-transparent text-teal-800/60 dark:text-zinc-500 hover:text-teal-950 dark:hover:text-zinc-300"
                }`}
            >
              My Bookings
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${viewMode === "all"
                  ? "border-teal-500 text-teal-600 dark:text-teal-400"
                  : "border-transparent text-teal-800/60 dark:text-zinc-500 hover:text-teal-950 dark:hover:text-zinc-300"
                }`}
            >
              All System Bookings (Admin)
            </button>
          </div>
        )}

        {displayBookings.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-teal-100 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 backdrop-blur-md">
            <span className="text-4xl">🧳</span>
            <h3 className="text-lg font-bold text-teal-950 dark:text-white mt-4">No Stays Found</h3>
            <p className="text-xs text-teal-800/80 dark:text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">
              {viewMode === "my"
                ? "You haven't reserved any stays yet. Visit the homepage to choose a property and dates."
                : "No bookings recorded in the system ledger yet."}
            </p>
            {viewMode === "my" && (
              <Link
                href="/"
                className="mt-6 inline-block rounded-xl bg-teal-500 px-6 py-2.5 text-xs font-bold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/10"
              >
                Explore Properties
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {displayBookings.map((b) => {
              const propertyForBooking = propertiesList.find((p) => p.id === b.propertyId);
              const isHourlyBooking = propertyForBooking?.bookingType === "hourly";
              const checkIn = isHourlyBooking 
                ? `${formatDisplayDate(b.fromDate)} ${new Date(b.fromDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}`
                : formatDisplayDate(b.fromDate);
              const checkOut = isHourlyBooking 
                ? `${formatDisplayDate(b.toDate)} ${new Date(b.toDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false})}`
                : formatDisplayDate(b.toDate);
              const stayNights = Math.max(1, Math.ceil(Math.abs(new Date(b.toDate).getTime() - new Date(b.fromDate).getTime()) / (1000 * 60 * 60 * 24)));
              const stayHours = Math.max(1, Math.ceil(Math.abs(new Date(b.toDate).getTime() - new Date(b.fromDate).getTime()) / (1000 * 60 * 60)));
              const propName = propertiesList.find((p) => p.id === b.propertyId)?.title || b.propertyId;
              const countdown = getCountdownLabel(b);

              return (
                <div
                  key={b.id}
                  className="group relative overflow-hidden rounded-3xl border border-teal-100/80 dark:border-white/15 bg-teal-50/15 dark:bg-zinc-900/60 p-6 backdrop-blur-md hover:border-teal-200 dark:hover:border-white/20 transition-all flex flex-col justify-between shadow-xl"
                >
                  <div className="absolute -right-10 -top-10 w-24 h-24 rounded-full bg-teal-500/5 blur-xl group-hover:bg-teal-500/10 transition-all pointer-events-none" />

                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="inline-block rounded bg-teal-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                          {b.propertyId === "shack" ? "Beach Shack" : b.propertyId === "cottage" ? "Cozy Cottage" : "Luxury Villa"}
                        </span>
                        <h3 className="text-lg font-black text-teal-950 dark:text-white mt-1 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {propName}
                        </h3>
                        <span className="text-[9px] font-mono text-teal-800/60 dark:text-zinc-500 block mt-0.5">Ref: {b.id}</span>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide border ${b.paymentStatus === "paid" || b.paymentStatus === "success"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/25"
                              : b.paymentStatus === "failed"
                                ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-100 dark:border-red-500/25"
                                : "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-500/25"
                            }`}
                        >
                          {b.paymentStatus}
                        </span>
                        {b.token && (b.paymentStatus === "paid" || b.paymentStatus === "success") && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              const inviteUrl = `${window.location.origin}/i/${b.token}`;
                              navigator.clipboard.writeText(inviteUrl);
                              alert("📋 Booking invite URL copied to clipboard: " + inviteUrl);
                            }}
                            title="Share Booking Invite Link"
                            className="rounded-full bg-teal-50 dark:bg-white/5 border border-teal-100 dark:border-white/10 p-1.5 text-teal-600 dark:text-teal-400 hover:bg-teal-550/15 transition-all active:scale-95 flex items-center justify-center"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l5.57 3.285m-5.57-3.285l5.57-3.285M13.5 18.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zM13.5 9.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex">
                      <span className={`rounded-lg px-2.5 py-1 text-[10px] font-medium tracking-wide ${countdown.class}`}>
                        {countdown.text}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 rounded-2xl bg-white dark:bg-black/40 p-4 border border-teal-100 dark:border-white/5 text-xs">
                      <div>
                        <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 uppercase block">Check-in</span>
                        <span className="font-bold text-teal-950 dark:text-white mt-1 block">{checkIn}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 uppercase block">Check-out</span>
                        <span className="font-bold text-teal-950 dark:text-white mt-1 block">{checkOut}</span>
                      </div>
                    </div>

                    {/* Guest Invite/List Section */}
                    {(b.paymentStatus === "paid" || b.paymentStatus === "success") && (
                      <div className="border-t border-teal-100/50 dark:border-white/5 pt-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                            Invited Guests
                          </span>
                          {b.token && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                const inviteUrl = `${window.location.origin}/i/${b.token}`;
                                navigator.clipboard.writeText(inviteUrl);
                                alert("📋 Booking invite URL copied to clipboard: " + inviteUrl);
                              }}
                              className="flex items-center gap-1.5 rounded bg-teal-500/10 px-2.5 py-1 text-[9px] font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-550/20 transition-all active:scale-95"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3 h-3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l5.57 3.285m-5.57-3.285l5.57-3.285M13.5 18.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5zM13.5 9.75a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
                              </svg>
                              Invite Guests
                            </button>
                          )}
                        </div>
                        {b.guests && b.guests.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {b.guests.map((gUid, idx) => {
                              const details = b.guestsDetails?.[gUid];
                              const displayName = details ? `${details.name} (${details.email})` : (gUid === user.uid ? "You" : gUid.substring(0, 8) + "...");
                              return (
                                <span key={idx} className="rounded bg-teal-55/10 dark:bg-white/5 border border-teal-150/40 px-2 py-0.5 text-[9px] font-mono text-teal-950 dark:text-zinc-300">
                                  👤 {displayName}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-teal-800/60 dark:text-zinc-500 italic">No guests joined this stay yet.</p>
                        )}
                      </div>
                    )}

                  </div>

                  <div className="mt-6 border-t border-teal-100 dark:border-white/5 pt-4 flex items-center justify-between text-xs">
                    <div>
                      {viewMode === "all" && (
                        <div className="text-[10px] text-teal-800/80 dark:text-zinc-400 mb-1">
                          Guest: <strong className="text-teal-950 dark:text-white">{b.customerName}</strong> <span className="text-teal-800/60 dark:text-zinc-500 font-mono text-[9px]">({b.customerEmail})</span>
                        </div>
                      )}
                      <Link
                        href={`/bookings/${b.id}`}
                        className="inline-flex rounded-lg bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white transition-all active:scale-95 mb-2.5"
                      >
                        View Details →
                      </Link>
                      <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 uppercase block">Duration</span>
                      <span className="font-bold text-teal-950 dark:text-white block mt-0.5">
                        {isHourlyBooking ? "1 Slot booking" : `${stayNights} night(s) stay`}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 uppercase">Paid Total</span>
                      <span className="text-lg font-black text-teal-600 dark:text-teal-400 block mt-0.5">
                        R {b.total ? b.total.toLocaleString() : "0"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      {/* Page Header */}
      <header className="mb-10 border-b border-teal-100 dark:border-white/10 pb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-extrabold uppercase tracking-wide">Step 2: Checkout</span>
          <h1 className="text-3xl font-black text-teal-950 dark:text-white mt-1">Book Your Package stay</h1>
        </div>
        <Link
          href="/"
          className="text-xs text-teal-800 dark:text-zinc-400 hover:text-teal-950 dark:hover:text-white transition-colors"
        >
          ← Change Dates / Property
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Left Side: Summary & Package Select */}
        <div className="lg:col-span-3 space-y-6">
          {/* Stay Details summary */}
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-6 backdrop-blur-md space-y-4">
            <h3 className="text-base font-bold text-teal-950 dark:text-white">1. Stay Configuration</h3>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="rounded-2xl bg-white dark:bg-black/40 p-4 border border-teal-100/50 dark:border-white/5">
                <span className="text-[10px] text-teal-850/60 dark:text-zinc-500 uppercase block">Selected Destination</span>
                <span className="text-sm font-extrabold text-teal-950 dark:text-white mt-1 block">
                  {property ? property.title : "Llandudno"}
                </span>
                <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 font-mono">id: {propertyId}</span>
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
                <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 font-mono">
                  {isHourly ? "1 Slot booking" : `${nights} night(s) stay`}
                </span>
              </div>
            </div>
          </div>

          {/* Package Configuration */}
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-6 backdrop-blur-md space-y-4">
            <h3 className="text-base font-bold text-teal-950 dark:text-white">2. Select Package Option</h3>

            <div>
              <select
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
                className="w-full rounded-xl border border-teal-150 dark:border-white/10 bg-white dark:bg-black/40 px-4 py-3 text-sm text-teal-950 dark:text-white focus:border-teal-500 focus:outline-none"
              >
                <option value="" className="bg-white dark:bg-zinc-950 text-teal-950 dark:text-white">
                  No Package (Standard Stay)
                </option>
                {packages.filter(p => p.category !== "addon").map((pkg) => (
                  <option key={pkg.id} value={pkg.id} className="bg-white dark:bg-zinc-950 text-teal-950 dark:text-white">
                    {pkg.name} (R {pkg.price || pkg.baseRate || 0} {pkg.multiplier && pkg.multiplier !== 1 ? `| x${pkg.multiplier}` : ""})
                  </option>
                ))}
              </select>
            </div>

            {selectedPackage && (
              <div className="rounded-2xl bg-white dark:bg-black/40 p-4 border border-teal-100 dark:border-white/5 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="rounded bg-teal-50 dark:bg-teal-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                    {selectedPackage.category} Package
                  </span>
                  <span className="text-xs text-teal-800/60 dark:text-zinc-500">
                    Base Multiplier: <strong>{selectedPackage.multiplier}x</strong>
                  </span>
                </div>
                <h4 className="text-sm font-extrabold text-teal-950 dark:text-white">{selectedPackage.name}</h4>
                {selectedPackage.description && (
                  <p className="text-xs text-teal-900/80 dark:text-zinc-400 leading-relaxed">{selectedPackage.description}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Total calculations & Secure Book action */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-6 backdrop-blur-md shadow-xl space-y-4">
            <h3 className="text-base font-bold text-teal-950 dark:text-white border-b border-teal-100/50 dark:border-white/15 pb-2">3. Cost Estimate & Pay</h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-teal-900 dark:text-zinc-400">
                <span>{isHourly ? "Booking Duration:" : "Stay Duration:"}</span>
                <span className="font-bold text-teal-950 dark:text-white">
                  {isHourly ? "1 Slot" : `${nights} night(s)`}
                </span>
              </div>
              <div className="flex justify-between text-teal-900 dark:text-zinc-400">
                <span>{isHourly ? `Slot Cost (R ${basePricePerNight} × 1 slot):` : `Nightly Cost (R ${basePricePerNight} × ${nights}):`}</span>
                <span className="font-bold text-teal-950 dark:text-white">R {baseCost.toLocaleString()}</span>
              </div>
              {selectedPackage && (
                <>
                  <div className="flex justify-between text-teal-900 dark:text-zinc-400">
                    <span>Package Cost ({selectedPackage.name}):</span>
                    <span className="font-bold text-teal-950 dark:text-white">R {packagePrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-teal-900 dark:text-zinc-400">
                    <span>Package Multiplier:</span>
                    <span className="font-bold text-teal-950 dark:text-white">× {packageMultiplier}</span>
                  </div>
                </>
              )}

              <div className="border-t border-teal-100 dark:border-white/10 pt-4 flex justify-between items-center">
                <span className="text-sm font-bold text-teal-950 dark:text-white">Payable Total ZAR:</span>
                <span className="text-2xl font-black text-teal-600 dark:text-teal-400">
                  R {finalTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Date Overlap block alert & visual resolver */}
            {dateConflict && (
              <div className="space-y-4">
                <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3 text-center text-xs font-bold text-red-600 dark:text-red-400">
                  ⚠️ {dateConflict}
                </div>
                <div className="rounded-3xl border border-teal-100 dark:border-white/5 bg-teal-50/10 dark:bg-zinc-950 p-4 space-y-3">
                  <p className="text-[11px] text-teal-800/80 dark:text-zinc-400 leading-relaxed">
                    {isHourly ? "Select an available date on the calendar below to update your booking date:" : "Select an available date range on the calendar below to update your stay dates:"}
                  </p>
                  <CalendarPicker
                    selectedFromDate={savedDates?.fromDate.split("T")[0] || ""}
                    selectedToDate={savedDates?.toDate.split("T")[0] || ""}
                    bookings={bookingsList}
                    singleMonth={true}
                    bookingType={property?.bookingType}
                    onChange={handleUpdateDates}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleBookNow}
              disabled={isSubmitting || !!dateConflict}
              className={`w-full rounded-xl py-3.5 text-center text-xs font-bold text-white transition-all ${!!dateConflict
                  ? "bg-neutral-800 text-white/30 cursor-not-allowed border border-neutral-700"
                  : "bg-gradient-to-r from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/15 hover:scale-[1.01] hover:brightness-110 active:scale-95"
                }`}
            >
              {isSubmitting ? "Generating Yoco transaction..." : "Confirm & Pay via Yoco"}
            </button>
          </div>

          {/* Checkout console logger */}
          {checkoutLog.length > 0 && (
            <div className="rounded-3xl border border-teal-100/50 dark:border-white/5 bg-black/90 p-4 font-mono text-[9px] text-teal-400 space-y-1 max-h-40 overflow-y-auto">
              <div className="text-teal-600/70 dark:text-white/40 mb-1 border-b border-teal-900/30 dark:border-white/5 pb-1 font-sans text-[10px]">Session Logs</div>
              {checkoutLog.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bookings Ledger */}
      {/*<div className="mt-12 border-t border-teal-100 dark:border-white/5 pt-12 space-y-4">
        <h2 className="text-base font-bold uppercase tracking-wider text-teal-800/60 dark:text-zinc-500 text-center">
          Property Bookings Ledger
        </h2>
        
        {bookingsList.length === 0 ? (
          <div className="text-center py-10 rounded-3xl border border-teal-100 dark:border-white/5 bg-teal-50/15 dark:bg-white/5 text-teal-850/60 dark:text-zinc-500 text-xs">
            No bookings registered in the ledger for this property yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-teal-100 dark:border-white/5 bg-teal-50/15 dark:bg-white/5">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-teal-150 dark:border-white/10 bg-teal-50/60 dark:bg-black/40 text-teal-950 dark:text-zinc-400 uppercase tracking-wider font-bold">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Dates</th>
                  <th className="px-5 py-3">Paid Total</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-100/60 dark:divide-white/5 text-teal-900 dark:text-zinc-300">
                {bookingsList.map((b) => {
                  const checkIn = formatDisplayDate(b.fromDate);
                  const checkOut = formatDisplayDate(b.toDate);

                  return (
                    <tr key={b.id} className="hover:bg-teal-50/20 dark:hover:bg-white/5 transition-all">
                      <td className="px-5 py-4">
                        <span className="font-bold text-teal-950 dark:text-white block">{b.customerName}</span>
                        <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 block mt-0.5">{b.customerEmail}</span>
                      </td>
                      <td className="px-5 py-4 text-teal-800/80 dark:text-zinc-400 font-mono">
                        {checkIn} - {checkOut}
                      </td>
                      <td className="px-5 py-4 font-bold text-teal-600 dark:text-teal-400">
                        R {b.total.toLocaleString()}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
                            b.paymentStatus === "paid" || b.paymentStatus === "success"
                              ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/25"
                              : b.paymentStatus === "failed"
                              ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/25"
                              : "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-500/25"
                          }`}
                        >
                          {b.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
        )}
      </div>*/}
    </div>
  );
}

export default function BookingsCheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
      </div>
    }>
      <AuthProvider>
        <BookingsCheckoutContent />
      </AuthProvider>
    </Suspense>
  );
}

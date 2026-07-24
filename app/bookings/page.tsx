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

    const conflict = bookingsList.find((b) => {
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
  const stayNights = savedDates ? Math.max(1, Math.ceil(Math.abs(to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const nights = isHourly ? 1 : stayNights;

  const basePricePerNight = property ? property.basePricePerNight : 1500;
  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  const baseCost = basePricePerNight * nights;
  const packagePrice = selectedPackage ? selectedPackage.price || selectedPackage.baseRate || 0 : 0;
  const packageMultiplier = selectedPackage ? selectedPackage.multiplier || 1.0 : 1.0;

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
        return {
          text: "No active reservation",
          class:
            "text-teal-800/70 bg-teal-50/30 border border-teal-100 dark:text-zinc-500 dark:bg-zinc-950/40 dark:border-zinc-800",
        };
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const start = new Date(b.fromDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(b.toDate);
      end.setHours(0, 0, 0, 0);

      if (now > end) {
        return {
          text: "Completed stay",
          class:
            "text-teal-800/70 bg-teal-50/20 border border-teal-100 dark:text-zinc-400 dark:bg-zinc-950/40 dark:border-zinc-900",
        };
      } else if (now >= start && now <= end) {
        return {
          text: "Active Now 🟢",
          class:
            "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 animate-pulse font-bold",
        };
      } else {
        const diffTime = start.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          return {
            text: "Starts tomorrow 📅",
            class:
              "text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 border border-teal-150 dark:border-teal-500/20 font-bold",
          };
        }
        return {
          text: `Starts in ${diffDays} days`,
          class:
            "text-teal-800 dark:text-zinc-300 bg-teal-50/50 dark:bg-white/5 border border-teal-100 dark:border-white/10",
        };
      }
    };

    return (
      <div className="relative max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div className="absolute -top-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[120px]" />
        </div>

        <header className="mb-10 border-b border-teal-100 dark:border-white/10 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-extrabold uppercase tracking-wide">
              Account Stays
            </span>
            <h1 className="text-3xl font-black text-teal-950 dark:text-white mt-1">My Bookings Dashboard</h1>
          </div>
          <Link
            href="/"
            className="text-xs text-teal-800 dark:text-zinc-400 hover:text-teal-950 dark:hover:text-white transition-colors"
          >
            ← View Destination Properties
          </Link>
        </header>

        {latestEstimate && latestEstimate.paymentStatus === "pending" && (() => {
          const estimateProperty = propertiesList.find((p) => p.id === latestEstimate.propertyId);
          return (
            <div className="mb-8 rounded-3xl border border-orange-500/20 bg-orange-500/5 p-6 backdrop-blur-md relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-24 h-24 rounded-full bg-orange-500/10 blur-xl pointer-events-none" />
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full">
                  {estimateProperty?.images && estimateProperty.images.length > 0 && (
                    <div className="relative w-full sm:w-28 h-20 rounded-2xl overflow-hidden border border-orange-500/20 bg-zinc-950 shrink-0">
                      <img
                        src={estimateProperty.images[0]}
                        alt={estimateProperty.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <span className="inline-block rounded bg-orange-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-orange-600 dark:text-orange-400">
                      Unpaid Stay Estimate
                    </span>
                    <h3 className="text-lg font-black text-teal-950 dark:text-white mt-1">
                      {estimateProperty?.title || latestEstimate.propertyId}
                    </h3>
                    <p className="text-xs text-teal-850/60 dark:text-zinc-400 mt-1">
                      Dates: <strong>{formatDisplayDate(latestEstimate.fromDate)}</strong> to{" "}
                      <strong>{formatDisplayDate(latestEstimate.toDate)}</strong>
                    </p>
                    <p className="text-xs text-teal-800/80 dark:text-zinc-300 mt-1 font-bold">
                      Total: R {latestEstimate.total ? Number(latestEstimate.total).toLocaleString() : "0"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 shrink-0">
                  <Link
                    href={`/estimate/${latestEstimate.id}`}
                    className="rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-600 transition-all shadow-md shadow-orange-500/10"
                  >
                    View Details & Pay
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}

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
                ? `${formatDisplayDate(b.fromDate)} ${new Date(b.fromDate).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}`
                : formatDisplayDate(b.fromDate);
              const checkOut = isHourlyBooking
                ? `${formatDisplayDate(b.toDate)} ${new Date(b.toDate).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}`
                : formatDisplayDate(b.toDate);
              const stayNights = Math.max(
                1,
                Math.ceil(Math.abs(new Date(b.toDate).getTime() - new Date(b.fromDate).getTime()) / (1000 * 60 * 60 * 24))
              );
              const propName = propertyForBooking?.title || b.propertyId;
              const countdown = getCountdownLabel(b);
              const guestCount = b.guests?.length || 0;

              return (
                <Link
                  key={b.id}
                  href={`/bookings/${b.id}`}
                  className="group relative overflow-hidden rounded-3xl border border-teal-100 dark:border-white/10 bg-white/80 dark:bg-zinc-900/70 p-6 backdrop-blur-xl shadow-lg hover:shadow-2xl hover:border-teal-300 dark:hover:border-teal-500/30 transition-all duration-300 flex flex-col justify-between"
                >
                  {/* Decorative Glow Effect */}
                  <div className="absolute -right-12 -top-12 w-32 h-32 rounded-full bg-teal-500/10 dark:bg-teal-500/20 blur-2xl group-hover:bg-teal-500/20 transition-all pointer-events-none" />

                  <div className="space-y-5">
                    {/* Top Header: Badge, Title, Status & Thumbnail on the right */}
                    <div className="flex gap-4 items-start justify-between">
                      <div className="flex-1 min-w-0 space-y-1">
                        <span className="inline-block rounded-full bg-teal-500/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-300 border border-teal-500/20">
                          {b.propertyId === "shack"
                            ? "Beach Shack"
                            : b.propertyId === "cottage"
                              ? "Cozy Cottage"
                              : "Luxury Villa"}
                        </span>
                        <h3 className="text-xl font-black text-teal-950 dark:text-white tracking-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {propName}
                        </h3>
                        <p className="text-[10px] font-mono text-teal-800/60 dark:text-zinc-500">Ref: {b.id}</p>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={`inline-block rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-wider border ${b.paymentStatus === "paid" || b.paymentStatus === "success"
                            ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25"
                            : b.paymentStatus === "failed"
                              ? "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/25"
                              : "bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/25"
                            }`}
                        >
                          {b.paymentStatus}
                        </span>
                        {propertyForBooking?.images && propertyForBooking.images.length > 0 && (
                          <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-teal-100/40 dark:border-white/5 bg-zinc-950">
                            <img
                              src={propertyForBooking.images[0]}
                              alt={propName}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Countdown / Schedule State */}
                    <div>
                      <span className={`inline-block rounded-xl px-3 py-1 text-[11px] font-semibold tracking-wide ${countdown.class}`}>
                        {countdown.text}
                      </span>
                    </div>

                    {/* Stay Dates Box */}
                    <div className="grid grid-cols-2 gap-3 rounded-2xl bg-teal-50/50 dark:bg-black/40 p-4 border border-teal-100/80 dark:border-white/5">
                      <div>
                        <span className="text-[10px] font-bold text-teal-800/60 dark:text-zinc-500 uppercase tracking-wider block">
                          Check-in
                        </span>
                        <span className="font-bold text-teal-950 dark:text-white text-xs mt-0.5 block">{checkIn}</span>
                      </div>
                      <div className="border-l border-teal-100/80 dark:border-white/5 pl-3">
                        <span className="text-[10px] font-bold text-teal-800/60 dark:text-zinc-500 uppercase tracking-wider block">
                          Check-out
                        </span>
                        <span className="font-bold text-teal-950 dark:text-white text-xs mt-0.5 block">{checkOut}</span>
                      </div>
                    </div>

                    {/* Guest Count Summary */}
                    {(b.paymentStatus === "paid" || b.paymentStatus === "success") && (
                      <div className="border-t border-teal-100/60 dark:border-white/5 pt-3.5 flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                          Total Guests
                        </span>
                        <span className="text-xs font-bold text-teal-950 dark:text-white">
                          👥 {guestCount} {guestCount === 1 ? "Guest" : "Guests"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="mt-6 border-t border-teal-100 dark:border-white/5 pt-4 flex items-end justify-between">
                    <div className="space-y-1">
                      {viewMode === "all" && (
                        <p className="text-[10px] text-teal-800/80 dark:text-zinc-400">
                          Guest: <strong className="text-teal-950 dark:text-white">{b.customerName}</strong>
                        </p>
                      )}
                      <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 font-bold uppercase block">Duration</span>
                      <span className="font-extrabold text-xs text-teal-950 dark:text-white block">
                        {isHourlyBooking ? "1 Slot Booking" : `${stayNights} Night(s)`}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 font-bold uppercase block">Total</span>
                        <span className="text-lg font-black text-teal-600 dark:text-teal-400 block">
                          R {b.total ? b.total.toLocaleString() : "0"}
                        </span>
                      </div>

                      <span className="rounded-xl bg-teal-500 text-white px-3.5 py-2 text-xs font-bold shadow-md shadow-teal-500/20 group-hover:bg-teal-600 transition-all flex items-center gap-1">
                        Details →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8 font-sans">
      {/* Background Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] left-[10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      {/* Page Header */}
      <header className="mb-10 border-b border-teal-100 dark:border-white/10 pb-6 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-extrabold uppercase tracking-wide">
            Step 2: Checkout
          </span>
          <h1 className="text-3xl font-black text-teal-950 dark:text-white mt-1">
            Book Your Stay
          </h1>
        </div>
        <Link
          href="/"
          className="text-xs font-semibold text-teal-800 dark:text-zinc-400 hover:text-teal-950 dark:hover:text-white transition-colors flex items-center gap-1"
        >
          ← Change Dates / Property
        </Link>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Left Side: Summary & Package Select Tiles */}
        <div className="lg:col-span-3 space-y-6">

          {/* Stay Details Summary */}
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/20 dark:bg-white/5 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-teal-950 dark:text-white">
                1. Stay Configuration
              </h3>
              {/* Booking Type Badge */}
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide border ${isHourly
                  ? "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400"
                  : "bg-indigo-500/10 text-indigo-700 border-indigo-500/20 dark:text-indigo-400"
                  }`}
              >
                {isHourly ? "🕒 Hourly Slot Booking" : "🌙 Nightly Overnight Stay"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Destination Tile */}
              <div className="rounded-2xl bg-white dark:bg-black/40 p-4 border border-teal-100/60 dark:border-white/5 shadow-sm space-y-1">
                <span className="text-[10px] text-teal-800/70 dark:text-zinc-500 uppercase font-bold block">
                  Selected Destination
                </span>
                <span className="text-sm font-extrabold text-teal-950 dark:text-white block">
                  {property ? property.title : "Llandudno Villa"}
                </span>
                <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 font-mono block">
                  id: {propertyId}
                </span>
              </div>

              {/* Booking Date & Time Tile */}
              <div className="rounded-2xl bg-white dark:bg-black/40 p-4 border border-teal-100/60 dark:border-white/5 shadow-sm space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-teal-800/70 dark:text-zinc-500 uppercase font-bold block">
                    {isHourly ? "Booking Date & Time Slot" : "Check-in & Check-out Dates"}
                  </span>
                </div>

                <span className="text-sm font-extrabold text-teal-950 dark:text-white block">
                  {isHourly ? (
                    <>
                      <div>{formatDisplayDate(from)}</div>
                      <div className="text-xs font-bold text-teal-600 dark:text-teal-400 mt-1 flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                        Slot Time: {from.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}
                      </div>
                    </>
                  ) : (
                    `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`
                  )}
                </span>

                {/* Explicit Distinction Disclaimer / Metadata */}
                <div className="pt-1.5 border-t border-slate-100 dark:border-white/5 text-[10px] text-teal-900/70 dark:text-zinc-400">
                  {isHourly ? (
                    <p className="flex items-center gap-1 font-medium text-amber-800/90 dark:text-amber-300/80">
                      <span>⏱</span> Access granted only during the selected hourly slot (No overnight stay).
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 font-medium text-indigo-800/90 dark:text-indigo-300/80">
                      <span>🛏</span> Standard overnight accommodation ({nights} night{nights > 1 ? "s" : ""}).
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Package Configuration - TILE SELECTOR */}
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/20 dark:bg-white/5 p-6 backdrop-blur-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-teal-950 dark:text-white">
                2. Select Package Option
              </h3>
              <span className="text-xs text-teal-700 dark:text-zinc-400 font-medium">
                Optional Enhancements
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {/* Option: Standard / No Package Tile */}
              <button
                type="button"
                onClick={() => setSelectedPackageId("")}
                className={`relative w-full text-left rounded-2xl p-4 transition-all border flex items-start justify-between gap-4 ${selectedPackageId === ""
                  ? "bg-white dark:bg-zinc-900 border-teal-500 ring-2 ring-teal-500/20 shadow-md"
                  : "bg-white/70 dark:bg-black/30 border-teal-100 dark:border-white/5 hover:border-teal-300 dark:hover:border-white/20"
                  }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-teal-950 dark:text-white">
                      Standard Stay
                    </span>
                    <span className="rounded bg-slate-100 dark:bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-400">
                      Basic
                    </span>
                  </div>
                  <p className="text-xs text-teal-900/70 dark:text-zinc-400 leading-relaxed">
                    Standard booking with base amenities included. No additional package added.
                  </p>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  <span className="text-sm font-black text-teal-950 dark:text-white">
                    R 0
                  </span>
                  <div
                    className={`mt-2 h-5 w-5 rounded-full border flex items-center justify-center transition-all ${selectedPackageId === ""
                      ? "border-teal-500 bg-teal-500 text-white"
                      : "border-slate-300 dark:border-white/20"
                      }`}
                  >
                    {selectedPackageId === "" && <span className="text-[10px] leading-none">✓</span>}
                  </div>
                </div>
              </button>

              {/* Dynamic Package Tiles */}
              {packages
                .filter((p) => p.category !== "addon")
                .map((pkg) => {
                  const isSelected = selectedPackageId === pkg.id;
                  const price = pkg.price || pkg.baseRate || 0;

                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPackageId(pkg.id)}
                      className={`relative w-full text-left rounded-2xl p-4 transition-all border flex items-start justify-between gap-4 ${isSelected
                        ? "bg-white dark:bg-zinc-900 border-teal-500 ring-2 ring-teal-500/20 shadow-md"
                        : "bg-white/70 dark:bg-black/30 border-teal-100 dark:border-white/5 hover:border-teal-300 dark:hover:border-white/20"
                        }`}
                    >
                      <div className="space-y-1.5 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-extrabold text-teal-950 dark:text-white">
                            {pkg.name}
                          </span>
                          {pkg.category && (
                            <span className="rounded bg-teal-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                              {pkg.category}
                            </span>
                          )}
                          {pkg.multiplier && pkg.multiplier !== 1 && (
                            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                              {pkg.multiplier}x Multiplier
                            </span>
                          )}
                        </div>
                        {pkg.description && (
                          <p className="text-xs text-teal-900/70 dark:text-zinc-400 leading-relaxed">
                            {pkg.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-sm font-black text-teal-600 dark:text-teal-400">
                          +R {price.toLocaleString()}
                        </span>
                        <div
                          className={`mt-2 h-5 w-5 rounded-full border flex items-center justify-center transition-all ${isSelected
                            ? "border-teal-500 bg-teal-500 text-white"
                            : "border-slate-300 dark:border-white/20"
                            }`}
                        >
                          {isSelected && <span className="text-[10px] leading-none">✓</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Right Side: Total calculations & Secure Book action */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/20 dark:bg-white/5 p-6 backdrop-blur-md shadow-xl space-y-4">
            <h3 className="text-base font-bold text-teal-950 dark:text-white border-b border-teal-100/60 dark:border-white/10 pb-3">
              3. Cost Estimate & Pay
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-teal-900/80 dark:text-zinc-400">
                <span>{isHourly ? "Booking Duration:" : "Stay Duration:"}</span>
                <span className="font-bold text-teal-950 dark:text-white">
                  {isHourly ? "1 Slot" : `${nights} night(s)`}
                </span>
              </div>

              <div className="flex justify-between text-teal-900/80 dark:text-zinc-400">
                <span>
                  {isHourly
                    ? `Slot Cost (R ${basePricePerNight} × 1 slot):`
                    : `Nightly Cost (R ${basePricePerNight} × ${nights}):`}
                </span>
                <span className="font-bold text-teal-950 dark:text-white">
                  R {baseCost.toLocaleString()}
                </span>
              </div>

              {selectedPackage && (
                <>
                  <div className="flex justify-between text-teal-900/80 dark:text-zinc-400">
                    <span>Package Cost ({selectedPackage.name}):</span>
                    <span className="font-bold text-teal-950 dark:text-white">
                      R {packagePrice.toLocaleString()}
                    </span>
                  </div>
                  {packageMultiplier > 1 && (
                    <div className="flex justify-between text-teal-900/80 dark:text-zinc-400">
                      <span>Package Multiplier:</span>
                      <span className="font-bold text-teal-950 dark:text-white">
                        × {packageMultiplier}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-teal-100 dark:border-white/10 pt-4 flex justify-between items-center">
                <span className="text-sm font-bold text-teal-950 dark:text-white">
                  Payable Total ZAR:
                </span>
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
                    {isHourly
                      ? "Select an available date on the calendar below to update your booking date:"
                      : "Select an available date range on the calendar below to update your stay dates:"}
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
            <div className="rounded-3xl border border-teal-100/50 dark:border-white/5 bg-black/90 p-4 font-mono text-[9px] text-teal-400 space-y-1 max-h-40 overflow-y-auto shadow-inner">
              <div className="text-teal-600/70 dark:text-white/40 mb-1 border-b border-teal-900/30 dark:border-white/5 pb-1 font-sans text-[10px]">
                Session Logs
              </div>
              {checkoutLog.map((log, idx) => (
                <div key={idx}>{log}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] flex-col items-center justify-center text-teal-950 dark:text-white">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
        </div>
      }
    >
      <AuthProvider>
        <BookingsCheckoutContent />
      </AuthProvider>
    </Suspense>
  );
}
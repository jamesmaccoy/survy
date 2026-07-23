"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import { useAuth, AuthProvider } from "@/components/auth";
import CalendarPicker from "@/components/CalendarPicker";
import { formatDisplayDate } from "@/lib/utils";

interface Property {
  id: string;
  title: string;
  slug: string;
  basePricePerNight: number;
  description?: string;
  images?: string[];
  bookingType?: string;
  slots?: string[];
  location?: string;
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

interface PropertyDetailsContentProps {
  slug: string;
}

function PropertyDetailsContent({ slug }: PropertyDetailsContentProps) {
  const { user, loading: authLoading } = useAuth();

  // Page States
  const [property, setProperty] = useState<Property | null>(null);
  const [packages, setPackages] = useState<PackageData[]>([]);
  const [savedDates, setSavedDates] = useState<{ fromDate: string; toDate: string } | null>(null);
  const [latestEstimate, setLatestEstimate] = useState<any | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDates, setIsSavingDates] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [copiedEstimateUrl, setCopiedEstimateUrl] = useState(false);

  // Date Picker Inputs
  const [fromDate, setFromDate] = useState("2026-06-16");
  const [toDate, setToDate] = useState("2026-06-19");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  const loadPropertyData = async () => {
    try {
      const propRes = await fetch(`/api/posts/${slug}`);
      const propResult = await propRes.json();
      if (propResult.success && propResult.data) {
        const found = propResult.data;
        setProperty(found);

        const pkgRes = await fetch(`/api/packages?propertyId=${found.id}`);
        const pkgResult = await pkgRes.json();
        if (pkgResult.success && pkgResult.data) {
          setPackages(pkgResult.data);
        }

        const bksRes = await fetch(`/api/bookings?propertyId=${found.id}`);
        const bksResult = await bksRes.json();
        if (bksResult.success && bksResult.data) {
          setBookings(bksResult.data);
        }
      }
    } catch (err) {
      console.error("Failed to query property data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPropertyData();
  }, [slug]);

  // Load user profile dates and latest estimate
  useEffect(() => {
    if (authLoading || !user) {
      setLatestEstimate(null);
      return;
    }

    const fetchUserDatesAndEstimate = async () => {
      try {
        const res = await fetch(`/api/user/dates?userId=${user.uid}`);
        const result = await res.json();
        if (result.success && result.data) {
          setSavedDates(result.data);
          setFromDate(result.data.fromDate.split("T")[0]);
          setToDate(result.data.toDate.split("T")[0]);
        }

        const estRes = await fetch(`/api/estimates/latest?userId=${user.uid}`);
        const estResult = await estRes.json();
        if (estResult.success && estResult.data) {
          setLatestEstimate(estResult.data);
        }
      } catch (err) {
        console.error("Failed to load user dates or estimate:", err);
      }
    };

    fetchUserDatesAndEstimate();
  }, [user, authLoading]);

  // Extract saved start time in hourly mode
  useEffect(() => {
    if (property?.bookingType === "hourly") {
      if (savedDates) {
        try {
          const fD = new Date(savedDates.fromDate);
          if (!isNaN(fD.getTime())) {
            const pad = (num: number) => String(num).padStart(2, "0");
            const slotTime = `${pad(fD.getHours())}:${pad(fD.getMinutes())}`;
            setSelectedSlot(slotTime);
          }
        } catch (err) {
          console.error("Failed to parse start time slot:", err);
        }
      } else if (property.slots && property.slots.length > 0 && !selectedSlot) {
        setSelectedSlot(property.slots[0]);
      }
    }
  }, [property, savedDates, selectedSlot]);

  const handleShareEstimate = () => {
    if (!latestEstimate) return;
    const inviteUrl = `${window.location.origin}/i/${latestEstimate.token}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedEstimateUrl(true);
    setTimeout(() => setCopiedEstimateUrl(false), 2500);
  };

  const handleSaveDates = async () => {
    if (!user) {
      alert("Please sign in to save your dates.");
      return;
    }
    if (!property) {
      alert("Property details are still loading.");
      return;
    }

    let start: Date;
    let end: Date;

    if (property.bookingType === "hourly") {
      const slotTime = selectedSlot || (property.slots && property.slots.length > 0 ? property.slots[0] : "10:00");
      const [h, m] = slotTime.split(":").map(Number);
      start = new Date(`${fromDate}T00:00:00`);
      start.setHours(h, m, 0, 0);

      end = new Date(start.getTime());
      end.setHours(end.getHours() + 4);
    } else {
      start = new Date(fromDate);
      end = new Date(toDate);
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      setDateError("Invalid date selection.");
      return;
    }

    setDateError(null);
    setIsSavingDates(true);

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
        throw new Error(result.error || "Failed to save dates.");
      }

      setSavedDates(result.data);

      let estimatedTotal = 0;
      if (property.bookingType === "hourly") {
        estimatedTotal = property.basePricePerNight;
      } else {
        const stayNights = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        estimatedTotal = property.basePricePerNight * stayNights;
      }

      const estRes = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          packageId: null,
          customerName: user.displayName || user.email?.split("@")[0] || "Authenticated Guest",
          customerEmail: user.email || "",
          customerId: user.uid,
          fromDate: start.toISOString(),
          toDate: end.toISOString(),
          total: estimatedTotal,
        }),
      });

      const estResult = await estRes.json();
      if (estRes.ok && estResult.success) {
        setLatestEstimate(estResult.estimate);
      }
    } catch (err: any) {
      setDateError(err.message);
    } finally {
      setIsSavingDates(false);
    }
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-[500px] flex-col items-center justify-center text-teal-950 dark:text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-teal-500 border-teal-100 dark:border-white/10" />
        <span className="mt-3 text-xs font-semibold tracking-wide text-teal-800/60 dark:text-zinc-400">
          Retrieving Listing Information...
        </span>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-3xl border border-teal-100/80 dark:border-white/10 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl text-center shadow-xl">
        <span className="text-4xl">⚠️</span>
        <h3 className="text-xl font-black text-teal-950 dark:text-white mt-4">Listing Not Found</h3>
        <p className="text-xs text-teal-800/80 dark:text-zinc-400 mt-2 leading-relaxed">
          The property matching <strong>"{slug}"</strong> could not be located.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/20"
        >
          Return to Destination Listings
        </Link>
      </div>
    );
  }

  const datesLocked = !!savedDates;
  let nights = 0;
  let hours = 0;
  let baseStayCost = 0;

  if (datesLocked && savedDates) {
    const start = new Date(savedDates.fromDate);
    const end = new Date(savedDates.toDate);
    if (property.bookingType === "hourly") {
      hours = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60)));
      baseStayCost = property.basePricePerNight;
    } else {
      nights = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      baseStayCost = property.basePricePerNight * nights;
    }
  }

  return (
    <div className="relative max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6 font-sans">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 dark:text-zinc-400 hover:text-teal-950 dark:hover:text-white transition-colors"
        >
          <span>←</span> Back to All Destinations
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Left Column: Property Details & Media */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-white dark:bg-zinc-900/80 p-6 backdrop-blur-xl shadow-xl space-y-5">

            {/* Gallery with Title Overlayed */}
            <div className="space-y-3">
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-teal-100/50 dark:border-white/5 bg-zinc-950 shadow-inner">
                {property.images && property.images.length > 0 ? (
                  <img
                    src={property.images[activeImageIndex]}
                    alt={`${property.title} gallery view`}
                    className="w-full h-full object-cover transition-all duration-300 ease-in-out"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-zinc-500 text-xs">
                    No image available
                  </div>
                )}

                {/* Top Badge */}
                <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-md border border-white/20 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                  {property.bookingType === "hourly" ? "Hourly Slot" : "Nightly Stay"}
                </span>

                {/* Title Overlay Banner at Bottom of Image */}
                <div className="absolute inset-x-0 bottom-0 pt-16 pb-4 px-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-teal-300 mb-0.5">
                    <span>📍</span> {property.location || "Llandudno, Cape Town"}
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white drop-shadow-md">
                    {property.title}
                  </h1>
                  <span className="text-[10px] text-zinc-300/80 font-mono mt-0.5">
                    Ref: {property.slug} • ID: {property.id}
                  </span>
                </div>
              </div>

              {/* Thumbnails */}
              {property.images && property.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                  {property.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-20 aspect-video rounded-xl overflow-hidden border-2 shrink-0 transition-all ${idx === activeImageIndex
                        ? "border-teal-500 scale-95 shadow-md"
                        : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Price Highlights */}
            <div className="grid grid-cols-2 gap-4 border-t border-teal-100/60 dark:border-white/5 pt-4">
              <div>
                <span className="text-[9px] text-teal-800/60 dark:text-zinc-400 uppercase font-bold tracking-wider block">
                  {property.bookingType === "hourly" ? "Hourly slot price" : "Nightly base rate"}
                </span>
                <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-0.5">
                  R {property.basePricePerNight.toLocaleString()}
                  <span className="text-xs font-semibold text-teal-800/60 dark:text-zinc-400">
                    {property.bookingType === "hourly" ? "/slot" : "/night"}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-[9px] text-teal-800/60 dark:text-zinc-400 uppercase font-bold tracking-wider block">
                  Location
                </span>
                <p className="text-sm font-bold text-teal-950 dark:text-white mt-1">
                  {property.location || "🏖 Llandudno, Cape Town"}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="border-t border-teal-100/60 dark:border-white/5 pt-4">
              <span className="text-[9px] text-teal-800/60 dark:text-zinc-400 uppercase font-bold tracking-wider block mb-1">
                About this property
              </span>
              <p className="text-xs text-teal-900/80 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                {property.description ||
                  "Experience Llandudno at its finest. This property features coastline scenery, proximity to the beach, luxury amenities, and private decks. Connect package options and add-ons at checkout."}
              </p>
            </div>
          </div>

          {/* Package Deals Section */}
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-white dark:bg-zinc-900/80 p-6 backdrop-blur-xl shadow-xl space-y-4">
            <h3 className="text-base font-black text-teal-950 dark:text-white flex items-center gap-2">
              <span>🎁</span> Available Packages
            </h3>

            {packages.filter((pkg) => pkg.category !== "addon").length === 0 ? (
              <p className="text-xs text-teal-800/60 dark:text-zinc-500 italic">
                No specific package configurations created for this property yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {packages
                  .filter((pkg) => pkg.category !== "addon")
                  .map((pkg) => (
                    <div
                      key={pkg.id}
                      className="rounded-2xl bg-teal-50/40 dark:bg-black/40 p-4 border border-teal-100/60 dark:border-white/5 flex items-center justify-between transition-all hover:border-teal-300 dark:hover:border-teal-500/30"
                    >
                      <div className="space-y-1">
                        <span className="inline-block rounded-full bg-teal-100 dark:bg-white/5 border border-teal-200 dark:border-white/10 px-2 py-0.5 text-[8px] font-extrabold text-teal-800 dark:text-zinc-400 uppercase tracking-wider">
                          {pkg.category} Category
                        </span>
                        <h4 className="text-sm font-bold text-teal-950 dark:text-white">{pkg.name}</h4>
                        {pkg.description && (
                          <p className="text-xs text-teal-900/70 dark:text-zinc-400 leading-relaxed">
                            {pkg.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right pl-4 shrink-0">
                        <span className="text-[8px] text-teal-800/60 dark:text-zinc-500 uppercase font-bold block">
                          Price
                        </span>
                        <p className="text-sm font-black text-teal-600 dark:text-teal-400">
                          R {pkg.price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Stay Scheduler & Booking Block */}
        <div className="lg:col-span-2 space-y-6 sticky top-6">
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-white dark:bg-zinc-900/80 p-6 backdrop-blur-xl shadow-xl space-y-5">
            <div className="flex justify-between items-center w-full border-b border-teal-100/60 dark:border-white/10 pb-3">
              <h3 className="text-base font-black text-teal-950 dark:text-white flex items-center gap-2">
                <span>📅</span> Stay Planner
              </h3>
            </div>

            {/* Enhanced Active Estimate Sharing Widget */}
            {latestEstimate && (
              <div className="rounded-2xl border border-teal-500/30 bg-teal-500/10 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">
                    Active Estimate Ready
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    Token: {latestEstimate.token ? `${latestEstimate.token.slice(0, 8)}...` : "Active"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-teal-950 dark:text-white">
                    R {latestEstimate.total ? latestEstimate.total.toLocaleString() : "0"}
                  </div>
                  <button
                    onClick={handleShareEstimate}
                    className="rounded-xl bg-teal-500 hover:bg-teal-600 px-3 py-1.5 text-xs font-bold text-white transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                  >
                    <span>{copiedEstimateUrl ? "✓ Copied!" : "🔗 Share Link"}</span>
                  </button>
                </div>
              </div>
            )}

            {!user ? (
              <div className="text-center py-6 space-y-4">
                <p className="text-xs text-teal-900/80 dark:text-zinc-400 leading-relaxed">
                  Sign in or register to lock check-in dates and access package booking options.
                </p>
                <Link
                  href="/login"
                  className="inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-extrabold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/20"
                >
                  Sign In to Reserve
                </Link>
              </div>
            ) : datesLocked ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-teal-50/60 dark:bg-teal-500/10 border border-teal-100 dark:border-teal-500/20 p-4 space-y-2.5">
                  <div className="flex justify-between items-start text-xs text-teal-900/80 dark:text-zinc-300">
                    <span className="font-medium">
                      {property.bookingType === "hourly" ? "Selected Slot:" : "Selected Stay:"}
                    </span>
                    <span className="font-bold text-teal-950 dark:text-white text-right">
                      {property.bookingType === "hourly" ? (
                        <>
                          {formatDisplayDate(savedDates!.fromDate)}
                          <br />
                          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-mono">
                            {new Date(savedDates!.fromDate).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}{" "}
                            -{" "}
                            {new Date(savedDates!.toDate).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </span>
                        </>
                      ) : (
                        `${formatDisplayDate(savedDates!.fromDate)} - ${formatDisplayDate(savedDates!.toDate)}`
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-teal-900/80 dark:text-zinc-300">
                    <span className="font-medium">Duration:</span>
                    <span className="font-bold text-teal-950 dark:text-white">
                      {property.bookingType === "hourly" ? "1 Slot (4 Hours)" : `${nights} Night(s)`}
                    </span>
                  </div>

                  <div className="flex justify-between text-xs text-teal-900/80 dark:text-zinc-300 border-t border-teal-100/60 dark:border-white/5 pt-2">
                    <span className="font-bold">Estimated Base Total:</span>
                    <span className="font-black text-teal-600 dark:text-teal-400">
                      R {baseStayCost.toLocaleString()}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/bookings?propertyId=${property.id}`}
                  className="block w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-center text-xs font-black text-white hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-teal-500/20"
                >
                  Select Package & Pay →
                </Link>

                <button
                  onClick={() => setSavedDates(null)}
                  className="w-full text-center text-[10px] uppercase tracking-wider text-teal-800 dark:text-zinc-400 hover:text-teal-950 dark:hover:text-white font-bold transition-colors"
                >
                  Change Stay Dates
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-teal-900/80 dark:text-zinc-400">
                  {property.bookingType === "hourly"
                    ? "Select booking date and time to persist to your profile."
                    : "Select stay ranges to persist to your guest profile."}
                </p>

                {dateError && (
                  <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-2.5 text-center text-xs text-red-600 dark:text-red-400 font-bold">
                    ⚠️ {dateError}
                  </div>
                )}

                <CalendarPicker
                  selectedFromDate={fromDate}
                  selectedToDate={toDate}
                  bookings={bookings}
                  singleMonth={true}
                  bookingType={property.bookingType}
                  onChange={(start, end) => {
                    setFromDate(start);
                    setToDate(end);
                  }}
                />

                {property.bookingType === "hourly" && (
                  <div className="rounded-2xl bg-teal-50/50 dark:bg-white/5 border border-teal-100 dark:border-white/10 p-3 space-y-2">
                    <label className="block text-[9px] text-teal-800/70 dark:text-zinc-400 uppercase tracking-wider font-extrabold">
                      Available Slots (Flat Booking)
                    </label>
                    {property.slots && property.slots.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        {property.slots.map((slotTime) => {
                          const isSelected = selectedSlot === slotTime;
                          const [h, m] = slotTime.split(":");
                          const hourNum = parseInt(h);
                          const ampm = hourNum >= 12 ? "PM" : "AM";
                          const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
                          const label = `${displayHour}:${m} ${ampm} Slot`;

                          return (
                            <button
                              key={slotTime}
                              type="button"
                              onClick={() => setSelectedSlot(slotTime)}
                              className={`rounded-xl py-2 px-2.5 text-xs font-bold border transition-all ${isSelected
                                ? "bg-teal-500/15 border-teal-500 text-teal-600 dark:text-teal-400"
                                : "bg-white/40 dark:bg-black/30 border-teal-100 dark:border-white/5 text-zinc-600 dark:text-zinc-400 hover:text-white"
                                }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500 italic">No available slots configured.</p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleSaveDates}
                  disabled={isSavingDates}
                  className="w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-black text-white hover:bg-teal-600 transition-all active:scale-95 shadow-md shadow-teal-500/20"
                >
                  {isSavingDates ? "Saving selection..." : "Confirm & Save Booking"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PropertyDetailsPage({ params }: { params: Promise<{ slug: string }> }) {
  const unwrappedParams = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-100 dark:border-white/10" />
        </div>
      }
    >
      <AuthProvider>
        <PropertyDetailsContent slug={unwrappedParams.slug} />
      </AuthProvider>
    </Suspense>
  );
}
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

  // Date Picker Inputs
  const [fromDate, setFromDate] = useState("2026-06-16");
  const [toDate, setToDate] = useState("2026-06-19");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookings, setBookings] = useState<any[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);

  const loadPropertyData = async () => {
    try {
      // 1. Fetch Property by slug directly (the details API resolves slugs)
      const propRes = await fetch(`/api/posts/${slug}`);
      const propResult = await propRes.json();
      if (propResult.success && propResult.data) {
        const found = propResult.data;
        setProperty(found);

        // 2. Fetch Packages for this property
        const pkgRes = await fetch(`/api/packages?propertyId=${found.id}`);
        const pkgResult = await pkgRes.json();
        if (pkgResult.success && pkgResult.data) {
          setPackages(pkgResult.data);
        }

        // 3. Fetch Bookings for this property
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
      end.setHours(end.getHours() + 4); // slot defaults to 4 hours block
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
          toDate: end.toISOString()
        })
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save dates.");
      }

      setSavedDates(result.data);

      // Calculate stay duration and total cost for the estimate
      let estimatedTotal = 0;
      if (property.bookingType === "hourly") {
        estimatedTotal = property.basePricePerNight; // flat per slot
      } else {
        const stayNights = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        estimatedTotal = property.basePricePerNight * stayNights;
      }

      // Create estimate immediately
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
          total: estimatedTotal
        })
      });

      const estResult = await estRes.json();
      if (estRes.ok && estResult.success) {
        setLatestEstimate(estResult.estimate);
      }

      alert("✅ Dates locked successfully to your profile and estimate generated!");
    } catch (err: any) {
      setDateError(err.message);
    } finally {
      setIsSavingDates(false);
    }
  };


  if (isLoading || authLoading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-teal-950 dark:text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
        <span className="mt-3 text-sm text-teal-800/60 dark:text-zinc-500">Retrieving Listing Information...</span>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 rounded-3xl border border-teal-100 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 text-center">
        <span className="text-3xl">⚠️</span>
        <h3 className="text-lg font-bold text-teal-950 dark:text-white mt-4">Listing Not Found</h3>
        <p className="text-xs text-teal-800/80 dark:text-zinc-400 mt-2 leading-relaxed">
          The property slug matching <strong>"{slug}"</strong> does not exist in our database.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-sm font-bold text-white hover:bg-teal-600 transition-all"
        >
          Return to Listings
        </Link>
      </div>
    );
  }

  // Calculate stay parameters
  const datesLocked = !!savedDates;
  let nights = 0;
  let hours = 0;
  let baseStayCost = 0;

  if (datesLocked && savedDates) {
    const start = new Date(savedDates.fromDate);
    const end = new Date(savedDates.toDate);
    if (property.bookingType === "hourly") {
      hours = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60)));
      baseStayCost = property.basePricePerNight; // flat per slot
    } else {
      nights = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      baseStayCost = property.basePricePerNight * nights;
    }
  }

  return (
    <div className="relative max-w-5xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] left-[20%] w-[60%] h-[60%] rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      <Link href="/" className="text-sm text-teal-800 dark:text-zinc-500 hover:text-teal-950 dark:hover:text-white transition-colors mb-6 inline-block">
        ← Back to Listings
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
        {/* Left Side: Property Specs */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-6 backdrop-blur-md space-y-4">
            {property.images && property.images.length > 0 && (
              <div className="space-y-3">
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-teal-100/50 dark:border-white/5 bg-zinc-950 animate-fade-in">
                  <img
                    src={property.images[activeImageIndex]}
                    alt={`${property.title} gallery`}
                    className="w-full h-full object-cover transition-all duration-300 ease-in-out"
                  />
                </div>
                {property.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                    {property.images.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative w-20 aspect-video rounded-lg overflow-hidden border-2 shrink-0 transition-all ${idx === activeImageIndex ? "border-teal-500 scale-95" : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <span className="inline-block rounded bg-teal-500/10 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                Premium Stay
              </span>
              <h1 className="text-3xl font-black text-teal-950 dark:text-white mt-2">{property.title}</h1>
              <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 font-mono block mt-1">Slug: {property.slug} | Database ID: {property.id}</span>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-teal-100/60 dark:border-white/5 pt-4">
              <div>
                <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 uppercase">
                  {property.bookingType === "hourly" ? "Hourly slot price" : "Nightly base price"}
                </span>
                <p className="text-xl font-black text-teal-600 dark:text-teal-400">
                  R {property.basePricePerNight.toLocaleString()}{property.bookingType === "hourly" ? "/slot" : ""}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 uppercase">Location</span>
                <p className="text-ml font-semibold text-teal-950 dark:text-white mt-1">
                  {property.location || "🏖 Llandudno, Cape Town"}
                </p>
              </div>
            </div>

            <div className="border-t border-teal-100/60 dark:border-white/5 pt-4">
              <span className="text-[10px] text-teal-800/60 dark:text-zinc-500 uppercase block">About this property</span>
              <p className="text-md text-teal-900/90 dark:text-zinc-300 leading-relaxed mt-1 whitespace-pre-line">
                {property.description || "Experience Llandudno at its finest. This property features unparalleled coastline scenery, proximity to the beach, luxury amenities, and private decks. Connect package options and addons at checkout."}
              </p>
            </div>
          </div>

          {/* Package deals list */}
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-3 backdrop-blur-md space-y-1">
            <h3 className="text-base font-bold text-teal-950 dark:text-white">Available Packages for this Listing</h3>

            {packages.filter(pkg => pkg.category !== "addon").length === 0 ? (
              <p className="text-md text-teal-800/60 dark:text-zinc-500">No specific packages config created for this property yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {packages.filter(pkg => pkg.category !== "addon").map((pkg) => (
                  <div key={pkg.id} className="rounded-2xl bg-teal-50/40 dark:bg-black/40 p-4 border border-teal-100/50 dark:border-white/5 flex items-center justify-between">
                    <div>
                      <span className="inline-block rounded bg-teal-100/60 dark:bg-white/5 border border-teal-200 dark:border-white/10 px-1.5 py-0.5 text-[10px] font-bold text-teal-800 dark:text-zinc-400 uppercase tracking-wide">
                        {pkg.category} Category
                      </span>
                      <h4 className="text-md font-bold text-teal-950 dark:text-white mt-1">{pkg.name}</h4>
                      {pkg.description && <p className="text-[12px] text-teal-900/80 dark:text-zinc-400 mt-1 leading-relaxed">{pkg.description}</p>}
                    </div>
                    <div className="text-right pl-4">
                      <span className="text-[9px] text-teal-850/60 dark:text-zinc-500 block uppercase">Price</span>
                      <p className="text-md font-extrabold text-teal-600 dark:text-teal-400">R {pkg.price.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Stay Scheduler Block */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-3xl border border-teal-100/80 dark:border-white/10 bg-teal-50/15 dark:bg-white/5 p-3 backdrop-blur-md shadow-xl space-y-2">
            <div className="flex justify-between items-center w-full border-b border-teal-100/50 dark:border-white/15 pb-2">
              <h3 className="text-base font-bold text-teal-950 dark:text-white flex items-center gap-2">
                📅 Stay Dates Planner
              </h3>
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


            {!user ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-md text-teal-900/80 dark:text-zinc-400 leading-relaxed">
                  Sign in or register to lock check-in dates and access package booking options.
                </p>
                <Link
                  href="/login"
                  className="inline-block w-full rounded-xl bg-teal-500 py-3 text-center text-md font-bold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/10"
                >
                  Sign In to Book
                </Link>
              </div>
            ) : datesLocked ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-teal-50 dark:bg-teal-500/5 border border-teal-100 dark:border-teal-500/15 p-4 space-y-2">
                  <div className="flex justify-between items-start text-md text-teal-900/80 dark:text-zinc-300">
                    <span>{property.bookingType === "hourly" ? "Selected Booking:" : "Selected Range:"}</span>
                    <span className="font-bold text-teal-950 dark:text-white text-right">
                      {property.bookingType === "hourly" ? (
                        <>
                          {formatDisplayDate(savedDates!.fromDate)}
                          <br />
                          <span className="text-[11px] text-zinc-400">
                            {new Date(savedDates!.fromDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(savedDates!.toDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        </>
                      ) : (
                        `${formatDisplayDate(savedDates!.fromDate)} - ${formatDisplayDate(savedDates!.toDate)}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-md text-teal-900/80 dark:text-zinc-300">
                    <span>Booking Duration:</span>
                    <span className="font-bold text-teal-950 dark:text-white">
                      {property.bookingType === "hourly" ? "1 Slot (4 hours)" : `${nights} night(s)`}
                    </span>
                  </div>
                  <div className="flex justify-between text-md text-teal-900/80 dark:text-zinc-300">
                    <span>Estimated Base Cost:</span>
                    <span className="font-bold text-teal-600 dark:text-teal-400">R {baseStayCost.toLocaleString()}</span>
                  </div>
                </div>

                <Link
                  href={`/bookings?propertyId=${property.id}`}
                  className="block w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-center text-sm font-bold text-white hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-teal-500/10"
                >
                  Proceed to Package Selection & Pay →
                </Link>

                <button
                  onClick={() => setSavedDates(null)}
                  className="w-full text-center text-[11px] text-teal-800 dark:text-zinc-500 hover:text-teal-950 dark:hover:text-zinc-300 font-bold"
                >
                  Change Stay Dates
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-teal-900/80 dark:text-zinc-400">
                  {property.bookingType === "hourly" ? "Select booking date and time to persist to your profile." : "Select stay ranges to persist to your guest profile."}
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
                  <div className="rounded-2xl bg-white/5 border border-white/10 p-4 text-sm backdrop-blur-md space-y-2">
                    <label className="block text-[10px] text-teal-850/60 dark:text-zinc-550 uppercase tracking-wider font-bold">
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
                              className={`rounded-xl py-2 px-3 text-sm font-bold border transition-all ${isSelected
                                ? "bg-teal-500/10 border-teal-500 text-teal-400"
                                : "bg-black/30 border-white/5 text-zinc-500 hover:text-white"
                                }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500 italic">No available slots configured by the Pro.</p>
                    )}
                  </div>
                )}

                <button
                  onClick={handleSaveDates}
                  disabled={isSavingDates}
                  className="w-full rounded-xl bg-teal-500 py-3 text-center text-md font-bold text-white hover:bg-teal-600 transition-all active:scale-95 shadow-md shadow-teal-500/10"
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
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-150 dark:border-white/10" />
      </div>
    }>
      <AuthProvider>
        <PropertyDetailsContent slug={unwrappedParams.slug} />
      </AuthProvider>
    </Suspense>
  );
}

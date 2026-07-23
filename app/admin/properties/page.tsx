"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/auth";

interface Property {
  id: string;
  title: string;
  slug: string;
  basePricePerNight: number;
  airbnbCalendarUrl?: string;
  googleCalendarUrl?: string;
  images?: string[];
  description?: string;
  bookingType?: string;
  slots?: string[];
  location?: string;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
}

export default function AdminPropertiesPage() {
  const { user, loading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form visibility state (hidden by default)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [location, setLocation] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [airbnbCalendarUrl, setAirbnbCalendarUrl] = useState("");
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [bookingType, setBookingType] = useState<"nightly" | "hourly">("nightly");
  const [slots, setSlots] = useState<string[]>(["10:00", "14:00"]);

  const fetchProperties = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/posts?hostId=${user.uid}`);
      const result = await res.json();
      if (result.success && result.data) {
        setProperties(result.data);
      }
    } catch (err: unknown) {
      console.error("Failed to load properties:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProperties();
    }
  }, [user, fetchProperties]);

  // Auto-generate slug from title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!editingPropertyId) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/--+/g, "-")
          .trim()
      );
    }
  };

  const resetForm = () => {
    setEditingPropertyId(null);
    setTitle("");
    setSlug("");
    setLocation("");
    setBasePrice("");
    setAirbnbCalendarUrl("");
    setGoogleCalendarUrl("");
    setDescription("");
    setImages([]);
    setBookingType("nightly");
    setSlots(["10:00", "14:00"]);
    setStatusMessage(null);
  };

  const closeForm = () => {
    resetForm();
    setIsFormOpen(false);
  };

  const startEditProperty = (p: Property) => {
    setEditingPropertyId(p.id);
    setTitle(p.title);
    setSlug(p.slug);
    setLocation(p.location || "");
    setBasePrice(String(p.basePricePerNight));
    setAirbnbCalendarUrl(p.airbnbCalendarUrl || "");
    setGoogleCalendarUrl(p.googleCalendarUrl || "");
    setDescription(p.description || "");
    setImages(p.images || []);
    setBookingType((p.bookingType as "nightly" | "hourly") || "nightly");
    setSlots(p.slots || ["10:00", "14:00"]);
    setStatusMessage(null);
    setIsFormOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    const fileList = Array.from(files);

    for (const file of fileList) {
      const uploadId = `${file.name}-${Date.now()}`;

      setUploadingFiles((prev) => [
        ...prev,
        { id: uploadId, name: file.name, progress: 10 },
      ]);

      try {
        const presignRes = await fetch("/api/media/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostId: user.uid,
            filename: file.name,
            contentType: file.type,
            propertyId: slug || "draft",
          }),
        });

        if (!presignRes.ok) throw new Error("Failed to get presigned URL");
        const { presignedUrl, publicUrl } = await presignRes.json();

        setUploadingFiles((prev) =>
          prev.map((item) =>
            item.id === uploadId ? { ...item, progress: 50 } : item
          )
        );

        const uploadRes = await fetch(presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadRes.ok) throw new Error("Failed to upload image file");

        setImages((prev) => [...prev, publicUrl]);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Upload error";
        console.error("Upload failed for file:", file.name, err);
        setStatusMessage({
          type: "error",
          text: `Upload failed for ${file.name}: ${errorMessage}`,
        });
      } finally {
        setUploadingFiles((prev) => prev.filter((item) => item.id !== uploadId));
      }
    }

    e.target.value = "";
  };

  const handleRemoveImage = (url: string) => {
    setImages((prev) => prev.filter((img) => img !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug || !basePrice) {
      setStatusMessage({ type: "error", text: "Please fill in all required fields." });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({
          id: editingPropertyId || undefined,
          title,
          name: title,
          slug,
          basePricePerNight: Number(basePrice),
          airbnbCalendarUrl,
          googleCalendarUrl,
          description,
          images,
          hostId: user?.uid,
          bookingType,
          slots: bookingType === "hourly" ? slots : [],
          location,
        }),
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || resJson.data || "Failed to save property.");
      }

      setStatusMessage({
        type: "success",
        text: editingPropertyId
          ? "Property updated successfully!"
          : "Property created successfully!",
      });

      closeForm();
      fetchProperties();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred.";
      setStatusMessage({ type: "error", text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-500/20" />
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center shadow-sm backdrop-blur-md">
          <span className="text-4xl">🔐</span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-4">
            Access Denied
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
            Administrative privileges are required to access this portal. Please sign in with an administrator account to continue.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/login"
              className="w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/10"
            >
              Sign In as Admin
            </Link>
            <Link
              href="/"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 py-3 text-center text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans selection:bg-teal-500/30 selection:text-teal-600 transition-colors duration-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] left-[10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        {/* Navigation & Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 dark:border-white/10 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-zinc-200 dark:to-zinc-400">
              Pro Portal
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Properties & Listings Management
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400">
              🔐 Pro Access
            </span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* LEFT COLUMN: LISTINGS SIDEBAR */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-zinc-300 flex items-center gap-2">
                <span>🏢</span> Published Listings ({properties.length})
              </h2>
              <button
                onClick={() => {
                  resetForm();
                  setIsFormOpen(true);
                }}
                className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-3 py-1.5 text-xs font-bold text-white hover:brightness-110 shadow-sm transition-all flex items-center gap-1 shrink-0"
              >
                <span>✙</span> New Property
              </button>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center py-12 justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-500/20" />
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-12 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 p-6 shadow-sm">
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
                  No properties published yet. Create one to get started.
                </p>
                <button
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(true);
                  }}
                  className="inline-flex rounded-xl bg-teal-500 px-4 py-2 text-xs font-bold text-white hover:bg-teal-600 transition-all"
                >
                  ✙ Create First Property
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
                {properties.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 transition-all flex flex-col gap-3 shadow-sm hover:border-slate-300 dark:hover:border-white/20"
                  >
                    <div className="flex items-center gap-3">
                      {p.images && p.images.length > 0 ? (
                        <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 shrink-0 bg-slate-100 dark:bg-zinc-900">
                          <Image
                            src={p.images[0]}
                            alt={p.title}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs text-slate-400 dark:text-zinc-600 shrink-0">
                          📷
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {p.title}
                        </h3>
                        {p.location && (
                          <span className="text-[11px] text-teal-600 dark:text-teal-400 block font-semibold truncate">
                            {p.location}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 dark:text-zinc-500 block font-mono truncate">
                          id: {p.id} | slug: {p.slug}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase font-bold block">
                          {p.bookingType === "hourly" ? "Rate/Hr" : "Rate/Night"}
                        </span>
                        <p className="text-xs font-black text-teal-600 dark:text-teal-400">
                          R {p.basePricePerNight.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {p.description && (
                      <p className="text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed italic border-t border-slate-100 dark:border-white/5 pt-2">
                        {p.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-2">
                      <span className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase tracking-wider font-bold">
                        {p.bookingType === "hourly" ? "🕒 Short bookings" : "🌙 Long booking"}
                      </span>
                      <button
                        onClick={() => startEditProperty(p)}
                        className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white transition-all active:scale-95"
                      >
                        Edit Config →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: HIDDEN / EXPANDABLE FORM & DASHBOARD CONTENT */}
          <div className="lg:col-span-7 space-y-6">

            {/* Banner when Form is Closed */}
            {!isFormOpen && (
              <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center shadow-sm backdrop-blur-md space-y-4">
                <span className="text-3xl block">🏡</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Property Configuration Center
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                  Select any listing from the left sidebar to edit its details, or click below to publish a brand new stay.
                </p>
                <button
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(true);
                  }}
                  className="inline-flex rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-5 py-2.5 text-xs font-bold text-white hover:brightness-110 shadow-md shadow-teal-500/10 transition-all gap-1.5"
                >
                  <span>✙</span> Create New Property
                </button>
              </div>
            )}

            {/* Collapsible Form */}
            {isFormOpen && (
              <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-xl backdrop-blur-md space-y-5 transition-all">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{editingPropertyId ? "✎" : "✙"}</span>
                    {editingPropertyId ? "Update Property Details" : "Create New Property"}
                  </h2>
                  <button
                    onClick={closeForm}
                    className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-bold transition-colors bg-slate-100 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10"
                  >
                    ✕ Close / Cancel
                  </button>
                </div>

                {statusMessage && (
                  <div
                    className={`rounded-xl border p-3.5 text-center text-xs font-bold ${statusMessage.type === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                      }`}
                  >
                    {statusMessage.text}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      Property Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Llandudno Cliffside Shack"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      Slug (Auto-generated) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. llandudno-cliffside-shack"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white/60 focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 🏖 Llandudno, Cape Town"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      {bookingType === "hourly" ? "Base Price Per Hour (ZAR) *" : "Base Price Per Night (ZAR) *"}
                    </label>
                    <input
                      type="number"
                      required
                      placeholder={bookingType === "hourly" ? "e.g. 250" : "e.g. 1500"}
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      Booking Type
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBookingType("nightly")}
                        className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all border ${bookingType === "nightly"
                            ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400"
                            : "bg-slate-100 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                      >
                        🌙 Long booking
                      </button>
                      <button
                        type="button"
                        onClick={() => setBookingType("hourly")}
                        className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all border ${bookingType === "hourly"
                            ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400"
                            : "bg-slate-100 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                          }`}
                      >
                        🕒 Short bookings
                      </button>
                    </div>
                  </div>

                  {bookingType === "hourly" && (
                    <div>
                      <label className="mb-2 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                        Available Time Slots
                      </label>
                      <div className="grid grid-cols-3 gap-2 bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 p-3 rounded-xl">
                        {["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"].map((slotTime) => {
                          const isSelected = slots.includes(slotTime);
                          const toggleSlot = () => {
                            if (isSelected) {
                              setSlots((prev) => prev.filter((s) => s !== slotTime));
                            } else {
                              setSlots((prev) => [...prev, slotTime].sort());
                            }
                          };
                          const [h, m] = slotTime.split(":");
                          const hourNum = parseInt(h, 10);
                          const ampm = hourNum >= 12 ? "PM" : "AM";
                          const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
                          const label = `${displayHour}:${m} ${ampm}`;

                          return (
                            <button
                              key={slotTime}
                              type="button"
                              onClick={toggleSlot}
                              className={`rounded-lg py-1.5 px-2 text-[10px] font-bold border transition-all ${isSelected
                                  ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400"
                                  : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/5 text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-300"
                                }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      Description / About Stay
                    </label>
                    <textarea
                      placeholder="Describe your stay, amenities, views, scenery..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 resize-y"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      High-Resolution Imagery
                    </label>
                    <div className="relative group border-2 border-dashed border-slate-300 dark:border-white/10 rounded-2xl p-6 hover:border-teal-500/50 bg-slate-50 dark:bg-black/20 hover:bg-slate-100/50 dark:hover:bg-black/40 transition-all cursor-pointer text-center">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div className="space-y-1">
                        <span className="text-2xl block">📸</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                          Drag & drop files or click to upload
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-500 block">
                          PNG, JPG, WEBP up to 10MB
                        </span>
                      </div>
                    </div>

                    {uploadingFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {uploadingFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-lg p-2 font-mono"
                          >
                            <span className="truncate max-w-[180px]">{file.name}</span>
                            <span className="text-teal-600 dark:text-teal-400 font-bold">{file.progress}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {images.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mt-3.5">
                        {images.map((url, index) => (
                          <div
                            key={index}
                            className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-200 dark:bg-zinc-900"
                          >
                            <Image
                              src={url}
                              alt={`Upload ${index}`}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(url)}
                              className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-[8px] leading-none opacity-0 group-hover:opacity-100 transition-opacity active:scale-95 shadow-md shadow-black/20 z-10"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      Airbnb iCal URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.airbnb.co.za/calendar/ical/..."
                      value={airbnbCalendarUrl}
                      onChange={(e) => setAirbnbCalendarUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 text-xs"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                      Google Calendar iCal URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://calendar.google.com/calendar/ical/..."
                      value={googleCalendarUrl}
                      onChange={(e) => setGoogleCalendarUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-center text-xs font-bold text-white shadow-lg shadow-teal-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmitting
                      ? editingPropertyId
                        ? "Saving changes..."
                        : "Creating property..."
                      : editingPropertyId
                        ? "Save Property Changes"
                        : "Publish Property"}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
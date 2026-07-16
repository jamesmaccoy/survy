"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
}

export default function AdminPropertiesPage() {
  const { user, loading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [airbnbCalendarUrl, setAirbnbCalendarUrl] = useState("");
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; progress: number }[]>([]);
  const [bookingType, setBookingType] = useState("nightly");
  const [slots, setSlots] = useState<string[]>(["10:00", "14:00"]);

  const fetchProperties = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/posts?hostId=${user.uid}`);
      const result = await res.json();
      if (result.success && result.data) {
        setProperties(result.data);
      }
    } catch (err: any) {
      console.error("Failed to load properties:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProperties();
    }
  }, [user]);

  // Auto-generate slug from title
  const handleTitleChange = (val: string) => {
    setTitle(val);
    setSlug(
      val
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/--+/g, "-")
        .trim()
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    
    // Add upload placeholders
    setUploadingFiles(prev => [...prev, ...fileList.map(f => ({ name: f.name, progress: 10 }))]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        // 1. Request presigned URL from /api/media/presign
        const presignRes = await fetch("/api/media/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostId: user?.uid || "mock_admin",
            filename: file.name,
            contentType: file.type,
            propertyId: slug || "draft"
          })
        });

        if (!presignRes.ok) throw new Error("Failed to get presigned URL");
        const { presignedUrl, publicUrl } = await presignRes.json();

        // Update progress to 50%
        setUploadingFiles(prev => prev.map(item => item.name === file.name ? { ...item, progress: 50 } : item));

        // 2. PUT file content directly to presigned URL
        const uploadRes = await fetch(presignedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type
          },
          body: file
        });

        if (!uploadRes.ok) throw new Error("Failed to upload image file");

        // Add publicUrl to images state
        setImages(prev => [...prev, publicUrl]);
        
        // Remove from uploading files list
        setUploadingFiles(prev => prev.filter(item => item.name !== file.name));
      } catch (err: any) {
        console.error("Upload failed for file:", file.name, err);
        setStatusMessage({ type: "error", text: `Upload failed for ${file.name}: ${err.message}` });
        setUploadingFiles(prev => prev.filter(item => item.name !== file.name));
      }
    }
  };

  const handleRemoveImage = (url: string) => {
    setImages(prev => prev.filter(img => img !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !slug || !basePrice) {
      setStatusMessage({ type: "error", text: "Please fill in all fields." });
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
          "x-user-email": user?.email || ""
        },
        body: JSON.stringify({
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
          slots
        })
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || resJson.data || "Failed to create property.");
      }

      setStatusMessage({ type: "success", text: "Property created successfully!" });
      setTitle("");
      setSlug("");
      setBasePrice("");
      setAirbnbCalendarUrl("");
      setGoogleCalendarUrl("");
      setDescription("");
      setImages([]);
      setBookingType("nightly");
      setSlots(["10:00", "14:00"]);
      fetchProperties(); // reload list
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "An error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-white/10" />
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-md">
          <span className="text-4xl">🔐</span>
          <h2 className="text-xl font-black text-white mt-4">Access Denied</h2>
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
            Administrative privileges are required to access this portal. Please sign in with an administrator account to continue.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <a
              href="/login"
              className="w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/10"
            >
              Sign In as Admin
            </a>
            <a
              href="/"
              className="w-full rounded-xl bg-white/5 border border-white/10 py-3 text-center text-xs font-bold text-zinc-300 hover:text-white transition-all"
            >
              Back to Home
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-teal-500/30 selection:text-teal-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[100px]" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
              Pro Portal
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Properties & Listings Management</p>
          </div>
          <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-400">
            🔐 Pro Access
          </span>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Create Property Form */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span>✙</span> Create New Property
            </h2>

            {statusMessage && (
              <div
                className={`mb-4 rounded-xl border p-3.5 text-center text-xs font-bold ${
                  statusMessage.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                }`}
              >
                {statusMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  Property Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Llandudno Cliffside Shack"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  Slug (Auto-generated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. llandudno-cliffside-shack"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white/60 focus:border-teal-500 focus:outline-none placeholder:text-zinc-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  {bookingType === "hourly" ? "Base Price Per Hour (ZAR)" : "Base Price Per Night (ZAR)"}
                </label>
                <input
                  type="number"
                  placeholder={bookingType === "hourly" ? "e.g. 250" : "e.g. 1500"}
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  Booking Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBookingType("nightly")}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all border ${
                      bookingType === "nightly"
                        ? "bg-teal-550/15 border-teal-500/50 text-teal-400"
                        : "bg-black/40 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    🌙 Nightly Stay
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingType("hourly")}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all border ${
                      bookingType === "hourly"
                        ? "bg-teal-550/15 border-teal-500/50 text-teal-400"
                        : "bg-black/40 border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    🕒 Time Specific (Hourly)
                  </button>
                </div>
              </div>

              {bookingType === "hourly" && (
                <div>
                  <label className="mb-2 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                    Available Time Slots
                  </label>
                  <div className="grid grid-cols-3 gap-2 bg-black/20 border border-white/10 p-3 rounded-xl">
                    {["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"].map((slotTime) => {
                      const isSelected = slots.includes(slotTime);
                      const toggleSlot = () => {
                        if (isSelected) {
                          setSlots(prev => prev.filter(s => s !== slotTime));
                        } else {
                          setSlots(prev => [...prev, slotTime].sort());
                        }
                      };
                      const [h, m] = slotTime.split(":");
                      const hourNum = parseInt(h);
                      const ampm = hourNum >= 12 ? "PM" : "AM";
                      const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
                      const label = `${displayHour}:${m} ${ampm}`;

                      return (
                        <button
                          key={slotTime}
                          type="button"
                          onClick={toggleSlot}
                          className={`rounded-lg py-1.5 px-2 text-[10px] font-bold border transition-all ${
                            isSelected
                              ? "bg-teal-500/10 border-teal-500 text-teal-400"
                              : "bg-zinc-900 border-white/5 text-zinc-500 hover:text-zinc-300"
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
                <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  Description / About Stay
                </label>
                <textarea
                  placeholder="Describe your stay, amenities, views, scenery..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-600 resize-y"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  High-Resolution Imagery
                </label>
                <div className="relative group border-2 border-dashed border-white/10 rounded-2xl p-6 hover:border-teal-500/50 bg-black/20 hover:bg-black/40 transition-all cursor-pointer text-center">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <span className="text-2xl block">📸</span>
                    <span className="text-xs font-bold text-zinc-300 block">Drag & drop files or click to upload</span>
                    <span className="text-[10px] text-zinc-550 block">PNG, JPG, WEBP up to 10MB</span>
                  </div>
                </div>

                {uploadingFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadingFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-white/5 border border-white/5 rounded-lg p-2 font-mono">
                        <span className="truncate max-w-[180px]">{file.name}</span>
                        <span className="text-teal-400 font-bold">{file.progress}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3.5">
                    {images.map((url, index) => (
                      <div key={index} className="group relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-zinc-900">
                        <img src={url} alt={`Upload ${index}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(url)}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-655 text-white rounded-full p-1 text-[8px] leading-none opacity-0 group-hover:opacity-100 transition-opacity active:scale-95 shadow-md shadow-black/50"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  Airbnb iCal URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://www.airbnb.co.za/calendar/ical/..."
                  value={airbnbCalendarUrl}
                  onChange={(e) => setAirbnbCalendarUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-600 text-xs"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                  Google Calendar iCal URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://calendar.google.com/calendar/ical/..."
                  value={googleCalendarUrl}
                  onChange={(e) => setGoogleCalendarUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-600 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-center text-xs font-bold text-white shadow-lg shadow-teal-500/20 hover:brightness-110 active:scale-95 transition-all"
              >
                {isSubmitting ? "Creating property..." : "Publish Property"}
              </button>
            </form>
          </div>

          {/* Properties List */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center justify-between">
              <span>📋 Published Properties</span>
              <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                Count: {properties.length}
              </span>
            </h2>

            {isLoading ? (
              <div className="flex flex-col items-center py-10 justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-white/10" />
              </div>
            ) : properties.length === 0 ? (
              <div className="text-center py-10 rounded-3xl border border-white/5 bg-white/5 text-zinc-500 text-xs">
                No properties published yet. Create one on the left.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 max-h-[580px] overflow-y-auto pr-1">
                {properties.map((p) => (
                  <div
                    key={p.id}
                    className="group rounded-2xl border border-white/5 bg-white/5 p-4 flex flex-col gap-2 hover:border-white/10 hover:bg-white/10 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {p.images && p.images.length > 0 ? (
                          <img
                            src={p.images[0]}
                            alt={p.title}
                            className="w-10 h-10 rounded-lg object-cover bg-zinc-800 border border-white/10 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center text-xs text-zinc-600 shrink-0">
                            📷
                          </div>
                        )}
                        <div>
                          <h3 className="text-sm font-bold text-white">{p.title}</h3>
                          <span className="text-[10px] text-zinc-550 block font-mono">
                            id: {p.id} | slug: {p.slug} | {p.bookingType === "hourly" ? `🕒 Hourly Slots: ${(p.slots || []).join(", ")}` : "🌙 Nightly"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-550">
                          {p.bookingType === "hourly" ? "Price/Hour" : "Price/Night"}
                        </span>
                        <p className="text-sm font-black text-teal-400">
                          R {p.basePricePerNight.toLocaleString()}{p.bookingType === "hourly" ? "/hr" : ""}
                        </p>
                      </div>
                    </div>

                    {p.description && (
                      <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-normal italic">
                        {p.description}
                      </p>
                    )}

                    {(p.airbnbCalendarUrl || p.googleCalendarUrl) && (
                      <div className="border-t border-white/5 pt-2 mt-1 space-y-1 text-[9px] text-zinc-500 font-mono">
                        {p.airbnbCalendarUrl && (
                          <div className="truncate" title={p.airbnbCalendarUrl}>
                            <span className="text-teal-400 font-bold">Airbnb:</span> {p.airbnbCalendarUrl}
                          </div>
                        )}
                        {p.googleCalendarUrl && (
                          <div className="truncate" title={p.googleCalendarUrl}>
                            <span className="text-emerald-400 font-bold">Google:</span> {p.googleCalendarUrl}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-bold">Edit Config</span>
                      <Link
                        href={`/admin/properties/${p.id}`}
                        className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 text-[10px] font-bold text-teal-400 hover:bg-teal-500 hover:text-white transition-all active:scale-95"
                      >
                        Edit Details →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

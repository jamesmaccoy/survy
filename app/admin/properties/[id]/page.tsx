"use client";

import React, { useState, useEffect, use, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth";

interface Property {
  id: string;
  title: string;
  slug: string;
  basePricePerNight: number;
  airbnbCalendarUrl?: string;
  googleCalendarUrl?: string;
  description?: string;
  images?: string[];
  hostId?: string;
  bookingType?: string;
  slots?: string[];
  location?: string;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
}

function EditPropertyContent({ id }: { id: string }) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const isNew = id === "new";

  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  useEffect(() => {
    const fetchProperty = async () => {
      if (isNew) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/posts/${id}`);
        const result = await res.json();
        if (result.success && result.data) {
          setProperty(result.data);
          setTitle(result.data.title || result.data.name || "");
          setSlug(result.data.slug || "");
          setBasePrice(
            result.data.basePricePerNight
              ? String(result.data.basePricePerNight)
              : ""
          );
          setAirbnbCalendarUrl(result.data.airbnbCalendarUrl || "");
          setGoogleCalendarUrl(result.data.googleCalendarUrl || "");
          setDescription(result.data.description || "");
          setImages(result.data.images || []);
          setBookingType(result.data.bookingType || "nightly");
          setSlots(result.data.slots || ["10:00", "14:00"]);
          setLocation(result.data.location || "");
        } else {
          setStatusMessage({
            type: "error",
            text: result.error || "Property not found.",
          });
        }
      } catch (err: unknown) {
        console.error("Failed to load property details:", err);
        setStatusMessage({
          type: "error",
          text: "Failed to load property details.",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperty();
  }, [id, isNew]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (isNew) {
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
            propertyId: isNew ? slug || "draft" : id,
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
        const errorMessage =
          err instanceof Error ? err.message : "Upload error";
        console.error("Upload failed for file:", file.name, err);
        setStatusMessage({
          type: "error",
          text: `Upload failed for ${file.name}: ${errorMessage}`,
        });
      } finally {
        setUploadingFiles((prev) =>
          prev.filter((item) => item.id !== uploadId)
        );
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
      setStatusMessage({
        type: "error",
        text: "Please fill in all required fields.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const url = isNew ? "/api/posts" : `/api/posts/${id}`;
      const method = isNew ? "POST" : "PUT";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
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
          bookingType,
          slots: bookingType === "hourly" ? slots : [],
          location,
          hostId: user?.uid,
        }),
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(
          resJson.error || resJson.data || "Failed to save property."
        );
      }

      setStatusMessage({
        type: "success",
        text: isNew
          ? "Property created successfully!"
          : "Property updated successfully!",
      });
      setTimeout(() => {
        router.push("/admin/properties");
      }, 1200);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred.";
      setStatusMessage({ type: "error", text: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    if (
      !window.confirm(
        "Are you sure you want to delete this property? All associated packages will also be deleted."
      )
    ) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/posts/${id}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
        },
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || "Failed to delete property.");
      }

      setStatusMessage({
        type: "success",
        text: "Property deleted successfully!",
      });
      setTimeout(() => {
        router.push("/admin/properties");
      }, 1200);
    } catch (err: unknown) {
      const error = err as Error;
      setStatusMessage({
        type: "error",
        text: error.message || "An error occurred.",
      });
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white flex items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-500/20" />
      </div>
    );
  }

  const hasAccess =
    isNew ||
    (user &&
      user.isAdmin &&
      (!property?.hostId ||
        property.hostId === user.uid ||
        property.hostId === "mock_admin_example_com"));

  if (!user || !user.isAdmin || !hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center shadow-sm backdrop-blur-md">
          <span className="text-4xl">🔐</span>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-4">
            Access Denied
          </h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
            Administrative privileges or listing ownership is required to access
            this portal.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Link
              href="/admin/properties"
              className="w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/10"
            >
              Back to Properties
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

      <div className="relative max-w-3xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        {/* Header Navigation */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 dark:border-white/10 pb-6 gap-4">
          <div>
            <Link
              href="/admin/properties"
              className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors mb-2 inline-flex items-center gap-1"
            >
              ← Back to Listings
            </Link>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">
              {isNew ? "Create Property Listing" : "Edit Property Configuration"}
            </h1>
          </div>
          <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 shrink-0">
            {isNew ? "✙ New Listing" : `ID: ${id}`}
          </span>
        </header>

        {/* Form Container */}
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 sm:p-8 shadow-sm backdrop-blur-md">
          {statusMessage && (
            <div
              className={`mb-6 rounded-xl border p-3.5 text-center text-xs font-bold ${statusMessage.type === "success"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
            >
              {statusMessage.text}
            </div>
          )}

          {isNew || property ? (
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* LARGER TITLE INPUT */}
              <div>
                <label className="mb-2 block text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                  Property Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Llandudno Cliffside Villa"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-black/40 px-4 py-3 text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white focus:border-teal-500 focus:bg-white dark:focus:bg-black/60 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-zinc-700 transition-all shadow-inner"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                    Slug (Auto-generated) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. llandudno-cliffside-villa"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white/80 focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                    {bookingType === "hourly"
                      ? "Base Price Per Hour (ZAR) *"
                      : "Base Price Per Night (ZAR) *"}
                  </label>
                  <input
                    type="number"
                    required
                    placeholder={bookingType === "hourly" ? "e.g. 250" : "e.g. 1500"}
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 font-mono"
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
                      🌙 Nightly Stay
                    </button>
                    <button
                      type="button"
                      onClick={() => setBookingType("hourly")}
                      className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition-all border ${bookingType === "hourly"
                          ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400"
                          : "bg-slate-100 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                      🕒 Hourly Slots
                    </button>
                  </div>
                </div>
              </div>

              {bookingType === "hourly" && (
                <div>
                  <label className="mb-2 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                    Available Time Slots
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 p-3 rounded-xl">
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
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 resize-y"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                  Property Imagery
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
                      Drag & drop new files or click to upload
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
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3.5">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                    Airbnb iCal URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.airbnb.co.za/calendar/ical/..."
                    value={airbnbCalendarUrl}
                    onChange={(e) => setAirbnbCalendarUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
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
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-center text-xs font-bold text-white shadow-lg shadow-teal-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSubmitting
                    ? isNew
                      ? "Creating property..."
                      : "Saving changes..."
                    : isNew
                      ? "Create Property"
                      : "Save Property Changes"}
                </button>

                {!isNew && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-5 py-3 text-center text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  >
                    Delete Listing
                  </button>
                )}
              </div>
            </form>
          ) : (
            <div className="text-center py-6 text-slate-500 dark:text-zinc-500 text-xs font-semibold">
              Could not retrieve property metadata.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const unwrappedParams = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-500/20" />
        </div>
      }
    >
      <EditPropertyContent id={unwrappedParams.id} />
    </Suspense>
  );
}
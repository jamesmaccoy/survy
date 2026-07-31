"use client";

import React, { useState, useEffect, use, Suspense, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth";
import {
  ArrowLeft,
  Lock,
  Moon,
  Clock,
  ImagePlus,
  X,
  Loader2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from "lucide-react";

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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIME_SLOTS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function formatSlotLabel(slotTime: string) {
  const [h, m] = slotTime.split(":");
  const hourNum = Number.parseInt(h, 10);
  const ampm = hourNum >= 12 ? "PM" : "AM";
  const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;
  return `${displayHour}:${m} ${ampm}`;
}

/** Uploads a file with real progress reporting. */
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: (progress: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(10 + Math.round((event.loaded / event.total) * 85));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage rejected the upload (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
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
  const statusRef = useRef<HTMLDivElement | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [location, setLocation] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [airbnbCalendarUrl, setAirbnbCalendarUrl] = useState("");
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [bookingType, setBookingType] = useState<"nightly" | "hourly">("nightly");
  const [slots, setSlots] = useState<string[]>(["10:00", "14:00"]);

  const isUploading = uploadingFiles.length > 0;

  const notify = useCallback((type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
  }, []);

  useEffect(() => {
    if (statusMessage) {
      statusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [statusMessage]);

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
          setSlots(
            result.data.slots?.length ? result.data.slots : ["10:00", "14:00"]
          );
          setLocation(result.data.location || "");
        } else {
          notify("error", result.error || "Property not found.");
        }
      } catch (err: unknown) {
        console.error("Failed to load property details:", err);
        notify("error", "Failed to load property details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProperty();
  }, [id, isNew, notify]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    // Only auto-fill the slug on new listings while the user hasn't edited it manually.
    if (isNew && !slugTouched) {
      setSlug(slugify(val));
    }
  };

  const processFiles = useCallback(
    async (fileList: File[]) => {
      if (fileList.length === 0) return;

      if (!user) {
        notify("error", "You must be signed in to upload images.");
        return;
      }

      const validFiles: File[] = [];
      const rejected: string[] = [];

      for (const file of fileList) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          rejected.push(`${file.name} (unsupported format)`);
        } else if (file.size > MAX_FILE_SIZE) {
          rejected.push(`${file.name} (over 10MB)`);
        } else {
          validFiles.push(file);
        }
      }

      if (rejected.length > 0) {
        notify("error", `Skipped ${rejected.length} file(s): ${rejected.join(", ")}`);
      }

      for (const file of validFiles) {
        const uploadId = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

        setUploadingFiles((prev) => [
          ...prev,
          { id: uploadId, name: file.name, progress: 5 },
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

          if (!presignRes.ok) {
            const presignError = await presignRes.json().catch(() => ({}));
            throw new Error(presignError.error || "Could not prepare the upload.");
          }
          const { presignedUrl, publicUrl } = await presignRes.json();

          setUploadingFiles((prev) =>
            prev.map((item) =>
              item.id === uploadId ? { ...item, progress: 10 } : item
            )
          );

          await uploadWithProgress(presignedUrl, file, (progress) => {
            setUploadingFiles((prev) =>
              prev.map((item) =>
                item.id === uploadId ? { ...item, progress } : item
              )
            );
          });

          setImages((prev) => (prev.includes(publicUrl) ? prev : [...prev, publicUrl]));
        } catch (err: unknown) {
          const errorMessage =
            err instanceof Error ? err.message : "Upload error";
          console.error("Upload failed for file:", file.name, err);
          notify("error", `Upload failed for ${file.name}: ${errorMessage}`);
        } finally {
          setUploadingFiles((prev) => prev.filter((item) => item.id !== uploadId));
        }
      }
    },
    [user, isNew, slug, id, notify]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);
    e.target.value = "";
    await processFiles(fileList);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files || []);
    await processFiles(dropped);
  };

  const handleRemoveImage = (url: string) => {
    setImages((prev) => prev.filter((img) => img !== url));
  };

  const validateForm = () => {
    if (!title.trim()) return "Please add a property title.";
    if (!slug.trim()) return "A slug is required.";
    if (!SLUG_PATTERN.test(slug))
      return "Slug can only contain lowercase letters, numbers and single dashes.";
    if (!basePrice.trim()) return "Please set a base price.";
    const price = Number(basePrice);
    if (!Number.isFinite(price) || price <= 0)
      return "Base price must be a number greater than zero.";
    if (bookingType === "hourly" && slots.length === 0)
      return "Select at least one available time slot for hourly bookings.";
    if (isUploading) return "Please wait for image uploads to finish.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const validationError = validateForm();
    if (validationError) {
      notify("error", validationError);
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const url = isNew ? "/api/posts" : `/api/posts/${id}`;
      const method = isNew ? "POST" : "PUT";
      const cleanTitle = title.trim();

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({
          title: cleanTitle,
          name: cleanTitle,
          slug: slug.trim().toLowerCase(),
          basePricePerNight: Number(basePrice),
          airbnbCalendarUrl: airbnbCalendarUrl.trim(),
          googleCalendarUrl: googleCalendarUrl.trim(),
          description: description.trim(),
          images,
          bookingType,
          slots: bookingType === "hourly" ? slots : [],
          location: location.trim(),
          hostId: user?.uid,
        }),
      });

      const resJson = await response.json().catch(() => ({}));

      if (!response.ok || !resJson.success) {
        if (response.status === 409) {
          throw new Error(
            "That slug is already in use. Try a different one, e.g. " +
              `${slug}-2.`
          );
        }
        throw new Error(
          resJson.error || resJson.data || "Failed to save property."
        );
      }

      notify(
        "success",
        isNew ? "Listing created successfully!" : "Listing updated successfully!"
      );
      setTimeout(() => {
        router.push("/admin/properties");
      }, 1200);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred.";
      notify("error", errorMessage);
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

      const resJson = await response.json().catch(() => ({}));
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || "Failed to delete property.");
      }

      notify("success", "Listing deleted successfully!");
      setTimeout(() => {
        router.push("/admin/properties");
      }, 1200);
    } catch (err: unknown) {
      const error = err as Error;
      notify("error", error.message || "An error occurred.");
      setIsSubmitting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-teal-500" aria-label="Loading" />
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
          <Lock className="mx-auto h-8 w-8 text-teal-500" />
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

  const submitDisabled = isSubmitting || isUploading;

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
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Listings
            </Link>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white text-balance">
              {isNew ? "Create Property Listing" : "Edit Property Configuration"}
            </h1>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 shrink-0">
            {isNew ? (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                New Listing
              </>
            ) : (
              `ID: ${id}`
            )}
          </span>
        </header>

        {/* Form Container */}
        <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 sm:p-8 shadow-sm backdrop-blur-md">
          <div ref={statusRef} aria-live="polite" role="status">
            {statusMessage && (
              <div
                className={`mb-6 flex items-center justify-center gap-2 rounded-xl border p-3.5 text-center text-xs font-bold ${
                  statusMessage.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                }`}
              >
                {statusMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span className="text-pretty">{statusMessage.text}</span>
              </div>
            )}
          </div>

          {isNew || property ? (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              {/* LARGER TITLE INPUT */}
              <div>
                <label
                  htmlFor="property-title"
                  className="mb-2 block text-xs text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider"
                >
                  Property Title *
                </label>
                <input
                  id="property-title"
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
                  <label
                    htmlFor="property-slug"
                    className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider"
                  >
                    Slug {isNew && !slugTouched ? "(Auto-generated)" : ""} *
                  </label>
                  <input
                    id="property-slug"
                    type="text"
                    required
                    inputMode="url"
                    placeholder="e.g. llandudno-cliffside-villa"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                    }}
                    onBlur={() => setSlug((prev) => slugify(prev).replace(/^-|-$/g, ""))}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white/80 focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 font-mono"
                  />
                  <p className="mt-1 text-[10px] text-slate-400 dark:text-zinc-600">
                    Lowercase letters, numbers and dashes only.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="property-location"
                    className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider"
                  >
                    Location
                  </label>
                  <input
                    id="property-location"
                    type="text"
                    placeholder="e.g. Llandudno, Cape Town"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="property-price"
                    className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider"
                  >
                    {bookingType === "hourly"
                      ? "Base Price Per Hour (ZAR) *"
                      : "Base Price Per Night (ZAR) *"}
                  </label>
                  <input
                    id="property-price"
                    type="number"
                    required
                    min={1}
                    step={1}
                    placeholder={bookingType === "hourly" ? "e.g. 250" : "e.g. 1500"}
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 font-mono"
                  />
                </div>

                <div>
                  <span className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                    Booking Type
                  </span>
                  <div className="flex gap-2" role="group" aria-label="Booking type">
                    <button
                      type="button"
                      aria-pressed={bookingType === "nightly"}
                      onClick={() => setBookingType("nightly")}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all border ${
                        bookingType === "nightly"
                          ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400"
                          : "bg-slate-100 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Moon className="h-3.5 w-3.5" />
                      Nightly Stay
                    </button>
                    <button
                      type="button"
                      aria-pressed={bookingType === "hourly"}
                      onClick={() => setBookingType("hourly")}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all border ${
                        bookingType === "hourly"
                          ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400"
                          : "bg-slate-100 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Hourly Slots
                    </button>
                  </div>
                </div>
              </div>

              {bookingType === "hourly" && (
                <div>
                  <span className="mb-2 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                    Available Time Slots *
                  </span>
                  <div
                    className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 p-3 rounded-xl"
                    role="group"
                    aria-label="Available time slots"
                  >
                    {TIME_SLOTS.map((slotTime) => {
                      const isSelected = slots.includes(slotTime);
                      const toggleSlot = () => {
                        setSlots((prev) =>
                          isSelected
                            ? prev.filter((s) => s !== slotTime)
                            : [...prev, slotTime].sort()
                        );
                      };

                      return (
                        <button
                          key={slotTime}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={toggleSlot}
                          className={`rounded-lg py-1.5 px-2 text-[10px] font-bold border transition-all ${
                            isSelected
                              ? "bg-teal-500/10 border-teal-500 text-teal-600 dark:text-teal-400"
                              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-white/5 text-slate-500 dark:text-zinc-500 hover:text-slate-800 dark:hover:text-zinc-300"
                          }`}
                        >
                          {formatSlotLabel(slotTime)}
                        </button>
                      );
                    })}
                  </div>
                  {slots.length === 0 && (
                    <p className="mt-1.5 text-[10px] font-semibold text-red-500">
                      Select at least one slot.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label
                  htmlFor="property-description"
                  className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider"
                >
                  Description / About Stay
                </label>
                <textarea
                  id="property-description"
                  placeholder="Describe your stay, amenities, views, scenery..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 resize-y"
                />
              </div>

              <div>
                <span className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                  Property Imagery
                </span>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`relative group border-2 border-dashed rounded-2xl p-6 transition-all cursor-pointer text-center ${
                    isDragging
                      ? "border-teal-500 bg-teal-500/5"
                      : "border-slate-300 dark:border-white/10 hover:border-teal-500/50 bg-slate-50 dark:bg-black/20 hover:bg-slate-100/50 dark:hover:bg-black/40"
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED_TYPES.join(",")}
                    onChange={handleFileUpload}
                    aria-label="Upload property images"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="space-y-1 pointer-events-none">
                    <ImagePlus className="mx-auto h-6 w-6 text-teal-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                      {isDragging
                        ? "Drop images to upload"
                        : "Drag & drop files or click to upload"}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-zinc-500 block">
                      PNG, JPG, WEBP up to 10MB each
                    </span>
                  </div>
                </div>

                {uploadingFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {uploadingFiles.map((file) => (
                      <div
                        key={file.id}
                        className="rounded-lg border border-slate-200 dark:border-white/5 bg-slate-100 dark:bg-white/5 p-2"
                      >
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="truncate max-w-[180px]">{file.name}</span>
                          <span className="text-teal-600 dark:text-teal-400 font-bold">
                            {file.progress}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-black/40">
                          <div
                            className="h-full rounded-full bg-teal-500 transition-all duration-200"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3.5">
                    {images.map((url, index) => (
                      <div
                        key={url}
                        className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-200 dark:bg-zinc-900"
                      >
                        <Image
                          src={url || "/placeholder.svg"}
                          alt={`${title || "Property"} photo ${index + 1}`}
                          fill
                          unoptimized
                          sizes="(max-width: 640px) 33vw, 25vw"
                          className="object-cover"
                        />
                        {index === 0 && (
                          <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            Cover
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(url)}
                          aria-label={`Remove image ${index + 1}`}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 leading-none opacity-100 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity active:scale-95 shadow-md shadow-black/20 z-10"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="airbnb-ical"
                    className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider"
                  >
                    Airbnb iCal URL (Optional)
                  </label>
                  <input
                    id="airbnb-ical"
                    type="url"
                    placeholder="https://www.airbnb.co.za/calendar/ical/..."
                    value={airbnbCalendarUrl}
                    onChange={(e) => setAirbnbCalendarUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="google-ical"
                    className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider"
                  >
                    Google Calendar iCal URL (Optional)
                  </label>
                  <input
                    id="google-ical"
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
                  disabled={submitDisabled}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white shadow-lg shadow-teal-500/20 hover:bg-teal-600 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {isUploading
                    ? "Waiting for uploads..."
                    : isSubmitting
                      ? isNew
                        ? "Creating listing..."
                        : "Saving changes..."
                      : isNew
                        ? "Create Listing"
                        : "Save Listing Changes"}
                </button>

                {!isNew && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-5 py-3 text-center text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
          <Loader2 className="h-6 w-6 animate-spin text-teal-500" aria-label="Loading" />
        </div>
      }
    >
      <EditPropertyContent id={unwrappedParams.id} />
    </Suspense>
  );
}

"use client";

import React, { useState, useEffect, use, Suspense, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Lock,
  Moon,
  Clock,
  ImagePlus,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { MandatoryRule, PropertyPackage } from "@/lib/types";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  weeklyDiscount?: number;
  monthlyDiscount?: number;
  mandatoryRules?: MandatoryRule[];
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
}

type FieldName = "title" | "slug" | "basePrice" | "slots";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/avif"];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TIME_SLOTS = ["08:00", "09:00", "10:00", "12:00", "13:00", "14:00", "16:00", "18:00"];

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

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {children}
    </div>
  );
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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const statusRef = useRef<HTMLDivElement | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [location, setLocation] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [weeklyDiscount, setWeeklyDiscount] = useState("");
  const [monthlyDiscount, setMonthlyDiscount] = useState("");
  const [airbnbCalendarUrl, setAirbnbCalendarUrl] = useState("");
  const [googleCalendarUrl, setGoogleCalendarUrl] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [bookingType, setBookingType] = useState<"nightly" | "hourly">("nightly");
  const [slots, setSlots] = useState<string[]>(["09:00", "13:00"]);

  const [activeTab, setActiveTab] = useState<"details" | "pricing">("details");
  const [mandatoryRules, setMandatoryRules] = useState<MandatoryRule[]>([]);
  const [packages, setPackages] = useState<PropertyPackage[]>([]);

  const isUploading = uploadingFiles.length > 0;

  const notify = useCallback((type: "success" | "error", text: string) => {
    setStatusMessage({ type, text });
  }, []);

  const clearFieldError = useCallback((field: FieldName) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
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
          setWeeklyDiscount(
            result.data.weeklyDiscount !== undefined
              ? String(result.data.weeklyDiscount)
              : ""
          );
          setMonthlyDiscount(
            result.data.monthlyDiscount !== undefined
              ? String(result.data.monthlyDiscount)
              : ""
          );
          setAirbnbCalendarUrl(result.data.airbnbCalendarUrl || "");
          setGoogleCalendarUrl(result.data.googleCalendarUrl || "");
          setDescription(result.data.description || "");
          setImages(result.data.images || []);
          setBookingType(result.data.bookingType || "nightly");
          setSlots(
            result.data.slots?.length ? result.data.slots : ["09:00", "13:00"]
          );
          setLocation(result.data.location || "");
          setMandatoryRules(result.data.mandatoryRules || []);

          // Fetch packages for this property
          try {
            const pkgsRes = await fetch(`/api/packages?propertyId=${id}`);
            const pkgsResult = await pkgsRes.json();
            if (pkgsResult.success && pkgsResult.data) {
              setPackages(pkgsResult.data);
            }
          } catch (pkgErr) {
            console.error("Failed to load packages for property rules:", pkgErr);
          }
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
    clearFieldError("title");
    // Only auto-fill the slug on new listings while the user hasn't edited it manually.
    if (isNew && !slugTouched) {
      setSlug(slugify(val));
      clearFieldError("slug");
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

  /** Returns per-field errors plus a summary message for the alert. */
  const validateForm = () => {
    const errors: Partial<Record<FieldName, string>> = {};

    if (!title.trim()) {
      errors.title = "Please add a property title.";
    }
    if (!slug.trim()) {
      errors.slug = "A slug is required.";
    } else if (!SLUG_PATTERN.test(slug)) {
      errors.slug = "Use lowercase letters, numbers and single dashes only.";
    }
    if (!basePrice.trim()) {
      errors.basePrice = "Please set a base price.";
    } else {
      const price = Number(basePrice);
      if (!Number.isFinite(price) || price <= 0) {
        errors.basePrice = "Base price must be a number greater than zero.";
      }
    }
    if (bookingType === "hourly" && slots.length === 0) {
      errors.slots = "Select at least one available time slot.";
    }

    const firstError = Object.values(errors)[0];
    const summary = isUploading
      ? "Please wait for image uploads to finish."
      : firstError;

    return { errors, summary };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const { errors, summary } = validateForm();
    setFieldErrors(errors);
    if (summary) {
      notify("error", summary);
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
          weeklyDiscount: weeklyDiscount ? Number(weeklyDiscount) : 0,
          monthlyDiscount: monthlyDiscount ? Number(monthlyDiscount) : 0,
          airbnbCalendarUrl: airbnbCalendarUrl.trim(),
          googleCalendarUrl: googleCalendarUrl.trim(),
          description: description.trim(),
          images,
          bookingType,
          slots: bookingType === "hourly" ? slots : [],
          location: location.trim(),
          hostId: user?.uid,
          mandatoryRules,
        }),
      });

      const resJson = await response.json().catch(() => ({}));

      if (!response.ok || !resJson.success) {
        if (response.status === 409) {
          setFieldErrors({ slug: "That slug is already in use." });
          throw new Error(
            `That slug is already in use. Try a different one, e.g. ${slug}-2.`
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
      <PageShell>
        <Spinner className="size-6 text-primary" aria-label="Loading" />
      </PageShell>
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
      <PageShell>
        <Empty className="w-full max-w-md rounded-xl border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Lock />
            </EmptyMedia>
            <EmptyTitle>Access Denied</EmptyTitle>
            <EmptyDescription>
              Administrative privileges or listing ownership is required to
              access this portal.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link href="/admin/properties" />}>
              Back to Properties
            </Button>
            <Button nativeButton={false} variant="ghost" render={<Link href="/" />}>
              Back to Home
            </Button>
          </EmptyContent>
        </Empty>
      </PageShell>
    );
  }

  const submitDisabled = isSubmitting || isUploading;

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <Button
              variant="link"
              size="sm"
              className="h-auto w-fit p-0"
              nativeButton={false}
              render={<Link href="/admin/properties" />}
            >
              <ArrowLeft data-icon="inline-start" />
              Back to Listings
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {isNew ? "Create Property Listing" : "Edit Property Configuration"}
            </h1>
          </div>
          <Badge variant="secondary" className="w-fit shrink-0">
            {isNew ? (
              <>
                <Sparkles />
                New Listing
              </>
            ) : (
              `ID: ${id}`
            )}
          </Badge>
        </header>

        <div ref={statusRef} aria-live="polite" role="status">
          {statusMessage && (
            <Alert
              variant={statusMessage.type === "success" ? "default" : "destructive"}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 />
              ) : (
                <AlertTriangle />
              )}
              <AlertTitle>
                {statusMessage.type === "success" ? "Success" : "Something needs attention"}
              </AlertTitle>
              <AlertDescription className="text-pretty">
                {statusMessage.text}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {isNew || property ? (
          <form onSubmit={handleSubmit} noValidate>
            <Card>
              <CardHeader>
                <CardTitle>
                  {activeTab === "details" ? "Listing details" : "Pricing & Rules"}
                </CardTitle>
                <CardDescription>
                  {activeTab === "details"
                    ? (isNew
                      ? "Describe the property and add photos to publish a new listing."
                      : "Update the property descriptive information, location, and imagery.")
                    : "Configure base pricing, stay discounts, and mandatory package rules."}
                </CardDescription>

                <div className="flex border-b border-border mt-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab("details")}
                    className={cn(
                      "px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-all",
                      activeTab === "details"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Listing Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("pricing")}
                    className={cn(
                      "px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-all",
                      activeTab === "pricing"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Pricing
                  </button>
                </div>
              </CardHeader>

              <CardContent>
                {activeTab === "details" ? (
                  <FieldGroup>
                  <Field data-invalid={fieldErrors.title ? true : undefined}>
                    <FieldLabel htmlFor="property-title">Property title</FieldLabel>
                    <Input
                      id="property-title"
                      placeholder="e.g. Llandudno Cliffside Villa"
                      value={title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      aria-invalid={fieldErrors.title ? true : undefined}
                    />
                    <FieldError errors={fieldErrors.title ? [{ message: fieldErrors.title }] : undefined} />
                  </Field>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field data-invalid={fieldErrors.slug ? true : undefined}>
                      <FieldLabel htmlFor="property-slug">
                        Slug{isNew && !slugTouched ? " (auto-generated)" : ""}
                      </FieldLabel>
                      <Input
                        id="property-slug"
                        inputMode="url"
                        className="font-mono"
                        placeholder="llandudno-cliffside-villa"
                        value={slug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                          clearFieldError("slug");
                        }}
                        onBlur={() => setSlug((prev) => slugify(prev).replace(/^-|-$/g, ""))}
                        aria-invalid={fieldErrors.slug ? true : undefined}
                      />
                      {fieldErrors.slug ? (
                        <FieldError errors={[{ message: fieldErrors.slug }]} />
                      ) : (
                        <FieldDescription>
                          Lowercase letters, numbers and dashes only.
                        </FieldDescription>
                      )}
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="property-location">Location</FieldLabel>
                      <Input
                        id="property-location"
                        placeholder="e.g. Llandudno, Cape Town"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      />
                    </Field>
                  </div>



                  <Field>
                    <FieldLabel htmlFor="property-description">
                      Description
                    </FieldLabel>
                    <Textarea
                      id="property-description"
                      rows={4}
                      className="resize-y leading-relaxed"
                      placeholder="Describe your stay, amenities, views, scenery..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <FieldDescription>
                      This appears on the public listing page.
                    </FieldDescription>
                  </Field>

                  <Separator />

                  <Field>
                    <FieldLabel htmlFor="property-images">
                      Property imagery
                    </FieldLabel>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      className={cn(
                        "relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                        isDragging
                          ? "border-primary bg-primary/5"
                          : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/60"
                      )}
                    >
                      <input
                        id="property-images"
                        type="file"
                        multiple
                        accept={ACCEPTED_TYPES.join(",")}
                        onChange={handleFileUpload}
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                      />
                      <div className="pointer-events-none flex flex-col items-center gap-1">
                        <ImagePlus className="size-6 text-primary" />
                        <span className="text-sm font-medium">
                          {isDragging
                            ? "Drop images to upload"
                            : "Drag & drop files or click to upload"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          PNG, JPG, WEBP up to 10MB each
                        </span>
                      </div>
                    </div>

                    {uploadingFiles.length > 0 && (
                      <div className="flex flex-col gap-2">
                        {uploadingFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex flex-col gap-1.5 rounded-lg border bg-muted/40 p-2"
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate font-mono">{file.name}</span>
                              <span className="shrink-0 font-medium text-muted-foreground">
                                {file.progress}%
                              </span>
                            </div>
                            <Progress value={file.progress} className="h-1" />
                          </div>
                        ))}
                      </div>
                    )}

                    {images.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {images.map((url, index) => (
                          <div
                            key={url}
                            className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
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
                              <Badge
                                variant="secondary"
                                className="absolute bottom-1 left-1"
                              >
                                Cover
                              </Badge>
                            )}
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="destructive"
                              onClick={() => handleRemoveImage(url)}
                              aria-label={`Remove image ${index + 1}`}
                              className="absolute top-1 right-1 z-10 bg-destructive text-destructive-foreground opacity-100 hover:bg-destructive/90 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                            >
                              <X />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </Field>

                  <Separator />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="airbnb-ical">
                        Airbnb iCal URL
                      </FieldLabel>
                      <Input
                        id="airbnb-ical"
                        type="url"
                        placeholder="https://www.airbnb.co.za/calendar/ical/..."
                        value={airbnbCalendarUrl}
                        onChange={(e) => setAirbnbCalendarUrl(e.target.value)}
                      />
                      <FieldDescription>Optional.</FieldDescription>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="google-ical">
                        Google Calendar iCal URL
                      </FieldLabel>
                      <Input
                        id="google-ical"
                        type="url"
                        placeholder="https://calendar.google.com/calendar/ical/..."
                        value={googleCalendarUrl}
                        onChange={(e) => setGoogleCalendarUrl(e.target.value)}
                      />
                      <FieldDescription>Optional.</FieldDescription>
                    </Field>
                  </div>
                </FieldGroup>
                ) : (
                  <div className="space-y-8">
                    <FieldGroup>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field data-invalid={fieldErrors.basePrice ? true : undefined}>
                          <FieldLabel htmlFor="property-price">
                            {bookingType === "hourly"
                              ? "Base price per hour"
                              : "Base price per night"}
                          </FieldLabel>
                          <InputGroup>
                            <InputGroupAddon>
                              <InputGroupText>R</InputGroupText>
                            </InputGroupAddon>
                            <InputGroupInput
                              id="property-price"
                              type="number"
                              min={1}
                              step={1}
                              className="font-mono"
                              placeholder={bookingType === "hourly" ? "250" : "1500"}
                              value={basePrice}
                              onChange={(e) => {
                                setBasePrice(e.target.value);
                                clearFieldError("basePrice");
                              }}
                              aria-invalid={fieldErrors.basePrice ? true : undefined}
                            />
                            <InputGroupAddon align="inline-end">
                              <InputGroupText>ZAR</InputGroupText>
                            </InputGroupAddon>
                          </InputGroup>
                          <FieldError errors={fieldErrors.basePrice ? [{ message: fieldErrors.basePrice }] : undefined} />
                        </Field>

                        <Field>
                          <FieldLabel htmlFor="booking-type">Booking type</FieldLabel>
                          <ToggleGroup
                            id="booking-type"
                            variant="outline"
                            className="w-full"
                            value={[bookingType]}
                            onValueChange={(value) => {
                              const next = value[0] as "nightly" | "hourly" | undefined;
                              if (next) setBookingType(next);
                            }}
                          >
                            <ToggleGroupItem value="nightly" className="flex-1">
                              <Moon />
                              Nightly stay
                            </ToggleGroupItem>
                            <ToggleGroupItem value="hourly" className="flex-1">
                              <Clock />
                              Hourly slots
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </Field>
                      </div>

                      {bookingType === "nightly" && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 border-t border-border/10 pt-4">
                          <Field>
                            <FieldLabel htmlFor="property-weekly-discount">
                              Weekly stay discount (%)
                            </FieldLabel>
                            <InputGroup>
                              <InputGroupInput
                                id="property-weekly-discount"
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                className="font-mono"
                                placeholder="10"
                                value={weeklyDiscount}
                                onChange={(e) => setWeeklyDiscount(e.target.value)}
                              />
                              <InputGroupAddon align="inline-end">
                                <InputGroupText>% off</InputGroupText>
                              </InputGroupAddon>
                            </InputGroup>
                          </Field>

                          <Field>
                            <FieldLabel htmlFor="property-monthly-discount">
                              Monthly stay discount (%)
                            </FieldLabel>
                            <InputGroup>
                              <InputGroupInput
                                id="property-monthly-discount"
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                className="font-mono"
                                placeholder="20"
                                value={monthlyDiscount}
                                onChange={(e) => setMonthlyDiscount(e.target.value)}
                              />
                              <InputGroupAddon align="inline-end">
                                <InputGroupText>% off</InputGroupText>
                              </InputGroupAddon>
                            </InputGroup>
                          </Field>
                        </div>
                      )}

                      {bookingType === "hourly" && (
                        <FieldSet data-invalid={fieldErrors.slots ? true : undefined}>
                          <FieldLegend variant="label">Available time slots</FieldLegend>
                          <ToggleGroup
                            multiple
                            variant="outline"
                            className="flex-wrap"
                            value={slots}
                            onValueChange={(value) => {
                              setSlots([...value].sort());
                              if (value.length > 0) clearFieldError("slots");
                            }}
                          >
                            {TIME_SLOTS.map((slotTime) => (
                              <ToggleGroupItem key={slotTime} value={slotTime}>
                                {formatSlotLabel(slotTime)}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                          {fieldErrors.slots ? (
                            <FieldError errors={[{ message: fieldErrors.slots }]} />
                          ) : (
                            <FieldDescription>
                              Guests can book any of the slots you select.
                            </FieldDescription>
                          )}
                        </FieldSet>
                      )}
                    </FieldGroup>

                    <Separator />

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">
                          Conditional Mandatory Packages
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Enforce selecting specific package deals when guest duration matches a stay length criteria.
                        </p>
                      </div>

                    {packages.length === 0 ? (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>No packages configured</AlertTitle>
                        <AlertDescription className="text-xs">
                          You must configure packages for this property first before setting up mandatory rules. Head to the Packages page to add some deals.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-4">
                        {mandatoryRules.length === 0 ? (
                          <div className="text-center py-6 border border-dashed rounded-xl bg-muted/20">
                            <p className="text-xs text-muted-foreground mb-2">No mandatory rules configured yet.</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setMandatoryRules([{
                                packageId: packages[0].id,
                                operator: "equals",
                                nights: 1
                              }])}
                            >
                              Add First Rule
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {mandatoryRules.map((rule, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col gap-3 p-4 border rounded-xl bg-card sm:flex-row sm:items-center"
                              >
                                <div className="flex-1">
                                  <FieldLabel className="text-xs mb-1">If stay duration is</FieldLabel>
                                  <select
                                    value={rule.operator}
                                    onChange={(e) => {
                                      const next = [...mandatoryRules];
                                      next[idx].operator = e.target.value as any;
                                      setMandatoryRules(next);
                                    }}
                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                  >
                                    <option value="equals">exactly (==)</option>
                                    <option value="greater">greater than (&gt;)</option>
                                    <option value="less">less than (&lt;)</option>
                                    <option value="greater_or_equal">greater or equal (&gt;=)</option>
                                    <option value="less_or_equal">less or equal (&lt;=)</option>
                                  </select>
                                </div>

                                <div className="w-24">
                                  <FieldLabel className="text-xs mb-1">Nights</FieldLabel>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={rule.nights}
                                    onChange={(e) => {
                                      const next = [...mandatoryRules];
                                      next[idx].nights = Math.max(1, parseInt(e.target.value) || 1);
                                      setMandatoryRules(next);
                                    }}
                                    className="w-full"
                                  />
                                </div>

                                <div className="flex-1">
                                  <FieldLabel className="text-xs mb-1">Then package is mandatory</FieldLabel>
                                  <select
                                    value={rule.packageId}
                                    onChange={(e) => {
                                      const next = [...mandatoryRules];
                                      next[idx].packageId = e.target.value;
                                      setMandatoryRules(next);
                                    }}
                                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                                  >
                                    {packages.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} (R {p.price})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  className="sm:mt-5 self-end sm:self-auto"
                                  onClick={() => setMandatoryRules(mandatoryRules.filter((_, i) => i !== idx))}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}

                            <div className="flex justify-end pt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setMandatoryRules([
                                  ...mandatoryRules,
                                  {
                                    packageId: packages[0].id,
                                    operator: "equals",
                                    nights: 1
                                  }
                                ])}
                              >
                                Add Rule
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>

              <CardFooter className="flex-col gap-3 border-t sm:flex-row">
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitDisabled}
                  className="w-full sm:flex-1"
                >
                  {isSubmitting && <Spinner data-icon="inline-start" />}
                  {isUploading
                    ? "Waiting for uploads..."
                    : isSubmitting
                      ? isNew
                        ? "Creating listing..."
                        : "Saving changes..."
                      : isNew
                        ? "Create Listing"
                        : "Save Listing Changes"}
                </Button>

                {!isNew && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          type="button"
                          size="lg"
                          variant="destructive"
                          disabled={isSubmitting}
                          className="w-full sm:w-auto"
                        />
                      }
                    >
                      <Trash2 data-icon="inline-start" />
                      Delete Listing
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes the property and every package
                          associated with it. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          variant="destructive"
                          onClick={handleDelete}
                        >
                          Delete listing
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardFooter>
            </Card>
          </form>
        ) : (
          <Empty className="rounded-xl border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertTriangle />
              </EmptyMedia>
              <EmptyTitle>Listing unavailable</EmptyTitle>
              <EmptyDescription>
                Could not retrieve property metadata for this listing.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/admin/properties" />}
              >
                Back to Listings
              </Button>
            </EmptyContent>
          </Empty>
        )}
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
        <PageShell>
          <Spinner className="size-6 text-primary" aria-label="Loading" />
        </PageShell>
      }
    >
      <EditPropertyContent id={unwrappedParams.id} />
    </Suspense>
  );
}

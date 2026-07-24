"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  images?: string[];
  description?: string;
  bookingType?: string;
  slots?: string[];
  location?: string;
}

interface Package {
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

export default function AdminPropertiesPage() {
  const { user, loading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [userPlan, setUserPlan] = useState<string>("standard");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeletingPackage, setIsDeletingPackage] = useState<string | null>(null);

  // Side sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);

  const router = useRouter();

  const handleCardClick = (e: React.MouseEvent, propertyId: string) => {
    if ((e.target as HTMLElement).closest(".packages-btn")) {
      return;
    }
    router.push(`/admin/properties/${propertyId}`);
  };

  const fetchPropertiesAndPackages = useCallback(async () => {
    if (!user) return;
    try {
      const [propsRes, pkgsRes, profileRes] = await Promise.all([
        fetch(`/api/posts?hostId=${user.uid}`),
        fetch(`/api/packages`),
        fetch(`/api/user/profile?userId=${user.uid}&email=${user.email || ""}`)
      ]);

      const propsResult = await propsRes.json();
      const pkgsResult = await pkgsRes.json();
      const profileResult = await profileRes.json();

      if (propsResult.success && propsResult.data) {
        setProperties(propsResult.data);
      }
      if (pkgsResult.success && pkgsResult.data) {
        setPackages(pkgsResult.data);
      }
      if (profileResult.success && profileResult.data) {
        setUserPlan(profileResult.data.plan || "standard");
      }
    } catch (err: unknown) {
      console.error("Failed to load properties and packages:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchPropertiesAndPackages();
    }
  }, [user, fetchPropertiesAndPackages]);

  const handleDeletePackage = async (packageId: string) => {
    if (!window.confirm("Are you sure you want to delete this package deal?")) {
      return;
    }

    setIsDeletingPackage(packageId);
    try {
      const response = await fetch(`/api/packages/${packageId}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
        },
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || "Failed to delete package.");
      }

      // Reload packages
      const pkgsRes = await fetch(`/api/packages`);
      const pkgsData = await pkgsRes.json();
      if (pkgsData.success) {
        setPackages(pkgsData.data || []);
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "An error occurred while deleting the package.");
    } finally {
      setIsDeletingPackage(null);
    }
  };

  if (loading || isLoading) {
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

  const sheetPackages = selectedProperty ? packages.filter((pkg) => pkg.propertyId === selectedProperty.id) : [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans selection:bg-teal-500/30 selection:text-teal-600 transition-colors duration-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-[10%] left-[10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        {/* Header Title & Actions */}
        <div className="border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6">
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Properties Dashboard</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Manage listings and their package entitlements</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 text-[10px] font-bold text-teal-600 dark:text-teal-400">
              ⚡ Plan: {userPlan === "pro" ? "Professional" : "Standard Pro"}
            </span>
            <Link
              href="/admin/properties/new"
              className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-xs font-bold text-white hover:brightness-110 shadow-md shadow-teal-500/10 transition-all flex items-center gap-1.5 shrink-0"
            >
              <span>✙</span> New Property
            </Link>
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 p-6 shadow-sm max-w-lg mx-auto">
            <span className="text-4xl block mb-3">🏡</span>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
              No properties published yet. Create one to get started.
            </p>
            <Link
              href="/admin/properties/new"
              className="inline-flex rounded-xl bg-teal-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-teal-655 transition-all"
            >
              ✙ Create First Property
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map((p) => {
              const propertyPackages = packages.filter((pkg) => pkg.propertyId === p.id);
              const pkgCount = propertyPackages.length;

              return (
                <div
                  key={p.id}
                  onClick={(e) => handleCardClick(e, p.id)}
                  className="group rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-md hover:border-slate-350 dark:hover:border-white/20 transition-all duration-200 cursor-pointer"
                >
                  {/* Card Top Image */}
                  <div className="relative aspect-video w-full bg-slate-200 dark:bg-zinc-900 border-b border-slate-200 dark:border-white/5">
                    {/* Booking Type Overlay Badge */}
                    <span className="absolute top-3 left-3 z-10 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 px-2.5 py-1 text-[9px] text-white font-bold uppercase tracking-wider">
                      {p.bookingType === "hourly" ? "🕒 Hourly slots" : "🌙 Nightly stay"}
                    </span>

                    {p.images && p.images.length > 0 ? (
                      <Image
                        src={p.images[0]}
                        alt={p.title}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-650 gap-1.5">
                        <span className="text-3xl">📷</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">No Imagery Uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* Card Content Body */}
                  <div className="p-5 flex-grow flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                            {p.title}
                          </h3>
                          {p.location && (
                            <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400 block mt-0.5">
                              {p.location}
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[8px] text-slate-500 dark:text-zinc-500 uppercase font-black block leading-none">
                            {p.bookingType === "hourly" ? "Rate/Hour" : "Rate/Night"}
                          </span>
                          <span className="text-sm font-black text-teal-650 dark:text-teal-400">
                            R {p.basePricePerNight.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {p.description ? (
                        <p className="text-[11px] text-slate-555 dark:text-zinc-400 line-clamp-3 leading-relaxed">
                          {p.description}
                        </p>
                      ) : (
                        <p className="text-[11px] text-slate-400 dark:text-zinc-600 italic">
                          No description specified for this property listing.
                        </p>
                      )}
                    </div>

                    {/* Card Footer Actions */}
                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProperty(p);
                          setIsSheetOpen(true);
                        }}
                        className="packages-btn rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
                      >
                        <span>📦</span> Packages ({pkgCount})
                      </button>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-all flex items-center gap-0.5">
                        Configure <span className="transform group-hover:translate-x-0.5 transition-transform">→</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Packages Left-Hand Side Sheet Sidebar */}
      {isSheetOpen && selectedProperty && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 animate-fade-in"
            onClick={() => setIsSheetOpen(false)}
          />
          {/* Sheet Container */}
          <div
            className="fixed bottom-0 left-0 w-full h-[85vh] rounded-t-3xl border-t md:top-0 md:right-0 md:bottom-auto md:left-auto md:h-full md:w-[550px] md:rounded-t-none md:border-l md:border-t-0 z-50 bg-white dark:bg-zinc-950 border-slate-200 dark:border-white/10 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out animate-sheet"
          >
            {/* Drag Handle for Mobile */}
            <div className="w-12 h-1 bg-slate-300 dark:bg-zinc-800 rounded-full mx-auto my-3 shrink-0 md:hidden" />

            {/* Sheet Header */}
            <div className="p-6 pt-3 md:pt-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold uppercase tracking-wider block">
                  Property Packages
                </span>
                <h2 className="text-base font-black text-slate-900 dark:text-white truncate max-w-[280px]">
                  {selectedProperty.title}
                </h2>
              </div>
              <button
                onClick={() => setIsSheetOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors text-lg"
              >
                ✕
              </button>
            </div>

            {/* Sheet Actions & Stats */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold">
                {sheetPackages.length} package{sheetPackages.length === 1 ? "" : "s"} configured
              </span>
              <Link
                href={`/admin/packages/new?propertyId=${selectedProperty.id}`}
                className="rounded-lg bg-teal-500 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-teal-600 transition-all flex items-center gap-1 shadow-sm shadow-teal-500/15"
              >
                <span>✙</span> Add Package
              </Link>
            </div>

            {/* Sheet Packages List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {sheetPackages.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-zinc-650 italic text-xs">
                  No packages configured for this property listing.
                </div>
              ) : (
                sheetPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/10 p-4 space-y-3 shadow-sm hover:border-slate-350 dark:hover:border-white/20 transition-all"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={`inline-block rounded px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide border ${pkg.category === "standard"
                            ? "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400"
                            : "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                            }`}>
                            {pkg.category}
                          </span>
                          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white mt-1.5">
                            {pkg.name}
                          </h4>
                          <span className="text-[8px] text-slate-400 dark:text-zinc-500 font-mono block">
                            id: {pkg.id}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[8px] text-slate-400 dark:text-zinc-500 uppercase font-bold block">Rate</span>
                          <span className="text-xs font-black text-teal-600 dark:text-teal-400">R {pkg.price.toLocaleString()}</span>
                        </div>
                      </div>
                      {pkg.description && (
                        <p className="text-[10px] text-slate-600 dark:text-zinc-400 leading-relaxed border-t border-slate-100 dark:border-white/5 mt-2 pt-2">
                          {pkg.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/5 pt-2.5">
                      <span className="text-[9px] text-slate-500 dark:text-zinc-500">
                        Mult: <strong className="text-slate-700 dark:text-zinc-300">{pkg.multiplier}x</strong> | Base: <strong className="text-slate-700 dark:text-zinc-300">R{pkg.baseRate}</strong>
                      </span>
                      <div className="flex gap-2">
                        <Link
                          href={`/admin/packages/${pkg.id}`}
                          className="rounded-md bg-teal-500/10 border border-teal-500/20 px-2 py-1 text-[9px] font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white transition-all"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDeletePackage(pkg.id)}
                          disabled={isDeletingPackage === pkg.id}
                          className="rounded-md bg-red-500/10 border border-red-500/20 px-2 py-1 text-[9px] font-bold text-red-650 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                        >
                          {isDeletingPackage === pkg.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Embedded sheet animations style tag */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes slideRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.25s ease-out forwards;
        }
        .animate-sheet {
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @media (min-width: 768px) {
          .animate-sheet {
            animation: slideRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        }
      `}</style>
    </div>
  );
}
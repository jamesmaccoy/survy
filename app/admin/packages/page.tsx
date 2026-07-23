"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth";
import Link from "next/link";

interface Property {
  id: string;
  title: string;
  slug: string;
  basePricePerNight: number;
  images?: string[];
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

export default function AdminPackagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [userPlan, setUserPlan] = useState<string>("standard");
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) return;
    try {
      const [propsRes, pkgsRes, profileRes] = await Promise.all([
        fetch(`/api/posts?hostId=${user.uid}`),
        fetch(`/api/packages`),
        fetch(`/api/user/profile?userId=${user.uid}&email=${user.email || ""}`)
      ]);

      const propsData = await propsRes.json();
      const pkgsData = await pkgsRes.json();
      const profileData = await profileRes.json();

      if (propsData.success) {
        setProperties(propsData.data || []);
      }
      if (pkgsData.success) {
        setPackages(pkgsData.data || []);
      }
      if (profileData.success) {
        setUserPlan(profileData.data.plan || "standard");
      }
    } catch (err: unknown) {
      console.error("Failed to load packages portal data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const handleDeletePackage = async (packageId: string) => {
    if (!window.confirm("Are you sure you want to delete this package deal?")) {
      return;
    }

    setIsDeleting(packageId);
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
      setIsDeleting(null);
    }
  };

  if (authLoading || isLoading) {
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
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-4">Access Denied</h2>
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
        <div className="absolute -bottom-[10%] right-[10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8 space-y-8">
        {/* Tab Selection & Global Actions */}
        <div className="border-b border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 sm:pb-0">
          <nav className="-mb-px flex gap-6" aria-label="Tabs">
            <Link
              href="/admin/properties"
              className="border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-705 dark:hover:text-zinc-300 hover:border-slate-300 dark:hover:border-white/20 border-b-2 py-4 px-1 text-sm font-bold flex items-center gap-2"
            >
              <span>🏢</span> Properties
            </Link>
            <Link
              href="/admin/packages"
              className="border-teal-500 text-teal-600 dark:text-teal-400 border-b-2 py-4 px-1 text-sm font-bold flex items-center gap-2"
            >
              <span>📦</span> Packages
            </Link>
          </nav>
          
          <div className="flex items-center gap-3 sm:mb-2">
            <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 text-[10px] font-bold text-teal-600 dark:text-teal-400">
              ⚡ Plan: {userPlan === "pro" ? "Professional" : "Standard Pro"}
            </span>
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 p-6 shadow-sm">
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
              You need to create a property listing before setting up package deals.
            </p>
            <Link
              href="/admin/properties"
              className="inline-flex rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-600 transition-all"
            >
              ✙ Create a Property First
            </Link>
          </div>
        ) : (
          <div className="space-y-10">
            {properties.map((property) => {
              const propertyPackages = packages.filter((pkg) => pkg.propertyId === property.id);

              return (
                <div
                  key={property.id}
                  className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-md backdrop-blur-md space-y-6"
                >
                  {/* Property Card Header Info */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 dark:border-white/10 pb-4 gap-4">
                    <div className="flex items-center gap-4">
                      {property.images && property.images[0] ? (
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-200 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shrink-0">
                          <img src={property.images[0]} alt={property.title} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-zinc-900 border border-slate-200 dark:border-white/10 shrink-0 flex items-center justify-center text-xs text-slate-400 dark:text-zinc-600">
                          📷
                        </div>
                      )}
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">{property.title}</h2>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          {property.location || "Cape Town"} • Base Rate: R {property.basePricePerNight.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/admin/packages/new?propertyId=${property.id}`}
                      className="rounded-xl border border-teal-500/20 bg-teal-550/10 hover:bg-teal-500 hover:text-white px-3.5 py-2 text-xs font-bold text-teal-600 dark:text-teal-400 transition-all flex items-center gap-1 shrink-0"
                    >
                      <span>✙</span> Add Package for Listing
                    </Link>
                  </div>

                  {/* Property Packages Grid */}
                  {propertyPackages.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 dark:text-zinc-500 italic">
                      No packages configured for this property listing yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {propertyPackages.map((pkg) => (
                        <div
                          key={pkg.id}
                          className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100/30 dark:bg-black/20 p-5 flex flex-col justify-between hover:border-teal-500/30 hover:bg-slate-100/50 dark:hover:bg-white/10 shadow-sm transition-all gap-4"
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className={`inline-block rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide border ${
                                  pkg.category === "standard" 
                                    ? "bg-teal-500/10 border-teal-500/20 text-teal-600 dark:text-teal-400"
                                    : "bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400"
                                }`}>
                                  {pkg.category}
                                </span>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{pkg.name}</h3>
                                <span className="text-[9px] text-slate-500 dark:text-zinc-500 font-mono block">
                                  ID: {pkg.id}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] text-slate-550 dark:text-zinc-500 uppercase font-bold block">Rate</span>
                                <p className="text-sm font-black text-teal-600 dark:text-teal-400">R {pkg.price.toLocaleString()}</p>
                              </div>
                            </div>

                            {pkg.description && (
                              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed line-clamp-3 pt-1 border-t border-slate-200 dark:border-white/5">
                                {pkg.description}
                              </p>
                            )}
                          </div>

                          <div className="flex justify-between items-center border-t border-slate-200 dark:border-white/5 pt-3">
                            <div className="text-[10px] text-slate-500 dark:text-zinc-500">
                              Mult: <strong className="text-slate-800 dark:text-zinc-300">{pkg.multiplier}x</strong> | Base:{" "}
                              <strong className="text-slate-800 dark:text-zinc-300">R{pkg.baseRate}</strong>
                            </div>
                            <div className="flex gap-2">
                              <Link
                                href={`/admin/packages/${pkg.id}`}
                                className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white transition-all"
                              >
                                Edit
                              </Link>
                              <button
                                onClick={() => handleDeletePackage(pkg.id)}
                                disabled={isDeleting === pkg.id}
                                className="rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[10px] font-bold text-red-650 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                              >
                                {isDeleting === pkg.id ? "..." : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
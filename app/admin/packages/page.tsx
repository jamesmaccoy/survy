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
  bookingType?: string;
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
  const { user, loading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [isLoadingProps, setIsLoadingProps] = useState(true);
  const [isLoadingPkgs, setIsLoadingPkgs] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);

  // Form visibility state (hidden by default)
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form Fields
  const [pkgId, setPkgId] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [multiplier, setMultiplier] = useState("1.0");
  const [baseRate, setBaseRate] = useState("0");
  const [yocoId, setYocoId] = useState("");
  const [category, setCategory] = useState("standard");

  // Load properties when user is available
  useEffect(() => {
    const loadProperties = async () => {
      if (!user) return;
      try {
        const res = await fetch(`/api/posts?hostId=${user.uid}`);
        const result = await res.json();
        if (result.success && result.data && result.data.length > 0) {
          setProperties(result.data);
          setSelectedPropertyId(result.data[0].id);
        }
      } catch (err: unknown) {
        console.error("Failed to load properties:", err);
      } finally {
        setIsLoadingProps(false);
      }
    };
    loadProperties();
  }, [user]);

  // Auto-generate ID from package name
  const handleNameChange = (val: string) => {
    setName(val);
    if (!editingPackageId) {
      setPkgId(
        val
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "_")
          .replace(/__+/g, "_")
          .trim()
      );
    }
  };

  const startEditPackage = (pkg: Package) => {
    setEditingPackageId(pkg.id);
    setPkgId(pkg.id);
    setName(pkg.name);
    setPrice(String(pkg.price));
    setDescription(pkg.description || "");
    setMultiplier(String(pkg.multiplier));
    setBaseRate(String(pkg.baseRate));
    setYocoId(pkg.yocoId || "");
    setCategory(pkg.category || "standard");
    setStatusMessage(null);
    setIsFormOpen(true); // Automatically expand the form when editing
  };

  const resetForm = () => {
    setEditingPackageId(null);
    setName("");
    setPkgId("");
    setPrice("");
    setDescription("");
    setMultiplier("1.0");
    setBaseRate("0");
    setYocoId("");
    setCategory("standard");
    setStatusMessage(null);
  };

  const cancelEditPackage = () => {
    resetForm();
    setIsFormOpen(false);
  };

  // Load packages when selected property changes
  const fetchPackages = async (propertyId: string) => {
    if (!propertyId) return;
    setIsLoadingPkgs(true);
    try {
      const res = await fetch(`/api/packages?propertyId=${propertyId}`);
      const result = await res.json();
      if (result.success && result.data) {
        setPackages(result.data);
      }
    } catch (err: unknown) {
      console.error("Failed to fetch packages:", err);
    } finally {
      setIsLoadingPkgs(false);
    }
  };

  useEffect(() => {
    if (selectedPropertyId) {
      const timer = setTimeout(() => {
        fetchPackages(selectedPropertyId);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedPropertyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId || !name || !price || !pkgId) {
      setStatusMessage({ type: "error", text: "Please fill in all required fields." });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/packages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({
          id: pkgId,
          propertyId: selectedPropertyId,
          name,
          price: Number(price),
          description,
          multiplier: Number(multiplier),
          baseRate: Number(baseRate),
          yocoId: yocoId || pkgId,
          category,
          isEnabled: true,
        }),
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.data || `Failed to ${editingPackageId ? "update" : "create"} package.`);
      }

      setStatusMessage({
        type: "success",
        text: editingPackageId ? "Package deal updated successfully!" : "Package deal created successfully!",
      });
      resetForm();
      setIsFormOpen(false);
      fetchPackages(selectedPropertyId);
    } catch (err: unknown) {
      const error = err as Error;
      setStatusMessage({ type: "error", text: error.message || "An error occurred." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    if (!window.confirm("Are you sure you want to delete this package deal?")) {
      return;
    }

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

      fetchPackages(selectedPropertyId);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "An error occurred while deleting the package.");
    }
  };

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

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
        {/* Navigation & Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 dark:border-white/10 pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-zinc-200 dark:to-zinc-400">
              Admin Packages Portal
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Configure package deals, add-ons, and pricing tiers per property
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400">
              🔐 Admin Panel
            </span>
          </div>
        </header>

        {isLoadingProps ? (
          <div className="flex flex-col items-center py-20 justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-teal-500 border-teal-500/20" />
            <span className="mt-2 text-xs text-slate-500 dark:text-zinc-400">Loading Host Properties...</span>
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 p-6 shadow-sm">
            <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
              You need to create a property before setting up packages.
            </p>
            <Link
              href="/admin/properties"
              className="inline-flex rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-600 transition-all"
            >
              ✙ Create a Property First
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* LEFT COLUMN: LISTINGS SIDEBAR */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-zinc-300 flex items-center gap-2">
                  <span>🏢</span> Listings ({properties.length})
                </h2>
                <span className="text-[10px] text-slate-500 dark:text-zinc-500">Select to manage</span>
              </div>

              <div className="space-y-3 max-h-[750px] overflow-y-auto pr-1">
                {properties.map((prop) => {
                  const isSelected = prop.id === selectedPropertyId;
                  return (
                    <button
                      key={prop.id}
                      onClick={() => {
                        setSelectedPropertyId(prop.id);
                        cancelEditPackage();
                      }}
                      className={`w-full text-left rounded-2xl border p-4 transition-all flex items-center gap-4 ${isSelected
                          ? "border-teal-500 bg-teal-500/10 shadow-md shadow-teal-500/10"
                          : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100/50 dark:hover:bg-white/10 shadow-sm"
                        }`}
                    >
                      {/* Image Thumbnail */}
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 dark:bg-zinc-900 shrink-0 border border-slate-200 dark:border-white/10">
                        {prop.images && prop.images[0] ? (
                          <img src={prop.images[0]} alt={prop.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 dark:text-zinc-600">
                            No image
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className={`text-sm font-bold truncate ${isSelected ? "text-teal-600 dark:text-teal-300" : "text-slate-900 dark:text-white"}`}>
                            {prop.title}
                          </h3>
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                          {prop.location || "Cape Town"} • ID: {prop.id}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-white/5">
                          <span className="text-[10px] text-slate-500 dark:text-zinc-400">Base Price:</span>
                          <span className="text-xs font-black text-teal-600 dark:text-teal-400">
                            R {prop.basePricePerNight.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BODY: PACKAGE CREATION & ACTIVE PACKAGES */}
            <div className="lg:col-span-8 space-y-6">

              {/* Selected Property Banner */}
              {selectedProperty && (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm backdrop-blur-md">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400">Active Listing Focus</span>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">{selectedProperty.title}</h2>
                  </div>

                  {/* Trigger Button to show form when hidden */}
                  {!isFormOpen && (
                    <button
                      onClick={() => {
                        resetForm();
                        setIsFormOpen(true);
                      }}
                      className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-xs font-bold text-white hover:brightness-110 shadow-lg shadow-teal-500/10 transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <span>✙</span> Create New Package
                    </button>
                  )}
                </div>
              )}

              {/* Collapsible Package Creation / Edit Form */}
              {isFormOpen && (
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-xl backdrop-blur-md space-y-5 transition-all">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{editingPackageId ? "✎" : "✙"}</span>
                      {editingPackageId ? "Update Package Deal" : "Create New Package Deal"}
                    </h2>
                    <button
                      onClick={cancelEditPackage}
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                          Package Name *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Extended Shack Stay"
                          value={name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                          Document ID / Key *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. extended_shack_stay"
                          value={pkgId}
                          onChange={(e) => setPkgId(e.target.value)}
                          disabled={!!editingPackageId}
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                          Price (ZAR) *
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 7500"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                          Category
                        </label>
                        <select
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none"
                        >
                          <option value="standard" className="bg-white dark:bg-zinc-900">Standard</option>
                          <option value="hosted" className="bg-white dark:bg-zinc-900">Hosted</option>
                          <option value="addon" className="bg-white dark:bg-zinc-900">Add-on</option>
                          <option value="special" className="bg-white dark:bg-zinc-900">Special</option>
                        </select>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                          Yoco Product ID
                        </label>
                        <input
                          type="text"
                          placeholder="Defaults to Doc ID"
                          value={yocoId}
                          onChange={(e) => setYocoId(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold tracking-wider">
                          Rate Multiplier (0.1 - 3.0)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={multiplier}
                          onChange={(e) => setMultiplier(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold tracking-wider">
                          Flat Base Rate (ZAR)
                        </label>
                        <input
                          type="number"
                          value={baseRate}
                          onChange={(e) => setBaseRate(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs text-slate-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">
                        Description
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Details about what is included in this package deal..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-black/40 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-teal-500 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-zinc-600 resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-center text-xs font-extrabold text-white shadow-lg shadow-teal-500/20 hover:brightness-110 active:scale-95 transition-all"
                    >
                      {isSubmitting
                        ? editingPackageId
                          ? "Updating package..."
                          : "Creating package..."
                        : editingPackageId
                          ? "Save Package Changes"
                          : "Publish Package Deal"}
                    </button>
                  </form>
                </div>
              )}

              {/* Active Packages List for Selected Listing */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📦</span> Active Packages for Listing
                  </h2>
                  <span className="rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-0.5 text-[10px] text-slate-500 dark:text-zinc-400 font-mono shadow-sm">
                    Total: {packages.length}
                  </span>
                </div>

                {isLoadingPkgs ? (
                  <div className="flex flex-col items-center py-12 justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-teal-500/20" />
                  </div>
                ) : packages.length === 0 ? (
                  <div className="text-center py-12 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 text-slate-500 dark:text-zinc-500 text-xs flex flex-col items-center justify-center gap-3 shadow-sm">
                    <p>No active packages configured for this property yet.</p>
                    {!isFormOpen && (
                      <button
                        onClick={() => {
                          resetForm();
                          setIsFormOpen(true);
                        }}
                        className="rounded-xl bg-teal-500/10 border border-teal-500/20 px-3.5 py-2 text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white transition-all"
                      >
                        ✙ Add Your First Package
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 flex flex-col justify-between hover:border-teal-500/30 hover:bg-slate-100/50 dark:hover:bg-white/10 shadow-sm transition-all gap-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="inline-block rounded-md bg-teal-500/10 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-600 dark:text-teal-400 border border-teal-500/20">
                              {pkg.category}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1.5">{pkg.name}</h3>
                            <span className="text-[10px] text-slate-500 dark:text-zinc-500 font-mono block mt-0.5">
                              ID: {pkg.id}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-slate-500 dark:text-zinc-500 uppercase font-bold block">Rate</span>
                            <p className="text-sm font-black text-teal-600 dark:text-teal-400">R {pkg.price.toLocaleString()}</p>
                          </div>
                        </div>

                        {pkg.description && (
                          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed border-t border-slate-200 dark:border-white/5 pt-2">
                            {pkg.description}
                          </p>
                        )}

                        <div className="flex justify-between items-center border-t border-slate-200 dark:border-white/5 pt-3 mt-1">
                          <div className="text-[10px] text-slate-500 dark:text-zinc-500">
                            Mult: <strong className="text-slate-800 dark:text-zinc-300">{pkg.multiplier}x</strong> | Base:{" "}
                            <strong className="text-slate-800 dark:text-zinc-300">R{pkg.baseRate}</strong>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditPackage(pkg)}
                              className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 text-[10px] font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-500 hover:text-white transition-all active:scale-95"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePackage(pkg.id)}
                              className="rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
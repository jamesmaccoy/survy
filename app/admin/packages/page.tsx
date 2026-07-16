"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth";
import Link from "next/link";

interface Property {
  id: string;
  title: string;
  slug: string;
  basePricePerNight: number;
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
        const error = err as Error;
        console.error("Failed to load properties:", error);
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
  };

  const cancelEditPackage = () => {
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
      const error = err as Error;
      console.error("Failed to fetch packages:", error);
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
          "x-user-email": user?.email || ""
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
          isEnabled: true
        })
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.data || `Failed to ${editingPackageId ? "update" : "create"} package.`);
      }

      setStatusMessage({ 
        type: "success", 
        text: editingPackageId ? "Package deal updated successfully!" : "Package deal created successfully!" 
      });
      setEditingPackageId(null);
      setName("");
      setPkgId("");
      setPrice("");
      setDescription("");
      setMultiplier("1.0");
      setBaseRate("0");
      setYocoId("");
      setCategory("standard");
      fetchPackages(selectedPropertyId); // reload list
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
          "x-user-email": user?.email || ""
        }
      });
      
      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || "Failed to delete package.");
      }
      
      // Reload packages
      fetchPackages(selectedPropertyId);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "An error occurred while deleting the package.");
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
            <Link
              href="/login"
              className="w-full rounded-xl bg-teal-500 py-3 text-center text-xs font-bold text-white hover:bg-teal-600 transition-all shadow-md shadow-teal-500/10"
            >
              Sign In as Admin
            </Link>
            <Link
              href="/"
              className="w-full rounded-xl bg-white/5 border border-white/10 py-3 text-center text-xs font-bold text-zinc-300 hover:text-white transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-teal-500/30 selection:text-teal-200">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -bottom-[10%] right-[10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-center justify-between border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-200 to-zinc-400">
              Admin Portal
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Package Deals & Rates Configurator</p>
          </div>
          <span className="rounded-lg bg-teal-500/10 border border-teal-500/20 px-3 py-1 text-xs font-semibold text-teal-400">
            🔐 Admin Access
          </span>
        </header>

        {isLoadingProps ? (
          <div className="flex flex-col items-center py-20 justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-teal-500 border-white/10" />
            <span className="mt-2 text-xs text-zinc-550">Loading Properties Data...</span>
          </div>
        ) : properties.length === 0 ? (
          <div className="text-center py-20 rounded-3xl border border-white/5 bg-white/5 p-6">
            <p className="text-sm text-zinc-400 mb-4">You need to create a property before setting up packages.</p>
            <Link
              href="/admin/properties"
              className="inline-flex rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-teal-600 transition-all"
            >
              ✙ Create a Property First
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 items-start">
            {/* Create Package Form */}
            <div className="md:col-span-2 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-md">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>{editingPackageId ? "✎" : "✙"}</span> {editingPackageId ? "Update Package Deal" : "Add Package Deal"}
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
                    Select Target Property *
                  </label>
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    disabled={!!editingPackageId}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id} className="bg-zinc-900">
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                    Package Name *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Extended Shack Stay"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                    Document ID / Key
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. extended_shack_stay"
                    value={pkgId}
                    onChange={(e) => setPkgId(e.target.value)}
                    disabled={!!editingPackageId}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white/60 focus:border-teal-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                      Price (ZAR) *
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 7500"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                      Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                    >
                      <option value="standard" className="bg-zinc-900">Standard</option>
                      <option value="hosted" className="bg-zinc-900">Hosted</option>
                      <option value="addon" className="bg-zinc-900">Add-on</option>
                      <option value="special" className="bg-zinc-900">Special</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400 font-semibold tracking-wider">
                      Multiplier (0.1-3.0)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={multiplier}
                      onChange={(e) => setMultiplier(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-zinc-400 font-semibold tracking-wider">
                      Flat Base Rate (ZAR)
                    </label>
                    <input
                      type="number"
                      value={baseRate}
                      onChange={(e) => setBaseRate(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                    Yoco Product ID
                  </label>
                  <input
                    type="text"
                    placeholder="Defaults to Document ID"
                    value={yocoId}
                    onChange={(e) => setYocoId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-zinc-400 font-semibold uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Details about package..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white focus:border-teal-500 focus:outline-none placeholder:text-zinc-600 resize-none"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-center text-xs font-bold text-white shadow-lg shadow-teal-500/20 hover:brightness-110 active:scale-95 transition-all"
                  >
                    {isSubmitting
                      ? editingPackageId
                        ? "Updating package..."
                        : "Creating package..."
                      : editingPackageId
                      ? "Update Package Deal"
                      : "Publish Package Deal"}
                  </button>
                  {editingPackageId && (
                    <button
                      type="button"
                      onClick={cancelEditPackage}
                      className="w-full rounded-xl bg-white/5 border border-white/10 py-3 text-center text-xs font-bold text-zinc-300 hover:text-white transition-all active:scale-95"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Packages List */}
            <div className="md:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  Active Package Options
                </h2>
                <span className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
                  Count: {packages.length}
                </span>
              </div>

              {isLoadingPkgs ? (
                <div className="flex flex-col items-center py-20 justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-t-teal-500 border-white/10" />
                </div>
              ) : packages.length === 0 ? (
                <div className="text-center py-20 rounded-3xl border border-white/5 bg-white/5 text-zinc-500 text-xs">
                  No packages defined for the selected property.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 max-h-[620px] overflow-y-auto pr-1">
                  {packages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="rounded-2xl border border-white/5 bg-white/5 p-5 flex flex-col justify-between hover:border-white/10 hover:bg-white/10 transition-all gap-4"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="inline-block rounded-md bg-teal-500/10 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-teal-400">
                            category: {pkg.category}
                          </span>
                          <h3 className="text-base font-bold text-white mt-1.5">{pkg.name}</h3>
                          <span className="text-[10px] text-zinc-500 font-mono block mt-0.5">ID: {pkg.id} | Yoco ID: {pkg.yocoId}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-500">Value</span>
                          <p className="text-base font-black text-teal-400">R {pkg.price.toLocaleString()}</p>
                        </div>
                      </div>
                      
                      {pkg.description && (
                        <p className="text-xs text-zinc-400 leading-relaxed border-t border-white/5 pt-3">
                          {pkg.description}
                        </p>
                      )}

                      <div className="flex justify-between items-center border-t border-white/5 pt-3">
                        <div className="flex gap-4 text-[10px] text-zinc-500">
                          <div>Multiplier: <strong className="text-zinc-300">{pkg.multiplier}x</strong></div>
                          <div>Base Flat Rate: <strong className="text-zinc-300">R {pkg.baseRate}</strong></div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEditPackage(pkg)}
                            className="rounded bg-teal-500/10 border border-teal-500/20 px-2.5 py-1 text-[9px] font-bold text-teal-400 hover:bg-teal-500 hover:text-white transition-all active:scale-95"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePackage(pkg.id)}
                            className="rounded bg-red-500/10 border border-red-500/20 px-2.5 py-1 text-[9px] font-bold text-red-400 hover:bg-red-550 hover:text-white transition-all active:scale-95"
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
        )}
      </div>
    </div>
  );
}

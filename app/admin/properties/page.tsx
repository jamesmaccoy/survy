"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth";
import { PropertyCard } from "@/components/property-card";
import { PackageSheet } from "@/components/package-sheet";
import { OrphanedPackages } from "@/components/orphaned-package";
import { type Property, type PropertyPackage } from "@/lib/types";
import { type PackageDraft } from "@/components/package-form";
import { PlusIcon } from "lucide-react";

export default function AdminPropertiesPage() {
  const { user, loading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [packages, setPackages] = useState<PropertyPackage[]>([]);
  const [userPlan, setUserPlan] = useState<string>("standard");
  const [isLoading, setIsLoading] = useState(true);

  // Side sheet state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

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

  // bucket packages
  const { byProperty, orphaned } = useMemo(() => {
    const byProp: Record<string, PropertyPackage[]> = {};
    const orphan: Record<string, PropertyPackage[]> = {};
    const propertyIds = new Set(properties.map((p) => p.id));

    packages.forEach((pkg) => {
      const pId = pkg.propertyId;
      if (propertyIds.has(pId)) {
        if (!byProp[pId]) byProp[pId] = [];
        byProp[pId].push(pkg);
      } else {
        if (!orphan[pId]) orphan[pId] = [];
        orphan[pId].push(pkg);
      }
    });

    return { byProperty: byProp, orphaned: orphan };
  }, [properties, packages]);

  const activeProperty = properties.find((p) => p.id === selectedPropertyId) ?? null;
  const activePackages = selectedPropertyId ? (byProperty[selectedPropertyId] ?? []) : [];
  const orphanCount = Object.values(orphaned).reduce((sum, list) => sum + list.length, 0);

  const openPackagesSheet = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setIsSheetOpen(true);
  };

  const handleCreatePackage = async (propertyId: string, draft: PackageDraft) => {
    try {
      const response = await fetch("/api/packages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({
          ...draft,
          propertyId,
        }),
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.data || resJson.error || "Failed to create package.");
      }

      // Refresh packages
      const pkgsRes = await fetch(`/api/packages`);
      const pkgsData = await pkgsRes.json();
      if (pkgsData.success) {
        setPackages(pkgsData.data || []);
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "An error occurred while creating the package.");
    }
  };

  const handleUpdatePackage = async (packageId: string, draft: PackageDraft) => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;

    try {
      const response = await fetch("/api/packages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({
          ...pkg,
          ...draft,
          id: packageId,
        }),
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.data || resJson.error || "Failed to update package.");
      }

      // Refresh packages
      const pkgsRes = await fetch(`/api/packages`);
      const pkgsData = await pkgsRes.json();
      if (pkgsData.success) {
        setPackages(pkgsData.data || []);
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "An error occurred while updating the package.");
    }
  };

  const handleDeletePackage = async (packageId: string) => {
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

      // Refresh packages
      const pkgsRes = await fetch(`/api/packages`);
      const pkgsData = await pkgsRes.json();
      if (pkgsData.success) {
        setPackages(pkgsData.data || []);
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "An error occurred while deleting the package.");
    }
  };

  const handleTogglePackage = async (packageId: string, isEnabled: boolean) => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;

    try {
      const response = await fetch("/api/packages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({
          ...pkg,
          isEnabled,
        }),
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.data || resJson.error || "Failed to toggle package.");
      }

      // Refresh packages
      const pkgsRes = await fetch(`/api/packages`);
      const pkgsData = await pkgsRes.json();
      if (pkgsData.success) {
        setPackages(pkgsData.data || []);
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "An error occurred while toggling the package.");
    }
  };

  const handleReassignPackage = async (packageId: string, propertyId: string) => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;

    try {
      const response = await fetch("/api/packages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({
          ...pkg,
          propertyId,
        }),
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.data || resJson.error || "Failed to reassign package.");
      }

      // Refresh packages
      const pkgsRes = await fetch(`/api/packages`);
      const pkgsData = await pkgsRes.json();
      if (pkgsData.success) {
        setPackages(pkgsData.data || []);
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message || "An error occurred while reassigning the package.");
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
              <PlusIcon className="mr-1 size-3.5 inline-block" /> New Property
            </Link>
          </div>
        </div>

        {orphanCount > 0 && (
          <OrphanedPackages
            orphaned={orphaned}
            properties={properties}
            onReassign={handleReassignPackage}
            onDelete={handleDeletePackage}
          />
        )}

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
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                property={property}
                packages={byProperty[property.id] ?? []}
                onOpenPackages={() => openPackagesSheet(property.id)}
              />
            ))}
          </div>
        )}
      </div>

      <PackageSheet
        property={activeProperty}
        packages={activePackages}
        open={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        onCreate={handleCreatePackage}
        onUpdate={handleUpdatePackage}
        onDelete={handleDeletePackage}
        onToggle={handleTogglePackage}
        onReassign={handleReassignPackage}
        userPlan={userPlan}
      />
    </div>
  );
}
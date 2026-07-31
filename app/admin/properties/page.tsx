"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth";
import { PropertyCard } from "@/components/property-card";
import { PackageSheet } from "@/components/package-sheet";
import { SuggestedPackages } from "@/components/orphaned-package";
import { type Property, type PropertyPackage } from "@/lib/types";
import { type PackageDraft } from "@/components/package-form";
import { HouseIcon, LockIcon, PlusIcon, TriangleAlertIcon, ZapIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

export default function AdminPropertiesPage() {
  const { user, loading } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [packages, setPackages] = useState<PropertyPackage[]>([]);
  const [userPlan, setUserPlan] = useState<string>("standard");
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

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
  const byProperty = useMemo(() => {
    const byProp: Record<string, PropertyPackage[]> = {};
    const propertyIds = new Set(properties.map((p) => p.id));

    packages.forEach((pkg) => {
      const pId = pkg.propertyId;
      if (propertyIds.has(pId)) {
        if (!byProp[pId]) byProp[pId] = [];
        byProp[pId].push(pkg);
      }
    });

    return byProp;
  }, [properties, packages]);

  // Suggested packages templates from other listings
  const suggestedPackages = useMemo(() => {
    const myPropertyIds = new Set(properties.map((p) => p.id));
    const otherPkgs = packages.filter((pkg) => !myPropertyIds.has(pkg.propertyId));

    const seen = new Set<string>();
    const uniqueTemplates: PropertyPackage[] = [];

    otherPkgs.forEach((pkg) => {
      const key = `${pkg.name.toLowerCase()}-${pkg.price}-${pkg.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTemplates.push(pkg);
      }
    });

    return uniqueTemplates;
  }, [properties, packages]);

  const activeProperty = properties.find((p) => p.id === selectedPropertyId) ?? null;
  const activePackages = selectedPropertyId ? (byProperty[selectedPropertyId] ?? []) : [];

  const openPackagesSheet = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setIsSheetOpen(true);
  };

  const handleCreatePackage = async (propertyId: string, draft: PackageDraft) => {
    setActionError(null);
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
      setActionError(error.message || "An error occurred while creating the package.");
    }
  };

  const handleUpdatePackage = async (packageId: string, draft: PackageDraft) => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;

    setActionError(null);
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
      setActionError(error.message || "An error occurred while updating the package.");
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    setActionError(null);
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
      setActionError(error.message || "An error occurred while deleting the package.");
    }
  };

  const handleTogglePackage = async (packageId: string, isEnabled: boolean) => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;

    setActionError(null);
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
      setActionError(error.message || "An error occurred while toggling the package.");
    }
  };

  const handleCopyPackage = async (propertyId: string, pkg: PropertyPackage) => {
    const newId = `${pkg.id.split('_')[0]}_${propertyId}`;
    setActionError(null);
    try {
      const response = await fetch("/api/packages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.uid || "",
          "x-user-email": user?.email || "",
        },
        body: JSON.stringify({
          id: newId,
          propertyId,
          name: pkg.name,
          price: pkg.price,
          description: pkg.description,
          multiplier: pkg.multiplier,
          baseRate: pkg.baseRate,
          yocoId: pkg.yocoId ? `${pkg.yocoId.split('_')[0]}_${propertyId}` : newId,
          category: pkg.category,
          isEnabled: true,
        }),
      });

      const resJson = await response.json();
      if (!response.ok || !resJson.success) {
        throw new Error(resJson.data || resJson.error || "Failed to copy package.");
      }

      // Refresh packages
      const pkgsRes = await fetch(`/api/packages`);
      const pkgsData = await pkgsRes.json();
      if (pkgsData.success) {
        setPackages(pkgsData.data || []);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setActionError(error.message || "An error occurred while copying the package.");
    }
  };

  const handleReassignPackage = async (packageId: string, propertyId: string) => {
    const pkg = packages.find((p) => p.id === packageId);
    if (!pkg) return;

    setActionError(null);
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
      setActionError(error.message || "An error occurred while reassigning the package.");
    }
  };

  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
        <span className="sr-only">Loading properties</span>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      // The root layout already renders the <main> landmark.
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LockIcon />
                </EmptyMedia>
                <EmptyTitle>Access denied</EmptyTitle>
                <EmptyDescription>
                  Administrative privileges are required to access this portal. Please sign
                  in with an administrator account to continue.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="w-full">
                <Button
                  className="w-full"
                  nativeButton={false}
                  render={<Link href="/login" />}
                >
                  Sign in as admin
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  nativeButton={false}
                  render={<Link href="/" />}
                >
                  Back to home
                </Button>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    // The root layout already renders the <main> landmark.
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        {/* Header Title & Actions */}
        <header className="flex flex-col items-start justify-between gap-4 border-b pb-6 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-2xl font-semibold">Properties dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Manage listings and their package entitlements
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="secondary">
              <ZapIcon />
              Plan: {userPlan === "pro" ? "Professional" : "Standard Pro"}
            </Badge>
            <Button
              className="shrink-0"
              nativeButton={false}
              render={<Link href="/admin/properties/new" />}
            >
              <PlusIcon data-icon="inline-start" />
              New property
            </Button>
          </div>
        </header>

        {actionError && (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {suggestedPackages.length > 0 && (
          <SuggestedPackages
            suggested={suggestedPackages}
            properties={properties}
            onCopy={handleCopyPackage}
          />
        )}

        {properties.length === 0 ? (
          <Card className="mx-auto w-full max-w-lg">
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <HouseIcon />
                  </EmptyMedia>
                  <EmptyTitle>No properties yet</EmptyTitle>
                  <EmptyDescription>
                    No properties published yet. Create one to get started.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button
                    nativeButton={false}
                    render={<Link href="/admin/properties/new" />}
                  >
                    <PlusIcon data-icon="inline-start" />
                    Create first property
                  </Button>
                </EmptyContent>
              </Empty>
            </CardContent>
          </Card>
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

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth, AuthProvider } from "@/components/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2 } from "lucide-react";

function SubscribeContent() {
  const { user, loading } = useAuth();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubscribe = async (plan: "monthly" | "annual") => {
    if (!user) {
      setStatusMessage({ type: "error", text: "Please sign in or sign up to subscribe." });
      return;
    }

    setIsRedirecting(true);
    setStatusMessage(null);

    try {
      const amountInCents = plan === "monthly" ? 1500 : 15000;
      const res = await fetch("/api/subscribe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          plan,
          amountInCents
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to create checkout transaction.");
      }

      // Redirect to Yoco Checkout page
      window.location.href = result.redirectUrl;
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: "error", text: err.message || "An error occurred." });
      setIsRedirecting(false);
    }
  };

  // Developer Bypass to become Pro instantly (in mock mode or development)
  const handleMockBypass = async (plan: "monthly" | "annual") => {
    if (!user) return;
    setIsRedirecting(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/subscribe/mock-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, plan: "pro" })
      });
      const result = await res.json();
      if (res.ok && result.success) {
        setStatusMessage({
          type: "success",
          text: `Success! Promoted to Pro (${plan === "monthly" ? "Monthly Plan" : "Annual Plan"}). Reloading session...`
        });
        setTimeout(() => {
          window.location.href = "/admin/properties";
        }, 1500);
      } else {
        throw new Error(result.error || "Mock promotion failed");
      }
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message || "Bypass failed" });
      setIsRedirecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-16 text-center">
          <Link href="/" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to Home
          </Link>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Become a Pro
          </h1>
          <p className="mt-4 text-muted-foreground max-w-lg mx-auto">
            Choose a plan, unlock listing capabilities, and access exclusive Pro-only package deals.
          </p>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div className="mb-8 max-w-md mx-auto">
            <Alert variant={statusMessage.type === "success" ? "default" : "destructive"}>
              <AlertDescription>{statusMessage.text}</AlertDescription>
            </Alert>
          </div>
        )}

        {/* Pro User View */}
        {user && user.isAdmin ? (
          <div className="mx-auto max-w-md">
            <Card>
              <CardHeader className="text-center">
                <div className="mb-4 text-5xl">🎉</div>
                <CardTitle>You are a Pro User!</CardTitle>
                <CardDescription className="mt-2">
                  Your account has full listing capabilities, high-resolution imagery, calendar sync, and exclusive Pro-only package access.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link
                  href="/admin/properties"
                  className="block"
                >
                  <Button className="w-full">Go to Pro Dashboard</Button>
                </Link>
                <Link
                  href="/"
                  className="block"
                >
                  <Button variant="outline" className="w-full">Storefront Home</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Plan Cards Grid */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 max-w-4xl mx-auto items-stretch">
              {/* Monthly Plan */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="secondary" className="mb-3">Monthly Plan</Badge>
                      <CardTitle>Pro Monthly</CardTitle>
                    </div>
                  </div>
                  <CardDescription>Flexible month-to-month access to all Pro features.</CardDescription>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">R 15</span>
                    <span className="text-sm text-muted-foreground">/ month</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-6" />
                  <ul className="space-y-3">
                    {["Access & create exclusive Pro-only packages", "High-resolution image uploads and sharing", "Airbnb / Google Calendar sync", "Unlimited property listings & custom deals"].map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {user ? (
                    <Button
                      onClick={() => handleSubscribe("monthly")}
                      disabled={isRedirecting}
                      className="w-full"
                    >
                      {isRedirecting ? "Connecting..." : "Subscribe Monthly"}
                    </Button>
                  ) : (
                    <Link href="/login" className="w-full">
                      <Button variant="outline" className="w-full">Sign In to Subscribe</Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>

              {/* Annual Plan (Recommended) */}
              <Card className="relative border-primary/50 md:ring-1 md:ring-primary/20">
                <div className="absolute -top-3 right-4">
                  <Badge>Save R30 · 2 Months Free</Badge>
                </div>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge className="mb-3">Annual Plan</Badge>
                      <CardTitle>Pro Annual</CardTitle>
                    </div>
                  </div>
                  <CardDescription>Best value plan for serious hosts with year-round capabilities.</CardDescription>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">R 150</span>
                    <span className="text-sm text-muted-foreground">/ year</span>
                    <span className="ml-2 text-xs text-primary font-medium">(R 12.50/mo)</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-6" />
                  <ul className="space-y-3">
                    {["Access & create exclusive Pro-only packages", "High-resolution image uploads and sharing", "Airbnb / Google Calendar sync", "Unlimited property listings & custom deals", "Priority features & promotional packages"].map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {user ? (
                    <Button
                      onClick={() => handleSubscribe("annual")}
                      disabled={isRedirecting}
                      className="w-full"
                    >
                      {isRedirecting ? "Connecting..." : "Subscribe Annually"}
                    </Button>
                  ) : (
                    <Link href="/login" className="w-full">
                      <Button variant="outline" className="w-full">Sign In to Subscribe</Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
            </div>

            {/* Local Developer Bypass block */}
            {process.env.NODE_ENV !== "production" && user && (
              <Card className="mx-auto max-w-md">
                <CardHeader className="text-center">
                  <CardTitle className="text-base">🛠 Local Dev Control</CardTitle>
                  <CardDescription>
                    For testing, bypass the checkout gateway and upgrade instantly.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMockBypass("monthly")}
                    disabled={isRedirecting}
                  >
                    Bypass as Pro Monthly
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleMockBypass("annual")}
                    disabled={isRedirecting}
                  >
                    Bypass as Pro Annual
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <AuthProvider>
      <SubscribeContent />
    </AuthProvider>
  );
}

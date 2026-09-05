export interface MandatoryRule {
  packageId?: string;
  packageIds?: string[];
  operator: "equals" | "greater" | "less" | "greater_or_equal" | "less_or_equal";
  nights: number;
}

export function getRulePackageIds(rule?: MandatoryRule | null): string[] {
  if (!rule) return [];
  if (Array.isArray(rule.packageIds) && rule.packageIds.length > 0) {
    return rule.packageIds;
  }
  if (rule.packageId) {
    return [rule.packageId];
  }
  return [];
}

export interface Property {
  id: string;
  title: string;
  name?: string;
  slug: string;
  basePricePerNight: number;
  airbnbCalendarUrl?: string;
  googleCalendarUrl?: string;
  images?: string[];
  description?: string;
  bookingType?: string;
  slots?: string[];
  location?: string;
  weeklyDiscount?: number;
  monthlyDiscount?: number;
  mandatoryRules?: MandatoryRule[];
}

export interface PropertyPackage {
  id: string;
  propertyId: string;
  name: string;
  price: number;
  description: string;
  category: string;
  isEnabled: boolean;
  isPro?: boolean;
}

export type PackageCategory = "standard" | "addon" | "hosted" | "special" | "pro";

export function formatZar(value: number): string {
  return `R ${Math.round(value).toLocaleString()}`;
}

export function resolveBookingType(property: Property): "hourly" | "nightly" {
  return property.bookingType === "hourly" ? "hourly" : "nightly";
}

export function rateLabel(property: Property): string {
  return resolveBookingType(property) === "hourly" ? "Rate/Hour" : "Rate/Night";
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { formatZar, type Property, type PropertyPackage } from "@/lib/types"
import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react"

interface OrphanedPackagesProps {
  orphaned: Record<string, PropertyPackage[]>
  properties: Property[]
  onReassign: (packageId: string, propertyId: string) => void
  onDelete: (packageId: string) => void
}

export function OrphanedPackages({ orphaned, properties, onReassign, onDelete }: OrphanedPackagesProps) {
  const [expanded, setExpanded] = useState(false)
  const groups = Object.entries(orphaned)
  const total = groups.reduce((sum, [, list]) => sum + list.length, 0)

  return (
    <section className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <TriangleAlertIcon className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">
            {total} package{total === 1 ? "" : "s"} not attached to any listing
          </p>
          <p className="text-xs text-muted-foreground">
            Their <code className="font-mono">propertyId</code> matches no property, so guests never see them.
          </p>
        </div>
        <ChevronDownIcon
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-destructive/20 px-4 py-4">
          {groups.map(([rawId, list]) => (
            <div key={rawId} className="flex flex-col gap-2">
              <p className="font-mono text-[11px] font-bold text-muted-foreground">propertyId: {rawId}</p>
              {list.map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{pkg.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {pkg.id} · {formatZar(pkg.price)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {properties.map((property) => (
                      <Button
                        key={property.id}
                        variant="outline"
                        size="xs"
                        onClick={() => onReassign(pkg.id, property.id)}
                        className="font-semibold"
                      >
                        {property.title}
                      </Button>
                    ))}
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onDelete(pkg.id)}
                      className="font-semibold text-muted-foreground hover:text-destructive"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
"use client"

import { useState, useEffect } from "react"
import { formatZar, type Property, type PropertyPackage } from "@/lib/types"
import { ChevronRightIcon, SparklesIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface SuggestedPackagesProps {
  suggested: PropertyPackage[]
  properties: Property[]
  onCopy: (propertyId: string, pkg: PropertyPackage) => void
}

export function SuggestedPackages({ suggested, properties, onCopy }: SuggestedPackagesProps) {
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const total = suggested.length

  if (total === 0) return null

  return (
    <>
      <section className="mt-6 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/[0.08] transition-colors duration-200">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
        >
          <SparklesIcon className="size-4 shrink-0 text-primary animate-pulse" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">
              {total} Suggested Package Template{total === 1 ? "" : "s"} Available
            </p>
            <p className="text-xs text-muted-foreground">
              Reuse popular package configurations from other listings in the community.
            </p>
          </div>
          <ChevronRightIcon
            className="size-4 shrink-0 text-muted-foreground transition-transform"
            aria-hidden="true"
          />
        </button>
      </section>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={cn(
            "flex flex-col w-full gap-0 overflow-hidden p-0",
            isMobile ? "data-[side=bottom]:h-[80vh] rounded-t-3xl border-t" : "h-full data-[side=right]:sm:max-w-lg"
          )}
        >
          <SheetHeader className="border-b border-border px-5 pt-5 pb-4">
            <p className="text-[11px] font-bold tracking-wider uppercase text-primary">Suggested packages</p>
            <SheetTitle className="text-xl font-bold">Suggested Templates</SheetTitle>
            <SheetDescription className="text-xs">
              Reuse popular package configurations from other listings in the community.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-4">
              {suggested.map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-sm hover:border-primary/45 transition-colors"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={pkg.category === "standard" ? "secondary" : "outline"}
                          className="text-[9px] font-bold tracking-wider uppercase animate-fade-in"
                        >
                          {pkg.category === "standard" ? "Standard" : "Add-on"}
                        </Badge>
                      </div>
                      <span className="text-sm font-bold text-primary">{formatZar(pkg.price)}</span>
                    </div>
                    <h4 className="mt-2 text-sm font-bold text-foreground">{pkg.name}</h4>
                    {pkg.description ? (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {pkg.description}
                      </p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground italic">No description provided.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                    <select
                      onChange={(e) => {
                        const propId = e.target.value
                        if (propId) {
                          onCopy(propId, pkg)
                          // Reset selection
                          e.target.value = ""
                        }
                      }}
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-foreground hover:border-primary/40 transition-colors focus:outline-none cursor-pointer"
                    >
                      <option value="">➕ Use this template...</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title || p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
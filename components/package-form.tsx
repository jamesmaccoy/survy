"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatZar, type PropertyPackage } from "@/lib/types"
import { SparklesIcon } from "lucide-react"

export type PackageDraft = Omit<PropertyPackage, "propertyId">

interface PackageFormProps {
    initial?: PropertyPackage
    existingIds: string[]
    onCancel: () => void
    onSave: (draft: PackageDraft) => void
    userPlan?: string
}

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
}

export function PackageForm({ initial, existingIds, onCancel, onSave, userPlan }: PackageFormProps) {
    const isEdit = Boolean(initial)
    const [name, setName] = useState(initial?.name ?? "")
    const [description, setDescription] = useState(initial?.description ?? "")
    const [price, setPrice] = useState(String(initial?.price ?? ""))
    
    const isInitialPro = Boolean(initial?.isPro || initial?.category === "pro")
    const isInitialAddon = initial?.category === "addon"
    const [baseCategory, setBaseCategory] = useState<"standard" | "addon">(isInitialAddon ? "addon" : "standard")
    const [isPro, setIsPro] = useState<boolean>(isInitialPro)

    const derivedId = initial?.id ?? slugify(name)
    const numericPrice = Number(price) || 0
    const effective = numericPrice

    const idCollision = !isEdit && derivedId.length > 0 && existingIds.includes(derivedId)
    const nameError = name.trim().length === 0
    const priceError = numericPrice <= 0
    const canSave = !nameError && !priceError && !idCollision

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault()
        if (!canSave) return
        onSave({
            id: derivedId,
            name: name.trim(),
            description: description.trim(),
            price: numericPrice,
            category: baseCategory,
            isPro,
            isEnabled: initial?.isEnabled ?? true,
        })
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-xl border border-primary/30 bg-secondary/40 p-4"
        >
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold tracking-wider uppercase text-primary">
                    {isEdit ? "Edit package" : "New package"}
                </p>
                <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    id: {derivedId || "—"}
                </code>
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pkg-name" className="text-xs font-semibold">
                    Name
                </Label>
                <Input
                    id="pkg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Hosted stay"
                    aria-invalid={nameError || idCollision}
                />
                {idCollision && (
                    <p className="text-xs font-medium text-destructive">
                        A package with the id {`"${derivedId}"`} already exists on this property.
                    </p>
                )}
            </div>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pkg-desc" className="text-xs font-semibold">
                    Description
                </Label>
                <Textarea
                    id="pkg-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="What the guest actually receives."
                />
            </div>

            <fieldset className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                    <legend className="text-xs font-semibold text-foreground">Category</legend>
                    {isPro && (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[9px] font-bold uppercase flex items-center gap-1">
                            <SparklesIcon className="size-2.5" />
                            Pro Exclusive
                        </Badge>
                    )}
                </div>

                {/* Base Category: Standard or Add-on */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => setBaseCategory("standard")}
                        aria-pressed={baseCategory === "standard"}
                        className={cn(
                            "flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-bold tracking-wide uppercase transition-colors text-center",
                            baseCategory === "standard"
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                    >
                        <span>Standard</span>
                        <span className="text-[9px] font-normal lowercase tracking-normal opacity-80">Replaces base rate</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setBaseCategory("addon")}
                        aria-pressed={baseCategory === "addon"}
                        className={cn(
                            "flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-bold tracking-wide uppercase transition-colors text-center",
                            baseCategory === "addon"
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        )}
                    >
                        <span>Add-on</span>
                        <span className="text-[9px] font-normal lowercase tracking-normal opacity-80">Billed on top</span>
                    </button>
                </div>

                {/* Pro Tier Category Toggle */}
                <button
                    type="button"
                    onClick={() => setIsPro(!isPro)}
                    aria-pressed={isPro}
                    className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs transition-all text-left",
                        isPro
                            ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm"
                            : "border-border bg-background text-muted-foreground hover:border-amber-500/30 hover:text-foreground"
                    )}
                >
                    <div className="flex items-center gap-2.5">
                        <span className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-bold transition-colors",
                            isPro
                                ? "border-amber-500 bg-amber-500 text-black"
                                : "border-muted-foreground/40 text-transparent"
                        )}>
                            ✓
                        </span>
                        <div className="flex flex-col">
                            <span className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                Pro Category
                                {isPro && (
                                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                        ({baseCategory === "addon" ? "Add-on + Pro" : "Standard + Pro"})
                                    </span>
                                )}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-normal">
                                {isPro
                                    ? `This ${baseCategory === "addon" ? "add-on" : "standard package"} is enabled for Pro subscribers only`
                                    : `Enable to make this ${baseCategory === "addon" ? "add-on" : "standard package"} exclusive to Pro subscribers`
                                }
                            </span>
                        </div>
                    </div>

                    <Badge variant="outline" className={cn(
                        "text-[9px] uppercase font-bold shrink-0",
                        isPro ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10" : "text-muted-foreground"
                    )}>
                        {isPro ? "Pro Only" : "All Guests"}
                    </Badge>
                </button>

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {baseCategory === "standard" && !isPro && "Standard packages replace the base rate."}
                    {baseCategory === "addon" && !isPro && "Add-ons are billed on top of the booking."}
                    {baseCategory === "standard" && isPro && "Standard + Pro package: replaces the base stay rate, available exclusively to Pro subscribers."}
                    {baseCategory === "addon" && isPro && "Add-on + Pro package: billed on top of the booking, available exclusively to Pro subscribers."}
                </p>

                {userPlan === "standard" && (baseCategory === "addon" || isPro) && (
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        Note: Standard plan hosts can only create standard packages for all guests. Upgrade to Pro to publish Add-on or Pro-exclusive packages.
                    </p>
                )}
            </fieldset>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor="pkg-price" className="text-xs font-semibold">
                    Price (R)
                </Label>
                <Input
                    id="pkg-price"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    aria-invalid={priceError}
                />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
                <span className="text-xs font-semibold text-muted-foreground">Guest pays</span>
                <span className="font-mono text-sm font-bold text-foreground">{formatZar(Math.round(effective))}</span>
            </div>

            <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" size="sm" disabled={!canSave} className="font-semibold">
                    {isEdit ? "Save changes" : "Create package"}
                </Button>
            </div>
        </form>
    )
}
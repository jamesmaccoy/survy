"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { formatZar, type PackageCategory, type PropertyPackage } from "@/lib/types"

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
    const [category, setCategory] = useState<PackageCategory>((initial?.category as PackageCategory) ?? "standard")

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
            category,
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

            <fieldset className="flex flex-col gap-1.5">
                <legend className="mb-1.5 text-xs font-semibold text-foreground">Category</legend>
                <div className="grid grid-cols-3 gap-2">
                    {([
                        { value: "standard", label: "Standard", hint: "Base rate" },
                        { value: "addon", label: "Add-on", hint: "Billed on top" },
                        { value: "pro", label: "Pro Only", hint: "Pros only" },
                    ] as const).map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => setCategory(item.value)}
                            aria-pressed={category === item.value}
                            className={cn(
                                "flex flex-col items-center justify-center rounded-lg border px-2 py-2 text-xs font-bold tracking-wide uppercase transition-colors text-center",
                                category === item.value
                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                            )}
                        >
                            <span>{item.label}</span>
                            <span className="text-[9px] font-normal lowercase tracking-normal opacity-80">{item.hint}</span>
                        </button>
                    ))}
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {category === "standard" && "Standard packages replace the base rate."}
                    {category === "addon" && "Add-ons are billed on top of the booking."}
                    {category === "pro" && "Pro packages appear as available packages exclusively for Pro subscribers."}
                    {category !== "standard" && category !== "addon" && category !== "pro" && "Custom package deal."}
                </p>
                {userPlan === "standard" && category !== "standard" && (
                    <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                        Note: Standard plan hosts can only create Standard packages. Upgrade to Pro to publish Pro or Add-on packages.
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
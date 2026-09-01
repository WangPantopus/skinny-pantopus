//
//  UnboxingSampleData.swift
//  Pantopus
//
//  A17.14 — deterministic fixture for the Unboxing scan-capture flow. The
//  view-model projects this into the `.capture` / `.filed` phases; previews,
//  tests, and snapshots stay stable. Mirrors the `UB` / `SHOTS` / `SUGGEST`
//  / `ALTS` / `FACTS` / `ELF_*` consts in `docs/designs/A17/unboxing.jsx`.
//
//  Real OCR / classification / vault upload are out of scope — every value
//  here is a stub.
//

import Foundation

public enum UnboxingSampleData {
    /// The canonical four-shot capture sequence — what the lens saw, in
    /// order. The shutter appends from this sequence (cycling) so the
    /// filmstrip keeps "appending labeled shots".
    public static let captureSequence: [UnboxingShot] = [
        UnboxingShot(id: "ub-shot-unit", tag: "UNIT", label: "The machine", isMain: true),
        UnboxingShot(id: "ub-shot-box", tag: "BOX", label: "Box + barcode"),
        UnboxingShot(id: "ub-shot-receipt", tag: "RECEIPT", label: "Store receipt"),
        UnboxingShot(id: "ub-shot-label", tag: "LABEL", label: "Serial label")
    ]

    public static let facts: [OcrFact] = [
        OcrFact(
            id: "ub-fact-product",
            icon: .package,
            label: "Product",
            value: "Breville Barista Express",
            note: "BES870XL · Stainless"
        ),
        OcrFact(
            id: "ub-fact-serial",
            icon: .hash,
            label: "Serial",
            value: "BES870-22F-091473",
            isCode: true
        ),
        OcrFact(
            id: "ub-fact-purchased",
            icon: .receipt,
            label: "Purchased",
            value: "May 28, 2026 · $699.95",
            note: "Williams Sonoma · card ••4417"
        ),
        OcrFact(
            id: "ub-fact-warranty",
            icon: .shieldCheck,
            label: "Warranty until",
            value: "May 28, 2028",
            tag: OcrFactTag(text: "2-yr", tone: .success)
        )
    ]

    public static let suggestion = UnboxingDrawer(
        id: "ub-drawer-home",
        drawer: "Home",
        folder: "Warranties & Receipts",
        tint: .home,
        confidence: 96
    )

    public static let alternates: [UnboxingDrawer] = [
        UnboxingDrawer(id: "ub-drawer-me", drawer: "Me", folder: "Receipts & purchases", tint: .personal),
        UnboxingDrawer(id: "ub-drawer-biz", drawer: "Biz", folder: "Equipment & assets", tint: .business)
    ]

    public static let classifyElf = AIElfStripContent(
        headline: "Pantopus sorted this unboxing",
        summary: "I read all four shots — this is your new Breville espresso machine with its receipt and "
            + "serial label. It belongs in Home, under Warranties & Receipts. Confirm and I'll file the "
            + "photos, register the product, and set a warranty reminder.",
        bullets: [
            AIElfBullet(
                id: "ub-elf-c1",
                icon: .scanLine,
                label: "Receipt + label read",
                text: "price, date & serial pulled"
            ),
            AIElfBullet(
                id: "ub-elf-c2",
                icon: .badgeCheck,
                label: "Best match: Home",
                text: "Warranties & Receipts · 96%"
            ),
            AIElfBullet(
                id: "ub-elf-c3",
                icon: .shieldCheck,
                label: "2-year warranty",
                text: "expires May 28, 2028"
            )
        ]
    )

    public static let filedElf = AIElfStripContent(
        headline: "Filed — here's what I set up",
        summary: "All four photos are in your Vault and the espresso machine is now a tracked product in "
            + "Home. I scheduled a reminder before the warranty lapses, so you'll never lose the receipt "
            + "when you need it.",
        bullets: [
            AIElfBullet(
                id: "ub-elf-f1",
                icon: .package,
                label: "Product registered",
                text: "Breville Barista Express"
            ),
            AIElfBullet(
                id: "ub-elf-f2",
                icon: .calendarClock,
                label: "Warranty reminder",
                text: "Apr 28, 2028 · 30 days before"
            ),
            AIElfBullet(
                id: "ub-elf-f3",
                icon: .archive,
                label: "4 photos saved",
                text: "original scans kept in Vault"
            )
        ]
    )

    public static let content = UnboxingContent(
        category: "Unboxing",
        timeLabel: "Just now",
        productTitle: "Breville Barista Express",
        productSubtitle: "Espresso machine · model BES870XL",
        shots: captureSequence,
        suggestion: suggestion,
        alternates: alternates,
        facts: facts,
        filedTo: "Home › Warranties",
        filedSubtitle: "Confirmed by you · Just now",
        photosSavedLabel: "4 photos saved",
        classifyElf: classifyElf,
        filedElf: filedElf
    )
}

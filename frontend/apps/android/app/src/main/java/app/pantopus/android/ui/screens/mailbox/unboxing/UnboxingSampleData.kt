@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.unboxing

import app.pantopus.android.ui.components.OcrFact
import app.pantopus.android.ui.components.OcrFactTag
import app.pantopus.android.ui.components.OcrFactsTone
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfBullet
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * A17.14 — deterministic fixture for the Unboxing scan-capture flow.
 * Mirrors the iOS `UnboxingSampleData.swift` and the `UB` / `SHOTS` /
 * `SUGGEST` / `ALTS` / `FACTS` / `ELF_*` consts in
 * `docs/designs/A17/unboxing.jsx`. Real OCR / classification / vault upload
 * are out of scope — every value here is a stub.
 */
object UnboxingSampleData {
    /**
     * The canonical four-shot capture sequence — what the lens saw, in
     * order. The shutter appends from this sequence (cycling) so the
     * filmstrip keeps "appending labeled shots".
     */
    val captureSequence: List<UnboxingShot> =
        listOf(
            UnboxingShot(id = "ub-shot-unit", tag = "UNIT", label = "The machine", isMain = true),
            UnboxingShot(id = "ub-shot-box", tag = "BOX", label = "Box + barcode"),
            UnboxingShot(id = "ub-shot-receipt", tag = "RECEIPT", label = "Store receipt"),
            UnboxingShot(id = "ub-shot-label", tag = "LABEL", label = "Serial label"),
        )

    val facts: List<OcrFact> =
        listOf(
            OcrFact(
                icon = PantopusIcon.Package,
                label = "Product",
                value = "Breville Barista Express",
                note = "BES870XL · Stainless",
            ),
            OcrFact(
                icon = PantopusIcon.Hash,
                label = "Serial",
                value = "BES870-22F-091473",
                isCode = true,
            ),
            OcrFact(
                icon = PantopusIcon.Receipt,
                label = "Purchased",
                value = "May 28, 2026 · \$699.95",
                note = "Williams Sonoma · card ••4417",
            ),
            OcrFact(
                icon = PantopusIcon.ShieldCheck,
                label = "Warranty until",
                value = "May 28, 2028",
                tag = OcrFactTag("2-yr", OcrFactsTone.Success),
            ),
        )

    val suggestion =
        UnboxingDrawer(
            id = "ub-drawer-home",
            drawer = "Home",
            folder = "Warranties & Receipts",
            tint = UnboxingDrawerTint.Home,
            confidence = 96,
        )

    val alternates: List<UnboxingDrawer> =
        listOf(
            UnboxingDrawer(
                id = "ub-drawer-me",
                drawer = "Me",
                folder = "Receipts & purchases",
                tint = UnboxingDrawerTint.Personal,
            ),
            UnboxingDrawer(
                id = "ub-drawer-biz",
                drawer = "Biz",
                folder = "Equipment & assets",
                tint = UnboxingDrawerTint.Business,
            ),
        )

    val classifyElf =
        AIElfStripContent(
            headline = "Pantopus sorted this unboxing",
            summary =
                "I read all four shots — this is your new Breville espresso machine with its receipt and " +
                    "serial label. It belongs in Home, under Warranties & Receipts. Confirm and I'll file the " +
                    "photos, register the product, and set a warranty reminder.",
            bullets =
                listOf(
                    AIElfBullet(
                        id = "ub-elf-c1",
                        icon = PantopusIcon.ScanLine,
                        label = "Receipt + label read",
                        text = "price, date & serial pulled",
                    ),
                    AIElfBullet(
                        id = "ub-elf-c2",
                        icon = PantopusIcon.BadgeCheck,
                        label = "Best match: Home",
                        text = "Warranties & Receipts · 96%",
                    ),
                    AIElfBullet(
                        id = "ub-elf-c3",
                        icon = PantopusIcon.ShieldCheck,
                        label = "2-year warranty",
                        text = "expires May 28, 2028",
                    ),
                ),
        )

    val filedElf =
        AIElfStripContent(
            headline = "Filed — here's what I set up",
            summary =
                "All four photos are in your Vault and the espresso machine is now a tracked product in " +
                    "Home. I scheduled a reminder before the warranty lapses, so you'll never lose the receipt " +
                    "when you need it.",
            bullets =
                listOf(
                    AIElfBullet(
                        id = "ub-elf-f1",
                        icon = PantopusIcon.Package,
                        label = "Product registered",
                        text = "Breville Barista Express",
                    ),
                    AIElfBullet(
                        id = "ub-elf-f2",
                        icon = PantopusIcon.CalendarClock,
                        label = "Warranty reminder",
                        text = "Apr 28, 2028 · 30 days before",
                    ),
                    AIElfBullet(
                        id = "ub-elf-f3",
                        icon = PantopusIcon.Archive,
                        label = "4 photos saved",
                        text = "original scans kept in Vault",
                    ),
                ),
        )

    val content =
        UnboxingContent(
            category = "Unboxing",
            timeLabel = "Just now",
            productTitle = "Breville Barista Express",
            productSubtitle = "Espresso machine · model BES870XL",
            shots = captureSequence,
            suggestion = suggestion,
            alternates = alternates,
            facts = facts,
            filedTo = "Home › Warranties",
            filedSubtitle = "Confirmed by you · Just now",
            photosSavedLabel = "4 photos saved",
            classifyElf = classifyElf,
            filedElf = filedElf,
        )
}

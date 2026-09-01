@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.unboxing

import app.pantopus.android.data.api.models.mailbox.v2.UnboxingPackageDto
import app.pantopus.android.ui.components.OcrFact
import app.pantopus.android.ui.components.OcrFactTag
import app.pantopus.android.ui.components.OcrFactsTone
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfBullet
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Projects the real `MailPackage` row into [UnboxingContent].
 *
 * There is no OCR / classification route on the backend, so every value
 * here comes off the package row itself — item name, carrier, masked
 * tracking, delivery note, and the `warranty_saved` / `manual_saved`
 * flags. The drawer suggestion is not a classifier output:
 * `POST …/p2/package/:mailId/save-warranty`
 * (`backend/routes/mailboxV2Phase2.js:1260`) files to the caller's
 * Home › Warranties folder unconditionally, so that is stated as a
 * destination — with no confidence score and no re-route alternatives
 * (no route exists to honour them).
 *
 * Mirrors `UnboxingContent.live(package:sender:)` on iOS.
 */
object UnboxingProjection {
    /** Neutral shell held while the package fetch is in flight. */
    val placeholder: UnboxingContent =
        UnboxingContent(
            category = "Unboxing",
            timeLabel = "",
            productTitle = "",
            productSubtitle = "",
            shots = emptyList(),
            suggestion =
                UnboxingDrawer(
                    id = "ub-drawer-home",
                    drawer = "Home",
                    folder = "Warranties & Receipts",
                    tint = UnboxingDrawerTint.Home,
                ),
            alternates = emptyList(),
            facts = emptyList(),
            filedTo = "Home › Warranties",
            filedSubtitle = "",
            photosSavedLabel = "",
            classifyElf = AIElfStripContent(headline = "", summary = "", bullets = emptyList()),
            filedElf = AIElfStripContent(headline = "", summary = "", bullets = emptyList()),
        )

    fun photosLabel(count: Int): String = if (count == 1) "1 photo saved" else "$count photos saved"

    @Suppress("LongMethod")
    fun live(
        row: UnboxingPackageDto,
        sender: String?,
    ): UnboxingContent {
        val shots = mutableListOf<UnboxingShot>()
        row.deliveryPhotoUrl?.takeIf { it.isNotEmpty() }?.let {
            shots += UnboxingShot(id = "delivery", tag = "DELIVERY", label = "Delivery photo", isMain = true)
        }
        row.conditionPhotoUrl?.takeIf { it.isNotEmpty() }?.let {
            shots +=
                UnboxingShot(
                    id = "condition",
                    tag = "CONDITION",
                    label = "Condition photo",
                    isMain = shots.isEmpty(),
                )
        }

        val facts = mutableListOf<OcrFact>()
        row.inferredItemName?.takeIf { it.isNotEmpty() }?.let {
            facts += OcrFact(icon = PantopusIcon.Package, label = "Item", value = it)
        }
        row.carrier?.takeIf { it.isNotEmpty() }?.let {
            facts += OcrFact(icon = PantopusIcon.Truck, label = "Carrier", value = it)
        }
        row.trackingIdMasked?.takeIf { it.isNotEmpty() }?.let {
            facts +=
                OcrFact(
                    icon = PantopusIcon.Hash,
                    label = "Tracking",
                    value = it,
                    isCode = true,
                )
        }
        row.deliveryLocationNote?.takeIf { it.isNotEmpty() }?.let {
            facts += OcrFact(icon = PantopusIcon.MapPin, label = "Left at", value = it)
        }
        if (row.warrantySaved == true) {
            facts +=
                OcrFact(
                    icon = PantopusIcon.ShieldCheck,
                    label = "Warranty",
                    value = "Saved to Home › Warranties",
                    tag = OcrFactTag(text = "Saved", tone = OcrFactsTone.Success),
                )
        }
        if (row.manualSaved == true) {
            facts +=
                OcrFact(
                    icon = PantopusIcon.FileText,
                    label = "Manual",
                    value = "Saved to Home › Warranties",
                    tag = OcrFactTag(text = "Saved", tone = OcrFactsTone.Success),
                )
        }

        val subtitleParts = listOfNotNull(row.carrier, row.trackingIdMasked).filter { it.isNotEmpty() }
        val title =
            listOfNotNull(row.inferredItemName, sender).firstOrNull { it.isNotEmpty() } ?: "Your package"

        return UnboxingContent(
            category = "Unboxing",
            timeLabel = statusLabel(row.status),
            productTitle = title,
            productSubtitle = if (subtitleParts.isEmpty()) "Delivered package" else subtitleParts.joinToString(" · "),
            shots = shots,
            suggestion =
                UnboxingDrawer(
                    id = "ub-drawer-home",
                    drawer = "Home",
                    folder = "Warranties & Receipts",
                    tint = UnboxingDrawerTint.Home,
                ),
            alternates = emptyList(),
            facts = facts,
            filedTo = "Home › Warranties",
            filedSubtitle = if (row.warrantySaved == true) "Confirmed by you" else "",
            photosSavedLabel = photosLabel(shots.size),
            classifyElf =
                AIElfStripContent(
                    headline = "Ready to file this delivery",
                    summary =
                        "Confirm and Pantopus saves the warranty paperwork to your Home › Warranties " +
                            "folder and marks this unboxing complete. Condition photos you take here attach " +
                            "to the package record.",
                    bullets =
                        listOf(
                            AIElfBullet(
                                id = "ub-elf-c1",
                                icon = PantopusIcon.FolderLock,
                                label = "Files to Home",
                                text = "Warranties",
                            ),
                            AIElfBullet(
                                id = "ub-elf-c2",
                                icon = PantopusIcon.Camera,
                                label = "Condition photos",
                                text = photosLabel(shots.size),
                            ),
                            AIElfBullet(
                                id = "ub-elf-c3",
                                icon = PantopusIcon.UsersRound,
                                label = "Need a hand?",
                                text = "post an assembly task",
                            ),
                        ),
                ),
            filedElf =
                AIElfStripContent(
                    headline = "Filed to your Home drawer",
                    summary =
                        "The paperwork for this delivery is in Home › Warranties and the unboxing is " +
                            "marked complete on the package record.",
                    bullets =
                        listOf(
                            AIElfBullet(
                                id = "ub-elf-f1",
                                icon = PantopusIcon.FolderLock,
                                label = "Home › Warranties",
                                text = "document saved",
                            ),
                            AIElfBullet(
                                id = "ub-elf-f2",
                                icon = PantopusIcon.Archive,
                                label = photosLabel(shots.size),
                                text = "kept on the package",
                            ),
                        ),
                ),
        )
    }

    private fun statusLabel(status: String?): String =
        when (status) {
            "delivered" -> "Delivered"
            "out_for_delivery" -> "Out for delivery"
            "in_transit" -> "In transit"
            "exception" -> "Delivery exception"
            "pre_receipt" -> "Expected"
            else -> "Package"
        }
}

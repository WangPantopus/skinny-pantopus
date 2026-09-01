@file:Suppress(
    "PackageNaming",
    "MagicNumber",
    "LongMethod",
    "LongParameterList",
    "TooManyFunctions",
    "ComplexMethod",
)

package app.pantopus.android.ui.screens.mailbox.mail_detail.variants

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.PackageBodyContent
import app.pantopus.android.ui.screens.mailbox.item_detail.PackageDeliveryStatus
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.PackageBody
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.CarrierBadge
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailContent
import app.pantopus.android.ui.screens.mailbox.mail_detail.MailDetailKeyFact
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfBullet
import app.pantopus.android.ui.screens.shared.mail_item_detail.AIElfStripContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentKind
import app.pantopus.android.ui.screens.shared.mail_item_detail.AttachmentsRowContent
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailItemDetailShell
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailOverflowItem
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailTopBarConfig
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailTopBarTrailingAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A17.8 — Package ceremonial variant of the mail item detail. Mirrors
 * iOS `PackageDetailLayout`. The body slot is the existing [PackageBody]
 * (carrier track-pill + delivery-status timeline + proof photo + handoff
 * scans + contents). The actions shelf is the "Acknowledge delivery"
 * CTA, flipping into a "Received" pill once the recipient confirms.
 */
@Composable
fun PackageDetailLayout(
    content: MailDetailContent,
    packageDetail: PackageBodyContent,
    ackInFlight: Boolean,
    onBack: () -> Unit,
    onAcknowledgeDelivery: () -> Unit,
    onOpenSenderProfile: (String) -> Unit = {},
    onSaveToVault: () -> Unit = {},
    // A17.14 — when set (and the package is delivered), the overflow
    // surfaces "Virtual unboxing", which opens the Unboxing capture flow.
    // Mirrors RN's delivered-only CTA in `src/app/mailbox/package.tsx:180`.
    onOpenUnboxing: (() -> Unit)? = null,
    // A17.8 → "Ask a Neighbor". Opens the package-gig form pre-filled from
    // this package; the flag mirrors RN's `?mode=pre|post`
    // (`src/app/mailbox/package.tsx:196-204`).
    onAskNeighbor: ((Boolean) -> Unit)? = null,
    // A17.8 → "Share ETA with household" — RN's primary package-dashboard
    // CTA (`src/app/mailbox/package.tsx:189-194`).
    onShareEta: () -> Unit = {},
    // A17.8 → "Report issue" — RN's tertiary CTA
    // (`src/app/mailbox/package.tsx:212-214`).
    onReportIssue: () -> Unit = {},
) {
    val isReceived =
        content.isAcknowledged || (packageDetail.deliveryPhoto?.isReceived == true)
    Box(modifier = Modifier.testTag("mailDetail_package")) {
        MailItemDetailShell(
            topBar =
                makeTopBar(
                    packageDetail = packageDetail,
                    content = content,
                    onBack = onBack,
                    onSaveToVault = onSaveToVault,
                    onOpenUnboxing = onOpenUnboxing,
                    onAskNeighbor = onAskNeighbor,
                    onShareEta = onShareEta,
                    onReportIssue = onReportIssue,
                ),
            aiElf = makeAIElf(packageDetail = packageDetail),
            attachments = makeAttachments(content = content),
            hero = { PackageHeroCard(content = content, packageDetail = packageDetail) },
            keyFacts = { PackageKeyFactsCard(rows = makeKeyFacts(packageDetail), packageDetail = packageDetail) },
            body = {
                PackageBody(
                    content = packageDetail,
                    isReceiveEnabled = !ackInFlight,
                    isReceiveLoading = ackInFlight,
                    isReceived = isReceived,
                    showsActions = false,
                    onReceiveAtDoor = onAcknowledgeDelivery,
                )
            },
            sender = { PackageSenderCard(content = content, packageDetail = packageDetail, onOpenProfile = onOpenSenderProfile) },
            actions = {
                PackageDetailActions(
                    isReceived = content.isAcknowledged,
                    ackInFlight = ackInFlight,
                    trackingUrl = packageDetail.trackingUrl,
                    carrier = packageDetail.carrier,
                    onConfirmPickup = onAcknowledgeDelivery,
                )
            },
        )
    }
}

private fun makeTopBar(
    packageDetail: PackageBodyContent,
    content: MailDetailContent,
    onBack: () -> Unit,
    onSaveToVault: () -> Unit,
    onOpenUnboxing: (() -> Unit)? = null,
    onAskNeighbor: ((Boolean) -> Unit)? = null,
    onShareEta: () -> Unit = {},
    onReportIssue: () -> Unit = {},
): MailTopBarConfig =
    MailTopBarConfig(
        eyebrow = packageDetail.carrier,
        trust = content.detailTrust,
        onBack = onBack,
        trailingAction =
            MailTopBarTrailingAction(
                icon = PantopusIcon.Bookmark,
                contentDescription = "Save to vault",
                onClick = onSaveToVault,
            ),
        overflowItems =
            buildList {
                // RN only offers the unboxing flow once the package is delivered.
                if (onOpenUnboxing != null && packageDetail.status == PackageDeliveryStatus.Delivered) {
                    add(
                        MailOverflowItem(
                            "unboxing",
                            PantopusIcon.ScanLine,
                            "Virtual unboxing",
                        ) { onOpenUnboxing() },
                    )
                }
                // RN offers the neighbor gig at every stage — pre-delivery
                // before the drop, post-delivery after (`package.tsx:196-204`).
                if (onAskNeighbor != null) {
                    val isPreDelivery = packageDetail.status != PackageDeliveryStatus.Delivered
                    add(
                        MailOverflowItem(
                            "askNeighbor",
                            PantopusIcon.UsersRound,
                            "Ask a Verified Neighbor",
                        ) { onAskNeighbor(isPreDelivery) },
                    )
                }
                // RN's primary package-dashboard CTA — notifies every
                // other resident that the package is on its way
                // (`package.tsx:189-194`).
                add(
                    MailOverflowItem(
                        "shareEta",
                        PantopusIcon.Send,
                        "Share ETA with household",
                    ) { onShareEta() },
                )
                add(MailOverflowItem("openMap", PantopusIcon.Map, "Track map") {})
                add(MailOverflowItem("handoff", PantopusIcon.UserPlus, "Hand-off") {})
                add(MailOverflowItem("saveToVault", PantopusIcon.Bookmark, "Save to vault") { onSaveToVault() })
                add(MailOverflowItem("archive", PantopusIcon.Archive, "Archive") {})
                add(
                    MailOverflowItem(
                        "report",
                        PantopusIcon.AlertTriangle,
                        "Report issue",
                    ) { onReportIssue() },
                )
            },
    )

private fun makeAIElf(packageDetail: PackageBodyContent): AIElfStripContent {
    val (headline, summary, bullets) =
        when (packageDetail.status) {
            PackageDeliveryStatus.Delivered ->
                Triple(
                    "Delivered to your porch",
                    "Pantopus matched the carrier's proof photo to your verified address.",
                    listOf(
                        AIElfBullet(
                            id = "proof-photo",
                            icon = PantopusIcon.Camera,
                            label = "Proof photo verified",
                            text = packageDetail.deliveryPhoto?.location,
                        ),
                        AIElfBullet(
                            id = "gps-match",
                            icon = PantopusIcon.MapPin,
                            label = "GPS match",
                            text = packageDetail.deliveryPhoto?.verificationLabel ?: "verified",
                        ),
                        AIElfBullet(id = "signature", icon = PantopusIcon.ShieldCheck, label = "No signature required"),
                    ),
                )
            PackageDeliveryStatus.OutForDelivery ->
                Triple(
                    "Out for delivery today",
                    packageDetail.statusDetail,
                    listOf(
                        AIElfBullet(
                            id = "carrier-moving",
                            icon = PantopusIcon.Package,
                            label = "Carrier is moving",
                            text = "we'll ping when scanned",
                        ),
                        AIElfBullet(id = "eta", icon = PantopusIcon.Clock, label = packageDetail.etaLine ?: "ETA pending"),
                        AIElfBullet(id = "photo", icon = PantopusIcon.ShieldCheck, label = "Delivery photo expected"),
                    ),
                )
            else ->
                Triple(
                    "Pantopus is watching this delivery",
                    "We'll surface scans and the ETA window as soon as the carrier hands off.",
                    listOf(
                        AIElfBullet(
                            id = "status",
                            icon = PantopusIcon.ArrowRight,
                            label = "In transit",
                            text = packageDetail.statusDetail,
                        ),
                        AIElfBullet(id = "eta", icon = PantopusIcon.Clock, label = packageDetail.etaLine ?: "ETA pending"),
                    ),
                )
        }
    return AIElfStripContent(headline = headline, summary = summary, bullets = bullets)
}

private fun makeAttachments(content: MailDetailContent): AttachmentsRowContent? {
    if (content.attachments.isEmpty()) return null
    val items =
        content.attachments.mapIndexed { index, name ->
            AttachmentItem(id = "att-$index", kind = AttachmentKind.Pdf, name = name)
        }
    return AttachmentsRowContent(title = "Order documents", items = items)
}

private fun makeKeyFacts(packageDetail: PackageBodyContent): List<MailDetailKeyFact> =
    // A17.8 spec: carrier · service · dimensions · weight.
    buildList {
        add(MailDetailKeyFact(icon = PantopusIcon.Package, label = "Carrier", value = packageDetail.carrier))
        packageDetail.service?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Truck, label = "Service", value = it))
        }
        packageDetail.dimensions?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Archive, label = "Dimensions", value = it))
        }
        packageDetail.weight?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Package, label = "Weight", value = it))
        }
        packageDetail.trackingNumber?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Hash, label = "Tracking", value = it))
        }
        packageDetail.etaLine?.let {
            add(MailDetailKeyFact(icon = PantopusIcon.Clock, label = "ETA", value = it))
        }
    }

@Composable
private fun PackageHeroCard(
    content: MailDetailContent,
    packageDetail: PackageBodyContent,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        Box(
            modifier =
                Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(content.category.accent),
        )
        Column(
            modifier = Modifier.padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CategoryBadge(category = content.category)
                Spacer(Modifier.weight(1f))
                content.createdAtLabel?.let { received ->
                    Text(text = received, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
                }
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                verticalAlignment = Alignment.Top,
            ) {
                CarrierBadge(carrier = packageDetail.carrier, size = 44.dp)
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = content.senderDisplayName.uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.6.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = content.title,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appText,
                        lineHeight = 24.sp,
                        modifier = Modifier.semantics { heading() },
                    )
                }
            }
            packageDetail.trackingNumber?.let { tracking ->
                Text(
                    text = tracking,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = FontFamily.Monospace,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("mailDetail_package_trackingNumber"),
                )
            }
            CarrierTrackPill(packageDetail = packageDetail)
        }
    }
}

@Composable
private fun CarrierTrackPill(packageDetail: PackageBodyContent) {
    val foreground =
        when (packageDetail.status) {
            PackageDeliveryStatus.Delivered -> PantopusColors.success
            else -> PantopusColors.primary700
        }
    val background =
        when (packageDetail.status) {
            PackageDeliveryStatus.Delivered -> PantopusColors.successBg
            else -> PantopusColors.primary50
        }
    val borderColor =
        when (packageDetail.status) {
            PackageDeliveryStatus.Delivered -> PantopusColors.successLight
            else -> PantopusColors.primary200
        }
    val badgeBg =
        when (packageDetail.status) {
            PackageDeliveryStatus.Delivered -> PantopusColors.success
            else -> PantopusColors.primary600
        }
    val badgeIcon =
        when (packageDetail.status) {
            PackageDeliveryStatus.Delivered -> PantopusIcon.CheckCircle
            PackageDeliveryStatus.OutForDelivery -> PantopusIcon.Package
            else -> PantopusIcon.ArrowRight
        }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(background)
                .border(1.dp, borderColor, RoundedCornerShape(10.dp))
                .padding(horizontal = Spacing.s2, vertical = Spacing.s2)
                .testTag("mailDetail_package_carrierPill"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(CircleShape)
                    .background(badgeBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = badgeIcon,
                contentDescription = null,
                size = 13.dp,
                tint = foreground,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = packageDetail.statusTitle,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = foreground,
            )
            packageDetail.etaLine?.let { eta ->
                Text(
                    text = eta,
                    fontSize = 10.5.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 1,
                )
            }
        }
        packageDetail.trackingNumber?.let { tracking ->
            Text(
                text = tracking.takeLast(8).uppercase(),
                fontSize = 10.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextSecondary,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(horizontal = Spacing.s2, vertical = 2.dp),
            )
        }
    }
}

@Composable
private fun CategoryBadge(category: MailItemCategory) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(category.rowBackground)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = category.icon,
            contentDescription = null,
            size = 11.dp,
            tint = category.accent,
        )
        Text(
            text = category.label,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.4.sp,
            color = category.accent,
        )
    }
}

@Composable
private fun PackageKeyFactsCard(
    rows: List<MailDetailKeyFact>,
    packageDetail: PackageBodyContent,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "SHIPMENT FACTS",
                modifier = Modifier.semantics { heading() },
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp,
                color = PantopusColors.appTextSecondary,
            )
            Spacer(Modifier.weight(1f))
            StatusBadge(status = packageDetail.status)
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        rows.forEachIndexed { index, row ->
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier =
                        Modifier
                            .size(24.dp)
                            .clip(RoundedCornerShape(Radii.sm))
                            .background(PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = row.icon,
                        contentDescription = null,
                        size = 13.dp,
                        tint = PantopusColors.appTextStrong,
                    )
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    Text(
                        text = row.label.uppercase(),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        letterSpacing = 0.4.sp,
                        color = PantopusColors.appTextSecondary,
                    )
                    Text(
                        text = row.value,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                }
            }
            if (index < rows.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun StatusBadge(status: PackageDeliveryStatus) {
    val isDelivered = status == PackageDeliveryStatus.Delivered
    Text(
        text = if (isDelivered) "DELIVERED" else "IN MOTION",
        fontSize = 9.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.5.sp,
        color = if (isDelivered) PantopusColors.success else PantopusColors.primary600,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (isDelivered) PantopusColors.successBg else PantopusColors.primary50)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
    )
}

@Composable
private fun PackageSenderCard(
    content: MailDetailContent,
    packageDetail: PackageBodyContent,
    onOpenProfile: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(enabled = content.senderUserId != null) {
                    content.senderUserId?.let(onOpenProfile)
                }
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(content.category.accent),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = content.senderInitials,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = content.senderDisplayName,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "via ${packageDetail.carrier}",
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (content.senderUserId != null) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextMuted,
            )
        }
    }
}

/**
 * A17.8 split dock: "Track on carrier" (secondary, opens the browser to
 * the carrier tracking URL) + "Confirm pickup" (primary, fires the
 * acknowledge-delivery flow). Confirm pickup flips into a "Picked up"
 * indicator once the recipient confirms. Mirrors iOS `PackageDetailActions`.
 */
@Composable
private fun PackageDetailActions(
    isReceived: Boolean,
    ackInFlight: Boolean,
    trackingUrl: String?,
    carrier: String,
    onConfirmPickup: () -> Unit,
) {
    val context = LocalContext.current
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        TrackOnCarrierButton(
            label = "Track on ${carrierShort(carrier)}",
            isEnabled = trackingUrl != null,
            onClick = {
                trackingUrl?.let { url ->
                    val intent =
                        Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(intent)
                }
            },
            modifier = Modifier.weight(1f),
        )
        ConfirmPickupButton(
            isReceived = isReceived,
            ackInFlight = ackInFlight,
            onConfirm = onConfirmPickup,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun TrackOnCarrierButton(
    label: String,
    isEnabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(14.dp))
                .alpha(if (isEnabled) 1f else 0.5f)
                .clickable(enabled = isEnabled, onClick = onClick)
                .padding(vertical = 14.dp, horizontal = Spacing.s3)
                .semantics {
                    contentDescription = label
                    role = Role.Button
                }
                .testTag("mailDetail_package_trackOnCarrier"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.ExternalLink,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextStrong,
        )
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
            maxLines = 1,
        )
    }
}

@Composable
private fun ConfirmPickupButton(
    isReceived: Boolean,
    ackInFlight: Boolean,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (isReceived) {
        Row(
            modifier =
                modifier
                    .clip(RoundedCornerShape(14.dp))
                    .background(PantopusColors.successBg)
                    .border(1.5.dp, PantopusColors.successLight, RoundedCornerShape(14.dp))
                    .clickable(onClick = onConfirm)
                    .padding(vertical = 14.dp)
                    .semantics {
                        contentDescription = "Picked up"
                        role = Role.Button
                    }
                    .testTag("mailDetail_package_received"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.success,
            )
            Spacer(Modifier.width(Spacing.s2))
            Text(
                text = "Picked up",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.success,
                maxLines = 1,
            )
        }
        return
    }
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.primary600)
                .clickable(enabled = !ackInFlight, onClick = onConfirm)
                .padding(vertical = 14.dp)
                .alpha(if (ackInFlight) 0.6f else 1f)
                .semantics {
                    contentDescription = "Confirm pickup"
                    role = Role.Button
                }
                .testTag("mailDetail_package_confirmPickup"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        if (ackInFlight) {
            CircularProgressIndicator(
                color = PantopusColors.appTextInverse,
                strokeWidth = 2.dp,
                modifier = Modifier.size(18.dp),
            )
        } else {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Spacer(Modifier.width(Spacing.s2))
        Text(
            text = "Confirm pickup",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
            maxLines = 1,
        )
    }
}

@Suppress("ReturnCount")
private fun carrierShort(carrier: String): String {
    val upper = carrier.uppercase()
    if (upper.contains("USPS")) return "USPS"
    if (upper.contains("UPS")) return "UPS"
    if (upper.contains("FEDEX")) return "FedEx"
    if (upper.contains("DHL")) return "DHL"
    return "carrier"
}

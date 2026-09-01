@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.mail_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedDetailDto
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemSampleData
import app.pantopus.android.ui.screens.mailbox.item_detail.MailTrust
import app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components.CertifiedConfirmGateBody
import app.pantopus.android.ui.screens.mailbox.mail_detail.variants.CertifiedDetailLayout
import app.pantopus.android.ui.screens.shared.mail_item_detail.MailDetailTrust
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import org.junit.Rule
import org.junit.Test

/** A17.3 Certified mail snapshots across unread, signed, and archived states. */
class CertifiedDetailSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 3600, softButtons = false),
        )

    @Test fun certified_detail_unread() {
        snapshot(
            certified = MailItemSampleData.certifiedUnread,
            readStatusLabel = "Unread",
            isAcknowledged = false,
            isArchived = false,
        )
    }

    @Test fun certified_detail_signed() {
        snapshot(
            certified = MailItemSampleData.certifiedSigned,
            readStatusLabel = "Read",
            isAcknowledged = true,
            isArchived = false,
        )
    }

    @Test fun certified_detail_archived() {
        snapshot(
            certified = MailItemSampleData.certifiedArchived,
            readStatusLabel = "Read",
            isAcknowledged = true,
            isArchived = true,
        )
    }

    private fun snapshot(
        certified: CertifiedDetailDto,
        readStatusLabel: String,
        isAcknowledged: Boolean,
        isArchived: Boolean,
    ) {
        val content =
            makeContent(
                certified = certified,
                readStatusLabel = readStatusLabel,
                isAcknowledged = isAcknowledged,
                isArchived = isArchived,
            )
        paparazzi.snapshot {
            Root {
                Box(modifier = Modifier.fillMaxSize()) {
                    CertifiedDetailLayout(
                        content = content,
                        certified = certified,
                        ackInFlight = false,
                        onBack = {},
                        onAcknowledge = {},
                        onOpenSenderProfile = {},
                        onSaveToVault = {},
                    )
                    if (readStatusLabel == "Unread" && !isAcknowledged && !isArchived) {
                        ConfirmGateSnapshotOverlay(content = content, certified = certified)
                    }
                }
            }
        }
    }

    @Composable
    private fun ConfirmGateSnapshotOverlay(
        content: MailDetailContent,
        certified: CertifiedDetailDto,
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.4f)),
            contentAlignment = Alignment.BottomCenter,
        ) {
            CertifiedConfirmGateBody(
                senderName = content.senderDisplayName,
                referenceNumber = certified.referenceNumber,
                deadlineLabel = "Tue Jun 30, 2026",
                isSigning = false,
                onReviewFirst = {},
                onSign = {},
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(topStart = Radii.xl3, topEnd = Radii.xl3))
                        .background(PantopusColors.appBg),
            )
        }
    }

    private fun makeContent(
        certified: CertifiedDetailDto,
        readStatusLabel: String,
        isAcknowledged: Boolean,
        isArchived: Boolean,
    ): MailDetailContent =
        MailDetailContent(
            mailId = if (isArchived) "certified-archived" else "certified-open",
            category = MailItemCategory.Certified,
            trust = MailTrust.Verified,
            detailTrust = MailDetailTrust.Verified,
            senderDisplayName = "Alameda County",
            senderMeta = "Treasurer-Tax Collector · Property Tax Bureau",
            senderTypeLabel = "Verified government",
            carrierLine = "via USPS Certified Mail",
            senderInitials = "AC",
            senderUserId = "sender-alameda-county",
            title = "Supplemental property tax bill — APN 048-7521-019",
            excerpt = "Payment is due Jun 30.",
            referenceLabel = certified.referenceNumber,
            createdAtLabel = "4h ago",
            expiresAtLabel = null,
            readStatusLabel = readStatusLabel,
            bodyParagraphs =
                certified.noticeBody
                    ?.split("\n\n")
                    ?.map { it.trim() }
                    ?.filter { it.isNotEmpty() }
                    ?: emptyList(),
            attachments = emptyList(),
            aiSummary =
                if (isAcknowledged) {
                    "Your signed delivery receipt is on file. Pantopus saved the chain of custody and reminders."
                } else {
                    "Your supplemental property tax bill is $1,247.82 due Jun 30. This is in addition to your annual property tax."
                },
            ackRequired = true,
            isAcknowledged = isAcknowledged,
            isArchived = isArchived,
            certifiedDetail = certified,
        )

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
    }
}

@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.shared.mail_item_detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the A17 Mailbox item detail archetype shell.
 *
 * Three baselines:
 *  - every slot populated,
 *  - only the required slots (top bar + hero),
 *  - aiElf + attachments nil (skipped without trail).
 */
class MailItemDetailShellSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    @Test
    fun shell_with_every_slot_populated() {
        paparazzi.snapshot {
            Root {
                MailItemDetailShell(
                    topBar = sampleTopBar(),
                    aiElf = sampleAIElf(),
                    attachments = sampleAttachments(),
                    hero = { SampleHero() },
                    keyFacts = { SampleKeyFacts() },
                    body = { SampleBody() },
                    sender = { SampleSender() },
                    actions = { SampleActions() },
                )
            }
        }
    }

    @Test
    fun shell_with_only_required_slots() {
        paparazzi.snapshot {
            Root {
                MailItemDetailShell(
                    topBar =
                        MailTopBarConfig(
                            eyebrow = "Booklet",
                            trust = MailDetailTrust.Verified,
                            onBack = {},
                        ),
                    hero = { SampleHero() },
                )
            }
        }
    }

    @Test
    fun shell_with_nil_optional_payloads() {
        paparazzi.snapshot {
            Root {
                MailItemDetailShell(
                    topBar = sampleTopBar(),
                    aiElf = null,
                    attachments = null,
                    hero = { SampleHero() },
                    keyFacts = { SampleKeyFacts() },
                    body = { SampleBody() },
                    sender = { SampleSender() },
                    actions = { SampleActions() },
                )
            }
        }
    }

    // ─── Fixtures ───────────────────────────────────────

    private fun sampleTopBar(): MailTopBarConfig =
        MailTopBarConfig(
            eyebrow = "Certified",
            trust = MailDetailTrust.Verified,
            onBack = {},
            trailingAction =
                MailTopBarTrailingAction(
                    icon = PantopusIcon.Bookmark,
                    contentDescription = "Save to vault",
                ) {},
            overflowItems =
                listOf(
                    MailOverflowItem("forward", PantopusIcon.Send, "Forward") {},
                    MailOverflowItem("archive", PantopusIcon.Archive, "Archive") {},
                    MailOverflowItem(
                        id = "delete",
                        icon = PantopusIcon.Trash2,
                        label = "Delete",
                        isDestructive = true,
                    ) {},
                ),
        )

    private fun sampleAIElf(): AIElfStripContent =
        AIElfStripContent(
            summary =
                "Your neighbor at 412 Elm wants a 2-foot rear-yard setback variance. " +
                    "Hearing June 3, comments by May 30.",
            bullets =
                listOf(
                    AIElfBullet(id = "1", icon = PantopusIcon.MapPin, label = "Affects 412 Elm St", text = "next door"),
                    AIElfBullet(id = "2", icon = PantopusIcon.Calendar, label = "Hearing Tue Jun 3", text = "6:00 PM"),
                    AIElfBullet(id = "3", icon = PantopusIcon.Pencil, label = "Comments by May 30", text = "optional"),
                ),
            trailingBadge = "2 min summary",
            onRedo = {},
        )

    private fun sampleAttachments(): AttachmentsRowContent =
        AttachmentsRowContent(
            items =
                listOf(
                    AttachmentItem(
                        id = "a1",
                        kind = AttachmentKind.Pdf,
                        name = "Public notice ZA-2026-0188.pdf",
                        meta = "2 pages · 84 KB",
                    ),
                    AttachmentItem(
                        id = "a2",
                        kind = AttachmentKind.Image,
                        name = "Site plan.jpg",
                        meta = "1.2 MB",
                    ),
                    AttachmentItem(
                        id = "a3",
                        kind = AttachmentKind.Video,
                        name = "Reading.mp4",
                        meta = "1m 22s",
                    ),
                ),
        )

    // ─── Sample slot content for the snapshot ───────────

    @Composable
    private fun SampleHero() {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s3),
        ) {
            Text(
                text = "Notice of public hearing — Zoning variance",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
        }
    }

    @Composable
    private fun SampleKeyFacts() {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s3),
        ) {
            Text("Key facts", fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Spacer(Modifier.height(Spacing.s2))
            Text("Hearing date · Tue Jun 3, 6:00 PM", color = PantopusColors.appText)
            Text("Location · Oakland City Hall", color = PantopusColors.appText)
        }
    }

    @Composable
    private fun SampleBody() {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s3),
        ) {
            Text("Notice text", fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Spacer(Modifier.height(Spacing.s2))
            Text(
                text =
                    "NOTICE IS HEREBY GIVEN that the Oakland Planning Commission will hold a " +
                        "public hearing on Tuesday, June 3, 2026.",
                color = PantopusColors.appTextStrong,
                fontSize = 13.sp,
            )
        }
    }

    @Composable
    private fun SampleSender() {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s3),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(PantopusColors.primary600),
            )
            Spacer(Modifier.size(Spacing.s3))
            Column {
                Text("City of Oakland", fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                Text("Planning Bureau", color = PantopusColors.appTextSecondary)
            }
        }
    }

    @Composable
    private fun SampleActions() {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .padding(vertical = 14.dp, horizontal = Spacing.s3),
        ) {
            Text(
                text = "Acknowledge receipt",
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
    }

    @Composable
    private fun Root(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}

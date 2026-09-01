package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.MailboxCheck
import app.pantopus.android.data.api.models.place.MailboxCheckVerdict
import app.pantopus.android.data.api.models.place.MailboxFindingSeverity
import app.pantopus.android.data.api.models.place.MailboxPhysicalStatus
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlaceTier
import app.pantopus.android.data.api.models.place.ResidencyLetter
import app.pantopus.android.data.api.models.place.ResidencyLetterStatus
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

@Composable
fun PlaceIdentityDetailContent(
    intel: PlaceIntelligence,
    viewModel: PlaceDetailViewModel,
) {
    val isVerified = intel.tier == PlaceTier.T4

    PlaceDetailSectionLabel("Verification")
    VerifiedStatusCard(isVerified, placeDetailAddress(intel.place))

    // Unlisted sits directly under Verification and is NOT gated on
    // T4: someone who has just claimed their address is exactly who
    // needs it, and a page called "get my address off the internet"
    // that waits on a postcard inverts the product. It also outranks
    // the letter and the pass for the reader most likely to be here.
    PlaceDetailSectionLabel("Your address online")
    LaunchedEffect(Unit) { viewModel.loadUnlisted() }
    PlaceUnlistedSection(viewModel)

    PlaceDetailSectionLabel("Residency letter")
    if (isVerified) {
        LaunchedEffect(Unit) { viewModel.loadLetters() }
        ResidencyLetterSection(viewModel)
    } else {
        PlaceLockedCard(
            title = "Verified residency letter",
            reason = "Verify your address to issue a server-attested letter that states your verified address for a purpose you choose.",
            cta = "Verify address",
            icon = PantopusIcon.FileText,
            onTap = null,
        )
    }

    PlaceDetailSectionLabel("Residency Pass")
    if (isVerified) {
        LaunchedEffect(Unit) { viewModel.loadClaims() }
        PlaceResidencyPassSection(viewModel)
    } else {
        PlaceLockedCard(
            title = "Prove residency without sharing your address",
            reason =
                "Verify your address to share one fact — your city, school district, or " +
                    "county — behind a live-checked link.",
            cta = "Verify address",
            icon = PantopusIcon.IdCard,
            onTap = null,
        )
    }

    PlaceDetailSectionLabel("Mailbox")
    LaunchedEffect(Unit) { viewModel.loadMailboxCheck() }
    MailboxCheckSection(viewModel)

    PlaceDetailSectionLabel("Portable ID")
    PlaceComingSoonRow(PantopusIcon.ShieldCheck, "Portable ID", "Carry your verified status to other apps")
}

// ── Mailbox reality check (Wave 1, #3) ───────────────────────
// The claim-time postal validation surfaced as a diagnostic; the
// physical-leg copy is per-caller, which makes this card the identity
// page's honest verify nudge. Parity: iOS MailboxCheckSection.

@Composable
private fun MailboxCheckSection(viewModel: PlaceDetailViewModel) {
    val state by viewModel.mailboxCheck.collectAsStateWithLifecycle()
    when (val current = state) {
        is MailboxCheckUiState.Loading ->
            PlaceDetailCard {
                Text("Checking how databases see this address…", fontSize = 13.5.sp, color = PantopusColors.appTextMuted)
            }
        is MailboxCheckUiState.Error ->
            PlaceDetailCard { Text(current.message, fontSize = 13.5.sp, color = PantopusColors.appTextMuted) }
        is MailboxCheckUiState.Loaded -> MailboxCheckCard(current.check)
    }
}

@Composable
private fun MailboxCheckCard(check: MailboxCheck) {
    val verdictChip =
        when (check.verdict) {
            MailboxCheckVerdict.LOOKS_GOOD -> PlaceChipModel(PlaceChipTone.SUCCESS, "Looks good")
            MailboxCheckVerdict.NEEDS_ATTENTION -> PlaceChipModel(PlaceChipTone.WARNING, "Needs attention")
            MailboxCheckVerdict.PROBLEM -> PlaceChipModel(PlaceChipTone.WARNING, "Problem found", PantopusIcon.AlertCircle)
            MailboxCheckVerdict.UNKNOWN -> PlaceChipModel(PlaceChipTone.NEUTRAL, "Not checked yet")
        }
    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Mailbox reality check",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                PlaceChip(verdictChip)
            }
            Text(
                "How USPS databases and real mail see this address",
                fontSize = 12.5.sp,
                color = PantopusColors.appTextMuted,
            )
            check.findings.forEach { finding ->
                MailboxFindingRow(
                    icon = severityIcon(finding.severity),
                    tint = severityTint(finding.severity),
                    title = finding.title,
                    detail = finding.detail,
                )
            }
            MailboxFindingRow(
                icon = physicalIcon(check.physical.status),
                tint = physicalTint(check.physical.status),
                title = check.physical.title,
                detail = check.physical.detail,
            )
        }
    }
}

private fun severityIcon(severity: MailboxFindingSeverity): PantopusIcon =
    when (severity) {
        MailboxFindingSeverity.OK -> PantopusIcon.BadgeCheck
        MailboxFindingSeverity.INFO -> PantopusIcon.Info
        MailboxFindingSeverity.ATTENTION -> PantopusIcon.TriangleAlert
        MailboxFindingSeverity.PROBLEM -> PantopusIcon.AlertCircle
    }

private fun severityTint(severity: MailboxFindingSeverity): Color =
    when (severity) {
        MailboxFindingSeverity.OK -> PantopusColors.success
        MailboxFindingSeverity.INFO -> PantopusColors.appTextMuted
        MailboxFindingSeverity.ATTENTION -> PantopusColors.warning
        MailboxFindingSeverity.PROBLEM -> PantopusColors.error
    }

private fun physicalIcon(status: MailboxPhysicalStatus): PantopusIcon =
    when (status) {
        MailboxPhysicalStatus.PROVEN -> PantopusIcon.BadgeCheck
        MailboxPhysicalStatus.IN_PROGRESS -> PantopusIcon.Clock
        MailboxPhysicalStatus.NOT_RUN -> PantopusIcon.Info
    }

private fun physicalTint(status: MailboxPhysicalStatus): Color =
    when (status) {
        MailboxPhysicalStatus.PROVEN -> PantopusColors.success
        MailboxPhysicalStatus.IN_PROGRESS -> PantopusColors.warning
        MailboxPhysicalStatus.NOT_RUN -> PantopusColors.appTextMuted
    }

@Composable
private fun MailboxFindingRow(
    icon: PantopusIcon,
    tint: Color,
    title: String,
    detail: String,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        PantopusIconImage(icon, null, modifier = Modifier.padding(top = 2.dp), size = 15.dp, strokeWidth = 2.25f, tint = tint)
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(detail, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun VerifiedStatusCard(
    isVerified: Boolean,
    address: String,
) {
    PlaceDetailCard {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier =
                    Modifier.size(
                        48.dp,
                    ).clip(RoundedCornerShape(12.dp)).background(if (isVerified) PantopusColors.homeBg else PantopusColors.warningBg),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    PantopusIcon.BadgeCheck,
                    null,
                    size = 24.dp,
                    strokeWidth = 2f,
                    tint = if (isVerified) PantopusColors.home else PantopusColors.warning,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (isVerified) "Verified resident" else "Claimed — not yet verified",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    PlaceChip(
                        if (isVerified) {
                            PlaceChipModel(
                                PlaceChipTone.SUCCESS,
                                "Active",
                                PantopusIcon.Check,
                            )
                        } else {
                            PlaceChipModel(PlaceChipTone.WARNING, "Pending")
                        },
                    )
                }
                Text(address, fontSize = 13.sp, color = PantopusColors.appTextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun ResidencyLetterSection(viewModel: PlaceDetailViewModel) {
    var purpose by remember { mutableStateOf("") }
    val isIssuing by viewModel.isIssuing.collectAsStateWithLifecycle()
    val state by viewModel.letters.collectAsStateWithLifecycle()

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // A failed revoke must be visible here too — the resident is
        // being told whether a document carrying their name and address
        // is still live.
        PlaceActionToastLine(viewModel)
        PlaceDetailCard {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("What is this letter for?", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
                OutlinedTextField(value = purpose, onValueChange = {
                    purpose = it
                }, placeholder = { Text("e.g. New library card application") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                PrimaryButton(
                    title = if (isIssuing) "Issuing…" else "Generate a residency letter",
                    isLoading = isIssuing,
                    isEnabled = !isIssuing && purpose.isNotBlank(),
                    onClick = {
                        viewModel.issueLetter(purpose)
                        purpose = ""
                    },
                )
            }
        }
        when (val current = state) {
            ResidencyLetterUiState.Loading -> Shimmer(width = 360.dp, height = 64.dp, cornerRadius = 16.dp)
            is ResidencyLetterUiState.Loaded ->
                if (current.letters.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { current.letters.forEach { LetterRow(it, viewModel) } }
                }
            is ResidencyLetterUiState.Error -> Text(current.message, fontSize = 12.5.sp, color = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun LetterRow(
    letter: ResidencyLetter,
    viewModel: PlaceDetailViewModel,
) {
    PlaceDetailCard(padding = 14.dp) {
        Row(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalAlignment = Alignment.CenterVertically) {
            PlaceIconTile(
                PantopusIcon.FileText,
                if (letter.status == ResidencyLetterStatus.ISSUED) PlaceTileTone.HOME else PlaceTileTone.MUTED,
                32.dp,
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    letter.purpose,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(letter.letterCode, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appTextMuted)
            }
            if (letter.status == ResidencyLetterStatus.ISSUED) {
                Text(
                    "Revoke",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.error,
                    modifier =
                        Modifier.clickable {
                            viewModel.revokeLetter(letter.id)
                        },
                )
            } else {
                PlaceChip(PlaceChipModel(PlaceChipTone.NEUTRAL, "Revoked"))
            }
        }
    }
}

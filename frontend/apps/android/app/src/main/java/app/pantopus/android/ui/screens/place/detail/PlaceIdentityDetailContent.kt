package app.pantopus.android.ui.screens.place.detail

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.widget.Toast
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.network.HomeDocumentTemporaryFiles
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.IOException

@Composable
fun PlaceIdentityDetailContent(
    intel: PlaceIntelligence,
    viewModel: PlaceDetailViewModel,
) {
    val isVerified = intel.tier == PlaceTier.T4
    val roleBase by viewModel.roleBase.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.loadAccess() }
    // Guests and service providers are verified here but don't live here.
    val isNonResident = roleBase == "guest" || roleBase == "service_provider"

    PlaceDetailSectionLabel("Verification")
    VerifiedStatusCard(isVerified, roleBase, placeDetailAddress(intel.place))

    // Unlisted sits directly under Verification and is NOT gated on
    // T4: someone who has just claimed their address is exactly who
    // needs it, and a page called "get my address off the internet"
    // that waits on a postcard inverts the product. It also outranks
    // the letter and the pass for the reader most likely to be here.
    PlaceDetailSectionLabel("Your address online")
    LaunchedEffect(Unit) { viewModel.loadUnlisted() }
    PlaceUnlistedSection(viewModel)

    if (isVerified && isNonResident) {
        // No issuing, but letters and passes from when they lived here
        // stay listed so they can still open or revoke them.
        PlaceDetailSectionLabel("Residency letter")
        LaunchedEffect(Unit) {
            viewModel.loadLetters()
            viewModel.loadClaims()
        }
        ResidencyLetterSection(viewModel, canIssue = false)
        val claims by viewModel.claims.collectAsStateWithLifecycle()
        if ((claims as? ResidencyClaimsUiState.Loaded)?.claims?.isNotEmpty() == true) {
            PlaceDetailSectionLabel("Residency Pass")
            PlaceResidencyPassSection(viewModel, canIssue = false)
        }
    } else {
        ResidencySections(isVerified, viewModel)
    }

    PlaceDetailSectionLabel("Mailbox")
    LaunchedEffect(Unit) { viewModel.loadMailboxCheck() }
    MailboxCheckSection(viewModel)

    PlaceDetailSectionLabel("Portable ID")
    PlaceComingSoonRow(PantopusIcon.ShieldCheck, "Portable ID", "Carry your verified status to other apps")
}

/** The residency letter and Residency Pass sections (residents only). */
@Composable
private fun ResidencySections(
    isVerified: Boolean,
    viewModel: PlaceDetailViewModel,
) {
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
    roleBase: String?,
    address: String,
) {
    val title =
        when {
            !isVerified -> "Claimed — not yet verified"
            roleBase == "guest" -> "Verified guest"
            roleBase == "service_provider" -> "Verified service provider"
            else -> "Verified resident"
        }
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
                        title,
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
private fun ResidencyLetterSection(
    viewModel: PlaceDetailViewModel,
    // Guests and service providers can't issue letters (the server refuses them).
    canIssue: Boolean = true,
) {
    var purpose by remember { mutableStateOf("") }
    val isIssuing by viewModel.isIssuing.collectAsStateWithLifecycle()
    val state by viewModel.letters.collectAsStateWithLifecycle()

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        // A failed revoke must be visible here too — the resident is
        // being told whether a document carrying their name and address
        // is still live.
        PlaceActionToastLine(viewModel)
        PlaceDetailCard {
            if (canIssue) {
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
                            viewModel.issueLetter(purpose) { purpose = "" }
                        },
                    )
                }
            } else {
                Text(
                    "Residency letters and passes are for the people who live here, so guest and service access can't issue them.",
                    fontSize = 13.5.sp,
                    color = PantopusColors.appTextMuted,
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
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val openingLetterId by viewModel.openingLetterId.collectAsStateWithLifecycle()
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
            Text(
                if (openingLetterId == letter.id) "Opening…" else "PDF",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.home,
                modifier =
                    Modifier
                        .testTag("place.letter.pdf")
                        .clickable(enabled = openingLetterId == null) {
                            viewModel.openLetterPdf(letter.id) { bytes -> scope.launch { showLetterPdf(context, letter, bytes) } }
                        },
            )
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
                val label =
                    when (letter.status) {
                        ResidencyLetterStatus.EXPIRED -> "Expired"
                        ResidencyLetterStatus.REVOKED -> "Revoked"
                        else -> "Unavailable"
                    }
                PlaceChip(PlaceChipModel(PlaceChipTone.NEUTRAL, label))
            }
        }
    }
}

// The file name matches the web download and the server's Content-Disposition.
private const val LETTER_FILE_ID_LENGTH = 8

/** Writes the letter to a private cache file (cleared on the next launch) and opens it in the phone's viewer. */
private suspend fun showLetterPdf(
    context: Context,
    letter: ResidencyLetter,
    bytes: ByteArray,
) {
    val file =
        try {
            withContext(Dispatchers.IO) {
                val directory = HomeDocumentTemporaryFiles.makeExportDirectory(context.cacheDir)
                File(directory, "pantopus-residency-letter-${letter.id.take(LETTER_FILE_ID_LENGTH)}.pdf").also { it.writeBytes(bytes) }
            }
        } catch (_: IOException) {
            Toast.makeText(context, "Couldn't prepare the letter. Try again.", Toast.LENGTH_SHORT).show()
            return
        }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/pdf")
    intent.clipData = ClipData.newRawUri(file.name, uri)
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    runCatching { context.startActivity(Intent.createChooser(intent, "Open letter")) }
}

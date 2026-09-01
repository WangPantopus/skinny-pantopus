package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
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

    PlaceDetailSectionLabel("Portable ID")
    PlaceComingSoonRow(PantopusIcon.ShieldCheck, "Portable ID", "Carry your verified status to other apps")
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

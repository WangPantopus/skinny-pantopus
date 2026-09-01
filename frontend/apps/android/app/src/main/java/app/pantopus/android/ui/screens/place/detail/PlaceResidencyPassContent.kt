package app.pantopus.android.ui.screens.place.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.place.ResidencyClaim
import app.pantopus.android.data.api.models.place.ResidencyClaimScope
import app.pantopus.android.data.api.models.place.ResidencyClaimStatus
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.place.PlacePresentation
import app.pantopus.android.ui.screens.place.components.PlaceChip
import app.pantopus.android.ui.screens.place.components.PlaceChipModel
import app.pantopus.android.ui.screens.place.components.PlaceChipTone
import app.pantopus.android.ui.theme.PantopusColors

// ─── Residency Pass (Wave 1) — Identity detail, T4 ───────────
// Pick ONE fact to share, pick a lifetime, issue — the verify link is
// copied for handing to whoever asked. Claims list with live status,
// view counts, and one-tap revoke. Parity: iOS
// PlaceResidencyPassSection.

private val SCOPE_ORDER =
    listOf(
        ResidencyClaimScope.CITY,
        ResidencyClaimScope.SCHOOL_DISTRICT,
        ResidencyClaimScope.COUNTY,
        ResidencyClaimScope.STATE,
        ResidencyClaimScope.CONGRESSIONAL_DISTRICT,
        ResidencyClaimScope.ADDRESS,
    )

private fun scopeLabel(scope: ResidencyClaimScope): Pair<String, String> =
    when (scope) {
        ResidencyClaimScope.CITY -> "City" to "e.g. “a verified resident of Portland, OR”"
        ResidencyClaimScope.SCHOOL_DISTRICT -> "School district" to "For enrollment and school-zone checks"
        ResidencyClaimScope.COUNTY -> "County" to "For county services and programs"
        ResidencyClaimScope.STATE -> "State" to "For state-residency checks"
        ResidencyClaimScope.CONGRESSIONAL_DISTRICT -> "Congressional district" to "For civic and campaign checks"
        ResidencyClaimScope.ADDRESS -> "Full address" to "Discloses your street address — like the letter"
        ResidencyClaimScope.UNKNOWN -> "Unknown" to ""
    }

private val DURATION_CHOICES = listOf(1, 7, 30, 90)
private const val DEFAULT_CLAIM_DAYS = 30

@Composable
fun PlaceResidencyPassSection(viewModel: PlaceDetailViewModel) {
    val state by viewModel.claims.collectAsStateWithLifecycle()
    val linkToCopy by viewModel.claimLinkToCopy.collectAsStateWithLifecycle()
    val clipboard = LocalClipboardManager.current

    LaunchedEffect(linkToCopy) {
        linkToCopy?.let {
            clipboard.setText(AnnotatedString(it))
            viewModel.consumeClaimLink()
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ResidencyPassComposer(viewModel)
        PlaceActionToastLine(viewModel)
        when (val current = state) {
            is ResidencyClaimsUiState.Loading -> Unit
            is ResidencyClaimsUiState.Error ->
                PlaceDetailCard { Text(current.message, fontSize = 13.5.sp, color = PantopusColors.appTextMuted) }
            is ResidencyClaimsUiState.Loaded ->
                current.claims.forEach { ResidencyClaimRow(it, viewModel) }
        }
    }
}

@Composable
private fun ResidencyPassComposer(viewModel: PlaceDetailViewModel) {
    var scope by remember { mutableStateOf(ResidencyClaimScope.CITY) }
    var days by remember { mutableIntStateOf(DEFAULT_CLAIM_DAYS) }
    val isIssuing by viewModel.isIssuingClaim.collectAsStateWithLifecycle()

    PlaceDetailCard {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                "Prove residency without sharing your address",
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                "The link shares only the statement you pick — checked live against your " +
                    "verification, logged for you, revocable any time.",
                fontSize = 12.5.sp,
                lineHeight = 17.sp,
                color = PantopusColors.appTextSecondary,
            )
            ScopePicker(selected = scope, onSelect = { scope = it })
            DurationPicker(selected = days, onSelect = { days = it })
            PrimaryButton(
                title = if (isIssuing) "Issuing…" else "Issue claim & copy link",
                isLoading = isIssuing,
                onClick = { viewModel.issueClaim(scope.raw, days) },
            )
        }
    }
}

@Composable
private fun ScopePicker(
    selected: ResidencyClaimScope,
    onSelect: (ResidencyClaimScope) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(PantopusColors.appSurfaceSunken),
    ) {
        SCOPE_ORDER.forEachIndexed { index, scope ->
            if (index > 0) HorizontalDivider(color = PantopusColors.appBorderSubtle, modifier = Modifier.padding(start = 12.dp))
            ScopeRow(scope, selected == scope) { onSelect(scope) }
        }
    }
}

@Composable
private fun ScopeRow(
    scope: ResidencyClaimScope,
    selected: Boolean,
    onTap: () -> Unit,
) {
    val (label, hint) = scopeLabel(scope)
    Row(
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onTap)
                .padding(horizontal = 12.dp, vertical = 8.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .size(17.dp)
                    .clip(CircleShape)
                    .border(2.dp, if (selected) PantopusColors.primary600 else PantopusColors.appBorderStrong, CircleShape),
        ) {
            if (selected) {
                Box(
                    modifier =
                        Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(PantopusColors.primary600),
                )
            }
        }
        Column {
            Text(label, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(
                hint,
                fontSize = 11.5.sp,
                color = if (scope == ResidencyClaimScope.ADDRESS) PantopusColors.warning else PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun DurationPicker(
    selected: Int,
    onSelect: (Int) -> Unit,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        DURATION_CHOICES.forEach { days ->
            val isSelected = selected == days
            Text(
                if (days == 1) "1 day" else "$days days",
                fontSize = 12.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = if (isSelected) PantopusColors.primary600 else PantopusColors.appTextSecondary,
                modifier =
                    Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(9.dp))
                        .background(if (isSelected) PantopusColors.primary100 else PantopusColors.appSurface)
                        .border(
                            1.5.dp,
                            if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                            RoundedCornerShape(9.dp),
                        )
                        .clickable { onSelect(days) }
                        .padding(vertical = 8.dp)
                        .wrapContentWidth(),
            )
        }
    }
}

@Composable
private fun ResidencyClaimRow(
    claim: ResidencyClaim,
    viewModel: PlaceDetailViewModel,
) {
    val clipboard = LocalClipboardManager.current
    val chip =
        when (claim.status) {
            ResidencyClaimStatus.ACTIVE -> PlaceChipModel(PlaceChipTone.SUCCESS, "Active")
            ResidencyClaimStatus.REVOKED -> PlaceChipModel(PlaceChipTone.WARNING, "Revoked")
            ResidencyClaimStatus.EXPIRED -> PlaceChipModel(PlaceChipTone.NEUTRAL, "Expired")
        }
    PlaceDetailCard(padding = 14.dp) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    claim.claimCode,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                PlaceChip(chip)
            }
            Text(claim.statement, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextStrong)
            val until = PlacePresentation.fmtMonthYear(claim.expiresAt) ?: ""
            val views =
                when {
                    claim.viewCount == 0 -> "Not checked yet"
                    claim.viewCount == 1 -> "Checked 1 time"
                    else -> "Checked ${claim.viewCount} times"
                }
            Text("Until $until · $views", fontSize = 11.5.sp, color = PantopusColors.appTextMuted)
            if (claim.status == ResidencyClaimStatus.ACTIVE) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "Copy link",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.primary600,
                        modifier = Modifier.clickable { clipboard.setText(AnnotatedString(claim.verifyUrl)) },
                    )
                    Text(
                        "Revoke",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.error,
                        modifier = Modifier.clickable { viewModel.revokeClaim(claim.id) },
                    )
                }
            }
        }
    }
}

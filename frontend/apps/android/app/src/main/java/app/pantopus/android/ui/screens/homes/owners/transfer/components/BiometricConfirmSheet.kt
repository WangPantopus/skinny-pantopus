@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "LongMethod", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.homes.owners.transfer.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** One row in the compact From / To diff at the top of the sheet. */
data class ConfirmSheetParty(
    val id: String,
    val role: String,
    val name: String,
    val initials: String,
    val avatarStart: Color,
    val avatarEnd: Color,
    val fromPercent: Int,
    val toPercent: Int,
    val verified: Boolean = false,
)

/**
 * Final-confirmation bottom-sheet body. The host (`TransferOwnershipScreen`)
 * triggers the platform BiometricPrompt on [onConfirm]; while
 * authentication is in flight the host sets [isAuthenticating] to swap
 * the primary CTA's label for a spinner.
 */
@Composable
fun BiometricConfirmSheet(
    parties: List<ConfirmSheetParty>,
    recipientName: String,
    homeAddress: String,
    coOwnerNames: String,
    timestamp: String,
    biometryLabel: String,
    isAuthenticating: Boolean,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .testTag("biometricConfirmSheet"),
    ) {
        Spacer(modifier = Modifier.heightIn(min = Spacing.s2 + 2.dp))
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterHorizontally)
                    .width(38.dp)
                    .heightIn(min = 4.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(PantopusColors.appBorderStrong),
        )
        Spacer(modifier = Modifier.heightIn(min = Spacing.s3 + 2.dp))
        SheetHeader(biometryLabel = biometryLabel)
        Spacer(modifier = Modifier.heightIn(min = Spacing.s4))
        DiffCard(parties = parties, modifier = Modifier.padding(horizontal = Spacing.s4))
        Spacer(modifier = Modifier.heightIn(min = Spacing.s3 + 2.dp))
        LegalBlock(
            biometryLabel = biometryLabel,
            recipientName = recipientName,
            homeAddress = homeAddress,
            coOwnerNames = coOwnerNames,
            timestamp = timestamp,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        Spacer(modifier = Modifier.heightIn(min = Spacing.s3 + 2.dp))
        Buttons(
            biometryLabel = biometryLabel,
            isAuthenticating = isAuthenticating,
            onCancel = onCancel,
            onConfirm = onConfirm,
            modifier = Modifier.padding(horizontal = Spacing.s4),
        )
        Spacer(modifier = Modifier.heightIn(min = Spacing.s8))
    }
}

@Composable
private fun SheetHeader(biometryLabel: String) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(PantopusColors.appText, PantopusColors.appTextStrong),
                        ),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.ScanFace,
                contentDescription = null,
                size = 28.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text = "Final confirmation",
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
        )
        Text(
            text = "$biometryLabel will sign the transfer and record it on the home's chain.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = Spacing.s5),
        )
    }
}

@Composable
private fun DiffCard(
    parties: List<ConfirmSheetParty>,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md + 2.dp))
                .background(PantopusColors.appSurfaceMuted)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md + 2.dp))
                .padding(horizontal = Spacing.s3 + 2.dp, vertical = Spacing.s2),
    ) {
        parties.forEachIndexed { index, party ->
            PartyRow(party)
            if (index < parties.size - 1) {
                HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
            }
        }
    }
}

@Composable
private fun PartyRow(party: ConfirmSheetParty) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s2 + 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2 + 2.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(listOf(party.avatarStart, party.avatarEnd))),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = party.initials,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = party.role,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextSecondary,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = party.name,
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                if (party.verified) {
                    PantopusIconImage(
                        icon = PantopusIcon.BadgeCheck,
                        contentDescription = null,
                        size = 13.dp,
                        tint = PantopusColors.success,
                    )
                }
            }
        }
        Percentage(party)
    }
}

@Composable
private fun Percentage(party: ConfirmSheetParty) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "${party.fromPercent}%",
            fontSize = 12.sp,
            fontFamily = FontFamily.Monospace,
            color = PantopusColors.appTextMuted,
            textDecoration = TextDecoration.LineThrough,
        )
        PantopusIconImage(
            icon = PantopusIcon.ArrowRight,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "${party.toPercent}%",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            color = if (party.toPercent > party.fromPercent) PantopusColors.success else PantopusColors.appText,
        )
    }
}

@Composable
private fun LegalBlock(
    biometryLabel: String,
    recipientName: String,
    homeAddress: String,
    coOwnerNames: String,
    timestamp: String,
    modifier: Modifier = Modifier,
) {
    val text =
        buildString {
            append("By confirming with $biometryLabel: ")
            append("you grant $recipientName ownership of $homeAddress and forfeit your own ")
            append("owner record. They must verify ownership before the transfer completes. ")
            if (coOwnerNames.isNotEmpty()) {
                append("$coOwnerNames must approve before it takes effect. ")
            }
            append("Recorded on chain at ")
            append(timestamp)
            append(".")
        }
    Text(
        text = text,
        fontSize = 11.sp,
        color = PantopusColors.appTextSecondary,
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md + 2.dp))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md + 2.dp))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2 + 2.dp),
    )
}

@Composable
private fun Buttons(
    biometryLabel: String,
    isAuthenticating: Boolean,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Box(
            modifier =
                Modifier
                    .weight(1f)
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .clickable(enabled = !isAuthenticating, onClick = onCancel)
                    .semantics { contentDescription = "Cancel" }
                    .testTag("biometricConfirmCancel"),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Cancel",
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
        }
        Box(
            modifier =
                Modifier
                    .weight(1.5f)
                    .heightIn(min = 48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.primary600)
                    .clickable(enabled = !isAuthenticating, onClick = onConfirm)
                    .semantics { contentDescription = "Confirm with $biometryLabel" }
                    .testTag("biometricConfirmConfirm"),
            contentAlignment = Alignment.Center,
        ) {
            if (isAuthenticating) {
                CircularProgressIndicator(
                    color = PantopusColors.appTextInverse,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(20.dp),
                )
            } else {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1 + 3.dp),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ScanFace,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.appTextInverse,
                    )
                    Text(
                        text = "Confirm with $biometryLabel",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}

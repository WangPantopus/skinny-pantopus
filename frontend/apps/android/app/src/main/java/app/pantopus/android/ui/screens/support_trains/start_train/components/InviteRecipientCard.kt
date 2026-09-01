@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.support_trains.start_train.components

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.support_trains.start_train.StartSupportTrainInviteCandidate
import app.pantopus.android.ui.screens.support_trains.start_train.StartSupportTrainInviteMethod
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A12.11 — Frame 2 recipient branch: the typed name matched no verified
 * neighbor, so the card pivots to an invite flow. Typed-search row →
 * warm-amber "no verified neighbor" section → invite-by-phone (recommended)
 * / invite-by-email rows → a privacy hint. The CTA flips to "Send invite &
 * continue" in this branch.
 *
 * The typeahead is stubbed (real contact-picker is out of scope, P7.4); the
 * contact handles come from the [candidate].
 */
@Composable
internal fun InviteRecipientCard(
    candidate: StartSupportTrainInviteCandidate,
    selectedMethod: StartSupportTrainInviteMethod,
    onClear: () -> Unit,
    onSelectMethod: (StartSupportTrainInviteMethod) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        InviteCard(candidate, selectedMethod, onClear, onSelectMethod)
        PrivacyHint(firstName(candidate.typedName))
    }
}

@Composable
private fun InviteCard(
    candidate: StartSupportTrainInviteCandidate,
    selectedMethod: StartSupportTrainInviteMethod,
    onClear: () -> Unit,
    onSelectMethod: (StartSupportTrainInviteMethod) -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = shape)
                .testTag("startSupportTrainInviteRecipientCard"),
    ) {
        SearchRow(candidate.typedName, onClear)
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorderSubtle)
        NoMatchSection(firstName(candidate.typedName))
        HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorderSubtle)
        StartSupportTrainInviteMethod.entries.forEachIndexed { index, method ->
            InviteMethodRow(
                method = method,
                value = candidate.valueFor(method),
                isSelected = method == selectedMethod,
                onClick = { onSelectMethod(method) },
            )
            if (index < StartSupportTrainInviteMethod.entries.lastIndex) {
                HorizontalDivider(thickness = 1.dp, color = PantopusColors.appBorderSubtle)
            }
        }
    }
}

@Composable
private fun SearchRow(
    typedName: String,
    onClear: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = typedName,
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Medium),
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clickable { onClear() }
                    .testTag("startSupportTrainClearInviteSearch"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Clear recipient search",
                size = 12.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun NoMatchSection(firstName: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.warmAmberBg)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.warmAmber),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Search,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "No verified neighbor by that name",
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.warmAmber,
            )
            Text(
                text = "We searched verified addresses near yours. You can still start a train and invite $firstName directly.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.warmAmber,
            )
        }
    }
}

@Composable
private fun InviteMethodRow(
    method: StartSupportTrainInviteMethod,
    value: String,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onClick() }
                .padding(Spacing.s3)
                .testTag("startSupportTrainInviteMethod_${method.name.lowercase()}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = method.icon,
                contentDescription = null,
                size = 15.dp,
                tint = PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text(
                    text = method.title,
                    style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                    color = PantopusColors.appText,
                )
                if (method == StartSupportTrainInviteMethod.Phone) {
                    Text(
                        text = "RECOMMENDED",
                        style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.Bold, fontSize = 9.sp),
                        color = PantopusColors.success,
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(Radii.pill))
                                .background(PantopusColors.successBg)
                                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
                    )
                }
            }
            Text(
                text = value,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = if (isSelected) PantopusIcon.CheckCircle else PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 16.dp,
            tint = if (isSelected) PantopusColors.primary600 else PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun PrivacyHint(firstName: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s1).testTag("startSupportTrainInviteInfoHint"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Info,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text =
                "$firstName gets a link to confirm the train and choose what's visible. " +
                    "They don't need a Pantopus account to receive help.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

private fun firstName(typedName: String): String = typedName.split(" ").firstOrNull { it.isNotBlank() } ?: typedName

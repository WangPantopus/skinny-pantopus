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
import app.pantopus.android.ui.screens.support_trains.start_train.StartSupportTrainInviteCandidate
import app.pantopus.android.ui.screens.support_trains.start_train.StartSupportTrainInviteMethod
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A12.11 — Frame 2 recipient branch: the typed name matched no one on
 * Pantopus. Typed-search row → warm-amber "no one by that name" section.
 * The wizard has no contact entry and sends no invite yet, so the
 * invite-by-phone / email rows and the "gets a link" hint are not shown;
 * [selectedMethod] / [onSelectMethod] stay for when real invites exist.
 */
@Suppress("UnusedParameter")
@Composable
internal fun InviteRecipientCard(
    candidate: StartSupportTrainInviteCandidate,
    selectedMethod: StartSupportTrainInviteMethod,
    onClear: () -> Unit,
    onSelectMethod: (StartSupportTrainInviteMethod) -> Unit,
) {
    InviteCard(candidate, onClear)
}

@Composable
private fun InviteCard(
    candidate: StartSupportTrainInviteCandidate,
    onClear: () -> Unit,
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
                text = "No one on Pantopus by that name",
                style = PantopusTextStyle.small.copy(fontWeight = FontWeight.Bold),
                color = PantopusColors.warmAmber,
            )
            Text(
                text = "You can still start a train for $firstName.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.warmAmber,
            )
        }
    }
}

private fun firstName(typedName: String): String = typedName.split(" ").firstOrNull { it.isNotBlank() } ?: typedName

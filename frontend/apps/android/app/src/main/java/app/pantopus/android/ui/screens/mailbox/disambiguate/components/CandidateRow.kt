@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.mailbox.disambiguate.components

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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.mailbox.disambiguate.CandidateRole
import app.pantopus.android.ui.screens.mailbox.disambiguate.MailCandidate
import app.pantopus.android.ui.screens.mailbox.disambiguate.MailGrant
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * A13.15 Disambiguate — one ranked recipient: radio-style selected ring, 44dp
 * identity-gradient avatar (with a verified check badge), name + [MatchBadge], a
 * role chip, the grant line, and an optional presence line. In the unclear
 * frame rows are inert "best guesses" ([isSelectable] == false). Mirrors the
 * iOS `CandidateRow`.
 */
@Composable
fun CandidateRow(
    candidate: MailCandidate,
    isSelected: Boolean,
    isSelectable: Boolean,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (isSelected) 1.5.dp else 1.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .then(if (isSelectable) Modifier.clickable(onClick = onTap) else Modifier)
                .padding(Spacing.s3)
                .testTag("disambiguateCandidate_${candidate.id}")
                .semantics {
                    contentDescription = accessibilityText(candidate)
                    selected = isSelected
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        RadioMark(isSelected = isSelected)
        Avatar(candidate = candidate)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Text(
                    text = candidate.name,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
                MatchBadge(tier = candidate.tier, percent = candidate.matchPercent)
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                RoleChip(role = candidate.role)
                GrantLine(grant = candidate.grant)
            }
            candidate.presence?.let { presence ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                ) {
                    Box(
                        modifier =
                            Modifier
                                .size(6.dp)
                                .clip(CircleShape)
                                .background(PantopusColors.appTextMuted),
                    )
                    Text(
                        text = presence,
                        fontSize = 10.5.sp,
                        fontStyle = FontStyle.Italic,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

@Composable
private fun RadioMark(isSelected: Boolean) {
    Box(
        modifier =
            Modifier
                .size(20.dp)
                .clip(CircleShape)
                .border(
                    width = if (isSelected) 6.dp else 2.dp,
                    color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                    shape = CircleShape,
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface),
            )
        }
    }
}

@Composable
private fun Avatar(candidate: MailCandidate) {
    Box(contentAlignment = Alignment.Center) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(Brush.linearGradient(avatarGradient(candidate.role))),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = candidate.initials,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        if (candidate.verified) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .size(15.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.home)
                        .border(2.dp, PantopusColors.appSurface, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 9.dp,
                    strokeWidth = 4f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun RoleChip(role: CandidateRole) {
    val (background, foreground) = roleColors(role)
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .padding(horizontal = Spacing.s2, vertical = 2.dp),
    ) {
        Text(
            text = role.title,
            fontSize = 10.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = foreground,
        )
    }
}

@Composable
private fun GrantLine(grant: MailGrant) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = if (grant == MailGrant.ReceivesMail) PantopusIcon.Mail else PantopusIcon.Ban,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = grant.label,
            fontSize = 11.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

private fun avatarGradient(role: CandidateRole): List<Color> =
    when (role) {
        CandidateRole.Owner -> listOf(PantopusColors.primary500, PantopusColors.primary700)
        CandidateRole.Resident -> listOf(PantopusColors.home, PantopusColors.homeDark)
        CandidateRole.Guest -> listOf(PantopusColors.warning, PantopusColors.warmAmber)
    }

private fun roleColors(role: CandidateRole): Pair<Color, Color> =
    when (role) {
        CandidateRole.Owner -> PantopusColors.primary100 to PantopusColors.primary700
        CandidateRole.Resident -> PantopusColors.homeBg to PantopusColors.home
        CandidateRole.Guest -> PantopusColors.appSurfaceSunken to PantopusColors.appTextStrong
    }

private fun accessibilityText(candidate: MailCandidate): String {
    val parts =
        buildList {
            add(candidate.name)
            add(candidate.role.title)
            add(candidate.grant.label)
            add("${candidate.tier.word} ${candidate.matchPercent} percent")
            candidate.presence?.let { add(it) }
        }
    return parts.joinToString(", ")
}

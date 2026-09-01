@file:Suppress("MagicNumber", "LongMethod", "MatchingDeclarationName", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * B1.3 — identity-preview primitive for A18.5 "View as".
 *
 * Mirrors `Core/Design/Components/ViewerPicker.swift`. A horizontally-
 * scrollable selector of *viewer audiences* grouped under audience headers
 * (Persona audience · Personal · Home). The selected chip recolours to its
 * audience's [IdentityPillar] tint; tapping emits the chosen [ViewerAudience].
 *
 * The View-As screen and its real privacy resolution land in B5.2 — this
 * is the reusable chrome only. `LiveBadge` (the small "LIVE" pill) lives
 * here as its one-line sibling.
 */

/** Which audience-pillar a viewer sits under — drives header + tint. */
enum class ViewerAudienceGroup(
    val id: String,
    val title: String,
    val pillar: IdentityPillar,
) {
    PersonaAudience("persona_audience", "Persona audience", IdentityPillar.Personal),
    Personal("personal", "Personal", IdentityPillar.Personal),
    Home("home", "Home", IdentityPillar.Home),
}

/**
 * A single viewer context you can preview your profile as. Membership,
 * order, labels and icons mirror `docs/designs/A18/view-as-frames.jsx`.
 * [id] is mirrored verbatim as the iOS `accessibilityIdentifier` suffix.
 */
enum class ViewerAudience(
    val id: String,
    val label: String,
    val icon: PantopusIcon,
    val group: ViewerAudienceGroup,
) {
    Public("public", "Public", PantopusIcon.Globe, ViewerAudienceGroup.PersonaAudience),
    PersonaAudience("persona_audience", "Persona audience", PantopusIcon.Megaphone, ViewerAudienceGroup.PersonaAudience),
    Neighbor("neighbor", "Neighbor", PantopusIcon.MapPin, ViewerAudienceGroup.PersonaAudience),
    Connection("connection", "Connection", PantopusIcon.UserCheck, ViewerAudienceGroup.Personal),
    GigParticipant("gig_participant", "Gig participant", PantopusIcon.Briefcase, ViewerAudienceGroup.Personal),
    Household("household", "Household", PantopusIcon.Home, ViewerAudienceGroup.Home),
    ;

    /** Pillar tint applied when this chip is selected. */
    val pillar: IdentityPillar get() = group.pillar
}

/** One ordered cluster in the picker — a header plus its viewer chips. */
data class ViewerGroup(
    val kind: ViewerAudienceGroup,
    val audiences: List<ViewerAudience>,
) {
    companion object {
        /** Default layout: the six A18.5 viewers under their three headers. */
        val STANDARD: List<ViewerGroup> =
            listOf(
                ViewerGroup(
                    ViewerAudienceGroup.PersonaAudience,
                    listOf(ViewerAudience.Public, ViewerAudience.PersonaAudience, ViewerAudience.Neighbor),
                ),
                ViewerGroup(
                    ViewerAudienceGroup.Personal,
                    listOf(ViewerAudience.Connection, ViewerAudience.GigParticipant),
                ),
                ViewerGroup(
                    ViewerAudienceGroup.Home,
                    listOf(ViewerAudience.Household),
                ),
            )
    }
}

/**
 * Horizontally-scrollable audience-chip selector for "View as".
 *
 * @param selection The currently-previewed audience (its chip is tinted).
 * @param onSelect Fired with the tapped audience.
 * @param groups Ordered clusters. Defaults to the A18.5 standard set.
 * @param title Optional eyebrow above the row (e.g. "Preview your profile
 *   as"). Hidden when null.
 */
@Composable
fun ViewerPicker(
    selection: ViewerAudience,
    onSelect: (ViewerAudience) -> Unit,
    modifier: Modifier = Modifier,
    groups: List<ViewerGroup> = ViewerGroup.STANDARD,
    title: String? = null,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(vertical = Spacing.s3)
                .testTag("viewerPicker"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (title != null) {
            Row(
                modifier =
                    Modifier
                        .padding(horizontal = Spacing.s4)
                        .semantics { heading() },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Eye,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = title.uppercase(),
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextMuted,
                )
            }
        }

        Row(
            modifier =
                Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            groups.forEachIndexed { index, group ->
                Text(
                    text = group.kind.title.uppercase(),
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextMuted,
                    modifier =
                        Modifier
                            .padding(start = if (index == 0) Spacing.s0 else Spacing.s2)
                            .clearAndSetSemantics {},
                )
                group.audiences.forEach { audience ->
                    ViewerChip(
                        audience = audience,
                        isSelected = audience == selection,
                        onClick = { onSelect(audience) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ViewerChip(
    audience: ViewerAudience,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.pill)
    val fg = if (isSelected) PantopusColors.appTextInverse else PantopusColors.appTextStrong
    val fill = if (isSelected) audience.pillar.color else PantopusColors.appSurface
    val borderColor = if (isSelected) audience.pillar.color else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .height(34.dp)
                .clip(shape)
                .background(fill)
                .border(1.5.dp, borderColor, shape)
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag("viewerPicker_chip_${audience.id}")
                .semantics {
                    contentDescription = "View as ${audience.label}"
                    role = Role.Button
                    selected = isSelected
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = audience.icon,
            contentDescription = null,
            size = 13.dp,
            tint = fg,
        )
        Text(
            text = audience.label,
            style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp),
            color = fg,
        )
    }
}

/**
 * The small "LIVE" pill stamped beside "Viewing as …" on A18.5. A dot +
 * uppercase label in a bordered surface capsule. Static (no pulse) so
 * snapshots stay deterministic.
 */
@Composable
fun LiveBadge(
    modifier: Modifier = Modifier,
    label: String = "Live",
    toneColor: Color = PantopusColors.success,
) {
    val shape = RoundedCornerShape(Radii.pill)
    Row(
        modifier =
            modifier
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .testTag("liveBadge")
                .semantics { contentDescription = label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(
            modifier =
                Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(toneColor),
        )
        Text(
            text = label.uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun ViewerPickerPreview() {
    var selection by remember { mutableStateOf(ViewerAudience.Connection) }
    Column(
        modifier = Modifier.background(PantopusColors.appBg),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        ViewerPicker(
            selection = selection,
            onSelect = { selection = it },
            title = "Preview your profile as",
        )
        Row(
            modifier = Modifier.padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            LiveBadge()
            LiveBadge(label = "Preview", toneColor = PantopusColors.warning)
        }
    }
}

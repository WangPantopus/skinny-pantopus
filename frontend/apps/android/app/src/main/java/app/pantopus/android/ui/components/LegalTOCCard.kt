@file:Suppress("MagicNumber", "LongMethod", "UnusedPrivateMember")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevations
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A19 legal scaffold — a collapsible "Jump to section" table of contents.
 * The header toggles open/closed; each expanded row is a numbered section
 * link. State is owned by the host screen (it animates the toggle and scrolls
 * to the chosen section); the card itself is stateless.
 *
 * @param items Section titles, in order.
 * @param isOpen Whether the section list is expanded.
 * @param onToggle Header tap — flip [isOpen].
 * @param onJump Row tap — the 0-based index in [items] (matching section is
 *     `LegalSection(number = index + 1)`).
 */
@Composable
fun LegalTOCCard(
    items: List<String>,
    isOpen: Boolean,
    onToggle: () -> Unit,
    onJump: (Int) -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .pantopusShadow(PantopusElevations.sm, shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, shape)
                .testTag("legalTOCCard"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(horizontal = 14.dp, vertical = Spacing.s3)
                    .testTag("legalTOCCard_toggle"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.List,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.2f,
                tint = PantopusColors.primary600,
            )
            Text(
                text = "Jump to section",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Spacer(modifier = Modifier.weight(1f))
            if (!isOpen) {
                Text(
                    text = "${items.size} sections",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium,
                    color = PantopusColors.appTextSecondary,
                )
            }
            PantopusIconImage(
                icon = if (isOpen) PantopusIcon.ChevronUp else PantopusIcon.ChevronDown,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }

        if (isOpen) {
            TocHairline()
            Column(modifier = Modifier.padding(top = Spacing.s1, bottom = 6.dp)) {
                items.forEachIndexed { index, title ->
                    TocRow(index = index, title = title, onJump = onJump)
                    if (index < items.size - 1) {
                        TocHairline()
                    }
                }
            }
        }
    }
}

@Composable
private fun TocRow(
    index: Int,
    title: String,
    onJump: (Int) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable { onJump(index) }
                .padding(horizontal = 14.dp, vertical = 9.dp)
                .testTag("legalTOCCard_row_$index"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(22.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = (index + 1).toString().padStart(2, '0'),
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary700,
            )
        }
        Text(
            text = title,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 13.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun TocHairline() {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(PantopusColors.appBorderSubtle),
    )
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun LegalTOCCardExpandedPreview() {
    Column(modifier = Modifier.padding(Spacing.s5)) {
        LegalTOCCard(
            items =
                listOf(
                    "Overview",
                    "Information we collect",
                    "How we use it",
                    "Identity pillars & privacy",
                    "Sharing & disclosure",
                ),
            isOpen = true,
            onToggle = {},
            onJump = {},
        )
    }
}

@Preview(showBackground = true, widthDp = 360)
@Composable
private fun LegalTOCCardCollapsedPreview() {
    Column(modifier = Modifier.padding(Spacing.s5)) {
        LegalTOCCard(
            items = List(10) { "Section" },
            isOpen = false,
            onToggle = {},
            onJump = {},
        )
    }
}

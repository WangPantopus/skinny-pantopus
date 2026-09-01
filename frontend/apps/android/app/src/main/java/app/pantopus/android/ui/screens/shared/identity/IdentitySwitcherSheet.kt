@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.shared.identity

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.SheetState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.screens.identity_center.IdentityKind
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Render-only switcher card. Pairs with [IdentitySwitcherSheet]. */
@Immutable
data class IdentitySwitcherCard(
    val id: String,
    val kind: IdentityKind,
    val overline: String,
    val name: String,
    val stats: String? = null,
    val isActive: Boolean = false,
)

/**
 * Bottom-sheet identity switcher used by Profiles & Privacy. Reuses
 * the [IdentityKind] color tokens from the Me tab so any future
 * surface that needs the same switcher has one source of truth. The
 * pill-row variant ships separately at [IdentitySwitcherPillRow]; this
 * sheet is the richer presentation with full card summaries.
 */
@Composable
fun IdentitySwitcherSheet(
    cards: List<IdentitySwitcherCard>,
    sheetState: SheetState,
    onSelect: (IdentitySwitcherCard) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("identitySwitcherSheet"),
    ) {
        IdentitySwitcherSheetBody(cards = cards, onSelect = onSelect)
    }
}

/** Sheet body, exposed for snapshot/preview use without a modal host. */
@Composable
fun IdentitySwitcherSheetBody(
    cards: List<IdentitySwitcherCard>,
    onSelect: (IdentitySwitcherCard) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(bottom = Spacing.s6),
    ) {
        Text(
            text = "Identity switcher",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier =
                Modifier
                    .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s1, bottom = Spacing.s1)
                    .semantics { heading() },
        )
        Text(
            text = "Pick the face you want active in feeds, composer, and chat.",
            fontSize = 12.5.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(start = Spacing.s4, end = Spacing.s4, bottom = 14.dp),
        )
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.padding(horizontal = Spacing.s4),
        ) {
            cards.forEach { card ->
                SwitcherCardBody(card = card, onTap = { onSelect(card) })
            }
        }
    }
}

@Composable
private fun SwitcherCardBody(
    card: IdentitySwitcherCard,
    onTap: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(if (card.isActive) card.kind.accentBg else PantopusColors.appSurface)
                .border(
                    width = if (card.isActive) 2.dp else 1.dp,
                    color = if (card.isActive) card.kind.accent else PantopusColors.appBorder,
                    shape = RoundedCornerShape(14.dp),
                )
                .clickable(onClick = onTap)
                .padding(14.dp)
                .testTag("identitySwitcherCard_${card.kind.key}"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(CircleShape)
                    .background(card.kind.accentBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = card.kind.icon,
                contentDescription = null,
                size = 22.dp,
                strokeWidth = 2f,
                tint = card.kind.accent,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = card.overline.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = card.kind.accent,
                    letterSpacing = 0.8.sp,
                )
                if (card.isActive) {
                    ActivePill(accent = card.kind.accent)
                }
            }
            Text(
                text = card.name,
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 1,
            )
            card.stats?.let {
                Text(
                    text = it,
                    fontSize = 11.5.sp,
                    color = PantopusColors.appTextSecondary,
                    maxLines = 2,
                )
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2f,
            tint = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun ActivePill(accent: Color) {
    Box(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(accent)
                .padding(horizontal = 6.dp, vertical = 1.dp),
    ) {
        Text(
            text = "ACTIVE",
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextInverse,
        )
    }
}

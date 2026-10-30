@file:Suppress("PackageNaming", "MagicNumber", "LongParameterList", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.mailbox.cards

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** The kinds of button on the Christmas card screens: wax red, card stock, or words alone. */
enum class CardButtonKind { Wax, Paper, Words }

/**
 * A button on the Christmas card screens (the web's wax-red primary and cream secondary): 48 dp tall when it fills the
 * width, at least 44 dp when it sits in a row. [busy] shows a spinner beside the words and stops a second tap.
 */
@Composable
fun CardButton(
    title: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    kind: CardButtonKind = CardButtonKind.Wax,
    enabled: Boolean = true,
    busy: Boolean = false,
    fill: Boolean = true,
    /** "Turn it over" says whether the card shows its back. */
    state: String? = null,
    icon: PantopusIcon? = null,
) {
    val shape = RoundedCornerShape(Radii.lg)
    val (background, ink, edge) =
        when (kind) {
            CardButtonKind.Wax -> Triple(PantopusColors.cardWax, PantopusColors.cardWaxText, Color.Transparent)
            CardButtonKind.Paper -> Triple(PantopusColors.cardField, PantopusColors.cardTextBody, PantopusColors.cardFieldEdge)
            CardButtonKind.Words -> Triple(Color.Transparent, PantopusColors.cardWax, Color.Transparent)
        }
    val tappable = enabled && !busy
    Row(
        modifier =
            modifier
                .then(if (fill) Modifier.fillMaxWidth().heightIn(min = 48.dp) else Modifier.heightIn(min = 44.dp))
                .alpha(if (enabled) 1f else 0.5f)
                .clip(shape)
                .background(background)
                .border(1.dp, edge, shape)
                .clickable(enabled = tappable, onClick = onClick)
                .padding(horizontal = if (fill) Spacing.s4 else 18.dp)
                .clearAndSetSemantics {
                    contentDescription = title
                    role = Role.Button
                    state?.let { stateDescription = it }
                    if (!enabled) disabled()
                },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (busy) {
            CircularProgressIndicator(color = ink, strokeWidth = 2.dp, modifier = Modifier.size(18.dp))
        } else if (icon != null) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = ink)
        }
        Text(
            title,
            fontSize = if (kind == CardButtonKind.Wax && fill) 16.sp else 15.sp,
            lineHeight = 20.sp,
            fontWeight = FontWeight.SemiBold,
            color = ink,
            textAlign = TextAlign.Center,
        )
    }
}

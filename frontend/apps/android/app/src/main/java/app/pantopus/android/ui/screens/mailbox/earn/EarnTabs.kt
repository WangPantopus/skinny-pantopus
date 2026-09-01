@file:Suppress("FunctionNaming", "MagicNumber", "MatchingDeclarationName", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.earn

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing

/**
 * A10.11 Earn is two surfaces under one roof:
 *
 * * **Offers** — the paid-offer wall the Mailbox Earn drawer exists for
 *   (RN `src/app/mailbox/earn.tsx`): open an envelope, dwell, bank the
 *   reward. This is the default tab because it is where money is made.
 * * **Earnings** — the designed A10.11 dashboard (balance hero, ways to
 *   earn, recent earnings, payout settings, tax docs) fed by the
 *   `api/mailbox/earnings/…` routes.
 *
 * Mirrors iOS `EarnTab` / `EarnTabStrip`.
 */
enum class EarnTab(
    val tag: String,
    val label: String,
) {
    Offers("offers", "Offers"),
    Earnings("earnings", "Earnings"),
}

/** Two-up underline tab strip for the Earn screen. */
@Composable
fun EarnTabStrip(
    selected: EarnTab,
    onSelect: (EarnTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s5),
            verticalAlignment = Alignment.Bottom,
        ) {
            EarnTab.entries.forEach { tab ->
                TabCell(
                    tab = tab,
                    isSelected = tab == selected,
                    onClick = { onSelect(tab) },
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(PantopusColors.appBorder),
        )
    }
}

@Composable
private fun TabCell(
    tab: EarnTab,
    isSelected: Boolean,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .width(IntrinsicSize.Max)
                .heightIn(min = 40.dp)
                .clickable(onClick = onClick)
                .semantics { selected = isSelected }
                .testTag("earnTab.${tab.tag}"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Bottom,
    ) {
        Text(
            text = tab.label,
            color = if (isSelected) PantopusColors.primary600 else PantopusColors.appTextSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(vertical = Spacing.s2),
        )
        // The underline runs the width of the label — the column takes its
        // max intrinsic width from the `Text`, so `fillMaxWidth` matches it.
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(2.dp)
                    .background(if (isSelected) PantopusColors.primary600 else Color.Transparent),
        )
    }
}

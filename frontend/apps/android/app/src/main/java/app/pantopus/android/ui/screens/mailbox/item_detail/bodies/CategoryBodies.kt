@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory
import app.pantopus.android.ui.screens.root.NotYetAvailableView
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing

/**
 * Factory for the 13 placeholder bodies used by the non-Package categories.
 *
 * The concrete `PackageBody` for A17.8 lives in its own file
 * (`bodies/PackageBody.kt`); category-specific bodies (Coupon / Booklet /
 * Certified / Community / Gig / Memory) likewise live in dedicated files.
 */
@Composable
fun MailItemPlaceholderBody(
    category: MailItemCategory,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .padding(horizontal = Spacing.s4)
                .heightIn(min = 280.dp),
    ) {
        NotYetAvailableView(
            tabName = category.raw.replaceFirstChar { it.uppercase() },
            icon = PantopusIcon.Info,
            accent = PantopusColors.appSurfaceSunken,
            foreground = category.accent,
        )
    }
}

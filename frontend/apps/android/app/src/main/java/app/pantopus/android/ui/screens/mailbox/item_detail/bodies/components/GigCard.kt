@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * White rounded card used by the gig sub-surfaces (A17.6). `padded = false`
 * lets cards that draw their own section dividers manage edge insets.
 */
@Composable
fun GigCard(
    modifier: Modifier = Modifier,
    padded: Boolean = true,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .then(if (padded) Modifier.padding(Spacing.s3) else Modifier),
        content = content,
    )
}

/** Uppercase section eyebrow shared by the gig cards. */
@Composable
fun GigSectionLabel(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextSecondary,
        modifier = modifier,
    )
}

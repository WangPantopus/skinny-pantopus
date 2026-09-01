@file:Suppress("MagicNumber", "UnusedPrivateMember", "MatchingDeclarationName", "LongMethod", "LongParameterList", "VariableNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * Shared empty-state scaffold: 72dp tinted hero circle + Lucide icon +
 * H3 headline + muted subcopy + optional primary CTA.
 *
 * @param icon Pantopus icon for the hero circle.
 * @param headline Bold H3 message.
 * @param subcopy Muted supporting sentence.
 * @param ctaTitle Title of the primary CTA. Pass null for no CTA.
 * @param onCta Tap handler invoked when [ctaTitle] is set.
 * @param tint Circle background. Defaults to personal identity bg.
 * @param accent Icon stroke color.
 */
@Composable
fun EmptyState(
    icon: PantopusIcon,
    headline: String,
    subcopy: String,
    modifier: Modifier = Modifier,
    ctaTitle: String? = null,
    onCta: (() -> Unit)? = null,
    tint: Color = PantopusColors.personalBg,
    accent: Color = PantopusColors.primary600,
) {
    Column(
        modifier =
            modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .padding(horizontal = Spacing.s6)
                .semantics { contentDescription = "$headline. $subcopy" },
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier =
                Modifier
                    .size(72.dp)
                    .clip(CircleShape)
                    .background(tint),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 32.dp, tint = accent)
        }
        Spacer(Modifier.size(Spacing.s4))
        Text(
            text = headline,
            style = PantopusTextStyle.h3,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.size(Spacing.s2))
        Text(
            text = subcopy,
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
        if (ctaTitle != null && onCta != null) {
            Spacer(Modifier.size(Spacing.s4))
            PrimaryButton(title = ctaTitle, onClick = onCta)
        }
    }
}

@Preview(showBackground = true, widthDp = 360, heightDp = 480)
@Composable
private fun EmptyStateNoCtaPreview() {
    EmptyState(
        icon = PantopusIcon.Inbox,
        headline = "No mail yet",
        subcopy = "When a neighbor sends you something, it'll land here.",
    )
}

@Preview(showBackground = true, widthDp = 360, heightDp = 480)
@Composable
private fun EmptyStateWithCtaPreview() {
    EmptyState(
        icon = PantopusIcon.Home,
        headline = "No home verified",
        subcopy = "Claim your address to unlock neighborhood features.",
        ctaTitle = "Claim address",
        onCta = {},
    )
}

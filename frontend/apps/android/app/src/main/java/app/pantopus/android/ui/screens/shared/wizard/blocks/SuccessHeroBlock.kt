package app.pantopus.android.ui.screens.shared.wizard.blocks

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/** Test tag applied to the success hero container. */
const val WIZARD_SUCCESS_HERO_TAG = "wizardSuccessHero"

/**
 * Hero block for a wizard's success step — large green check + headline +
 * subcopy. The wizard renders its CTAs through the shell's primary +
 * secondary slots; this block is content only.
 */
@Composable
fun SuccessHeroBlock(
    headline: String,
    subcopy: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .padding(vertical = Spacing.s8)
                .testTag(WIZARD_SUCCESS_HERO_TAG),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Box(
            modifier =
                Modifier
                    .size(96.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.successBg),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = 48.dp,
                tint = PantopusColors.success,
            )
        }
        Text(
            text = headline,
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { heading() },
        )
        Text(
            text = subcopy,
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

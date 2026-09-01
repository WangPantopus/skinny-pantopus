package app.pantopus.android.ui.screens.shared.wizard.blocks

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle

/** Wizard content block — supporting paragraph under [HeadlineBlock]. */
@Composable
fun SubcopyBlock(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = PantopusTextStyle.body,
        color = PantopusColors.appTextSecondary,
        modifier = modifier.fillMaxWidth(),
    )
}

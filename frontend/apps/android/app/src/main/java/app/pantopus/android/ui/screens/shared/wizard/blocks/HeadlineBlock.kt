package app.pantopus.android.ui.screens.shared.wizard.blocks

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle

/** Wizard content block — H2 headline used at the top of most steps. */
@Composable
fun HeadlineBlock(
    text: String,
    modifier: Modifier = Modifier,
) {
    Text(
        text = text,
        style = PantopusTextStyle.h2,
        color = PantopusColors.appText,
        modifier =
            modifier
                .fillMaxWidth()
                .semantics { heading() },
    )
}

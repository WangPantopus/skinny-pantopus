package app.pantopus.android.ui.screens.crewday.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.plans.detail.PlanFooter
import app.pantopus.android.ui.screens.plans.detail.PlanRoundButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * A Crew Day step page (boards `Price`, `Review`): the Plans plain bar with Back or Close, a centered title and the
 * step on the right ("1 of 2"), the scrolling content, and a sticky footer for the price and the main action.
 */
@Composable
fun CrewDayFlowScaffold(
    title: String,
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    step: String? = null,
    closeIcon: Boolean = false,
    footer: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = modifier.fillMaxSize().background(PantopusColors.appBg)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PlanRoundButton(
                icon = if (closeIcon) PantopusIcon.X else PantopusIcon.ChevronLeft,
                label = if (closeIcon) "Close" else "Back",
                onClick = onBack,
                glass = false,
            )
            Text(
                text = title,
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f).semantics { heading() },
                textAlign = TextAlign.Center,
            )
            Box(modifier = Modifier.widthIn(min = 44.dp), contentAlignment = Alignment.CenterEnd) {
                step?.let { Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary) }
            }
        }
        Column(
            modifier =
                Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s1),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            content = content,
        )
        if (footer != null) PlanFooter(content = footer)
    }
}

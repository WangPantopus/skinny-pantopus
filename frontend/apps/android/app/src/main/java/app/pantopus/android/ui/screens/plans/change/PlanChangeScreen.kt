@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.plans.change

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.plans.components.PlanDivider
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanWhenCard
import app.pantopus.android.ui.screens.plans.detail.PlanPlainScaffold
import app.pantopus.android.ui.screens.plans.map.PlanRowsSkeleton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.format.DateTimeFormatter
import java.util.Locale

/** H11: change the time, and see the "Still coming?" everyone in will get. */
@Composable
fun PlanChangeScreen(
    onDone: () -> Unit,
    viewModel: PlanChangeViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(ui.saved) { if (ui.saved) onDone() }
    val clock = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
    val was = ui.originalStart?.format(clock)
    PlanPlainScaffold(
        onBack = onDone,
        title = "Change the time",
        modifier = Modifier.testTag("planChange"),
        footer = {
            PrimaryButton(
                title = if (ui.asksStillComing) "Save and ask them" else "Save",
                onClick = viewModel::save,
                isLoading = ui.saving,
                isEnabled = ui.changed && !ui.saving,
                modifier = Modifier.height(50.dp),
            )
            if (was != null) PlanTextButton(title = "Keep $was", onClick = onDone)
        },
    ) {
        if (ui.plan == null) {
            if (ui.error != null) {
                Text(text = ui.error.orEmpty(), style = PantopusTextStyle.body, color = PantopusColors.appTextSecondary)
            } else {
                PlanRowsSkeleton(rows = 2)
            }
            return@PlanPlainScaffold
        }
        PlanField(label = "When") {
            PlanWhenCard(
                start = ui.start,
                end = ui.end,
                onStart = viewModel::setStart,
                onEnd = viewModel::setEnd,
                startHighlighted = ui.start != ui.originalStart,
            )
            if (was != null && ui.start != ui.originalStart) {
                Text(text = "Was $was", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
        }
        ui.error?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.error) }
        if (ui.asksStillComing) {
            StillComingWarning(ui.peopleIn)
            NotificationPreview(ui)
        }
    }
}

@Composable
private fun StillComingWarning(peopleIn: Int) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.warningBg)
                .padding(horizontal = 14.dp, vertical = Spacing.s3)
                .semantics(mergeDescendants = true) {},
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = PantopusIcon.AlertTriangle, contentDescription = null, size = 22.dp, tint = PantopusColors.warning)
        Text(
            text =
                "${if (peopleIn == 1) "1 person is" else "$peopleIn people are"} in. Moving the time by more than 30 minutes " +
                    "asks each of them “Still coming?”",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextStrong,
        )
    }
}

/** What they'll get (board H11): the notification and its two buttons. */
@Composable
private fun NotificationPreview(ui: PlanChangeUi) {
    val plan = ui.plan ?: return
    val host = PlanFormat.firstName(plan.host?.displayName)
    val noun = plan.planKind?.noun ?: "plan"
    val start = ui.start ?: return
    val day = start.format(DateTimeFormatter.ofPattern("EEEE", Locale.US))
    val time = start.format(DateTimeFormatter.ofPattern("h:mm a", Locale.US))
    PlanField(label = "What they'll get") {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(22.dp))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(22.dp))
                    .padding(horizontal = 14.dp, vertical = Spacing.s3)
                    .semantics(mergeDescendants = true) {},
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Box(modifier = Modifier.size(22.dp).clip(RoundedCornerShape(6.dp)).background(PantopusColors.primary600))
                Text(
                    text = "Pantopus · now",
                    style = PantopusTextStyle.small.copy(fontSize = PantopusTextStyle.caption.fontSize),
                    color = PantopusColors.appTextSecondary,
                )
            }
            Text(
                text = "$host moved the $noun",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(text = "Now $day at $time. Still coming?", style = PantopusTextStyle.body, color = PantopusColors.appText)
        }
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.xl))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl)),
        ) {
            Text(
                text = "Still coming",
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = 13.dp),
            )
            PlanDivider()
            Text(
                text = "Can't make it",
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = 13.dp),
            )
        }
    }
}

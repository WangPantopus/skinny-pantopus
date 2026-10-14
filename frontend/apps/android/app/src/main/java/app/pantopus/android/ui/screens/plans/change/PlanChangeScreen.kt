@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.plans.change

import androidx.activity.compose.BackHandler
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
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.plans.components.PlanDivider
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTile
import app.pantopus.android.ui.screens.plans.components.PlanWhenCard
import app.pantopus.android.ui.screens.plans.detail.PlanPlainScaffold
import app.pantopus.android.ui.screens.plans.host.PlacePickerState
import app.pantopus.android.ui.screens.plans.host.PublicPlacePicker
import app.pantopus.android.ui.screens.plans.host.placeCaption
import app.pantopus.android.ui.screens.plans.map.PlanRowsSkeleton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.time.format.DateTimeFormatter
import java.util.Locale

/** H11: change the time (or a public plan's place, with H6's picker), and see the "Still coming?" everyone in will get. */
@Composable
fun PlanChangeScreen(
    onDone: () -> Unit,
    viewModel: PlanChangeViewModel = hiltViewModel(),
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(ui.saved) { if (ui.saved) onDone() }
    if (ui.picking) {
        ChangePlacePicker(ui, viewModel)
        return
    }
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
        if (ui.canChangePlace) WhereField(ui, onClick = viewModel::openPlaces)
        ui.error?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.error) }
        if (ui.asksStillComing) {
            StillComingWarning(ui.peopleIn, placeChanged = ui.newPlace != null)
            NotificationPreview(ui)
        }
    }
}

/** H6 over H11: another public place for the plan, near the one it's at; Back returns to H11. */
@Composable
private fun ChangePlacePicker(
    ui: PlanChangeUi,
    viewModel: PlanChangeViewModel,
) {
    BackHandler(onBack = viewModel::closePlaces)
    PublicPlacePicker(
        state =
            PlacePickerState(
                kind = ui.plan?.planKind ?: PlanKind.WATCH_PARTY,
                candidate = ui.placeCandidate,
                query = ui.placesQuery,
                places = ui.places,
                loading = ui.placesLoading,
                attribution = ui.placesAttribution,
                origin = ui.placesOrigin,
                error = ui.error,
            ),
        onClose = viewModel::closePlaces,
        onUse = viewModel::usePlace,
        onSearch = viewModel::searchPlaces,
        onPick = viewModel::pickPlaceCandidate,
    )
}

/** "Where": the plan's place, or the new one in the accent color, opening H6 (public plans, as on iOS). */
@Composable
private fun WhereField(
    ui: PlanChangeUi,
    onClick: () -> Unit,
) {
    val plan = ui.plan ?: return
    val kind = plan.planKind ?: PlanKind.WATCH_PARTY
    val name = ui.newPlace?.name ?: plan.place?.name ?: plan.area?.label ?: "Choose a place"
    PlanField(label = "Where") {
        PlanFormCard {
            PlanOptionRow(
                first = true,
                onClick = onClick,
                modifier =
                    Modifier.clearAndSetSemantics {
                        contentDescription = "Where: $name. Choose another place"
                        role = Role.Button
                    },
            ) {
                PlanTile(kind, size = 36.dp, glyph = 18.dp, corner = 10.dp)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = name,
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = if (ui.newPlace != null) PantopusColors.primary700 else PantopusColors.appText,
                    )
                    Text(
                        text = ui.newPlace?.let(::placeCaption) ?: "Choose another place",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 16.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
        }
    }
}

@Composable
private fun StillComingWarning(
    peopleIn: Int,
    placeChanged: Boolean,
) {
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
                "${if (peopleIn == 1) "1 person is" else "$peopleIn people are"} in. " +
                    if (placeChanged) {
                        "Changing the place asks each of them “Still coming?”"
                    } else {
                        "Moving the time by more than 30 minutes asks each of them “Still coming?”"
                    },
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
    val now = "Now ${PlanFormat.dayAt(start.atZone(PlanFormat.zone(plan.timezone)))}"
    // The push the server sends (board H11), word for word.
    val (title, body) =
        when {
            ui.timeMoved && ui.newPlace != null -> "$host changed the $noun" to "$now, at a new place. Still coming?"
            ui.newPlace != null -> "$host changed the place" to "It's at a new place now. Still coming?"
            else -> "$host moved the $noun" to "$now. Still coming?"
        }
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
                text = title,
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(text = body, style = PantopusTextStyle.body, color = PantopusColors.appText)
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

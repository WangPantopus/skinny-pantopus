@file:Suppress("LongMethod", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.crewday.ask

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.crewday.components.CrewDayFlowScaffold
import app.pantopus.android.ui.screens.crewday.components.CrewDayTile
import app.pantopus.android.ui.screens.plans.components.PlanChoice
import app.pantopus.android.ui.screens.plans.components.PlanChoiceGroup
import app.pantopus.android.ui.screens.plans.components.PlanLockLine
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.components.planCard
import app.pantopus.android.ui.screens.plans.detail.PlanFooterCaption
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Where the ask hands off. */
data class CrewDayAskActions(
    val onBack: () -> Unit,
    /** After Send request: Your Crew Days, where the request shows under "Asked for". */
    val onSent: () -> Unit,
    /** "Add your home": the existing home setup. */
    val onAddHome: () -> Unit,
)

/**
 * Ask for a Crew Day on your street (screen 11, board `AskStreet` with `hasHome` and `noHome`): service chips, the
 * street from the person's home, the months that suit them or any time, an optional note, and Send request.
 */
@Composable
fun CrewDayAskScreen(
    actions: CrewDayAskActions,
    viewModel: CrewDayAskViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    // Again on every return, so a home added in the home setup shows at once.
    LaunchedEffect(Unit) { viewModel.loadHomes() }
    LaunchedEffect(state.sent) { if (state.sent) actions.onSent() }
    CrewDayFlowScaffold(
        title = "Ask for a Crew Day",
        onBack = actions.onBack,
        modifier = Modifier.testTag("crewDayAsk"),
        footer = {
            state.error?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("crewDayAskError"),
                )
            }
            PrimaryButton(
                title = "Send request",
                onClick = viewModel::send,
                isEnabled = state.canSend,
                isLoading = state.sending,
                modifier = Modifier.fillMaxWidth().testTag("crewDayAskSend"),
            )
            PlanFooterCaption("We'll tell you within a week whether a crew can come.")
        },
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s5)) {
            Text(
                text = "Tell us what your street needs. We'll look for a local crew. Nothing is booked until you see a price.",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextStrong,
            )
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PlanOverline("Service", modifier = Modifier.semantics { heading() })
                PlanChoiceGroup(
                    choices = CrewDayFormat.SERVICES.map { PlanChoice(it, CrewDayFormat.service(it)) },
                    isSelected = { it.id == state.service },
                    onSelect = { viewModel.setService(it.id) },
                    tagFor = { "crewDayAskService_${it.id}" },
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PlanOverline("Your street", modifier = Modifier.semantics { heading() })
                val home = state.home
                when {
                    home != null -> {
                        Row(
                            modifier =
                                Modifier
                                    .fillMaxWidth()
                                    .planCard()
                                    .padding(14.dp)
                                    .semantics(mergeDescendants = true) {}
                                    .testTag("crewDayAskStreet"),
                            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            CrewDayTile()
                            Column {
                                Text(
                                    text = home.street,
                                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                                    color = PantopusColors.appText,
                                )
                                Text(text = "From your home", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                            }
                        }
                        PlanLockLine("Neighbors see the street and the service, never who asked.")
                    }
                    !state.loadingHomes ->
                        Column(
                            modifier = Modifier.fillMaxWidth().planCard().padding(14.dp).testTag("crewDayAskNoHome"),
                            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                        ) {
                            Text(
                                text = "Add your home first",
                                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                                color = PantopusColors.appText,
                            )
                            Text(
                                text = "We ask crews for the street your home is on.",
                                style = PantopusTextStyle.small,
                                color = PantopusColors.appTextSecondary,
                            )
                            PlanTonalButton(
                                title = "Add your home",
                                onClick = actions.onAddHome,
                                icon = PantopusIcon.Home,
                                height = 44.dp,
                                modifier = Modifier.fillMaxWidth().testTag("crewDayAskAddHome"),
                            )
                        }
                    else -> Unit
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PlanOverline("When suits you", modifier = Modifier.semantics { heading() })
                PlanChoiceGroup(
                    choices = viewModel.monthChoices.map { PlanChoice(it.toString(), it.format(MONTH)) } + PlanChoice(ANY, "Any time"),
                    isSelected = { if (it.id == ANY) state.months.isEmpty() else it.id in state.months },
                    onSelect = { if (it.id == ANY) viewModel.anyTime() else viewModel.toggleMonth(YearMonth.parse(it.id)) },
                    multiSelect = true,
                    tagFor = { "crewDayAskMonth_${it.id}" },
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    PlanOverline("Anything else? (optional)", modifier = Modifier.weight(1f))
                    Text(
                        text = "${state.note.length} / ${CrewDayAskState.MAX_NOTE}",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                PlanTextArea(
                    value = state.note,
                    onValue = viewModel::setNote,
                    placeholder = "Back gutters only, or any time after the leaves fall",
                    label = "Anything else",
                )
            }
        }
    }
}

private const val ANY = "any"
private val MONTH = DateTimeFormatter.ofPattern("MMM", Locale.US)

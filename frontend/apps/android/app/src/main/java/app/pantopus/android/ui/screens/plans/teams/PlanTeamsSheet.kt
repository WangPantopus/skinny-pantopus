package app.pantopus.android.ui.screens.plans.teams

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.plans.PlanTeamDto
import app.pantopus.android.ui.components.closesKeyboardOnTapOrScroll
import app.pantopus.android.ui.screens.plans.components.PlanChoice
import app.pantopus.android.ui.screens.plans.components.PlanChoiceGroup
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanSwitchRow
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlanTeamsSheet(
    onClose: () -> Unit,
    vm: PlanTeamsViewModel = hiltViewModel(),
) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { vm.load() }
    ModalBottomSheet(
        modifier = Modifier.closesKeyboardOnTapOrScroll(),
        onDismissRequest = onClose,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
    ) {
        Column(
            modifier =
                Modifier.fillMaxWidth().verticalScroll(
                    rememberScrollState(),
                ).padding(Spacing.s4).navigationBarsPadding().imePadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Text("Your teams", style = PantopusTextStyle.h3, color = PantopusColors.appText)
            PlanTextButton("Done", onClose)
            PlanTextArea(
                value = ui.query,
                onValue = vm::search,
                placeholder = "Search teams, cities or states",
                label = "Search teams",
                singleLine = true,
            )
            PlanSwitchRow(
                "Not into sports",
                "Hide game suggestions",
                ui.preferences.watch == "off",
                { if (!ui.saving) vm.setOff(it) },
            )
            TeamChoices(
                if (ui.query.isBlank()) "Suggested near you" else "Search results",
                if (ui.query.isBlank()) ui.suggested else ui.results,
                ui,
                vm,
            )
            ChosenTeams("Following", ui.preferences.teams.orEmpty(), false, ui, vm)
            ChosenTeams("Hidden teams", ui.preferences.hidden.orEmpty(), true, ui, vm)
            PlanField("Leagues · postseason and championships") {
                PlanChoiceGroup(
                    choices = sportsLeagues.map { PlanChoice(it, leagueLabel(it), !ui.saving && ui.loaded) },
                    isSelected = { it.id in ui.preferences.leagues.orEmpty() },
                    onSelect = { vm.toggleLeague(it.id) },
                    multiSelect = true,
                )
            }
            ui.error?.let {
                Text(it, style = PantopusTextStyle.small, color = PantopusColors.error)
                PlanTextButton("Try again", vm::load)
            }
        }
    }
}

@Composable
private fun TeamChoices(
    title: String,
    teams: List<PlanTeamDto>,
    ui: PlanTeamsUi,
    vm: PlanTeamsViewModel,
) {
    PlanField(title) {
        if (teams.isEmpty()) {
            Text(
                if (ui.query.isBlank()) "Search for any team you follow." else "No teams found.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        PlanChoiceGroup(
            choices = teams.map { PlanChoice(it.id, it.name, !ui.saving && ui.loaded) },
            isSelected = { it.id in ui.preferences.teams.orEmpty() },
            onSelect = { vm.follow(it.id) },
            multiSelect = true,
        )
    }
}

@Composable
private fun ChosenTeams(
    title: String,
    ids: List<String>,
    hidden: Boolean,
    ui: PlanTeamsUi,
    vm: PlanTeamsViewModel,
) {
    PlanField(title) {
        if (ids.isEmpty()) Text("None yet", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        ids.forEach { id ->
            PlanTextButton(
                "${if (hidden) "Unhide" else "Remove"} ${ui.known[id]?.name ?: id}",
                { if (hidden) vm.unhide(id) else vm.follow(id) },
                enabled = !ui.saving && ui.loaded,
            )
        }
    }
}

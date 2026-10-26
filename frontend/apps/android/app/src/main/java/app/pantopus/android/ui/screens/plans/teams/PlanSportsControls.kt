package app.pantopus.android.ui.screens.plans.teams

import android.content.Context
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.plans.PlanGameDto
import app.pantopus.android.data.api.models.plans.PlansSportsDto
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.ui.screens.plans.components.PlanChoice
import app.pantopus.android.ui.screens.plans.components.PlanChoiceGroup
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.rememberGameTime
import app.pantopus.android.ui.screens.plans.host.HostFlowViewModel
import app.pantopus.android.ui.screens.plans.host.HostUi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle

@Composable
fun PlanWatchGameFields(
    ui: HostUi,
    vm: HostFlowViewModel,
    teams: PlanTeamsViewModel = hiltViewModel(),
) {
    var showsTeams by remember { mutableStateOf(false) }
    var menuGame by remember { mutableStateOf<PlanGameDto?>(null) }
    val teamUi by teams.ui.collectAsStateWithLifecycle()
    SportsChanges(teamUi, vm::refreshGames)
    val now by rememberGameTime()
    PlanField("Game") {
        val available = ui.games.filter { it.isAvailable(now) }
        val shown = (available.take(GAME_CHIPS) + available.filter { it.id == ui.draft.gameId }).distinctBy { it.id }
        val choices =
            shown.map { game ->
                val time = PlanFormat.instant(game.startsAt)?.let { PlanFormat.shortWhen(it, ui.zone) }
                PlanChoice(game.id, listOfNotNull(game.matchupLabel(), time).joinToString(" · "))
            } + PlanChoice("another", "Another game")
        PlanChoiceGroup(
            choices = choices,
            isSelected = { it.id == (ui.draft.gameId ?: "another") },
            onSelect = { choice -> vm.pickGame(available.firstOrNull { it.id == choice.id }) },
            onLongClick = if (ui.sports?.canChoose == true) { choice -> menuGame = available.firstOrNull { it.id == choice.id } } else null,
        )
        SportsMenu(menuGame, { menuGame = null }, teams)
        Text("Picking a game fills in the title and the time.", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        if (ui.sports?.canChoose == true) PlanTextButton("Edit teams", { showsTeams = true })
        ui.sports?.attribution?.let { Attribution(it) }
        teamUi.error?.let { Text(it, style = PantopusTextStyle.small, color = PantopusColors.error) }
    }
    if (showsTeams) {
        PlanTeamsSheet({
            showsTeams = false
            vm.refreshGames()
        }, teams)
    }
}

@Composable
fun PlansSportsEmpty(
    games: List<PlanGameDto>,
    sports: PlansSportsDto?,
    onChange: () -> Unit,
    teams: PlanTeamsViewModel = hiltViewModel(),
    content: @Composable (PlanGameDto?, (() -> Unit)?) -> Unit,
) {
    val storage = LocalContext.current.getSharedPreferences("plans.sports", Context.MODE_PRIVATE)
    var dismissed by remember { mutableStateOf(storage.getBoolean("askDismissed", false)) }
    var showsTeams by remember { mutableStateOf(false) }
    var menuGame by remember { mutableStateOf<PlanGameDto?>(null) }
    val ui by teams.ui.collectAsStateWithLifecycle()
    SportsChanges(ui, onChange)
    val now by rememberGameTime()
    val game = games.firstOrNull { it.isAvailable(now) }
    when {
        sports?.canChoose != true -> content(game, null)
        sports.state == "unset" && !dismissed ->
            Column {
                Text("Watch games with neighbors?", style = PantopusTextStyle.body, color = PantopusColors.appText)
                PlanTextButton("Choose teams", { showsTeams = true })
                PlanTextButton("Not into sports", { teams.setOff(true) }, enabled = !ui.saving)
                PlanTextButton("×", {
                    dismissed = true
                    storage.edit().putBoolean("askDismissed", true).apply()
                })
            }
        sports.state == "on" && game != null ->
            Column {
                content(game) { menuGame = game }
                SportsMenu(menuGame, { menuGame = null }, teams)
                sports.attribution?.let { Attribution(it) }
            }
    }
    ui.error?.let { Text(it, style = PantopusTextStyle.small, color = PantopusColors.error) }
    if (showsTeams) {
        PlanTeamsSheet({
            showsTeams = false
            onChange()
        }, teams)
    }
}

@Composable
private fun SportsMenu(
    game: PlanGameDto?,
    close: () -> Unit,
    vm: PlanTeamsViewModel,
) {
    DropdownMenu(expanded = game != null, onDismissRequest = close) {
        game?.team?.let { team ->
            DropdownMenuItem(text = { Text("Hide ${game.label} games") }, onClick = {
                vm.hide(team)
                close()
            })
        }
        DropdownMenuItem(text = { Text("Not into sports") }, onClick = {
            vm.setOff(true)
            close()
        })
    }
}

@Composable
private fun SportsChanges(
    ui: PlanTeamsUi,
    onChange: () -> Unit,
) {
    var revision by remember { mutableIntStateOf(ui.revision) }
    LaunchedEffect(ui.revision) {
        if (ui.revision != revision) {
            revision = ui.revision
            onChange()
        }
    }
}

@Composable
private fun Attribution(text: String) {
    Text(text, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
}

private const val GAME_CHIPS = 3

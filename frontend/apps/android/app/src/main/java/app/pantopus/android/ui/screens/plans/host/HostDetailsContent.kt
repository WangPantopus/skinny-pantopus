@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.plans.host

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.plans.KidsAgeBand
import app.pantopus.android.data.plans.PlanAutoRule
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.ui.components.PantopusCheckbox
import app.pantopus.android.ui.screens.plans.components.PlanChoice
import app.pantopus.android.ui.screens.plans.components.PlanChoiceGroup
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanIconTile
import app.pantopus.android.ui.screens.plans.components.PlanNote
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanScopeLine
import app.pantopus.android.ui.screens.plans.components.PlanSegmented
import app.pantopus.android.ui.screens.plans.components.PlanStepperRow
import app.pantopus.android.ui.screens.plans.components.PlanSwitchRow
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanTile
import app.pantopus.android.ui.screens.plans.components.PlanWhenCard
import app.pantopus.android.ui.screens.plans.detail.extraGearWord
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import java.time.format.DateTimeFormatter
import java.util.Locale

/** H2 to H5: the details for the chosen type. */
@Composable
internal fun HostDetailsStep(
    ui: HostUi,
    vm: HostFlowViewModel,
    onBack: () -> Unit,
) {
    val kind = ui.draft.kind ?: return
    HostStepScaffold(
        title = kind.label,
        step = "2 of 3",
        leadingClose = false,
        onLeading = onBack,
        footer = {
            ui.error?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.error) }
            HostFooterButton(title = "Preview", onClick = vm::preview)
        },
    ) {
        when (kind) {
            PlanKind.WATCH_PARTY -> WatchFields(ui, vm)
            PlanKind.PLAYDATE -> PlaydateFields(ui, vm)
            PlanKind.PICKUP_GAME -> PickupFields(ui, vm)
            PlanKind.WALK_COFFEE -> WalkFields(ui, vm)
        }
    }
}

private const val GAME_CHIPS = 3

/** H2: watch party. */
@Composable
private fun ColumnScope.WatchFields(
    ui: HostUi,
    vm: HostFlowViewModel,
) {
    val draft = ui.draft
    PlanField(label = "Game") {
        // The three soonest games (and the one already picked), then "Another game" (as on iOS).
        val shown = (ui.games.take(GAME_CHIPS) + ui.games.filter { it.id == draft.gameId }).distinctBy { it.id }
        val choices =
            shown.map { game ->
                val time = PlanFormat.instant(game.startsAt)?.let { PlanFormat.shortWhen(it, ui.zone) }
                PlanChoice(game.id, listOfNotNull(game.label, time).joinToString(" · "))
            } + PlanChoice(ANOTHER_GAME, "Another game")
        PlanChoiceGroup(
            choices = choices,
            isSelected = { it.id == (draft.gameId ?: ANOTHER_GAME) },
            onSelect = { choice -> vm.pickGame(ui.games.firstOrNull { it.id == choice.id }) },
        )
        Text(
            text = "Picking a game fills in the title and the time.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
    TitleField(draft.title, vm::setTitle)
    WhenField(ui, vm)
    WhereField(ui, vm, homeLabel = "My place")
    PlanStepperRow(
        title = "Spots",
        caption = "People who can join, besides you",
        value = draft.spots,
        range = 1..MAX_SPOTS,
        onChange = { value -> vm.edit { it.copy(spots = value) } },
    )
    HowPeopleGetIn(ui, vm)
    NoteField(draft.note, label = "Note for people who are in", placeholder = "Park on the street. The side gate is open.") { text ->
        vm.edit { it.copy(note = text) }
    }
    PlanField(label = "About · everyone sees this") {
        PlanTextArea(
            value = draft.about,
            onValue = { text -> vm.edit { it.copy(about = text.take(ABOUT_MAX)) } },
            placeholder = "Big screen in the backyard. Kids welcome.",
            label = "About, everyone sees this",
        )
    }
}

/** H3: playdate. */
@Composable
private fun ColumnScope.PlaydateFields(
    ui: HostUi,
    vm: HostFlowViewModel,
) {
    val draft = ui.draft
    PlanNote("Playdates happen in public places, parents stay, and only ages are shared. Everyone who joins has a verified address.")
    PlanField(label = "Kids' ages") {
        PlanChoiceGroup(
            choices = KidsAgeBand.entries.map { PlanChoice(it.wire, it.label) },
            isSelected = { it.id in draft.kidsAgeBands },
            onSelect = { choice -> vm.edit { it.copy(kidsAgeBands = it.kidsAgeBands.toggle(choice.id)) } },
            multiSelect = true,
        )
    }
    TitleField(draft.title, vm::setTitle)
    PlanField(label = "When") {
        PlanWhenCard(start = draft.start, end = draft.end, onStart = vm::setStart, onEnd = vm::setEnd)
        val shown =
            draft.start?.let {
                "“${it.format(DateTimeFormatter.ofPattern("EEEE", Locale.US))} ${dayPartWord(it.hour)}”"
            } ?: "the part of the day"
        PlanScopeLine("Neighbors see $shown until you accept them.")
    }
    PlanField(label = "Where") {
        PlaceRow(ui, onClick = vm::openPlaces)
        PlanScopeLine("Families you accept see the exact spot. Others see the neighborhood.")
    }
    PlanStepperRow(
        title = "Families",
        caption = "Besides yours",
        value = draft.spots,
        range = 1..MAX_FAMILIES,
        onChange = { value -> vm.edit { it.copy(spots = value) } },
    )
    PlanField(label = "How families get in") {
        PlanFormCard {
            PlanOptionRow(first = true) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(text = "You approve each family", style = semibold, color = PantopusColors.appText)
                    Text(text = "Always on for playdates", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                }
                PantopusIconImage(icon = PantopusIcon.Lock, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextSecondary)
            }
        }
    }
    NoteField(draft.note, label = "Note for families who are in", placeholder = "Meet by the big slide. We'll bring bubbles.") { text ->
        vm.edit { it.copy(note = text) }
    }
}

/** H4: pickup game. */
@Composable
private fun ColumnScope.PickupFields(
    ui: HostUi,
    vm: HostFlowViewModel,
) {
    val draft = ui.draft
    PlanField(label = "Sport") {
        PlanChoiceGroup(
            choices = sports.map { (id, label) -> PlanChoice(id, label) },
            isSelected = { it.id == draft.sport },
            onSelect = { choice ->
                vm.edit { d ->
                    val label = sports.firstOrNull { it.first == choice.id }?.second ?: "Pickup game"
                    d.copy(sport = choice.id, title = if (d.titleEdited) d.title else "$label, need ${d.spots}")
                }
            },
        )
    }
    PlanField(label = "Level") {
        PlanSegmented(
            options = listOf("any" to "Any level", "casual" to "Casual", "competitive" to "Competitive"),
            selected = draft.level,
            onSelect = { level -> vm.edit { it.copy(level = level) } },
        )
    }
    PlanField(label = "When") {
        PlanSegmented(
            options = listOf("now" to "Now", "later" to "Later"),
            selected = if (draft.pickupNow) "now" else "later",
            onSelect = { vm.setPickupNow(it == "now") },
        )
        PlanWhenCard(
            start = draft.start,
            end = draft.end,
            onStart = vm::setStart,
            onEnd = vm::setEnd,
            showStart = !draft.pickupNow,
            endLabel = if (draft.pickupNow) "Until" else "Ends",
        )
    }
    PlanField(label = "Where") {
        PlaceRow(ui, onClick = vm::openPlaces)
        PlanScopeLine("Your location only proves you're nearby. The pin shows the place's area.")
    }
    PlanStepperRow(
        title = "Players needed",
        caption = "Shown as “need ${draft.spots}”",
        value = draft.spots,
        range = 1..MAX_SPOTS,
        onChange = { value ->
            vm.edit { d ->
                val label = sports.firstOrNull { it.first == d.sport }?.second ?: "Pickup game"
                d.copy(spots = value, title = if (d.titleEdited) d.title else "$label, need $value")
            }
        },
    )
    HowPeopleGetIn(ui, vm)
    PlanSwitchRow(
        title = "I have extra ${extraGearWord(draft.sport)}",
        caption = "Shown on the plan",
        checked = draft.extraGear,
        onChecked = { on -> vm.edit { it.copy(extraGear = on) } },
    )
    NoteField(draft.note, label = "Note for people who are in", placeholder = "Court 3, by the fence.", singleLine = true) { text ->
        vm.edit { it.copy(note = text) }
    }
}

/** H5: walk and coffee. */
@Composable
private fun ColumnScope.WalkFields(
    ui: HostUi,
    vm: HostFlowViewModel,
) {
    val draft = ui.draft
    PlanField(label = "Kind") {
        PlanChoiceGroup(
            choices = walkKinds.map { (id, label) -> PlanChoice(id, label) },
            isSelected = { it.id == draft.walkKind },
            onSelect = { choice -> vm.edit { it.copy(walkKind = choice.id) } },
        )
    }
    TitleField(draft.title, vm::setTitle)
    PlanField(label = "Pace") {
        PlanSegmented(
            options = listOf("easy" to "Easy", "brisk" to "Brisk"),
            selected = draft.pace,
            onSelect = { pace -> vm.edit { it.copy(pace = pace) } },
        )
    }
    PlanSwitchRow(
        title = "Dogs welcome",
        caption = "Shown on the plan",
        checked = draft.dogsWelcome,
        onChecked = { on -> vm.edit { it.copy(dogsWelcome = on) } },
    )
    WhenField(ui, vm)
    WhereField(ui, vm, homeLabel = "My porch")
    PlanStepperRow(
        title = "People",
        caption = "Besides you",
        value = draft.spots,
        range = 1..MAX_SPOTS,
        onChange = { value -> vm.edit { it.copy(spots = value) } },
    )
    HowPeopleGetIn(ui, vm)
    NoteField(
        draft.note,
        label = "Note for people who are in",
        placeholder = "Meet at the trailhead sign. Coffee after.",
        singleLine = true,
    ) { text ->
        vm.edit { it.copy(note = text) }
    }
}

private const val ANOTHER_GAME = "another"
private const val MAX_SPOTS = 30
private const val MAX_FAMILIES = 10
private const val ABOUT_MAX = 500
private const val NOTE_MAX = 500

private val semibold = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold)

private val sports =
    listOf(
        "pickleball" to "Pickleball",
        "basketball" to "Basketball",
        "soccer" to "Soccer",
        "tennis" to "Tennis",
        "volleyball" to "Volleyball",
        "running" to "Running",
        "other" to "Other",
    )

private val walkKinds =
    listOf(
        "walk" to "Walk",
        "dog_walk" to "Dog walk",
        "stroller_walk" to "Stroller walk",
        "coffee" to "Coffee",
    )

@Composable
private fun TitleField(
    title: String,
    onTitle: (String) -> Unit,
) {
    PlanField(label = "Title") {
        PlanTextArea(value = title, onValue = onTitle, placeholder = "Give it a short title", label = "Title", singleLine = true)
    }
}

@Composable
private fun WhenField(
    ui: HostUi,
    vm: HostFlowViewModel,
) {
    PlanField(label = "When") {
        PlanWhenCard(start = ui.draft.start, end = ui.draft.end, onStart = vm::setStart, onEnd = vm::setEnd)
    }
}

/** "A public place" or "My place" (H2) / "My porch" (H5), with the place or home row and its promise. */
@Composable
private fun WhereField(
    ui: HostUi,
    vm: HostFlowViewModel,
    homeLabel: String,
) {
    val draft = ui.draft
    PlanField(label = "Where") {
        PlanSegmented(
            options = listOf("public" to "A public place", "home" to homeLabel),
            selected = if (draft.atHome) "home" else "public",
            onSelect = { vm.setAtHome(it == "home") },
        )
        if (draft.atHome) {
            PlanFormCard {
                PlanOptionRow(first = true) {
                    PlanIconTile(
                        PantopusIcon.Home,
                        PantopusColors.appSurfaceSunken,
                        PantopusColors.appTextStrong,
                        size = 36.dp,
                        glyph = 18.dp,
                        corner = 10.dp,
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = homeLabel, style = semibold, color = PantopusColors.appText)
                        Text(
                            text =
                                ui.home?.let { home -> listOfNotNull("Your home", home.city?.let { "in $it" }).joinToString(" ") }
                                    ?: "Add your home to host there",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
            }
            PlanScopeLine("Only people you accept see your address. Everyone else sees the area.")
        } else {
            PlaceRow(ui, onClick = vm::openPlaces)
        }
    }
}

/** The chosen public place, or "Pick a place", opening H6. */
@Composable
private fun PlaceRow(
    ui: HostUi,
    onClick: () -> Unit,
) {
    val place = ui.draft.place
    val kind = ui.draft.kind ?: PlanKind.PICKUP_GAME
    PlanFormCard {
        PlanOptionRow(
            first = true,
            onClick = onClick,
            modifier = Modifier.semantics(mergeDescendants = true) { role = Role.Button },
        ) {
            PlanTile(kind, size = 36.dp, glyph = 18.dp, corner = 10.dp)
            Column(modifier = Modifier.weight(1f)) {
                Text(text = place?.name ?: "Pick a place", style = semibold, color = PantopusColors.appText)
                Text(
                    text = place?.let { placeCaption(it) } ?: "Parks, courts, trails, libraries, cafés",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
            PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
        }
    }
}

/** "Park · public place · 0.4 mi" (the host's own distance to a public place). */
internal fun placeCaption(place: PickedPlace): String {
    val distance = place.distanceMeters?.let { metersToMiles(it) }
    return listOfNotNull(place.category?.replaceFirstChar { it.titlecase() }, "public place", distance).joinToString(" · ")
}

/** H6's row: "Court · tennis · 0.1 mi", "Park · 0.4 mi" (the host's own distance to a public place). */
internal fun placeRowCaption(place: PickedPlace): String {
    val words = place.categories.distinct().take(2).mapIndexed { i, w -> if (i == 0) w.replaceFirstChar { it.titlecase() } else w }
    return (words + listOfNotNull(place.distanceMeters?.let { metersToMiles(it) })).joinToString(" · ")
}

internal fun metersToMiles(meters: Double): String {
    val miles = meters / METERS_PER_MILE
    return when {
        miles < HERE_MILES -> "here"
        else -> String.format(Locale.US, "%.1f mi", miles.coerceAtLeast(0.1))
    }
}

private const val HERE_MILES = 0.03

private const val METERS_PER_MILE = 1609.344

/** How people get in (H2, H4, H5), by the rules in decisions D6 and D7. */
@Composable
private fun HowPeopleGetIn(
    ui: HostUi,
    vm: HostFlowViewModel,
) {
    val draft = ui.draft
    val kind = draft.kind ?: return
    PlanField(label = "How people get in") {
        PlanFormCard {
            if (draft.atHome) {
                PlanOptionRow(first = true) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(text = "I approve each person", style = semibold, color = PantopusColors.appText)
                        Text(
                            text = "Always on for plans at your place",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                    PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 22.dp, tint = PantopusColors.primary600)
                }
            } else {
                val rule = if (kind == PlanKind.PICKUP_GAME) PlanAutoRule.ANYONE_NEARBY else PlanAutoRule.VERIFIED
                val (title, caption) =
                    if (rule == PlanAutoRule.ANYONE_NEARBY) {
                        "Anyone nearby gets in right away" to "Until the spots fill"
                    } else {
                        "Verified neighbors get in right away" to "Others ask, and you approve"
                    }
                RuleOption(title, caption, selected = !draft.approveEach, first = true) {
                    vm.edit { it.copy(approveEach = false, autoRule = rule) }
                }
                RuleOption("I approve each person", null, selected = draft.approveEach, first = false) {
                    vm.edit { it.copy(approveEach = true, autoRule = null) }
                }
            }
            PlanOptionRow {
                PantopusCheckbox(
                    isChecked = draft.hostedBefore,
                    onCheckedChange = { on -> vm.edit { it.copy(hostedBefore = on) } },
                    label = "Also let in people I've hosted",
                )
            }
        }
    }
}

@Composable
private fun RuleOption(
    title: String,
    caption: String?,
    selected: Boolean,
    first: Boolean,
    onClick: () -> Unit,
) {
    PlanOptionRow(
        first = first,
        onClick = onClick,
        modifier =
            Modifier.semantics(mergeDescendants = true) {
                role = Role.RadioButton
                this.selected = selected
            },
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(text = title, style = semibold, color = PantopusColors.appText)
            caption?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary) }
        }
        if (selected) {
            PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 22.dp, tint = PantopusColors.primary600)
        } else {
            Row(modifier = Modifier.size(22.dp), verticalAlignment = Alignment.CenterVertically) {}
        }
    }
}

@Composable
private fun NoteField(
    note: String,
    label: String,
    placeholder: String,
    singleLine: Boolean = false,
    onNote: (String) -> Unit,
) {
    PlanField(label = label, lock = true) {
        PlanTextArea(
            value = note,
            onValue = { onNote(it.take(NOTE_MAX)) },
            placeholder = placeholder,
            label = label,
            singleLine = singleLine,
        )
    }
}

/** The part of the day neighbors see for a playdate before they're in (the API's `day_part`). */
private fun dayPartWord(hour: Int): String =
    when (hour) {
        in 5..11 -> "morning"
        in 12..16 -> "afternoon"
        in 17..20 -> "evening"
        else -> "night"
    }

/** Adds [value] when it's missing, removes it when it's there. */
private fun Set<String>.toggle(value: String): Set<String> = if (value in this) this - value else this + value

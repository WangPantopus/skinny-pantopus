@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.property_details

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.homes.FloorPlanLayoutDto
import app.pantopus.android.data.api.models.homes.HouseholdCountyPageDto
import app.pantopus.android.data.api.models.homes.HouseholdFactChange
import app.pantopus.android.data.api.models.homes.HouseholdFactDto
import app.pantopus.android.data.api.models.homes.HouseholdGroupDto
import app.pantopus.android.data.api.models.homes.HouseholdQuestionDto
import app.pantopus.android.ui.components.ChipPicker
import app.pantopus.android.ui.components.ChipPickerOption
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.SectionHeader
import app.pantopus.android.ui.screens.homes.add_home.AddHomeTextField
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

private const val OTHER_CHIP = "__other"
private const val MAX_NOTE_LENGTH = 500

// A household confirms, corrects and adds to a Home's facts, and reports what it can't correct
// (backend/services/householdFacts.js). All of this comes from what the server sends: a server
// without it, or someone it isn't for, gets nothing new.

/** What the controls ask of the screen. */
data class HouseholdActions(
    val saving: Boolean = false,
    val save: (List<HouseholdFactChange>) -> Unit = {},
    val edit: (HouseholdGroupDto) -> Unit = {},
    val report: (PropertyRecordSection) -> Unit = {},
    /** "Is this your layout?": yes, no or undo. */
    val answerLayout: (String) -> Unit = {},
)

/** "Bedrooms? 1 2 3 4 Other". A tap answers it; Other is the person's own number. Also on Add Home. */
@Composable
internal fun HouseholdQuestionRow(
    question: HouseholdQuestionDto,
    onAnswer: (String) -> Unit,
    onOther: () -> Unit,
    value: String? = null,
) {
    val selected =
        when {
            value.isNullOrEmpty() -> null
            question.options.any { it.value == value } -> value
            else -> OTHER_CHIP
        }
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(text = question.prompt, style = PantopusTextStyle.small, color = PantopusColors.appText)
        ChipPicker(
            options = question.options.map { ChipPickerOption(it.value, it.label) } + ChipPickerOption(OTHER_CHIP, question.other),
            selectedId = selected,
            onSelectionChange = { chosen ->
                when (chosen) {
                    null -> Unit
                    OTHER_CHIP -> onOther()
                    else -> onAnswer(chosen)
                }
            },
            testTag = "household_question_${question.key}",
        )
    }
}

/** The county's own page: a person checks a fact at the source and comes back to confirm it. */
@Composable
internal fun HouseholdCountyPageLink(page: HouseholdCountyPageDto) {
    if (!page.url.startsWith("https://")) return
    val uriHandler = LocalUriHandler.current
    Text(
        text = page.label,
        style = PantopusTextStyle.caption,
        color = PantopusColors.primary600,
        modifier =
            Modifier
                .clickable(role = Role.Button) { uriHandler.openUri(page.url) }
                .heightIn(min = 48.dp)
                .padding(vertical = Spacing.s1)
                .testTag("household_countyPage"),
    )
}

/** One-tap questions for what the record lacks. */
@Composable
internal fun HouseholdQuestionsCard(
    household: PropertyHouseholdContent,
    actions: HouseholdActions,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        SectionHeader("A few quick questions")
        Column(
            modifier = Modifier.fillMaxWidth().householdCard().padding(Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            household.questions.forEach { question ->
                HouseholdQuestionRow(
                    question = question,
                    onAnswer = { actions.save(listOf(HouseholdFactChange.correct(question.key, it))) },
                    onOther = { household.fact(question.key)?.let { fact -> actions.edit(fact.asGroup()) } },
                )
            }
            household.countyPage?.let { HouseholdCountyPageLink(it) }
        }
    }
}

/** The editor for one fact, typed in: Other was the answer. */
private fun HouseholdFactDto.asGroup() = HouseholdGroupDto(id = key, title = label, facts = listOf(copy(options = emptyList())))

@Composable
private fun Modifier.householdCard(): Modifier =
    background(PantopusColors.appSurface, RoundedCornerShape(Radii.lg))
        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))

@Composable
private fun HouseholdAction(
    title: String,
    enabled: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    Text(
        text = title,
        style = PantopusTextStyle.small,
        color = if (enabled) PantopusColors.primary600 else PantopusColors.appTextMuted,
        modifier =
            Modifier
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .heightIn(min = 48.dp)
                .padding(vertical = Spacing.s1)
                .testTag(tag),
    )
}

/** The foot of a record card: "Is this right?", what the household said, "Report a problem". */
@Composable
internal fun HouseholdGroupFooter(
    group: HouseholdGroupDto,
    section: PropertyRecordSection,
    actions: HouseholdActions,
) {
    val enabled = !actions.saving
    val tag = "propertyDetails_household_${group.id}"
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag(tag),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        group.confirmed?.let { confirmed ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = confirmed,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.weight(1f).padding(end = Spacing.s2),
                )
                HouseholdAction("Undo", enabled, "${tag}_undo") { actions.save(listOf(HouseholdFactChange.undoConfirm(group.id))) }
            }
        }
        group.prompt?.let { prompt ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = prompt,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f).padding(end = Spacing.s2),
                )
                HouseholdAction("Yes", enabled, "${tag}_yes") { actions.save(listOf(HouseholdFactChange.confirm(group.id))) }
            }
        }
        group.reported?.let { Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary) }
        group.fix?.let { HouseholdAction(it, enabled, "${tag}_fix") { actions.edit(group) } }
        group.report?.let { HouseholdAction(it, true, "${tag}_report") { actions.report(section) } }
    }
}

/** "Is this your layout?" at the foot of the card a building's floor plan fills, or what the household said. */
@Composable
internal fun FloorPlanLayoutFooter(
    layout: FloorPlanLayoutDto,
    actions: HouseholdActions,
) {
    val enabled = !actions.saving
    val tag = "propertyDetails_floorPlan"
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurfaceSunken)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag(tag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        val answered = layout.answered
        if (answered != null) {
            Text(
                text = answered,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f),
            )
            if (layout.canUndo) HouseholdAction("Undo", enabled, "${tag}_undo") { actions.answerLayout("undo") }
        } else {
            Text(
                text = layout.prompt.orEmpty(),
                style = PantopusTextStyle.small,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            HouseholdAction("Yes", enabled, "${tag}_yes") { actions.answerLayout("yes") }
            HouseholdAction("No", enabled, "${tag}_no") { actions.answerLayout("no") }
        }
    }
}

/** "Add details": for what the record has no card for. */
@Composable
internal fun HouseholdAddDetailsCard(
    group: HouseholdGroupDto,
    actions: HouseholdActions,
) {
    Column(
        modifier = Modifier.fillMaxWidth().householdCard().padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        group.lead?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary) }
        HouseholdAction(group.fix ?: group.title, !actions.saving, "propertyDetails_household_add") { actions.edit(group) }
    }
}

/** "Fix something" and "Add details": tap what's right, or type it. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun HouseholdFactEditorSheet(
    group: HouseholdGroupDto,
    saving: Boolean,
    onSave: (List<HouseholdFactChange>, (Boolean) -> Unit) -> Unit,
    onDismiss: () -> Unit,
) {
    val drafts = remember(group.id) { mutableStateMapOf<String, String>() }
    val typing = remember(group.id) { mutableStateMapOf<String, Boolean>() }
    var failed by remember(group.id) { mutableStateOf(false) }
    val changes =
        group.facts.mapNotNull { fact ->
            drafts[fact.key]?.trim()?.takeIf { it.isNotEmpty() && it != fact.current }?.let { HouseholdFactChange.correct(fact.key, it) }
        }
    val save = { list: List<HouseholdFactChange> ->
        failed = false
        onSave(list) { saved -> if (saved) onDismiss() else failed = true }
    }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("household_editor"),
    ) {
        Column(modifier = Modifier.navigationBarsPadding().padding(horizontal = Spacing.s4)) {
            Text(text = group.title, style = PantopusTextStyle.h3, color = PantopusColors.appText)
            Column(
                modifier = Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(vertical = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s5),
            ) {
                Text(
                    text = group.lead ?: "Tap what's right. The county's own record stays as it is.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
                if (failed) {
                    Text(
                        text = "Couldn't save that. Check it and try again.",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.error,
                        modifier = Modifier.testTag("household_editor_error"),
                    )
                }
                group.facts.forEach { fact ->
                    FactField(
                        fact = fact,
                        value = drafts[fact.key] ?: fact.current,
                        typing = typing[fact.key] == true,
                        enabled = !saving,
                        onValue = { drafts[fact.key] = it },
                        onTyping = { typing[fact.key] = it },
                        onUndo = { save(listOf(HouseholdFactChange.undo(fact.key))) },
                    )
                }
            }
            PrimaryButton(
                title = "Save",
                onClick = { save(changes) },
                modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3).testTag("household_editor_save"),
                isLoading = saving,
                isEnabled = changes.isNotEmpty() && !saving,
            )
        }
    }
}

@Composable
private fun FactField(
    fact: HouseholdFactDto,
    value: String,
    typing: Boolean,
    enabled: Boolean,
    onValue: (String) -> Unit,
    onTyping: (Boolean) -> Unit,
    onUndo: () -> Unit,
) {
    val known = fact.options.firstOrNull { it.value.equals(value, ignoreCase = true) }
    val showsField = fact.options.isEmpty() || typing || (value.isNotEmpty() && known == null)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("household_fact_${fact.key}")) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(text = fact.label, style = PantopusTextStyle.small, color = PantopusColors.appText)
            if (fact.canUndo) HouseholdAction("Undo", enabled, "household_fact_${fact.key}_undo", onUndo)
        }
        if (fact.options.isNotEmpty()) {
            ChipPicker(
                options = fact.options.map { ChipPickerOption(it.value, it.label) } + ChipPickerOption(OTHER_CHIP, "Other"),
                selectedId = if (showsField) OTHER_CHIP else known?.value,
                onSelectionChange = { chosen ->
                    when (chosen) {
                        null -> Unit
                        OTHER_CHIP -> onTyping(true)
                        else -> {
                            onTyping(false)
                            onValue(chosen)
                        }
                    }
                },
                testTag = "household_fact_${fact.key}_chips",
            )
        }
        if (showsField) {
            AddHomeTextField(
                label = fact.unit ?: "Your answer",
                placeholder = "",
                value = value,
                onValueChange = onValue,
                keyboardType =
                    when (fact.input) {
                        "text" -> KeyboardType.Text
                        "decimal" -> KeyboardType.Decimal
                        else -> KeyboardType.Number
                    },
                testTag = "household_fact_${fact.key}_field",
            )
        }
        fact.note?.let { Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted) }
    }
}

/** "Report a problem": it reaches review, and the page stays as it is. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun HouseholdReportSheet(
    section: PropertyRecordSection,
    onSend: (String?, String?, (Boolean) -> Unit) -> Unit,
    onDismiss: () -> Unit,
) {
    var field by remember(section.id) { mutableStateOf<String?>(null) }
    var note by remember(section.id) { mutableStateOf("") }
    var sending by remember(section.id) { mutableStateOf(false) }
    var failed by remember(section.id) { mutableStateOf(false) }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("household_report"),
    ) {
        Column(modifier = Modifier.navigationBarsPadding().padding(horizontal = Spacing.s4)) {
            Text(text = "Report a problem", style = PantopusTextStyle.h3, color = PantopusColors.appText)
            Column(
                modifier = Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(vertical = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s4),
            ) {
                Text(
                    text = "We'll check it against the county's record. This page stays as it is until the county's record changes.",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
                if (failed) {
                    Text(text = "Couldn't send that. Please try again.", style = PantopusTextStyle.small, color = PantopusColors.error)
                }
                Text(text = "What looks wrong?", style = PantopusTextStyle.small, color = PantopusColors.appText)
                ChipPicker(
                    options = section.rows.map { ChipPickerOption(it.id, it.label) },
                    selectedId = field,
                    onSelectionChange = { field = it },
                    testTag = "household_report_field",
                )
                AddHomeTextField(
                    label = "Anything to add?",
                    placeholder = "",
                    value = note,
                    onValueChange = { note = it.take(MAX_NOTE_LENGTH) },
                    optional = true,
                    singleLine = false,
                    testTag = "household_report_note",
                )
            }
            PrimaryButton(
                title = "Send",
                onClick = {
                    sending = true
                    failed = false
                    onSend(field, note.trim().ifEmpty { null }) { sent ->
                        sending = false
                        if (sent) onDismiss() else failed = true
                    }
                },
                modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3).testTag("household_report_send"),
                isLoading = sending,
                isEnabled = !sending,
            )
        }
    }
}

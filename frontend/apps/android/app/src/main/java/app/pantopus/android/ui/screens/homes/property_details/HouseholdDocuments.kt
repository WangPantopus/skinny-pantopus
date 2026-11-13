@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.property_details

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import app.pantopus.android.data.api.models.homes.DocumentFactDto
import app.pantopus.android.data.api.models.homes.DocumentFactValue
import app.pantopus.android.data.api.models.homes.DocumentFactsAnswerDto
import app.pantopus.android.data.api.models.homes.HouseholdDocumentsOfferDto
import app.pantopus.android.data.api.models.homes.HouseholdFactDto
import app.pantopus.android.ui.components.ChipPicker
import app.pantopus.android.ui.components.ChipPickerOption
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

// "From your papers": a household sends a PDF of its home's inspection report, appraisal or listing sheet; the server
// reads it, keeps nothing, and lists the facts it states. The household marks each one Right, Fix or Skip, and only
// what it keeps is saved (backend/services/householdDocuments). The card's words come from the server: without them,
// nothing new is drawn.

private const val KEEP = "keep"
private const val FIX = "fix"
private const val SKIP = "skip"
private val documentChoices = listOf(ChipPickerOption(KEEP, "Right"), ChipPickerOption(FIX, "Fix"), ChipPickerOption(SKIP, "Skip"))

/** "From your papers", in the style of the "Add details" card. */
@Composable
internal fun HouseholdDocumentsCard(
    offer: HouseholdDocumentsOfferDto,
    state: HouseholdDocumentsState,
    saving: Boolean,
    onPick: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().householdCard().padding(Spacing.s4).testTag("propertyDetails_documents"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(text = offer.title, style = PantopusTextStyle.body, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Text(text = offer.lead, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        state.notice?.let {
            Text(
                text = it,
                style = PantopusTextStyle.small,
                color = PantopusColors.appText,
                modifier = Modifier.testTag("propertyDetails_documents_notice"),
            )
        }
        state.error?.let {
            Text(
                text = it,
                style = PantopusTextStyle.small,
                color = PantopusColors.error,
                modifier = Modifier.testTag("propertyDetails_documents_error"),
            )
        }
        HouseholdAction(
            title = if (state.reading) "Reading your report…" else offer.action,
            enabled = !state.reading && !saving,
            tag = "propertyDetails_documents_add",
            onClick = onPick,
        )
    }
}

/** "Check what we found": each fact the report states, kept only when the household says so. Same sheet as "Fix something". */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun DocumentFactsSheet(
    answer: DocumentFactsAnswerDto,
    saving: Boolean,
    onSave: (List<DocumentFactValue>, (Boolean) -> Unit) -> Unit,
    onDismiss: () -> Unit,
) {
    val choices = remember(answer) { mutableStateMapOf<String, String>() }
    val drafts = remember(answer) { mutableStateMapOf<String, String>() }
    val typing = remember(answer) { mutableStateMapOf<String, Boolean>() }
    var failed by remember(answer) { mutableStateOf(false) }
    val kept =
        answer.facts.mapNotNull { fact ->
            when (choices[fact.key]) {
                KEEP -> DocumentFactValue(fact.key, fact.current)
                FIX -> (drafts[fact.key] ?: fact.current).trim().takeIf { it.isNotEmpty() }?.let { DocumentFactValue(fact.key, it) }
                else -> null
            }
        }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("documentFacts"),
    ) {
        Column(modifier = Modifier.navigationBarsPadding().padding(horizontal = Spacing.s4)) {
            Text(
                text = if (answer.message == null) "Check what we found" else answer.title,
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
            )
            Text(text = answer.subtitle, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            Column(
                modifier = Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()).padding(vertical = Spacing.s3),
                verticalArrangement = Arrangement.spacedBy(Spacing.s5),
            ) {
                DocumentFactsBody(answer = answer, failed = failed, saving = saving, state = DocumentChoices(choices, drafts, typing))
            }
            if (answer.message != null) {
                PrimaryButton(
                    title = "OK",
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3).testTag("documentFacts_ok"),
                )
            } else {
                PrimaryButton(
                    title = if (kept.isEmpty()) "Save" else "Save ${kept.size}",
                    onClick = {
                        failed = false
                        onSave(kept) { saved -> if (!saved) failed = true }
                    },
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.s3).testTag("documentFacts_save"),
                    isLoading = saving,
                    isEnabled = kept.isNotEmpty() && !saving,
                )
            }
        }
    }
}

/** What the household has chosen so far, fact by fact: Right, Fix or Skip, a fixed value, and whether it's typing one. */
private class DocumentChoices(
    val choices: SnapshotStateMap<String, String>,
    val drafts: SnapshotStateMap<String, String>,
    val typing: SnapshotStateMap<String, Boolean>,
)

/** The sheet's words: the server's message for an answer with no facts, otherwise each fact to check. */
@Composable
private fun DocumentFactsBody(
    answer: DocumentFactsAnswerDto,
    failed: Boolean,
    saving: Boolean,
    state: DocumentChoices,
) {
    val message = answer.message
    if (message != null) {
        Text(
            text = message,
            style = PantopusTextStyle.small,
            color = PantopusColors.appText,
            modifier = Modifier.testTag("documentFacts_message"),
        )
        return
    }
    Text(text = answer.lead, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
    if (failed) {
        Text(
            text = "Couldn't save that. Check it and try again.",
            style = PantopusTextStyle.small,
            color = PantopusColors.error,
            modifier = Modifier.testTag("documentFacts_error"),
        )
    }
    answer.facts.forEach { fact -> DocumentFactRow(fact = fact, state = state, enabled = !saving) }
    answer.missing?.let { Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted) }
}

@Composable
private fun DocumentFactRow(
    fact: DocumentFactDto,
    state: DocumentChoices,
    enabled: Boolean,
) {
    val choice = state.choices[fact.key]
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("documentFacts_row_${fact.key}")) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(text = fact.label, style = PantopusTextStyle.small, color = PantopusColors.appText, modifier = Modifier.weight(1f))
            Text(
                text = fact.value ?: fact.current,
                style = PantopusTextStyle.small,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                textAlign = TextAlign.End,
                modifier = Modifier.weight(1f),
            )
        }
        fact.note?.let { Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted) }
        Text(text = fact.source, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        ChipPicker(
            options = documentChoices,
            selectedId = choice,
            onSelectionChange = { chosen -> chosen?.let { state.choices[fact.key] = it } },
            testTag = "documentFacts_${fact.key}_choice",
        )
        if (choice == FIX) {
            // The fact's own choices and field, as "Fix something" has them, starting from the report's value.
            FactField(
                fact =
                    HouseholdFactDto(
                        key = fact.key,
                        label = "What it should say",
                        value = fact.value,
                        current = fact.current,
                        input = fact.input,
                        unit = fact.unit,
                        options = fact.options,
                    ),
                value = state.drafts[fact.key] ?: fact.current,
                typing = state.typing[fact.key] == true,
                enabled = enabled,
                onValue = { state.drafts[fact.key] = it },
                onTyping = { state.typing[fact.key] = it },
                onUndo = {},
            )
        }
    }
}

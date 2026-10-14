@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.plans.detail

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.plans.KidsAgeBand
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.isPlaydate
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.ui.components.PantopusCheckbox
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.plans.components.PlanChoice
import app.pantopus.android.ui.screens.plans.components.PlanChoiceGroup
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanScopeLine
import app.pantopus.android.ui.screens.plans.components.PlanStepperControl
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanWell
import app.pantopus.android.ui.screens.plans.map.planH3
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/** The most people one request can bring (brief section 4: party size 1 to 4). */
private const val MAX_PARTY = 4

/** Notes the host reads: 280 characters (brief section 4). */
private const val NOTE_MAX = 280

/** Short starters for the hello (board J3). */
private val helloStarters = listOf("First time", "Bringing a snack", "Can help set up")

/**
 * Ask to join (boards J3 and J4): who's coming (kids and their ages for a playdate), a short hello, the privacy
 * sentence and "Send request". Party size counts against spots, so choices past the spots left are shown at half
 * strength (a full plan's request goes to the waitlist and keeps every choice).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun PlanAskSheet(
    plan: PlanDto,
    draft: AskDraft,
    onEdit: ((AskDraft) -> AskDraft) -> Unit,
    onSend: () -> Unit,
    onClose: () -> Unit,
) {
    val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val host = plan.hostFirst
    ModalBottomSheet(onDismissRequest = onClose, sheetState = sheet, containerColor = PantopusColors.appSurface) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s6)
                    .navigationBarsPadding()
                    .imePadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            Column {
                Text(
                    text = "Ask $host to join",
                    style = planH3,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                Text(
                    text = listOf(PlanFormat.shortTitle(plan), PlanFormat.rowWhen(plan) ?: PlanFormat.hiddenWhen(plan))
                        .filter(String::isNotBlank)
                        .joinToString(" · "),
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                )
            }
            if (plan.isPlaydate) {
                KidsFields(draft, onEdit)
            } else {
                PartyField(plan, draft, onEdit)
            }
            HelloField(plan, draft, onEdit)
            PlanScopeLine(
                if (plan.isPlaydate) {
                    "$host sees your first name, your verified badge, about how far away you live and your kids' ages. Never their names."
                } else {
                    "$host sees your first name, your verified badge and about how far away you live. Never your address."
                },
            )
            draft.error?.let { Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.error) }
            PrimaryButton(
                title =
                    when {
                        plan.myRequest != null -> "Update request"
                        plan.isFull -> "Join the waitlist"
                        else -> "Send request"
                    },
                onClick = onSend,
                isLoading = draft.sending,
                isEnabled = !draft.sending && (!plan.isPlaydate || (draft.staysWithKids && draft.ageBands.isNotEmpty())),
                modifier = Modifier.height(50.dp),
            )
        }
    }
}

@Composable
private fun PartyField(
    plan: PlanDto,
    draft: AskDraft,
    onEdit: ((AskDraft) -> AskDraft) -> Unit,
) {
    val room = if (plan.isFull) MAX_PARTY else plan.spotsLeft.coerceAtLeast(1)
    val choices =
        (1..MAX_PARTY).map { size ->
            PlanChoice(id = size.toString(), label = if (size == 1) "Just me" else "Me + ${size - 1}", enabled = size <= room)
        }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanOverline("Who's coming")
        PlanChoiceGroup(
            choices = choices,
            isSelected = { it.id == draft.partySize.toString() },
            onSelect = { choice -> onEdit { it.copy(partySize = choice.id.toInt()) } },
        )
    }
}

@Composable
private fun KidsFields(
    draft: AskDraft,
    onEdit: ((AskDraft) -> AskDraft) -> Unit,
) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "Kids coming",
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
            )
            Text(text = "With you, the whole time", style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
        }
        PlanStepperControl(
            value = draft.kidsCount,
            range = 1..MAX_KIDS,
            label = "Kids coming",
            onChange = { value -> onEdit { it.copy(kidsCount = value) } },
        )
    }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanOverline("Their ages")
        PlanChoiceGroup(
            choices = KidsAgeBand.entries.map { PlanChoice(it.wire, it.label) },
            isSelected = { it.id in draft.ageBands },
            onSelect = { choice ->
                onEdit {
                    it.copy(ageBands = if (choice.id in it.ageBands) it.ageBands - choice.id else it.ageBands + choice.id)
                }
            },
            multiSelect = true,
        )
    }
    PlanWell {
        PantopusCheckbox(
            isChecked = draft.staysWithKids,
            onCheckedChange = { checked -> onEdit { it.copy(staysWithKids = checked) } },
            label = "I'll stay with my kids the whole time",
        )
    }
}

private const val MAX_KIDS = 8

@Composable
private fun HelloField(
    plan: PlanDto,
    draft: AskDraft,
    onEdit: ((AskDraft) -> AskDraft) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PlanOverline("Say hi · optional")
        PlanTextArea(
            value = draft.note,
            onValue = { text -> onEdit { it.copy(note = text.take(NOTE_MAX)) } },
            placeholder = "Add a short hello",
            label = "Say hi, optional",
        )
        if (plan.planKind != PlanKind.PLAYDATE) {
            PlanChoiceGroup(
                choices = helloStarters.map { PlanChoice(it, it) },
                isSelected = { draft.note.contains(it.label) },
                onSelect = { choice ->
                    onEdit {
                        val note = it.note.trim()
                        val next =
                            if (note.contains(
                                    choice.label,
                                )
                            ) {
                                note
                            } else {
                                listOf(note, "${choice.label}.").filter(String::isNotBlank).joinToString(" ")
                            }
                        it.copy(note = next.take(NOTE_MAX))
                    }
                },
                multiSelect = true,
            )
        }
    }
}

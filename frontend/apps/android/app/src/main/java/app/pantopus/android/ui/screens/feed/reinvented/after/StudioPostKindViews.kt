@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented.after

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.components.sheetKeyboardRules
import app.pantopus.android.ui.screens.compose.pulse.PulseSafetyAlertKind
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Over the Studio's caption while the switch is on (the Studio is drawn only then): "+ Ask / Kind", or the kind picked
 * with ✕ to make it a Moment again; "Keep until answered?" when the words ask something and no kind is picked; and what
 * stops Post for a post. Nothing for a video or several photos picked together.
 */
@Composable
fun StudioPostKindRow(
    state: MomentsComposeUiState,
    modifier: Modifier = Modifier,
    viewModel: StudioPostViewModel = hiltViewModel(),
) {
    if (!state.offersStudioKinds) return
    val draft by StudioPostState.draft
    val note by viewModel.note.collectAsStateWithLifecycle()
    val posting by viewModel.posting.collectAsStateWithLifecycle()
    var sheet by rememberSaveable { mutableStateOf(false) }
    val kind = state.studioPostKind(draft)
    val asks =
        kind == null && !draft.askDeclined && StudioPostKind.ASK in state.studioKindChoices &&
            StudioPostKind.asksSomething(if (state.media == null) state.text else state.caption)
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
            KindChip(
                text = kind?.let { "${it.title}  ✕" } ?: "+ Ask / Kind",
                on = kind != null,
                tag = "moments.studio.kind",
                spoken = kind?.let { "${it.title}. Tap to post it as a Moment instead" } ?: "Ask or kind: post it as one of Pulse's kinds",
            ) { if (kind != null) viewModel.clear() else sheet = true }
            if (kind != null) KindChip("Details", on = false, tag = "moments.studio.kind.details", spoken = "Details") { sheet = true }
            if (asks) {
                KindChip("Keep until answered?", on = false, tag = "moments.studio.keepUntilAnswered") {
                    viewModel.pick(state, StudioPostKind.ASK)
                }
                KindChip("✕", on = false, tag = "moments.studio.keepUntilAnswered.no", spoken = "No, keep it a Moment") {
                    viewModel.edit { it.copy(askDeclined = true) }
                }
            }
        }
        val line = if (posting) "Posting…" else note
        line?.let {
            Text(
                text = it,
                color = Color.White,
                fontSize = 13.sp,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(PantopusColors.momentCaptionPill)
                        .padding(horizontal = Spacing.s3, vertical = 6.dp)
                        .testTag("moments.studio.kind.note"),
            )
        }
    }
    if (sheet) StudioKindSheet(state = state, viewModel = viewModel, onDismiss = { sheet = false })
}

/**
 * The Studio's Post with "+ Ask / Kind": a post when a kind is picked (closing the composer with [onDone] once it is
 * made), else [momentPost], today's Post for a Moment.
 */
@Composable
fun rememberStudioPost(
    state: MomentsComposeUiState,
    onDone: () -> Unit,
    viewModel: StudioPostViewModel = hiltViewModel(),
    momentPost: () -> Unit,
): () -> Unit {
    val now by rememberUpdatedState(state)
    val done by rememberUpdatedState(onDone)
    val moment by rememberUpdatedState(momentPost)
    return remember(viewModel) { { if (!viewModel.post(now) { done() }) moment() } }
}

@Composable
private fun KindChip(
    text: String,
    on: Boolean,
    tag: String,
    spoken: String = text,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(19.dp)
    Text(
        text = text,
        color = if (on) PantopusColors.appText else Color.White,
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            Modifier
                .height(38.dp)
                .clip(shape)
                .background(if (on) Color.White else PantopusColors.studioPillFill)
                .border(1.dp, PantopusColors.studioChipOutline, shape)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = 9.dp)
                .testTag(tag)
                .semantics { contentDescription = spoken },
    )
}

/** The kinds (today's October 13 kinds, with one line each) and the picked kind's own details, in the Studio's colors. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun StudioKindSheet(
    state: MomentsComposeUiState,
    viewModel: StudioPostViewModel,
    onDismiss: () -> Unit,
) {
    val draft by StudioPostState.draft
    val kind = state.studioPostKind(draft)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.studioBar,
        modifier = Modifier.sheetKeyboardRules().testTag("moments.studio.kindSheet"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s5)
                    .padding(bottom = Spacing.s5)
                    .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text("Post it as", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            state.studioKindChoices.forEach { choice ->
                KindRow(choice, on = choice == kind) { viewModel.pick(state, choice) }
            }
            if (kind != null) KindDetails(state, kind, draft, viewModel)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                if (kind != null) {
                    KindChip("Keep it a Moment", on = false, tag = "moments.studio.kindSheet.moment") {
                        viewModel.clear()
                        onDismiss()
                    }
                }
                KindChip("Done", on = true, tag = "moments.studio.kindSheet.done", onClick = onDismiss)
            }
        }
    }
}

@Composable
private fun KindRow(
    kind: StudioPostKind,
    on: Boolean,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(if (on) PantopusColors.primary600 else PantopusColors.studioPillFill)
                .clickable(role = Role.RadioButton, onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("moments.studio.kind.${kind.wire}")
                .semantics(mergeDescendants = true) {
                    role = Role.RadioButton
                    selected = on
                },
    ) {
        Text(kind.title, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(kind.hint, color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
    }
}

/** The picked kind's own details, as today's composer asks them. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun KindDetails(
    state: MomentsComposeUiState,
    kind: StudioPostKind,
    draft: StudioPostDraft,
    viewModel: StudioPostViewModel,
) {
    if (state.media != null) {
        SheetField(
            label = "What it says",
            value = draft.words ?: state.caption,
            tag = "moments.studio.kind.words",
        ) { words -> viewModel.edit { it.copy(words = words.take(StudioPostDraft.WORDS_LIMIT)) } }
    }
    when (kind) {
        StudioPostKind.ALERT ->
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PulseSafetyAlertKind.entries.forEach { alert ->
                    KindChip(alert.label, on = draft.alertKind == alert, tag = "moments.studio.kind.alert.${alert.key}") {
                        viewModel.edit { it.copy(alertKind = alert) }
                    }
                }
            }
        StudioPostKind.LOST_FOUND -> LostFoundDetails(draft, viewModel)
        StudioPostKind.EVENT -> EventDetails(draft, viewModel)
        // Eyes on (CONTRACT 8f): an Ask under the person's own name, about a picked public place.
        StudioPostKind.ASK -> if (!state.madeUp) EyesOnAskRow(draft, viewModel)
        else -> Unit
    }
    // "Also show in Explore" (CONTRACT 6f): never at home, under a made-up name, without a place, or for the kinds tied to
    // the place.
    val explorable = kind.mayGoToExplore && !state.madeUp && !state.noLocationOn && state.place?.atHome != true
    if (explorable) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Also show in Explore", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text("People anywhere can see this, with its place.", color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
            }
            Switch(
                checked = draft.explore,
                onCheckedChange = { on -> viewModel.edit { it.copy(explore = on) } },
                modifier = Modifier.testTag("moments.studio.kind.explore"),
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LostFoundDetails(
    draft: StudioPostDraft,
    viewModel: StudioPostViewModel,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        KindChip("Lost", on = !draft.found, tag = "moments.studio.kind.lost") { viewModel.edit { it.copy(found = false) } }
        KindChip("Found", on = draft.found, tag = "moments.studio.kind.found") { viewModel.edit { it.copy(found = true) } }
    }
    Text("How to reach you", color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        CONTACTS.forEach { (key, words) ->
            KindChip(
                words,
                on = draft.contact == key,
                tag = "moments.studio.kind.contact.$key",
            ) { viewModel.edit { it.copy(contact = key) } }
        }
    }
    if (draft.contact == "phone") {
        SheetField("Phone", draft.phone, tag = "moments.studio.kind.phone", keyboard = KeyboardType.Phone) { phone ->
            viewModel.edit { it.copy(phone = phone.take(PHONE_MAX)) }
        }
    }
}

@Composable
private fun EventDetails(
    draft: StudioPostDraft,
    viewModel: StudioPostViewModel,
) {
    val context = LocalContext.current
    val pick: (LocalDateTime, (LocalDateTime) -> Unit) -> Unit = { from, then ->
        DatePickerDialog(context, { _, year, month, day ->
            TimePickerDialog(context, { _, hour, minute ->
                then(LocalDateTime.of(year, month + 1, day, hour, minute))
            }, from.hour, from.minute, false).show()
        }, from.year, from.monthValue - 1, from.dayOfMonth).show()
    }
    WhenRow("Starts", draft.eventStart, tag = "moments.studio.kind.eventStart") {
        pick(draft.eventStart ?: eventStartDefault()) { at -> viewModel.edit { it.copy(eventStart = at) } }
    }
    WhenRow("Ends (optional)", draft.eventEnd, tag = "moments.studio.kind.eventEnd") {
        val from = draft.eventEnd ?: (draft.eventStart ?: eventStartDefault()).plusHours(1)
        pick(from) { at -> viewModel.edit { it.copy(eventEnd = at) } }
    }
    SheetField("Where (optional)", draft.venue, tag = "moments.studio.kind.venue") { venue ->
        viewModel.edit { it.copy(venue = venue.take(VENUE_MAX)) }
    }
}

@Composable
private fun WhenRow(
    label: String,
    at: LocalDateTime?,
    tag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(PantopusColors.studioPillFill)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag(tag),
    ) {
        Text(label, color = Color.White, fontSize = 15.sp, modifier = Modifier.weight(1f))
        Text(
            at?.format(DateTimeFormatter.ofPattern("EEE, MMM d · h:mm a", Locale.US)) ?: "Pick",
            color = PantopusColors.studioPillSecondary,
            fontSize = 15.sp,
        )
    }
}

@Composable
private fun SheetField(
    label: String,
    value: String,
    tag: String,
    keyboard: KeyboardType = KeyboardType.Text,
    onValue: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
        BasicTextField(
            value = value,
            onValueChange = onValue,
            textStyle = TextStyle(color = Color.White, fontSize = 16.sp),
            cursorBrush = SolidColor(Color.White),
            keyboardOptions = KeyboardOptions(keyboardType = keyboard),
            modifier =
                Modifier
                    .keepsKeyboard()
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(PantopusColors.studioPillFill)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                    .testTag(tag),
        )
    }
}

private val CONTACTS = listOf("dm" to "Message me", "comment" to "Reply on the post", "phone" to "Call or text")
private const val PHONE_MAX = 20
private const val VENUE_MAX = 120

/** "Eyes on: ask people who are there now" on a Question (CONTRACT 8f); the post must tag a picked place. */
@Composable
private fun EyesOnAskRow(
    draft: StudioPostDraft,
    viewModel: StudioPostViewModel,
) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.weight(1f)) {
            Text("Eyes on: ask people who are there now", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "For six hours, people at this place can answer with a Live photo. Nobody is told who is near it. " +
                    "Pick the place in the list first.",
                color = PantopusColors.studioPillSecondary,
                fontSize = 13.sp,
            )
        }
        Switch(
            checked = draft.eyesOn,
            onCheckedChange = { on -> viewModel.edit { it.copy(eyesOn = on) } },
            modifier = Modifier.testTag("moments.studio.kind.eyesOn"),
        )
    }
}

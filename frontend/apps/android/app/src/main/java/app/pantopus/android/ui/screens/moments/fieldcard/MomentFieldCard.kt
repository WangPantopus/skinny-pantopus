package app.pantopus.android.ui.screens.moments.fieldcard

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentDotDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.moments.fieldcard.MomentFieldCardDto
import app.pantopus.android.data.moments.fieldcard.MomentFieldCardRepository
import app.pantopus.android.data.moments.fieldcard.MomentFieldGuideEntryDto
import app.pantopus.android.data.moments.fieldcard.fieldCardRefusal
import app.pantopus.android.ui.components.sheetKeyboardRules
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/*
 * "Pulse, reinvented" phase 2, a thing's field card in the viewer (board B3; CONTRACT 7d, 7f), as the iPhone's
 * `MomentFieldCard.swift`. The card opens with its dot: a kept card at once, else the first tap anywhere names it
 * ("Naming it…"; one Pantopus AI call on the server, kept with the post). "Likely <name>", the scientific name, one line
 * of why, the caution for a wild plant or mushroom, a source that opens, who named it and that it can be wrong. Collect
 * keeps it in the reader's own field guide; "Not right?" says what they think it is (the card stays as it is).
 */

/** One card as this reader sees it. */
data class FieldCardUi(
    val card: MomentFieldCardDto? = null,
    val busy: Boolean = false,
    val problem: String? = null,
)

/** The field guide sheet. */
data class FieldGuideUi(
    val entries: List<MomentFieldGuideEntryDto> = emptyList(),
    val next: String? = null,
    val loading: Boolean = false,
    val problem: String? = null,
)

@HiltViewModel
class MomentFieldCardViewModel
    @Inject
    constructor(
        private val repository: MomentFieldCardRepository,
    ) : ViewModel() {
        private val _cards = MutableStateFlow<Map<String, FieldCardUi>>(emptyMap())

        /** By "<moment>/<dot>". */
        val cards: StateFlow<Map<String, FieldCardUi>> = _cards.asStateFlow()

        private val _guide = MutableStateFlow(FieldGuideUi())
        val guide: StateFlow<FieldGuideUi> = _guide.asStateFlow()

        /** The kept card when the Moment carries one; else the first tap names it. */
        fun open(
            moment: String,
            dot: MomentDotDto,
        ) {
            val key = "$moment/${dot.id}"
            if (_cards.value[key]?.card != null || _cards.value[key]?.busy == true) return
            dot.card?.let { kept ->
                set(key, FieldCardUi(card = kept))
                // The kept card may not say whether this reader collected it: ask once, at no cost (it is kept).
                if (kept.collected == null) run(key) { repository.card(moment, dot.id) }
                return
            }
            run(key) { repository.card(moment, dot.id) }
        }

        fun retry(
            moment: String,
            dot: String,
        ) = run("$moment/$dot") { repository.card(moment, dot) }

        fun collect(
            moment: String,
            dot: String,
            keep: Boolean,
        ) {
            val key = "$moment/$dot"
            val before = _cards.value[key]?.card ?: return
            set(key, FieldCardUi(card = before.copy(collected = keep), busy = true))
            viewModelScope.launch {
                when (val answer = repository.collect(moment, dot, keep)) {
                    is NetworkResult.Success -> set(key, FieldCardUi(card = answer.data ?: before.copy(collected = false)))
                    is NetworkResult.Failure -> set(key, FieldCardUi(card = before, problem = "Couldn't do that. Try again."))
                }
            }
        }

        fun correct(
            moment: String,
            dot: String,
            name: String,
            note: String?,
        ) = run("$moment/$dot") { repository.correct(moment, dot, name.trim(), note?.trim()?.ifEmpty { null }) }

        fun loadGuide(more: Boolean = false) {
            val now = _guide.value
            if (now.loading) return
            _guide.value = now.copy(loading = true, problem = null)
            viewModelScope.launch {
                when (val page = repository.fieldGuide(if (more) now.next else null)) {
                    is NetworkResult.Success ->
                        _guide.value =
                            FieldGuideUi(
                                entries = if (more) now.entries + page.data.cards else page.data.cards,
                                next = page.data.nextCursor,
                            )
                    is NetworkResult.Failure -> _guide.value = now.copy(loading = false, problem = "Your field guide didn't load. Try again.")
                }
            }
        }

        /** "Let it go" from the field guide. */
        fun letGo(entry: MomentFieldGuideEntryDto) {
            viewModelScope.launch {
                if (repository.collect(entry.postId, entry.dotId, keep = false) is NetworkResult.Success) {
                    _guide.update { it.copy(entries = it.entries - entry) }
                    _cards.update { cards ->
                        val key = "${entry.postId}/${entry.dotId}"
                        cards[key]?.card?.let { cards + (key to FieldCardUi(card = it.copy(collected = false))) } ?: cards
                    }
                }
            }
        }

        private fun run(
            key: String,
            call: suspend () -> NetworkResult<MomentFieldCardDto>,
        ) {
            val kept = _cards.value[key]?.card
            set(key, FieldCardUi(card = kept, busy = true))
            viewModelScope.launch {
                when (val answer = call()) {
                    is NetworkResult.Success -> set(key, FieldCardUi(card = answer.data))
                    is NetworkResult.Failure ->
                        set(key, FieldCardUi(card = kept, problem = fieldCardRefusal(answer.error) ?: "Couldn't do that. Try again."))
                }
            }
        }

        private fun set(
            key: String,
            ui: FieldCardUi,
        ) {
            _cards.update { it + (key to ui) }
        }
    }

/** A thing dot's card body in the viewer's dot card ([moment]: the Moment's id). */
@Composable
fun MomentFieldCard(
    moment: String,
    dot: MomentDotDto,
    viewModel: MomentFieldCardViewModel = hiltViewModel(),
) {
    val cards by viewModel.cards.collectAsStateWithLifecycle()
    val ui = cards["$moment/${dot.id}"] ?: FieldCardUi(busy = true)
    var correcting by remember(moment, dot.id) { mutableStateOf(false) }
    var guiding by remember(moment, dot.id) { mutableStateOf(false) }
    LaunchedEffect(moment, dot.id) { viewModel.open(moment, dot) }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.testTag("moments.viewer.fieldCard")) {
        val card = ui.card
        if (card == null) {
            Text(dot.label?.takeIf { it.isNotBlank() }?.let { "Maybe $it" } ?: "Something in the photo", color = Color.White, fontSize = 15.sp)
            Text(ui.problem ?: if (ui.busy) "Naming it…" else "", color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
            if (ui.problem != null) CardAction("Try again", tag = "moments.viewer.fieldCard.retry") { viewModel.retry(moment, dot.id) }
        } else {
            Named(card)
            ui.problem?.let { Text(it, color = PantopusColors.studioPillSecondary, fontSize = 13.sp) }
            Actions(
                card = card,
                busy = ui.busy,
                onCollect = { viewModel.collect(moment, dot.id, keep = card.collected != true) },
                onGuide = { guiding = true },
                onCorrect = { correcting = true },
            )
        }
    }
    if (correcting) {
        NotRightSheet(
            onSend = { name, note ->
                viewModel.correct(moment, dot.id, name, note)
                correcting = false
            },
            onDismiss = { correcting = false },
        )
    }
    if (guiding) FieldGuideSheet(viewModel, onDismiss = { guiding = false })
}

@Composable
private fun Named(card: MomentFieldCardDto) {
    val uri = LocalUriHandler.current
    val name = card.name
    if (name != null) {
        Text(
            buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.Bold)) { append("Likely $name") }
                card.scientific?.takeIf { it.isNotBlank() }?.let { withStyle(SpanStyle(fontStyle = FontStyle.Italic)) { append("  $it") } }
            },
            color = Color.White,
            fontSize = 15.sp,
            modifier = Modifier.testTag("moments.viewer.fieldCard.name"),
        )
    } else {
        Text("Not sure what this is", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
    }
    card.why?.takeIf { it.isNotBlank() }?.let { Text(it, color = Color.White, fontSize = 14.sp) }
    card.caution?.takeIf { it.isNotBlank() }?.let {
        Text(it, color = PantopusColors.warmAmberBorder, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.testTag("moments.viewer.fieldCard.caution"))
    }
    val source = card.source
    source?.url?.takeIf { it.startsWith("https://") }?.let { url ->
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier =
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(role = Role.Button) { runCatching { uri.openUri(url) } }
                    .testTag("moments.viewer.fieldCard.source")
                    .semantics { contentDescription = "Source: ${source.title ?: url}. Opens it" },
        ) {
            PantopusIconImage(icon = PantopusIcon.ExternalLink, contentDescription = null, size = 13.dp, strokeWidth = 2.2f, tint = PantopusColors.studioPillSecondary)
            Text(source.title ?: url, color = PantopusColors.studioPillSecondary, fontSize = 13.sp, maxLines = 2)
        }
    }
    Text(madeBy(card), color = PantopusColors.studioPillSecondary, fontSize = 12.sp)
}

private fun madeBy(card: MomentFieldCardDto): String {
    val words = StringBuilder("Named by ${card.namedBy ?: "Pantopus AI"}. It can be wrong.")
    if (card.corrections > 0) words.append(" ${card.corrections} ${if (card.corrections == 1) "person said" else "people said"} it's something else.")
    return words.toString()
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Actions(
    card: MomentFieldCardDto,
    busy: Boolean,
    onCollect: () -> Unit,
    onGuide: () -> Unit,
    onCorrect: () -> Unit,
) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        if (card.name != null) {
            val kept = card.collected == true
            CardAction(
                if (kept) "In your field guide" else "Collect",
                icon = if (kept) PantopusIcon.Check else PantopusIcon.Plus,
                enabled = !busy,
                tag = "moments.viewer.fieldCard.collect",
                onClick = onCollect,
            )
            if (kept) CardAction("Open the guide", icon = PantopusIcon.BookOpen, tag = "moments.viewer.fieldCard.guide", onClick = onGuide)
        }
        CardAction(card.myCorrection?.let { "You said: ${it.name}" } ?: "Not right?", tag = "moments.viewer.fieldCard.correct", onClick = onCorrect)
    }
}

@Composable
private fun CardAction(
    words: String,
    tag: String,
    icon: PantopusIcon? = null,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        modifier =
            Modifier
                .clip(RoundedCornerShape(19.dp))
                .background(PantopusColors.studioPillFill)
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 7.dp)
                .semantics { role = Role.Button }
                .testTag(tag),
    ) {
        icon?.let { PantopusIconImage(icon = it, contentDescription = null, size = 14.dp, strokeWidth = 2.2f, tint = Color.White) }
        Text(words, color = Color.White.copy(alpha = if (enabled) 1f else 0.5f), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
    }
}

/** "Not right?": what the reader thinks it is and how they know, in a sheet of its own (the keyboard never covers it). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotRightSheet(
    onSend: (String, String?) -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.studioBar,
        modifier = Modifier.sheetKeyboardRules(),
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = Spacing.s4).padding(bottom = Spacing.s5),
        ) {
            Text("Not right?", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
            Text(
                "Say what you think it is. The card stays as it is; its author sees what people say.",
                color = PantopusColors.studioPillSecondary,
                fontSize = 13.sp,
            )
            CardField(name, "What it is", 60, "moments.viewer.fieldCard.nameField") { name = it }
            CardField(note, "How you know (optional)", 140, "moments.viewer.fieldCard.note") { note = it }
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                CardAction("Send", tag = "moments.viewer.fieldCard.send", enabled = name.isNotBlank()) { onSend(name, note) }
            }
        }
    }
}

@Composable
private fun CardField(
    value: String,
    placeholder: String,
    most: Int,
    tag: String,
    onChange: (String) -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    BasicTextField(
        value = value,
        onValueChange = { onChange(it.take(most)) },
        textStyle = TextStyle(color = Color.White, fontSize = 15.sp),
        cursorBrush = SolidColor(Color.White),
        modifier = Modifier.fillMaxWidth().testTag(tag).semantics { contentDescription = placeholder },
        decorationBox = { field ->
            Box(
                contentAlignment = Alignment.CenterStart,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clip(shape)
                        .background(PantopusColors.studioPillFill)
                        .border(1.dp, PantopusColors.studioPillOutline, shape)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
            ) {
                if (value.isEmpty()) Text(placeholder, color = PantopusColors.studioPillSecondary, fontSize = 15.sp)
                field()
            }
        },
    )
}

/** The reader's own field guide: what they collected, newest first; "Let it go" on each. Private to them. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FieldGuideSheet(
    viewModel: MomentFieldCardViewModel,
    onDismiss: () -> Unit,
) {
    val guide by viewModel.guide.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.loadGuide() }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = PantopusColors.studioBar) {
        Column(
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .navigationBarsPadding()
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s5)
                    .testTag("moments.viewer.fieldGuide"),
        ) {
            Text("Your field guide", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
            Text("Only you see what you collect.", color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
            if (guide.entries.isEmpty() && !guide.loading && guide.problem == null) {
                Text("Nothing collected yet.", color = Color.White, fontSize = 14.sp)
            }
            guide.entries.forEach { entry -> GuideRow(entry, onLetGo = { viewModel.letGo(entry) }) }
            guide.problem?.let {
                Text(it, color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
                CardAction("Try again", tag = "moments.viewer.fieldGuide.retry") { viewModel.loadGuide() }
            }
            if (guide.next != null && !guide.loading) CardAction("Show more", tag = "moments.viewer.fieldGuide.more") { viewModel.loadGuide(more = true) }
        }
    }
}

@Composable
private fun GuideRow(
    entry: MomentFieldGuideEntryDto,
    onLetGo: () -> Unit,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.studioPillFill)
                .padding(12.dp)
                .testTag("moments.viewer.fieldGuide.row"),
    ) {
        PantopusIconImage(icon = PantopusIcon.Leaf, contentDescription = null, size = 18.dp, strokeWidth = 2.2f, tint = Color.White)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(entry.card.name?.let { "Likely $it" } ?: "Not sure what this is", color = Color.White, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold)
            entry.card.scientific?.takeIf { it.isNotBlank() }?.let { Text(it, color = PantopusColors.studioPillSecondary, fontSize = 12.5.sp, fontStyle = FontStyle.Italic) }
            entry.card.why?.takeIf { it.isNotBlank() }?.let { Text(it, color = PantopusColors.studioPillSecondary, fontSize = 12.5.sp, maxLines = 2) }
        }
        CardAction("Let it go", tag = "moments.viewer.fieldGuide.letGo", onClick = onLetGo)
    }
}

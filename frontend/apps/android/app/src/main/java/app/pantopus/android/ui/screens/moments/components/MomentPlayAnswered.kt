@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.moments.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import app.pantopus.android.data.api.models.moments.MomentPlayAnswerBody
import app.pantopus.android.data.api.models.moments.MomentPlayAnswerRowDto
import app.pantopus.android.data.api.models.moments.MomentPlayFaceDto
import app.pantopus.android.data.api.models.moments.MomentPlayItemDto
import app.pantopus.android.ui.theme.PantopusColors
import kotlinx.coroutines.launch

/*
 * "Pulse, reinvented" phase 2 (CONTRACT 7b; as on iPhone): the slider (an emoji on a line, or the spectrum dial with
 * people's faces along it) and the question box (an answer only its author reads), on the viewer's cards; and the
 * author's list of a question box's answers.
 */

/** The most letters in a question box answer (CONTRACT 7b). */
const val QUESTION_ANSWER_LETTERS = 200

/** The slider or the dial: drag the mark along the line and let go to answer; the average shows once answered. */
@Composable
internal fun SliderCard(
    item: MomentPlayItemDto,
    onAnswer: ((MomentPlayAnswerBody) -> Unit)?,
) {
    PlayWords(item.question.orEmpty(), bold = true)
    val dial = item.look == "dial"
    val answers = onAnswer.takeIf { item.open == true }
    var moving by remember(item.id, item.mine) { mutableStateOf<Float?>(null) }
    val shown = moving ?: item.mine?.value?.toFloat() ?: 0.5f
    BoxWithConstraints(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(38.dp)
                .sliderInput(item, shown, answers) { moving = it },
    ) {
        val width = constraints.maxWidth.toFloat()
        val density = LocalDensity.current.density
        Box(
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.studioPillOutline),
        )
        if (dial) item.results?.faces.orEmpty().forEach { face -> DialFace(face, width, density) }
        item.results?.average?.let { average ->
            Box(
                modifier =
                    Modifier
                        .align(Alignment.CenterStart)
                        .offset(x = ((average.toFloat() * width) / density).dp - 1.dp)
                        .size(2.dp, 22.dp)
                        .background(Color.White),
            )
        }
        Box(
            contentAlignment = Alignment.Center,
            modifier =
                Modifier
                    .align(Alignment.CenterStart)
                    .offset(x = ((shown * width) / density).dp - 19.dp)
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(if (dial) Color.White else Color.Transparent),
        ) {
            if (!dial) Text(item.emoji?.takeIf { it.isNotBlank() } ?: "●", fontSize = 24.sp, color = Color.White)
        }
    }
    Row(modifier = Modifier.fillMaxWidth()) {
        PlayWords(item.left.orEmpty())
        Spacer(Modifier.weight(1f))
        PlayWords(item.right.orEmpty())
    }
    item.results?.count?.let { count ->
        PlayNote(
            "$count ${if (count == 1) "answer" else "answers"}${if (item.results?.average != null) " · the line is the average" else ""}",
        )
    }
}

/**
 * The slider's line as people use it: TalkBack reads and sets the value, a tap answers where it lands, and a drag moves
 * the mark ([onMove]) and answers where it is let go. Nothing answers when [answers] is null (closed, or the author).
 */
private fun Modifier.sliderInput(
    item: MomentPlayItemDto,
    shown: Float,
    answers: ((MomentPlayAnswerBody) -> Unit)?,
    onMove: (Float) -> Unit,
): Modifier {
    val spoken =
        semantics {
            contentDescription = item.question ?: "Slider"
            progressBarRangeInfo = ProgressBarRangeInfo(shown, 0f..1f)
            if (answers != null) {
                setProgress { to ->
                    answers(MomentPlayAnswerBody(value = to.coerceIn(0f, 1f).toDouble()))
                    true
                }
            }
        }.testTag("moments.play.slider.track")
    if (answers == null) return spoken
    var last: Float? = null
    return spoken
        .pointerInput(item.id) {
            detectTapGestures { at -> answers(MomentPlayAnswerBody(value = (at.x / size.width).coerceIn(0f, 1f).toDouble())) }
        }.pointerInput(item.id) {
            detectHorizontalDragGestures(
                onDragEnd = { last?.let { answers(MomentPlayAnswerBody(value = it.toDouble())) } },
            ) { change, _ ->
                change.consume()
                last = (change.position.x / size.width).coerceIn(0f, 1f).also(onMove)
            }
        }
}

/** One face along the dial: the reader's own and their connections' initials; anyone else a plain face. */
@Composable
private fun DialFace(
    face: MomentPlayFaceDto,
    width: Float,
    density: Float,
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .offset(x = ((face.x.toFloat() * width) / density).dp - 11.dp, y = 8.dp)
                .size(22.dp)
                .clip(CircleShape)
                .background(if (face.mine) PantopusColors.primary600 else PantopusColors.studioPillFill)
                .border(1.dp, Color.White, CircleShape)
                .semantics { contentDescription = if (face.mine) "You" else face.person?.firstName ?: "Someone nearby" },
    ) {
        Text(face.person?.initials.orEmpty(), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
    }
}

/**
 * The question box: the author sees how many answered and opens the list ([onAnswers]); a reader writes one answer
 * ([onWrite] opens the writing box) and then sees their own words. Only [authorName] reads the answers.
 */
@Composable
internal fun QuestionCard(
    item: MomentPlayItemDto,
    authorName: String?,
    onWrite: (() -> Unit)?,
    onAnswers: (() -> Unit)?,
) {
    PlayWords(item.prompt.orEmpty(), bold = true)
    val who = authorName ?: "the author"
    val count = item.results?.count
    val mine = item.mine?.text
    when {
        count != null ->
            Text(
                text = "$count ${if (count == 1) "answer" else "answers"} · See them",
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                textDecoration = TextDecoration.Underline,
                modifier =
                    Modifier
                        .then(if (onAnswers != null) Modifier.clickable(role = Role.Button, onClick = onAnswers) else Modifier)
                        .testTag("moments.play.question.answers"),
            )
        mine != null -> PlayNote("You said: $mine. Only $who sees answers.")
        item.open == true -> {
            Text(
                text = "Your answer",
                color = PantopusColors.studioPillSecondary,
                fontSize = 14.5.sp,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(PantopusColors.studioPillFill)
                        .then(if (onWrite != null) Modifier.clickable(role = Role.Button, onClick = onWrite) else Modifier)
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                        .testTag("moments.play.question.field"),
            )
            PlayNote("Only $who sees answers.")
        }
        else -> PlayNote("Only $who sees answers.")
    }
}

/** The question box's writing box, over the keyboard; [onSend] answers whether it went. */
@Composable
internal fun QuestionWriteDialog(
    prompt: String,
    onSend: suspend (String) -> Boolean,
    onDone: () -> Unit,
    limit: Int = QUESTION_ANSWER_LETTERS,
    first: String = "",
    hint: String = "Your answer",
) {
    var words by remember { mutableStateOf(first) }
    var sending by remember { mutableStateOf(false) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    Dialog(onDismissRequest = onDone) {
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.Black)
                    .background(PantopusColors.studioBar)
                    .padding(16.dp)
                    .testTag("moments.play.question.write"),
        ) {
            PlayWords(prompt, bold = true)
            BasicTextField(
                value = words,
                onValueChange = { words = it.take(limit) },
                textStyle = TextStyle(color = Color.White, fontSize = 15.sp),
                cursorBrush = SolidColor(Color.White),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 72.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(PantopusColors.studioPillFill)
                        .padding(12.dp)
                        .focusRequester(focus)
                        .semantics { contentDescription = hint }
                        .testTag("moments.play.question.text"),
            )
            if (failed) PlayNote("Couldn't send it. Try again.")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                PlayButton("Cancel", "moments.play.question.cancel", onDone)
                PlayButton(if (sending) "Sending…" else "Send", "moments.play.question.send") {
                    val typed = words.trim()
                    if (typed.isEmpty() || sending) return@PlayButton
                    sending = true
                    failed = false
                    scope.launch {
                        val sent = onSend(typed)
                        sending = false
                        if (sent) onDone() else failed = true
                    }
                }
            }
        }
    }
}

/** The author's list of a question box's answers, newest first, each with Remove. */
@Composable
internal fun AnswersDialog(
    prompt: String,
    load: suspend (cursor: String?) -> Pair<List<MomentPlayAnswerRowDto>, String?>?,
    remove: suspend (String) -> Boolean,
    onDone: () -> Unit,
) {
    var rows by remember { mutableStateOf<List<MomentPlayAnswerRowDto>?>(null) }
    var next by remember { mutableStateOf<String?>(null) }
    var failed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) {
        val page = load(null)
        if (page == null) failed = true else rows = page.first.also { next = page.second }
    }
    Dialog(onDismissRequest = onDone) {
        Column(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(max = 520.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.Black)
                    .background(PantopusColors.studioBar)
                    .padding(16.dp)
                    .testTag("moments.play.answersList"),
        ) {
            PlayWords(prompt, bold = true)
            when {
                failed -> PlayNote("Couldn't load the answers.")
                rows == null -> PlayNote("Loading…")
                rows.orEmpty().isEmpty() -> PlayNote("No answers yet.")
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.weight(1f, fill = false)) {
                items(rows.orEmpty(), key = { it.id }) { row ->
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.testTag("moments.play.answer")) {
                        PlayWords(row.person?.name ?: row.person?.firstName ?: "Someone", bold = true)
                        PlayWords(row.text ?: row.note.orEmpty())
                        PlayButton("Remove", "moments.play.answer.remove") {
                            scope.launch { if (remove(row.id)) rows = rows.orEmpty().filterNot { it.id == row.id } }
                        }
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                next?.let { cursor ->
                    PlayButton("More", "moments.play.answers.more") {
                        scope.launch {
                            load(cursor)?.let { page ->
                                rows = rows.orEmpty() + page.first
                                next = page.second
                            }
                        }
                    }
                }
                PlayButton("Done", "moments.play.answers.done", onDone)
            }
        }
    }
}

@Composable
internal fun PlayWords(
    words: String,
    bold: Boolean = false,
) {
    Text(
        text = words,
        color = Color.White,
        fontSize = if (bold) 15.sp else 13.sp,
        fontWeight = if (bold) FontWeight.Bold else FontWeight.SemiBold,
    )
}

@Composable
internal fun PlayNote(words: String) {
    Text(words, color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
}

@Composable
internal fun PlayButton(
    words: String,
    tag: String,
    onClick: () -> Unit,
) {
    Text(
        text = words,
        color = Color.White,
        fontSize = 13.5.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            Modifier
                .clip(RoundedCornerShape(16.dp))
                .background(PantopusColors.studioPillFill)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 7.dp)
                .testTag(tag),
    )
}

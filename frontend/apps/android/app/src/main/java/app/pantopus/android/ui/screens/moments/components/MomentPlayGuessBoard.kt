@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentPlayAnswerBody
import app.pantopus.android.data.api.models.moments.MomentPlayFaceDto
import app.pantopus.android.data.api.models.moments.MomentPlayItemDto
import app.pantopus.android.data.api.models.moments.MomentPlayRangeDto
import app.pantopus.android.ui.theme.PantopusColors
import java.util.Locale
import kotlin.math.roundToInt

/*
 * "Pulse, reinvented" phase 2 (CONTRACT 7b; boards B6 and B9; as on iPhone): guess and reveal, one try at the options or
 * a number in a range, then the answer and how everyone did; and the board, "where do you stand", where a reader puts
 * their own face among others' on two axes.
 */

/** A number as people read it: whole when it is whole, else one decimal. */
fun playNumber(value: Double): String =
    if (value == Math.rint(value)) value.toLong().toString() else String.format(Locale.US, "%.1f", value)

/** Guess and reveal. */
@Composable
internal fun GuessCard(
    item: MomentPlayItemDto,
    onAnswer: ((MomentPlayAnswerBody) -> Unit)?,
) {
    PlayWords(item.prompt.orEmpty(), bold = true)
    val tries = onAnswer.takeIf { item.open == true && item.mine == null }
    val options = item.options
    val range = item.range
    if (options != null) {
        options.forEachIndexed { at, option ->
            val right = item.answer?.toInt() == at
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(38.dp)
                        .clip(RoundedCornerShape(19.dp))
                        .background(if (item.mine?.choice == at) PantopusColors.studioPillOutline else PantopusColors.studioPillFill)
                        .then(
                            if (tries != null) {
                                Modifier.clickable(
                                    role = Role.Button,
                                ) { tries(MomentPlayAnswerBody(choice = at)) }
                            } else {
                                Modifier
                            },
                        )
                        .padding(horizontal = 12.dp)
                        .testTag("moments.play.guess.option$at"),
            ) {
                Text(option, color = Color.White, fontSize = 14.5.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                if (right) Text("✓", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        }
    } else if (range != null) {
        RangeGuess(item, range, tries)
    }
    guessOutcome(item)?.let { PlayNote(it) }
}

@Composable
private fun RangeGuess(
    item: MomentPlayItemDto,
    range: MomentPlayRangeDto,
    tries: ((MomentPlayAnswerBody) -> Unit)?,
) {
    val unit = range.unit?.takeIf { it.isNotBlank() }?.let { " $it" }.orEmpty()
    var value by remember(item.id) { mutableStateOf(((range.min + range.max) / 2).toFloat()) }
    if (tries != null) {
        Slider(
            value = value,
            onValueChange = { value = it },
            valueRange = range.min.toFloat()..range.max.toFloat(),
            colors = SliderDefaults.colors(thumbColor = Color.White, activeTrackColor = Color.White),
            modifier = Modifier.testTag("moments.play.guess.range"),
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            PlayWords("${playNumber(value.toDouble())}$unit", bold = true)
            Spacer(Modifier.weight(1f))
            PlayButton("Guess", "moments.play.guess.send") { tries(MomentPlayAnswerBody(value = Math.round(value * 100) / 100.0)) }
        }
    } else {
        item.answer?.let { PlayWords("It's ${playNumber(it)}$unit", bold = true) }
    }
}

/** After the reader's try (or for the author): right or not, how far off, and how everyone did. */
private fun guessOutcome(item: MomentPlayItemDto): String? {
    val words = mutableListOf<String>()
    item.mine?.right?.let { words += if (it) "You got it." else "Not this time." }
    item.mine?.offBy?.let { words += "You were ${playNumber(it)}${item.range?.unit?.let { u -> " $u" }.orEmpty()} off." }
    everyoneDid(item)?.let { words += it }
    return words.takeIf { it.isNotEmpty() }?.joinToString(" ")
}

/** How everyone did: the share who got the options' answer, or the range's average. */
private fun everyoneDid(item: MomentPlayItemDto): String? {
    val results = item.results ?: return null
    val counts = results.counts
    val total = results.total ?: 0
    val answer = item.answer
    if (counts != null && answer != null && total > 0) {
        return "${(counts.getOrElse(answer.toInt()) { 0 } * 100f / total).roundToInt()}% of $total got it."
    }
    val count = results.count ?: return null
    return results.average?.let { "$count guessed; the average is ${playNumber(it)}." }
}

/**
 * The board: two axes, everyone's faces, and the reader's own once they tap where they stand ([onAnswer]; `y` from the
 * bottom). [onNote] opens the writing box for the reader's note.
 */
@Composable
internal fun BoardCard(
    item: MomentPlayItemDto,
    onAnswer: ((MomentPlayAnswerBody) -> Unit)?,
    onNote: (() -> Unit)?,
) {
    PlayWords(item.question.orEmpty(), bold = true)
    val places = onAnswer.takeIf { item.open == true }
    PlayNote(item.yAxis?.top.orEmpty())
    BoxWithConstraints(
        modifier =
            Modifier
                .fillMaxWidth()
                .aspectRatio(1.2f)
                .clip(RoundedCornerShape(14.dp))
                .background(PantopusColors.studioPillFill)
                .border(1.dp, PantopusColors.studioPillOutline, RoundedCornerShape(14.dp))
                .semantics { contentDescription = "${item.question.orEmpty()}: tap where you stand" }
                .testTag("moments.play.board.area")
                .then(
                    if (places == null) {
                        Modifier
                    } else {
                        Modifier.pointerInput(item.id) {
                            detectTapGestures { at ->
                                val x = (at.x / size.width).coerceIn(0f, 1f)
                                val y = (1f - at.y / size.height).coerceIn(0f, 1f)
                                places(
                                    MomentPlayAnswerBody(
                                        x = Math.round(x * 100) / 100.0,
                                        y = Math.round(y * 100) / 100.0,
                                        note = item.mine?.note,
                                    ),
                                )
                            }
                        }
                    },
                ),
    ) {
        val width = constraints.maxWidth.toFloat()
        val height = constraints.maxHeight.toFloat()
        val density = LocalDensity.current.density
        // The two axes through the middle.
        Box(Modifier.align(Alignment.Center).fillMaxWidth().height(1.dp).background(PantopusColors.studioPillOutline))
        Box(Modifier.align(Alignment.Center).size(1.dp, (height / density).dp).background(PantopusColors.studioPillOutline))
        item.results?.faces.orEmpty().forEach { face -> BoardFace(face, width, height, density) }
    }
    Row(modifier = Modifier.fillMaxWidth()) {
        PlayNote(item.xAxis?.left.orEmpty())
        Spacer(Modifier.weight(1f))
        PlayNote(item.xAxis?.right.orEmpty())
    }
    PlayNote(item.yAxis?.bottom.orEmpty())
    item.results?.count?.let { count -> PlayNote("$count ${if (count == 1) "person" else "people"} on the board") }
    if (item.mine != null && item.open == true && onNote != null) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PlayButton(if (item.mine.note.isNullOrBlank()) "Add a note" else "Change my note", "moments.play.board.note", onNote)
        }
    }
}

/** One face on the board at its place (`y` from the bottom), with its note under it when it has one. */
@Composable
private fun BoardFace(
    face: MomentPlayFaceDto,
    width: Float,
    height: Float,
    density: Float,
) {
    val x = face.x.toFloat() * width / density
    val y = (1f - (face.y ?: 0.5).toFloat()) * height / density
    Box(
        contentAlignment = Alignment.Center,
        modifier =
            Modifier
                .offset(x = x.dp - 13.dp, y = y.dp - 13.dp)
                .size(26.dp)
                .clip(CircleShape)
                .background(if (face.mine) PantopusColors.primary600 else Color.Black)
                .border(1.5.dp, Color.White, CircleShape)
                .semantics {
                    contentDescription =
                        (if (face.mine) "You" else face.person?.firstName ?: "Someone nearby") + (face.note?.let { ": $it" } ?: "")
                }.testTag(if (face.mine) "moments.play.board.mine" else "moments.play.board.face"),
    ) {
        Text(if (face.mine) "You" else face.person?.initials.orEmpty(), color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Bold)
    }
}

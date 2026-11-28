@file:Suppress("MagicNumber", "TooManyFunctions")

package app.pantopus.android.ui.screens.moments.studio

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.exclude
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentDotDto
import app.pantopus.android.data.api.models.moments.MomentDotKinds
import app.pantopus.android.data.api.models.moments.drawable
import app.pantopus.android.data.api.models.moments.httpsLink
import app.pantopus.android.ui.screens.moments.components.DOT
import app.pantopus.android.ui.screens.moments.components.MomentDotMarker
import app.pantopus.android.ui.screens.moments.components.kindWords
import app.pantopus.android.ui.screens.moments.components.stampFrame
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import kotlin.math.roundToInt

/*
 * "Pulse, reinvented" phase 2, living objects (CONTRACT 7c; as on iPhone): Illuminate in the Studio. From the rail, add
 * a dot (a note, a rating, a link: never a link under a made-up name), write what it holds, remove it; up to eight on one
 * picture. Each new dot sits near the middle of the picture; the author drags it onto the thing it is about once the
 * panel is closed. They go out as `dots` with the post; nothing is drawn into the picture.
 */

/** The dots that go with the post: complete ones on a photo or video, no link under a made-up name; null when none. */
internal val MomentsComposeUiState.sentDots: List<MomentDotDto>?
    get() =
        dots
            .takeIf { media != null }
            ?.filter { it.ready && !(madeUp && (it.kind == MomentDotKinds.LINK || it.kind == MomentDotKinds.WHISPER)) }
            ?.map { it.trimmed() }
            ?.takeIf { it.isNotEmpty() }

/** Whole enough to go out: a link only as an https address (the server refuses the Moment otherwise), a whisper once recorded. */
private val MomentDotDto.ready: Boolean
    get() =
        when (kind) {
            MomentDotKinds.LINK -> httpsLink(url) != null
            MomentDotKinds.WHISPER -> app.pantopus.android.data.moments.sound.MomentsStudioSounds.whispers.value.containsKey(id)
            else -> drawable
        }

/** A dot's words as they go out: trimmed, a link as its https address, an empty title left out. */
private fun MomentDotDto.trimmed(): MomentDotDto =
    copy(
        text = text?.trim(),
        label = label?.trim(),
        url = if (kind == MomentDotKinds.LINK) httpsLink(url) else null,
        title = title?.trim()?.ifEmpty { null },
    )

/** A new dot of [kind], near the middle of the picture, a little apart from those already there. */
private fun newDot(
    kind: String,
    dots: List<MomentDotDto>,
): MomentDotDto {
    val n = (dots.mapNotNull { it.id.removePrefix("dot-").toIntOrNull() }.maxOrNull() ?: 0) + 1
    val step = (dots.size % 4) * 0.06
    return MomentDotDto(id = "dot-$n", kind = kind, x = 0.42 + step, y = 0.42 + step, stars = 5.takeIf { kind == MomentDotKinds.RATING })
}

/** The Studio's dots over the picture of [picture] px filling the screen: drag one to move it, tap it to open it. */
@Composable
internal fun StudioDotLayer(
    dots: List<MomentDotDto>,
    picture: IntSize?,
    enabled: Boolean,
    onDots: (List<MomentDotDto>) -> Unit,
    onOpen: (String) -> Unit,
) {
    if (dots.isEmpty()) return
    val current by rememberUpdatedState(dots)
    BoxWithConstraints(modifier = Modifier.fillMaxSize().testTag("moments.studio.dots")) {
        val frame = stampFrame(picture, constraints.maxWidth.toFloat(), constraints.maxHeight.toFloat())
        val dotPx = DOT * LocalDensity.current.density
        dots.forEach { dot ->
            val cx = frame.left + dot.x.toFloat() * frame.width
            val cy = frame.top + dot.y.toFloat() * frame.height
            MomentDotMarker(
                kind = dot.kind,
                modifier =
                    Modifier
                        .offset { IntOffset((cx - dotPx / 2).roundToInt(), (cy - dotPx / 2).roundToInt()) }
                        .pointerInput(dot.id, enabled) {
                            if (!enabled) return@pointerInput
                            detectTapGestures { onOpen(dot.id) }
                        }.pointerInput(dot.id, enabled, frame) {
                            if (!enabled) return@pointerInput
                            detectDragGestures { change, amount ->
                                change.consume()
                                onDots(
                                    current.map {
                                        if (it.id != dot.id) {
                                            it
                                        } else {
                                            it.copy(
                                                x = (it.x + amount.x / frame.width).coerceIn(0.04, 0.96),
                                                y = (it.y + amount.y / frame.height).coerceIn(0.04, 0.96),
                                            )
                                        }
                                    },
                                )
                            }
                        }.semantics {
                            contentDescription = "Dot: ${dot.kindWords().removePrefix("A ")}. Opens it in Illuminate. Drag to move it."
                            role = Role.Button
                        }.testTag("moments.studio.dot"),
            )
        }
    }
}

/** The Studio's Illuminate panel: add a dot, write what it holds, remove it. */
@Composable
internal fun StudioIlluminate(
    visible: Boolean,
    dots: List<MomentDotDto>,
    picked: String?,
    madeUp: Boolean,
    onPick: (String?) -> Unit,
    onDots: (List<MomentDotDto>) -> Unit,
    onDone: () -> Unit,
) {
    BackHandler(enabled = visible, onBack = onDone)
    Box(modifier = Modifier.fillMaxSize()) {
        AnimatedVisibility(visible = visible, enter = fadeIn(), exit = fadeOut()) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.momentDim)
                        .clickable(interactionSource = remember { MutableInteractionSource() }, indication = null, onClick = onDone)
                        .semantics {
                            contentDescription = "Close"
                            role = Role.Button
                        },
            )
        }
        AnimatedVisibility(
            visible = visible,
            enter = slideInVertically { it },
            exit = slideOutVertically { it },
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            Column(
                modifier =
                    Modifier
                        .windowInsetsPadding(WindowInsets.ime.exclude(WindowInsets.navigationBars))
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp))
                        .background(Color.Black)
                        .background(PantopusColors.studioBar)
                        .verticalScroll(rememberScrollState())
                        .navigationBarsPadding()
                        .padding(start = Spacing.s4, end = Spacing.s4, top = Spacing.s5, bottom = Spacing.s5)
                        .testTag("moments.studio.illuminate"),
                verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                IlluminateBody(dots, picked, madeUp, onPick, onDots)
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun IlluminateBody(
    dots: List<MomentDotDto>,
    picked: String?,
    madeUp: Boolean,
    onPick: (String?) -> Unit,
    onDots: (List<MomentDotDto>) -> Unit,
) {
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text("Illuminate", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
        Text("Dots people tap on the picture", color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
    }
    val shown = dots.firstOrNull { it.id == picked } ?: dots.lastOrNull()
    if (dots.isNotEmpty()) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            dots.forEachIndexed { at, dot ->
                Pill("${at + 1}. ${dot.kindWords().removePrefix("A ").replaceFirstChar { it.uppercase() }}", on = dot.id == shown?.id) {
                    onPick(dot.id)
                }
            }
        }
    }
    shown?.let { dot -> DotEditor(dot, madeUp, onChange = { changed -> onDots(dots.map { if (it.id == dot.id) changed else it }) }) }
    shown?.let { dot ->
        Pill("Remove dot", tag = "moments.studio.dot.remove") {
            onDots(dots.filterNot { it.id == dot.id })
            onPick(null)
        }
    }
    if (dots.size < MomentDotDto.MOST) {
        Text("Add a dot", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            listOf(
                MomentDotKinds.NOTE to "A note",
                MomentDotKinds.RATING to "A rating",
                MomentDotKinds.LINK to "A link",
                MomentDotKinds.WHISPER to "A whisper",
            ).filterNot { madeUp && (it.first == MomentDotKinds.LINK || it.first == MomentDotKinds.WHISPER) }
                .forEach { (kind, words) ->
                    Pill(words, tag = "moments.studio.dot.add.$kind") {
                        val dot = newDot(kind, dots)
                        onDots(dots + dot)
                        onPick(dot.id)
                    }
                }
        }
        if (madeUp) Hint("A made-up name can't post a link or a whisper: these stay off.")
    } else {
        Hint("Up to ${MomentDotDto.MOST} dots on one picture.")
    }
    if (dots.isNotEmpty()) Hint("Close this and drag each dot onto what it's about.")
}

/** What the picked dot holds. */
@Composable
private fun DotEditor(
    dot: MomentDotDto,
    madeUp: Boolean,
    onChange: (MomentDotDto) -> Unit,
) {
    when (dot.kind) {
        MomentDotKinds.NOTE ->
            Field(dot.text.orEmpty(), "What should people know here?", MomentDotDto.NOTE_LETTERS, "moments.studio.dot.note") {
                onChange(dot.copy(text = it))
            }
        MomentDotKinds.RATING -> {
            Field(dot.label.orEmpty(), "What you rate", MomentDotDto.LABEL_LETTERS, "moments.studio.dot.label") {
                onChange(dot.copy(label = it))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                for (n in 1..5) {
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier =
                            Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .clickable(role = Role.Button) { onChange(dot.copy(stars = n)) }
                                .padding(6.dp)
                                .semantics { contentDescription = "$n of 5 stars" }
                                .testTag("moments.studio.dot.star$n"),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.Star,
                            contentDescription = null,
                            size = 24.dp,
                            strokeWidth = 2.2f,
                            tint = if (n <= (dot.stars ?: 0)) Color.White else PantopusColors.studioPillOutline,
                        )
                    }
                }
            }
        }
        MomentDotKinds.LINK ->
            if (madeUp) {
                Hint("A made-up name can't post a link: this one stays off.")
            } else {
                Field(dot.url.orEmpty(), "https://", MomentDotDto.URL_LETTERS, "moments.studio.dot.url", KeyboardType.Uri) {
                    onChange(dot.copy(url = it))
                }
                Field(dot.title.orEmpty(), "Title (optional)", MomentDotDto.TITLE_LETTERS, "moments.studio.dot.title") {
                    onChange(dot.copy(title = it))
                }
                Hint(
                    if (dot.url.isNullOrBlank() || httpsLink(dot.url) != null) {
                        "Only an https link."
                    } else {
                        "This one won't go out: only an https link."
                    },
                )
            }
        MomentDotKinds.WHISPER ->
            if (madeUp) {
                Hint("A made-up name can't carry sound: a voice tells who you are. This one stays off.")
            } else {
                app.pantopus.android.ui.screens.moments.studio.sound.MomentsStudioWhisperEditor(dot.id)
            }
    }
}

@Composable
private fun Field(
    value: String,
    placeholder: String,
    most: Int,
    tag: String,
    type: KeyboardType = KeyboardType.Text,
    onChange: (String) -> Unit,
) {
    val shape = RoundedCornerShape(14.dp)
    BasicTextField(
        value = value,
        onValueChange = { onChange(it.take(most)) },
        textStyle = TextStyle(color = Color.White, fontSize = 15.sp),
        cursorBrush = SolidColor(Color.White),
        keyboardOptions = KeyboardOptions(keyboardType = type),
        modifier = Modifier.fillMaxWidth().testTag(tag).semantics { contentDescription = placeholder },
        decorationBox = { field ->
            Box(
                contentAlignment = Alignment.CenterStart,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(44.dp)
                        .clip(shape)
                        .background(PantopusColors.studioPillFill)
                        .border(1.dp, PantopusColors.studioPillOutline, shape)
                        .padding(horizontal = 12.dp),
            ) {
                if (value.isEmpty()) Text(placeholder, color = PantopusColors.studioPillSecondary, fontSize = 15.sp)
                field()
            }
        },
    )
}

@Composable
private fun Pill(
    words: String,
    on: Boolean = false,
    tag: String = "moments.studio.dot.pill",
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(19.dp)
    Text(
        text = words,
        color = if (on) PantopusColors.studioBar else Color.White,
        fontSize = 14.5.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            Modifier
                .clip(shape)
                .background(if (on) Color.White else PantopusColors.studioPillFill)
                .border(1.dp, PantopusColors.studioPillOutline, shape)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 14.dp, vertical = Spacing.s2)
                .testTag(tag),
    )
}

@Composable
private fun Hint(words: String) {
    Text(words, color = PantopusColors.studioPillSecondary, fontSize = 13.sp)
}

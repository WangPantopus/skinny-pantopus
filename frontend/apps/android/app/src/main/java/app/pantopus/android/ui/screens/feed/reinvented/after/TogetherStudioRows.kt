package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.screens.moments.studio.studioPair
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.flow.first

/*
 * Phase 3's rows in the Studio's drawer (CONTRACT 8) and the Retake's ghost on the Studio's picture, hung on the Studio
 * by one line each (the hook rule); and the opener Pulse draws. They draw nothing unless the switch is on and the row
 * applies. Words as the web's and the iPhone's Studio.
 */

private const val GHOST_ALPHA = 0.4f

/** The drawer's phase 3 rows (the Studio's drawer only: its caller passes `studio`). */
@Composable
fun TogetherStudioRows(
    state: MomentsComposeUiState,
    holder: TogetherStudioViewModel = hiltViewModel(),
) {
    val on by holder.on.collectAsStateWithLifecycle()
    if (!on) return
    when (val opened = TogetherStudio.context.value) {
        is TogetherStudio.Context.RetakeFrame -> AddingRow(opened)
        is TogetherStudio.Context.EyesOnAnswer -> AnsweringRow(opened)
        is TogetherStudio.Context.PinboardPiece -> {
            PieceRow(opened, photo = state.media is MomentMediaFile.Photo && state.studioPair == null)
            if (state.offersSky) JoinSkyRow()
        }
        null -> {
            if (state.offersSky) JoinSkyRow()
            if (state.offersRetake) StartRetakeRow()
            if (state.offersPinboard) StartPinboardRow()
        }
    }
}

/** "Adding to “The cedar bench”", and the first picture shown or hidden. */
@Composable
private fun AddingRow(frame: TogetherStudio.Context.RetakeFrame) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).padding(top = 6.dp).testTag("together.studio.adding"),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text("Adding to “${frame.title}”", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        Text(
            "Stand where the first picture was taken. Your frame joins the Retake and stays.",
            fontSize = 12.5.sp,
            lineHeight = 16.sp,
            color = PantopusColors.appTextSecondary,
        )
        if (frame.ghost != null) {
            val on by TogetherStudio.ghostOn
            SwitchRow(
                title = "Show the first picture",
                line = null,
                on = on,
                tag = "together.studio.ghost",
            ) { TogetherStudio.ghostOn.value = it }
        }
    }
}

/** "Answering “Is the fountain running?” with a Live photo". */
@Composable
private fun AnsweringRow(answer: TogetherStudio.Context.EyesOnAnswer) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).padding(top = 6.dp).testTag("together.studio.answering"),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            "Answering “${answer.question}” with a Live photo",
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            "Take it here, now: a photo from the place the question is about.",
            fontSize = 12.5.sp,
            lineHeight = 16.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/** "Adding your piece to “Best fall tree on your walk”" (8i). */
@Composable
private fun PieceRow(
    piece: TogetherStudio.Context.PinboardPiece,
    photo: Boolean,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s5)
                .padding(top = 6.dp)
                .testTag("together.studio.piece")
                .semantics(mergeDescendants = true) {},
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            "Adding your piece to “${piece.prompt}”",
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            if (photo) {
                "Your photo joins the pinboard and stays. One piece each."
            } else {
                "Only a photo joins the pinboard. This posts as an ordinary Moment."
            },
            fontSize = 12.5.sp,
            lineHeight = 16.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/** "Start a pinboard", and its prompt (8i). */
@Composable
private fun StartPinboardRow() {
    val on by TogetherStudio.startsPinboard
    val prompt by TogetherStudio.pinboardPrompt
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).padding(top = 6.dp)) {
        SwitchRow(
            title = "Start a pinboard",
            line = "A prompt others add their own photo to for a week, one each. It stays.",
            on = on,
            tag = "together.studio.pinboard",
        ) { TogetherStudio.startsPinboard.value = it }
        if (on) {
            OutlinedTextField(
                value = prompt,
                onValueChange = { TogetherStudio.pinboardPrompt.value = it.take(TogetherStudio.PROMPT_MAX) },
                placeholder = { Text("Best fall tree on your walk") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(top = Spacing.s2)
                        .testTag("together.studio.pinboardPrompt")
                        .semantics { contentDescription = "The pinboard's prompt" },
            )
        }
    }
}

/** "Join tonight's sky: your photo stays in the piece", on by default. */
@Composable
private fun JoinSkyRow() {
    val on by TogetherStudio.joinsSky
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).padding(top = 6.dp)) {
        SwitchRow(
            title = "Join tonight’s sky: your photo stays in the piece",
            line = "Only if several people photograph a real sunset or a first snow here in the same minutes.",
            on = on,
            tag = "together.studio.sky",
        ) { TogetherStudio.joinsSky.value = it }
    }
}

/** "Start a Retake", and its name. */
@Composable
private fun StartRetakeRow() {
    val on by TogetherStudio.startsRetake
    val title by TogetherStudio.retakeTitle
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).padding(top = 6.dp)) {
        SwitchRow(
            title = "Start a Retake",
            line = "A Retake shows this exact spot and stays, so others can stand here.",
            on = on,
            tag = "together.studio.retake",
        ) { TogetherStudio.startsRetake.value = it }
        if (on) {
            OutlinedTextField(
                value = title,
                onValueChange = { TogetherStudio.retakeTitle.value = it.take(TogetherStudio.TITLE_MAX) },
                placeholder = { Text("Its name, like The cedar bench") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Done),
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(top = Spacing.s2)
                        .testTag("together.studio.retakeTitle")
                        .semantics { contentDescription = "The Retake's name" },
            )
        }
    }
}

@Composable
private fun SwitchRow(
    title: String,
    line: String?,
    on: Boolean,
    tag: String,
    onChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(text = title, fontSize = 15.sp, fontWeight = FontWeight.Medium, color = PantopusColors.appText)
            line?.let { Text(text = it, fontSize = 12.5.sp, lineHeight = 16.sp, color = PantopusColors.appTextSecondary) }
        }
        Switch(
            checked = on,
            onCheckedChange = onChange,
            modifier = Modifier.testTag(tag).semantics { contentDescription = listOfNotNull(title, line).joinToString(". ") },
            colors =
                SwitchDefaults.colors(
                    checkedTrackColor = PantopusColors.primary600,
                    uncheckedTrackColor = PantopusColors.momentSwitchTrack,
                    uncheckedBorderColor = PantopusColors.momentSwitchTrack,
                    uncheckedThumbColor = Color.White,
                ),
        )
    }
}

/**
 * On the Studio's stage, over its picture and under everything else: claims the Studio for phase 3's choices (the drawer
 * may never be opened), and while adding a frame to a Retake shows its first picture over the Studio's own at 40%, to
 * line up with. Takes no touch.
 */
@Composable
fun TogetherStudioGhost(
    @Suppress("UNUSED_PARAMETER") state: MomentsComposeUiState,
    holder: TogetherStudioViewModel = hiltViewModel(),
) {
    DisposableEffect(holder) {
        TogetherStudio.owner = holder
        TogetherStudio.staged.value = true
        onDispose { TogetherStudio.staged.value = false }
    }
    val on by holder.on.collectAsStateWithLifecycle()
    if (!on) return
    val frame = TogetherStudio.context.value as? TogetherStudio.Context.RetakeFrame ?: return
    val ghost = frame.ghost ?: return
    if (!TogetherStudio.ghostOn.value) return
    Box(Modifier.fillMaxSize().clearAndSetSemantics {}) {
        AsyncImage(
            model = ghost,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize().alpha(GHOST_ALPHA).testTag("together.studio.ghostPicture"),
        )
    }
}

/**
 * In Pulse: opens the Studio that [TogetherStudio.openFor] asked for, once Pulse is in front (at once, or when the viewer
 * or sheet that asked has closed). Coming back to Pulse with no Studio open and nothing asked drops what was chosen.
 */
@Composable
fun TogetherStudioOpener(onCompose: () -> Unit) {
    val compose by rememberUpdatedState(onCompose)
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val asked = TogetherStudio.opening.value
    // Keyed on the request only: clearing it below ends this effect, never starts a second one.
    LaunchedEffect(asked, lifecycle) {
        val at = asked ?: return@LaunchedEffect
        lifecycle.currentStateFlow.first { it.isAtLeast(Lifecycle.State.RESUMED) }
        if (TogetherStudio.opening.value != at) return@LaunchedEffect
        if (System.currentTimeMillis() - at > TogetherStudio.OPENING_MS) {
            TogetherStudio.reset()
            return@LaunchedEffect
        }
        TogetherStudio.pending = true
        TogetherStudio.opening.value = null
        compose()
    }
    // Only a real return to Pulse (a resume), never a change of the request, drops what an unopened Studio held.
    LifecycleResumeEffect(Unit) {
        if (TogetherStudio.opening.value == null && TogetherStudio.owner == null) TogetherStudio.reset()
        onPauseOrDispose { }
    }
}

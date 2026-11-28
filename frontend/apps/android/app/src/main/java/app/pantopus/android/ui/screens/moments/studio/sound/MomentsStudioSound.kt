@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.studio.sound

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaPlayer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.moments.sound.MomentSoundCleaner
import app.pantopus.android.data.moments.sound.MomentSoundDto
import app.pantopus.android.data.moments.sound.MomentSoundEncoder
import app.pantopus.android.data.moments.sound.MomentSoundRecorder
import app.pantopus.android.data.moments.sound.MomentSoundSamples
import app.pantopus.android.data.moments.sound.MomentsStudioRecording
import app.pantopus.android.data.moments.sound.MomentsStudioSounds
import app.pantopus.android.data.pulse.PulseReinventedFeature
import app.pantopus.android.ui.screens.moments.studio.RailTool
import app.pantopus.android.ui.screens.pennames.PenNameChoiceViewModel
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID
import javax.inject.Inject

/*
 * "Pulse, reinvented" phase 2, sound in the Studio (PHASE-2 piece 10; CONTRACT 7e), as the iPhone's
 * `MomentsStudioSound.swift`: "Sound" on the rail records three seconds of place sound, heard once when the Moment
 * opens, and "Clean the wind" makes a cleaned copy on the phone, marked as cleaned. It goes up after the Moment is made
 * (`MomentsStudioSounds`). Not offered under a made-up name: a voice tells who someone is. Mood tracks and song stickers
 * wait for the founder's word: no button for them. With the switch off the Studio isn't shown at all.
 */

/** What the Sound sheet shows. */
data class StudioSoundUi(
    val recording: Boolean = false,
    /** What is being recorded or written: null for place sound, else the whisper dot's id. */
    val dot: String? = null,
    val elapsedMs: Long = 0,
    /** Writing the sound, or cleaning the wind from it. */
    val working: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class MomentsStudioSoundViewModel
    @Inject
    constructor(
        feature: PulseReinventedFeature,
    ) : ViewModel() {
        val on: StateFlow<Boolean> = feature.on
        private val _ui = MutableStateFlow(StudioSoundUi())
        val ui: StateFlow<StudioSoundUi> = _ui.asStateFlow()
        private var recorder: MomentSoundRecorder? = null

        init {
            // The switch reads off: the Studio gives way to today's Post screen, and a sound waiting for the Moment goes now.
            viewModelScope.launch {
                feature.on.collect { on ->
                    if (!on) {
                        recorder?.stop()
                        MomentsStudioSounds.clear()
                    }
                }
            }
        }

        /** Three seconds of the microphone, written as an .m4a, kept for the Moment being made: place sound, or [dot]'s whisper. */
        fun record(
            context: Context,
            dot: String? = null,
        ) {
            if (_ui.value.recording || _ui.value.working) return
            val app = context.applicationContext
            val next = MomentSoundRecorder(MomentSoundDto.SHORT_MS)
            recorder = next
            _ui.value = StudioSoundUi(recording = true, dot = dot)
            viewModelScope.launch {
                val heard = withContext(Dispatchers.IO) { next.record { ms -> _ui.update { it.copy(elapsedMs = ms) } } }
                recorder = null
                if (heard == null) {
                    _ui.value = StudioSoundUi(dot = dot, error = "Your phone's microphone couldn't record. Try again.")
                    return@launch
                }
                _ui.value = StudioSoundUi(working = true, dot = dot)
                val kept = withContext(Dispatchers.IO) { write(app, heard, heard, cleaned = false) }
                val failed = "Your sound couldn't be saved on your phone. Try again.".takeIf { kept == null }
                _ui.value = StudioSoundUi(dot = dot, error = failed)
                if (kept == null) return@launch
                if (dot == null) MomentsStudioSounds.setPlace(app, kept) else MomentsStudioSounds.setWhisper(app, dot, kept)
            }
        }

        fun stop() {
            recorder?.stop()
        }

        /** "Clean the wind" on the kept sound, or, on a cleaned one, the sound back as it was heard. */
        fun toggleWind(context: Context) {
            val kept = MomentsStudioSounds.place.value ?: return
            if (_ui.value.working) return
            val app = context.applicationContext
            _ui.value = StudioSoundUi(working = true)
            viewModelScope.launch {
                val next =
                    withContext(Dispatchers.IO) {
                        if (kept.cleaned) {
                            write(app, kept.heard, kept.heard, cleaned = false)
                        } else {
                            write(app, MomentSoundCleaner.clean(kept.heard), kept.heard, cleaned = true)
                        }
                    }
                _ui.value = StudioSoundUi(error = "The wind couldn't be cleaned on your phone.".takeIf { next == null })
                if (next != null) MomentsStudioSounds.setPlace(app, next)
            }
        }

        fun remove(
            context: Context,
            dot: String? = null,
        ) {
            if (dot == null) MomentsStudioSounds.setPlace(context, null) else MomentsStudioSounds.setWhisper(context, dot, null)
            _ui.value = StudioSoundUi()
        }

        private fun write(
            context: Context,
            samples: MomentSoundSamples,
            heard: MomentSoundSamples,
            cleaned: Boolean,
        ): MomentsStudioRecording? {
            val file = File(context.cacheDir, "moment-sound-${UUID.randomUUID()}.m4a")
            if (!MomentSoundEncoder.write(samples, file)) return null
            return MomentsStudioRecording(file, samples.durationMs, cleaned, heard)
        }

        /** The compose screen is gone: a sound nobody posted goes with it. */
        override fun onCleared() {
            recorder?.stop()
            MomentsStudioSounds.clear()
        }
    }

/**
 * "Sound" on the Studio's rail, and its sheet. Drawn only while the switch is on for the person and they post as
 * themselves; the one line that places it is in the Studio's rail.
 */
@Composable
fun MomentsStudioSoundTool(
    enabled: Boolean,
    viewModel: MomentsStudioSoundViewModel = hiltViewModel(),
    penNames: PenNameChoiceViewModel = hiltViewModel(),
) {
    val on by viewModel.on.collectAsStateWithLifecycle()
    val postAs by penNames.postAs.collectAsStateWithLifecycle()
    val kept by MomentsStudioSounds.place.collectAsStateWithLifecycle()
    var open by rememberSaveable { mutableStateOf(false) }
    if (!on || postAs?.isMadeUp == true) return
    RailTool(
        label = if (kept != null) "Sound · ${seconds(kept?.durationMs ?: 0)}" else "Sound",
        spoken = if (kept != null) "Sound: place sound kept. Opens it" else "Sound: record three seconds of where you are",
        enabled = enabled,
        tag = "sound",
        onClick = { open = true },
    ) {
        PantopusIconImage(icon = PantopusIcon.Mic, contentDescription = null, size = 20.dp, strokeWidth = 2.2f, tint = Color.White)
    }
    if (open) StudioSoundSheet(viewModel, onDone = { open = false })
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StudioSoundSheet(
    viewModel: MomentsStudioSoundViewModel,
    onDone: () -> Unit,
) {
    val context = LocalContext.current
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val kept by MomentsStudioSounds.place.collectAsStateWithLifecycle()
    var denied by remember { mutableStateOf(false) }
    val ask =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            denied = !granted
            if (granted) viewModel.record(context)
        }
    val record = {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            denied = false
            viewModel.record(context)
        } else {
            ask.launch(Manifest.permission.RECORD_AUDIO)
        }
    }
    ModalBottomSheet(
        onDismissRequest = {
            viewModel.stop()
            onDone()
        },
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.studioBar,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(start = Spacing.s4, end = Spacing.s4, bottom = Spacing.s5)
                    .testTag("moments.studio.sound"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text("Sound", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Bold, modifier = Modifier.semantics { heading() })
            Text("Place sound", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            Text(
                "Three seconds of where you are, heard once when your Moment opens.",
                color = Color.White.copy(alpha = 0.75f),
                fontSize = 13.sp,
            )
            PlaceSoundControls(ui, kept, viewModel, record)
            val note =
                when {
                    denied -> "Pantopus needs the microphone to record sound. You can allow it in your phone's settings."
                    ui.error != null -> ui.error
                    else -> null
                }
            note?.let {
                Text(it, color = PantopusColors.warmAmberBorder, fontSize = 13.sp, modifier = Modifier.testTag("moments.studio.sound.note"))
            }
            DoneButton(
                Modifier.align(Alignment.End),
                onClick = {
                    viewModel.stop()
                    onDone()
                },
            )
        }
    }
}

/** Record, stop, hear it, take it off; then "Clean the wind" on what was kept. */
@Composable
private fun PlaceSoundControls(
    ui: StudioSoundUi,
    kept: MomentsStudioRecording?,
    viewModel: MomentsStudioSoundViewModel,
    record: () -> Unit,
) {
    val context = LocalContext.current
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        when {
            ui.recording && ui.dot == null ->
                SoundChip(
                    words = "Stop · ${seconds(ui.elapsedMs)} / ${seconds(MomentSoundDto.SHORT_MS)}",
                    icon = PantopusIcon.Square,
                    on = true,
                    tag = "moments.studio.sound.place",
                    onClick = viewModel::stop,
                )
            else ->
                SoundChip(
                    words = if (kept == null) "Record 3 seconds" else "Record again",
                    icon = PantopusIcon.Mic,
                    on = false,
                    enabled = !ui.working && !ui.recording,
                    tag = "moments.studio.sound.place",
                    onClick = record,
                )
        }
        kept?.takeIf { !ui.recording }?.let { sound ->
            PlayChip(sound.file, sound.durationMs, "Play your place sound")
            SoundChip(
                words = "",
                icon = PantopusIcon.X,
                on = false,
                enabled = !ui.working,
                tag = "moments.studio.sound.place.off",
                spoken = "Take the sound off",
                onClick = { viewModel.remove(context) },
            )
        }
    }
    kept?.takeIf { !ui.recording }?.let { sound ->
        SoundChip(
            words =
                when {
                    ui.working -> "Cleaning the wind…"
                    sound.cleaned -> "Wind cleaned · your sound says so"
                    else -> "Clean the wind"
                },
            icon = PantopusIcon.Wind,
            on = sound.cleaned,
            enabled = !ui.working,
            tag = "moments.studio.sound.wind",
            spoken =
                if (sound.cleaned) {
                    "Wind cleaned. Tap to put the sound back as it was."
                } else {
                    "Clean the wind from this sound, on your phone"
                },
            onClick = { viewModel.toggleWind(context) },
        )
    }
}

/** "Done": closes the sheet; what was recorded stays for the Moment. */
@Composable
private fun DoneButton(
    modifier: Modifier,
    onClick: () -> Unit,
) {
    Text(
        "Done",
        color = Color.White,
        fontSize = 15.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            modifier
                .clip(RoundedCornerShape(20.dp))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag("moments.studio.sound.done"),
    )
}

/** Plays the kept sound on the phone, once per tap. */
@Composable
private fun PlayChip(
    file: File,
    durationMs: Long,
    spoken: String,
) {
    var player by remember { mutableStateOf<MediaPlayer?>(null) }
    DisposableEffect(file) {
        onDispose {
            player?.release()
            player = null
        }
    }
    SoundChip(
        words = seconds(durationMs),
        icon = PantopusIcon.Play,
        on = false,
        tag = "moments.studio.sound.play",
        spoken = spoken,
        onClick = {
            player?.release()
            player =
                runCatching {
                    MediaPlayer().apply {
                        setDataSource(file.path)
                        prepare()
                        start()
                    }
                }.getOrNull()
        },
    )
}

@Composable
private fun SoundChip(
    words: String,
    icon: PantopusIcon,
    on: Boolean,
    tag: String,
    enabled: Boolean = true,
    spoken: String = words,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 40.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(if (on) PantopusColors.primary600 else Color.White.copy(alpha = 0.14f))
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(horizontal = if (words.isEmpty()) 10.dp else 14.dp)
                .testTag(tag)
                .clearAndSetSemantics {
                    contentDescription = spoken
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, strokeWidth = 2.2f, tint = Color.White)
        if (words.isNotEmpty()) Text(words, color = Color.White.copy(alpha = if (enabled) 1f else 0.5f), fontSize = 13.5.sp)
    }
}

/**
 * A whisper dot's three seconds, in Illuminate's editor (CONTRACT 7c, 7e): record, hear it, record again or take it off.
 * The dot goes out with the Moment only once it holds a whisper; the whisper goes up after the Moment is made. Never
 * under a made-up name (the editor isn't offered then).
 */
@Composable
fun MomentsStudioWhisperEditor(
    dot: String,
    viewModel: MomentsStudioSoundViewModel = hiltViewModel(),
) {
    val context = LocalContext.current
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val whispers by MomentsStudioSounds.whispers.collectAsStateWithLifecycle()
    val kept = whispers[dot]
    var denied by remember { mutableStateOf(false) }
    val ask =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            denied = !granted
            if (granted) viewModel.record(context, dot)
        }
    val mine = ui.dot == dot
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("moments.studio.dot.whisper")) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            if (ui.recording && mine) {
                SoundChip(
                    words = "Stop · ${seconds(ui.elapsedMs)} / ${seconds(MomentSoundDto.SHORT_MS)}",
                    icon = PantopusIcon.Square,
                    on = true,
                    tag = "moments.studio.dot.whisper.record",
                    onClick = viewModel::stop,
                )
            } else {
                SoundChip(
                    words = if (kept == null) "Whisper 3 seconds" else "Whisper again",
                    icon = PantopusIcon.Mic,
                    on = false,
                    enabled = !ui.working && !ui.recording,
                    tag = "moments.studio.dot.whisper.record",
                    onClick = {
                        if (micAllowed(context)) {
                            denied = false
                            viewModel.record(context, dot)
                        } else {
                            ask.launch(Manifest.permission.RECORD_AUDIO)
                        }
                    },
                )
            }
            kept?.takeIf { !(ui.recording && mine) }?.let { sound ->
                PlayChip(sound.file, sound.durationMs, "Play your whisper")
                SoundChip(
                    words = "",
                    icon = PantopusIcon.X,
                    on = false,
                    enabled = !ui.working,
                    tag = "moments.studio.dot.whisper.off",
                    spoken = "Take the whisper off",
                    onClick = { viewModel.remove(context, dot) },
                )
            }
        }
        val note =
            when {
                denied -> "Pantopus needs the microphone to record a whisper. You can allow it in your phone's settings."
                mine && ui.error != null -> ui.error
                kept == null -> "This dot goes out once it holds a whisper."
                else -> null
            }
        note?.let { Text(it, color = Color.White.copy(alpha = 0.75f), fontSize = 13.sp) }
    }
}

private fun micAllowed(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

/** "0:03". */
internal fun seconds(ms: Long): String {
    val s = ((ms + 500) / 1_000).coerceAtLeast(0)
    return "${s / 60}:${(s % 60).toString().padStart(2, '0')}"
}

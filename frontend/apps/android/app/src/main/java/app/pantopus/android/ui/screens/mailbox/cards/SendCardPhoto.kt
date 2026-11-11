@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.mailbox.cards

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.SystemClock
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import app.pantopus.android.data.api.models.mailbox.CardPhoto
import app.pantopus.android.data.api.models.mailbox.CardVoice
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.mailbox.cards.table.CardGreeting
import app.pantopus.android.ui.screens.mailbox.cards.table.CardGreetingVoice
import app.pantopus.android.ui.screens.mailbox.cards.table.CardPrint
import app.pantopus.android.ui.screens.mailbox.cards.table.CardPrintPhoto
import app.pantopus.android.ui.screens.mailbox.cards.table.GreetingRecorder
import app.pantopus.android.ui.screens.mailbox.cards.table.greetingLength
import app.pantopus.android.ui.screens.mailbox.cards.table.recordingClock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay
import java.io.File
import kotlin.math.roundToInt

/**
 * The card's own photo on Write on the back (memories plan step 4, wave 4 drawings 1 and 2): "Add a photo" under the
 * note; once chosen, the print with its own upload progress, Replace (or Try again after a failure) and Remove, and an
 * optional description for screen readers. The note stays first and required.
 */
@Composable
internal fun WritePhoto(
    photo: CardPhotoDraft?,
    fromFirst: String,
    onPick: () -> Unit,
    onRetry: () -> Unit,
    onRemove: () -> Unit,
    onAlt: (String) -> Unit,
) {
    if (photo == null) {
        CardButton(
            "Add a photo",
            onClick = onPick,
            kind = CardButtonKind.Paper,
            fill = false,
            modifier = Modifier.padding(top = Spacing.s2).testTag("sendCardAddPhoto"),
        )
        return
    }
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3).testTag("sendCardPhoto"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
        verticalAlignment = Alignment.Top,
    ) {
        val stored = photo.stored
        CardPrint(
            photo = stored?.let { CardPrintPhoto.own(CardPhoto(it.fileId, it.width, it.height, photo.alt)) },
            local = photo.local,
            localRatio = if (photo.width != null && photo.height != null) photo.width.toFloat() / photo.height else null,
            fromFirst = fromFirst,
            uploading = photo.uploading,
            tilt = -2f,
            modifier = Modifier.weight(0.42f).padding(top = Spacing.s1),
        )
        Column(modifier = Modifier.weight(0.58f), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            val status =
                when {
                    photo.failed != null -> photo.failed
                    photo.local == null && photo.stored == null -> "Getting the photo ready…"
                    photo.uploading -> "Uploading… ${(photo.progress * 100f).roundToInt()}%"
                    else -> "Added."
                }
            Text(
                status,
                fontSize = 13.sp,
                fontWeight = if (photo.failed != null) FontWeight.SemiBold else FontWeight.Normal,
                color = if (photo.failed != null) DeskInk.alert else DeskInk.quiet,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag("sendCardPhotoStatus"),
            )
            if (photo.failed != null && photo.local != null) {
                PhotoButton("Try again", "sendCardPhotoRetry", onRetry)
            } else if (photo.failed == null) {
                PhotoButton("Replace", "sendCardPhotoReplace", onPick)
            }
            PhotoButton("Remove", "sendCardPhotoRemove", onRemove)
        }
    }
    if (photo.ready) PhotoDescription(photo.alt, onAlt)
}

/** "Describe the photo (optional, for screen readers)": up to 200 letters, sent with the card as the print's words. */
@Composable
private fun PhotoDescription(
    value: String,
    onValueChange: (String) -> Unit,
) {
    var focused by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    val shape = RoundedCornerShape(Radii.lg)
    val label = "Describe the photo (optional, for screen readers)"
    Text(label, fontSize = 13.sp, color = DeskInk.quiet, modifier = Modifier.padding(top = Spacing.s3, bottom = Spacing.s1))
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        textStyle = TextStyle(fontSize = 16.sp, color = PantopusColors.cardTextStrong),
        cursorBrush = SolidColor(PantopusColors.cardWax),
        keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences, imeAction = ImeAction.Done),
        keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
        modifier =
            Modifier
                .keepsKeyboard()
                .fillMaxWidth()
                .onFocusChanged { focused = it.isFocused }
                .semantics { contentDescription = label }
                .testTag("sendCardPhotoAlt"),
        decorationBox = { inner ->
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .background(PantopusColors.cardField, shape)
                        .border(if (focused) 2.dp else 1.dp, if (focused) PantopusColors.cardWax else PantopusColors.cardFieldEdge, shape)
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                contentAlignment = Alignment.CenterStart,
            ) {
                if (value.isEmpty()) Text("For example: the lake at sunset", fontSize = 16.sp, color = PantopusColors.cardTextQuiet)
                inner()
            }
        },
    )
}

/** What Write on the back does with the card's own photo; null where no photo can be added. */
internal class CardPhotoCalls(
    val onAdd: (Uri) -> Unit,
    val onRetry: () -> Unit,
    val onRemove: () -> Unit,
    val onAlt: (String) -> Unit,
)

/** Why "Seal it" waits: the note first, then the photo and the greeting until uploaded (a failed one: again or removed). */
internal fun sealWaits(
    message: String,
    photo: CardPhotoDraft?,
    voice: CardVoiceDraft? = null,
): String? =
    when {
        message.isBlank() -> "Write a few words on the back first."
        photo?.failed != null -> "The photo didn’t upload. Try again, or remove it."
        voice?.failed != null -> "The greeting didn’t upload. Try again, or remove it."
        photo?.ready == false -> "Waiting for the photo to finish uploading."
        voice?.ready == false -> "Waiting for the greeting to finish uploading."
        else -> null
    }

/** The photo picker (the system's own: no permission) and [WritePhoto], under the note. */
@Composable
internal fun PhotoUnderTheNote(
    photo: CardPhotoDraft?,
    fromName: String,
    calls: CardPhotoCalls,
    beforePick: () -> Unit,
) {
    val picker =
        rememberLauncherForActivityResult(
            ActivityResultContracts.PickVisualMedia(),
        ) { uri -> uri?.let(calls.onAdd) }
    WritePhoto(
        photo = photo,
        fromFirst = fromName.trim().substringBefore(' '),
        onPick = {
            beforePick()
            picker.launch(
                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
            )
        },
        onRetry = calls.onRetry,
        onRemove = calls.onRemove,
        onAlt = calls.onAlt,
    )
}

@Composable
private fun PhotoButton(
    title: String,
    tag: String,
    onClick: () -> Unit,
) {
    CardButton(title, onClick = onClick, kind = CardButtonKind.Paper, fill = false, modifier = Modifier.testTag(tag))
}

/** What Write on the back does with the card's voice greeting; null where no greeting can be added. */
internal class CardVoiceCalls(
    val onRecorded: (File, Long) -> Unit,
    val onRetry: () -> Unit,
    val onRemove: () -> Unit,
)

/**
 * "Record a greeting" under the note (memories plan step 7, wave 4 drawings 1 and 2): the microphone is asked for only
 * on this tap; it records up to 60 seconds and stops when the app goes to the background (keeping what it has, never
 * resuming by itself). Then the cassette (a gift tag for Christmas with Jesus Christ) to listen to, with its upload,
 * Record again (or Try again) and Remove. Refused, the card can still go with its note.
 */
@Composable
internal fun VoiceUnderTheNote(
    voice: CardVoiceDraft?,
    forFirst: String,
    fromFirst: String,
    gift: Boolean,
    calls: CardVoiceCalls,
    beforeRecord: () -> Unit,
) {
    val context = LocalContext.current
    val recorder = remember { GreetingRecorder(context.applicationContext) }
    recorder.onDone = calls.onRecorded
    var refused by rememberSaveable { mutableStateOf<String?>(null) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    DisposableEffect(lifecycle, recorder) {
        val observer = LifecycleEventObserver { _, event -> if (event == Lifecycle.Event.ON_STOP) recorder.stop() }
        lifecycle.addObserver(observer)
        onDispose {
            lifecycle.removeObserver(observer)
            recorder.stop()
        }
    }
    val begin = {
        refused = null
        if (!recorder.start()) refused = "The microphone couldn’t be used just now. You can still send the card with your note."
    }
    val asker =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                begin()
            } else {
                refused =
                    "Pantopus can’t use the microphone. You can still send the card with your note, " +
                    "or allow the microphone in Settings."
            }
        }
    val record = {
        beforeRecord()
        val has = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        if (has) begin() else asker.launch(Manifest.permission.RECORD_AUDIO)
    }
    when {
        recorder.recording -> Recording(recorder)
        voice == null -> {
            PhotoButton("Record a greeting", "sendCardRecord", record)
            refused?.let {
                Text(
                    it,
                    fontSize = 13.sp,
                    color = DeskInk.alert,
                    modifier = Modifier.padding(top = Spacing.s1).semantics { liveRegion = LiveRegionMode.Polite },
                )
            }
        }
        else -> RecordedGreeting(voice, forFirst, fromFirst, gift, calls, record)
    }
}

@Composable
private fun Recording(recorder: GreetingRecorder) {
    val clock by produceState(0L, recorder.startedAt) {
        while (true) {
            value = SystemClock.elapsedRealtime() - recorder.startedAt
            delay(250)
        }
    }
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s2).testTag("sendCardRecording"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "● Recording ${recordingClock(clock)}",
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = DeskInk.alert,
            modifier = Modifier.weight(1f).semantics { liveRegion = LiveRegionMode.Polite },
        )
        PhotoButton("Stop", "sendCardRecordStop") { recorder.stop() }
    }
}

@Composable
private fun RecordedGreeting(
    voice: CardVoiceDraft,
    forFirst: String,
    fromFirst: String,
    gift: Boolean,
    calls: CardVoiceCalls,
    record: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3).testTag("sendCardVoice"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s4),
        verticalAlignment = Alignment.Top,
    ) {
        CardGreeting(
            voice = voice.stored?.let { CardGreetingVoice.own(CardVoice(it.fileId, it.durationMs)) },
            local = voice.local,
            durationMs = voice.lengthMs,
            forFirst = forFirst,
            fromFirst = fromFirst,
            gift = gift,
            tilt = 2f,
            modifier = Modifier.weight(0.42f),
        )
        Column(modifier = Modifier.weight(0.58f), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            val status =
                when {
                    voice.failed != null -> voice.failed
                    voice.uploading -> "Uploading… ${(voice.progress * 100f).roundToInt()}%"
                    else -> "Added. ${greetingLength(voice.lengthMs)}"
                }
            Text(
                status,
                fontSize = 13.sp,
                fontWeight = if (voice.failed != null) FontWeight.SemiBold else FontWeight.Normal,
                color = if (voice.failed != null) DeskInk.alert else DeskInk.quiet,
                modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite }.testTag("sendCardVoiceStatus"),
            )
            if (voice.failed != null && voice.local != null) {
                PhotoButton("Try again", "sendCardVoiceRetry", calls.onRetry)
            } else if (voice.failed == null) {
                PhotoButton("Record again", "sendCardRecordAgain", record)
            }
            PhotoButton("Remove", "sendCardVoiceRemove", calls.onRemove)
        }
    }
}

package app.pantopus.android.ui.screens.moments.studio

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.moments.MomentMediaFile
import app.pantopus.android.data.moments.MomentMotionClip
import app.pantopus.android.data.moments.MomentMotionPhoto
import app.pantopus.android.data.pulse.MomentMotionSender
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import javax.inject.Inject

/*
 * "Pulse, reinvented"'s Studio, a motion photo keeps its motion (PHASE-5 C, CONTRACT 10b). A photo picked with its clip
 * (Android's motion photo) offers "Keep the motion", on at first; kept, the clip goes up beside the Moment once its photo
 * is up, and readers see it move. Off, or anywhere else (today's Post screen, the switch off), it posts as the still it
 * is today. The mark is a small moving-photo sign, never the word "Live" ("Live" means taken here just now).
 */

/** The Studio's motion clip for the Moment being made, where the view model's Post finds it ([posted]). */
object StudioMotion {
    @Volatile internal var owner: StudioMotionViewModel? = null

    /** Moment [momentId] was made from the Studio: its kept clip goes up once the photo is up. */
    fun posted(momentId: String) {
        owner?.posted(momentId)
    }
}

/** The clip read from the photo on the Studio, and whether it is kept. */
@HiltViewModel
class StudioMotionViewModel
    @Inject
    constructor(
        @ApplicationContext private val context: Context,
        private val sender: MomentMotionSender,
    ) : ViewModel() {
        private val _clip = MutableStateFlow<MomentMotionClip?>(null)
        val clip: StateFlow<MomentMotionClip?> = _clip.asStateFlow()

        private val _keep = MutableStateFlow(true)
        val keep: StateFlow<Boolean> = _keep.asStateFlow()

        private var readFrom: File? = null

        /**
         * The photo [photo] took the Studio: its clip is read. A copy with marks drawn in, or a picture moved on the
         * canvas, has none of its own ([asTaken] false): the clip read from the photo as it came stays.
         */
        fun read(
            photo: File,
            asTaken: Boolean,
        ) {
            if (photo == readFrom) return
            readFrom = photo
            viewModelScope.launch {
                val read = withContext(Dispatchers.IO) { MomentMotionPhoto.clipOf(context, photo) }
                if (read != null) {
                    swap(read)
                    _keep.value = true
                } else if (asTaken) {
                    swap(null)
                }
            }
        }

        /** Not a photo any more (a video, a text card): no clip. */
        fun clear() {
            readFrom = null
            swap(null)
        }

        fun setKeep(on: Boolean) {
            _keep.value = on
        }

        internal fun posted(momentId: String) {
            val kept = _clip.value?.takeIf { _keep.value } ?: return
            _clip.value = null
            readFrom = null
            sender.send(momentId, kept)
        }

        private fun swap(next: MomentMotionClip?) {
            val was = _clip.value
            _clip.value = next
            if (was != null && was !== next) viewModelScope.launch(Dispatchers.IO) { was.delete() }
        }

        override fun onCleared() {
            if (StudioMotion.owner === this) StudioMotion.owner = null
            _clip.value?.delete()
            _clip.value = null
        }
    }

/**
 * Over the caption, when the photo on the Studio is a motion photo: "Keep the motion" with its moving-photo mark, on at
 * first. It also reads the clip from each photo that takes the Studio.
 */
@Composable
internal fun StudioMotionRow(
    state: MomentsComposeUiState,
    modifier: Modifier = Modifier,
    motion: StudioMotionViewModel = hiltViewModel(),
) {
    DisposableEffect(motion) {
        StudioMotion.owner = motion
        onDispose {
            if (StudioMotion.owner === motion) StudioMotion.owner = null
            // The Studio gave way (back to today's Post screen, or to the camera): its clip goes, and no motion request
            // ever leaves from today's screens. A posted one was handed over already.
            motion.clear()
        }
    }
    val photo = (state.media as? MomentMediaFile.Photo)?.file?.takeIf { state.studioPair == null }
    val asTaken = state.marks.isEmpty && state.placement == null
    LaunchedEffect(photo) { if (photo == null) motion.clear() else motion.read(photo, asTaken) }
    val clip by motion.clip.collectAsStateWithLifecycle()
    val keep by motion.keep.collectAsStateWithLifecycle()
    if (clip == null || photo == null) return
    val words = "Keep the motion"
    Row(
        modifier =
            modifier
                .height(34.dp)
                .clip(RoundedCornerShape(17.dp))
                .background(if (keep) Color.White else PantopusColors.momentCaptionPill)
                .then(if (keep) Modifier else Modifier.border(1.dp, PantopusColors.studioChipOutline, RoundedCornerShape(17.dp)))
                .clickable(enabled = !state.posting, role = Role.Switch) { motion.setKeep(!keep) }
                .padding(horizontal = Spacing.s3)
                .testTag("moments.studio.motion")
                .clearAndSetSemantics {
                    contentDescription = "$words. A moving photo."
                    role = Role.Switch
                    toggleableState = ToggleableState(keep)
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.CircleDot,
            contentDescription = null,
            size = 16.dp,
            tint = if (keep) PantopusColors.appText else Color.White,
        )
        Text(
            text = words,
            color = if (keep) PantopusColors.appText else Color.White,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

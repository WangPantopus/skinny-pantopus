package app.pantopus.android.ui.screens.moments.studio

import android.net.Uri
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.border
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.flow.StateFlow

/*
 * "Pulse, reinvented"'s Studio, PHASE-5 A5 (LEAD-8 10:18, as on iPhone): the pictures picked together, as a row of small
 * thumbnails just above the bar: the one on screen ringed, the waiting ones after it. A tap on a waiting one makes it the
 * next (nothing posts, the one on screen stays as it is); holding one leaves it out. They post one after another as today
 * ("Post 2 of 3"). Not on today's Post screen.
 */

/** The row of the ones picked together: shown while more than one waits its turn in the Studio. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
internal fun StudioPickedRow(
    state: MomentsComposeUiState,
    waitingPicked: StateFlow<List<Uri>>,
    onPickNext: (Uri) -> Unit,
    onLeaveOut: (Uri) -> Unit,
    modifier: Modifier = Modifier,
) {
    val waiting by waitingPicked.collectAsStateWithLifecycle()
    val current = state.media?.file ?: return
    if (state.pickedTogether < 2 || waiting.isEmpty() || state.posting) return
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
            text = "Post ${state.pickedAt} of ${state.pickedTogether} · tap one to post it next, hold to leave it out",
            color = Color.White,
            fontSize = 12.sp,
        )
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            contentPadding = PaddingValues(end = Spacing.s4),
            modifier = Modifier.testTag("moments.studio.picked"),
        ) {
            item {
                Thumb(model = current, ringed = true, modifier = Modifier.semantics { contentDescription = "On screen now" })
            }
            items(waiting, key = { it.toString() }) { uri ->
                val at = waiting.indexOf(uri) + 1
                Thumb(
                    model = uri,
                    ringed = false,
                    modifier =
                        Modifier
                            .combinedClickable(onClick = { onPickNext(uri) }, onLongClick = { onLeaveOut(uri) })
                            .semantics {
                                contentDescription = if (at == 1) "Posts next" else "Waiting, $at after this one. Tap to post it next"
                                customActions = listOf(CustomAccessibilityAction("Leave this one out") { onLeaveOut(uri).let { true } })
                            }.testTag("moments.studio.picked.$at"),
                )
            }
        }
    }
}

/** One picture's thumbnail: 40 dp drawn in a 44 dp target; the one on screen ringed in white. */
@Composable
private fun Thumb(
    model: Any,
    ringed: Boolean,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(8.dp)
    Box(modifier = modifier.size(44.dp), contentAlignment = Alignment.Center) {
        AsyncImage(
            model = model,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(shape)
                    .border(if (ringed) 2.dp else 1.dp, if (ringed) Color.White else PantopusColors.studioChipOutline, shape),
        )
    }
}

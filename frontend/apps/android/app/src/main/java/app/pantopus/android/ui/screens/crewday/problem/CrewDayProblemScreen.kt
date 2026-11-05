@file:Suppress("LongMethod")

package app.pantopus.android.ui.screens.crewday.problem

import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.crewday.components.CrewDayFlowScaffold
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanOverline
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.detail.PlanFooterCaption
import app.pantopus.android.ui.screens.plans.detail.PlanRoundButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** The five kinds of problem (01-spec screen 7), with the server's keys. */
private val KINDS =
    listOf(
        "missed" to "The crew missed something",
        "damage" to "Something was damaged",
        "no_show" to "The crew didn't come",
        "charge" to "A problem with the charge",
        "other" to "Something else",
    )

/**
 * Something needs attention (screen 7, board `Problem`): full screen with Close; what went wrong, what happened, up to
 * four photos, and Send to Pantopus support. With a case already open it adds a note or photos to it.
 */
@Composable
fun CrewDayProblemScreen(
    onClose: () -> Unit,
    viewModel: CrewDayProblemViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(state.sent) { if (state.sent) onClose() }
    val picker =
        rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(CrewDayProblemState.MAX_PHOTOS)) { uris ->
            scope.launch {
                uris.take(CrewDayProblemState.MAX_PHOTOS - state.photos.size).forEach { uri ->
                    val bytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }
                    bytes?.let(viewModel::addPhoto)
                }
            }
        }
    val price = state.booking?.priceCents?.let { app.pantopus.android.data.crewday.CrewDayFormat.price(it) }
    val crew = state.booking?.crewDay?.crew?.name ?: "The crew"
    CrewDayFlowScaffold(
        title = if (state.adding) "Add a note or photo" else "Something needs attention",
        onBack = onClose,
        closeIcon = true,
        modifier = Modifier.testTag("crewDayProblem"),
        footer = {
            state.error?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.error,
                    modifier = Modifier.testTag("crewDayProblemError"),
                )
            }
            PrimaryButton(
                title = "Send to Pantopus support",
                onClick = viewModel::send,
                isEnabled = state.canSend,
                isLoading = state.sending,
                modifier = Modifier.fillMaxWidth().testTag("crewDayProblemSend"),
            )
            PlanFooterCaption("We reply within one business day. $crew sees your note so they can make it right.")
        },
    ) {
        Text(
            text =
                if (state.adding) {
                    // "Example Gutter Co." already ends the sentence.
                    "Pantopus support has your case. Anything you add goes to them and to ${crew.removeSuffix(".")}."
                } else {
                    "Tell us what's wrong. Pantopus support owns it until it's fixed, and your ${price ?: ""} charge waits."
                },
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextStrong,
        )
        if (!state.adding) {
            PlanOverline("What's wrong?", modifier = Modifier.semantics { heading() })
            PlanFormCard(modifier = Modifier.testTag("crewDayProblemKinds")) {
                KINDS.forEachIndexed { index, (key, label) ->
                    val selected = state.kind == key
                    PlanOptionRow(
                        first = index == 0,
                        onClick = { viewModel.setKind(key) },
                        modifier = Modifier.semantics { this.selected = selected }.testTag("crewDayProblemKind_$key"),
                    ) {
                        RadioButton(selected = selected, onClick = null)
                        Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appText, modifier = Modifier.weight(1f))
                    }
                }
            }
        }
        PlanField("What happened?", modifier = Modifier.testTag("crewDayProblemNote")) {
            PlanTextArea(
                value = state.note,
                onValue = viewModel::setNote,
                placeholder = "The back gutters still have leaves in them.",
                label = "What happened",
                minHeight = 110.dp,
            )
            Text(
                text = "${state.note.length} of ${CrewDayProblemState.MAX_NOTE}",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        PlanField("Photos (optional)") {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), verticalAlignment = Alignment.CenterVertically) {
                state.photos.forEach { photo ->
                    val bitmap = remember(photo.id) { BitmapFactory.decodeByteArray(photo.bytes, 0, photo.bytes.size)?.asImageBitmap() }
                    Box {
                        bitmap?.let {
                            Image(
                                bitmap = it,
                                contentDescription = "Photo you added",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.size(72.dp).clip(RoundedCornerShape(12.dp)).background(PantopusColors.appSurfaceSunken),
                            )
                        }
                        PlanRoundButton(
                            icon = PantopusIcon.X,
                            label = "Remove photo",
                            onClick = { viewModel.removePhoto(photo.id) },
                            glass = true,
                            modifier = Modifier.align(Alignment.TopEnd).padding(2.dp),
                        )
                    }
                }
            }
            if (state.photos.size < CrewDayProblemState.MAX_PHOTOS) {
                PlanTonalButton(
                    title = "Add photos",
                    icon = PantopusIcon.Camera,
                    onClick = { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                    height = 44.dp,
                    modifier = Modifier.testTag("crewDayProblemAddPhoto"),
                )
            }
            Text(
                text = "Up to 4. Only Pantopus support and the crew see them.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

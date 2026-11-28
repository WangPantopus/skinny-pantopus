package app.pantopus.android.ui.screens.feed.reinvented.after

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
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.posts.PostCreateRequest
import app.pantopus.android.data.api.models.reinvented.PulseTravelDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.plans.PlanLocationResolver
import app.pantopus.android.data.pulse.StudioPostRepository
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/*
 * Passing on ("Pulse, reinvented" phase 3, PHASE-3 piece 6; CONTRACT 8f; iPhone's `PulseTravel.swift`, the web's
 * `passon/`): a post travels when someone passes it on from where they are, and it says who carried it. A pass is
 * today's quote post (`quotedPostId`) by the passer, from their own place now, with `studio: { passed_on: true }`. Only
 * in the new Pulse's list, so only while the switch is on.
 */

/** Under a post's status line: "Carried here by Dana", "Passed on by Dana and Ade", or an Eyes-on Ask's window. */
@Composable
fun PulseTravelLine(
    travel: PulseTravelDto?,
    modifier: Modifier = Modifier,
) {
    val line = travel?.line() ?: return
    Text(
        line,
        fontSize = 12.5.sp,
        color = PantopusColors.appTextSecondary,
        modifier = modifier.testTag("reinventedPulse.travel"),
    )
}

/** One pass being made, or made. */
data class PulsePassUi(
    val postId: String? = null,
    val sending: Boolean = false,
    val passed: Set<String> = emptySet(),
    val problem: String? = null,
)

@HiltViewModel
class PulsePassViewModel
    @Inject
    constructor(
        private val repository: StudioPostRepository,
        private val locations: PlanLocationResolver,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(PulsePassUi())
        val ui: StateFlow<PulsePassUi> = _ui.asStateFlow()

        /** The same pass tapped again (a failed answer) names the same request, so it is never made twice. */
        private var requestId: Pair<String, String>? = null

        fun begin(postId: String) {
            _ui.value = _ui.value.copy(postId = postId, problem = null)
        }

        /** Pass it on: a fresh fix, then today's quote post from that place (`POST /api/posts`). */
        fun pass(
            postId: String,
            words: String,
            kind: String?,
            onDone: () -> Unit,
        ) {
            if (_ui.value.sending) return
            _ui.value = _ui.value.copy(sending = true, problem = null)
            viewModelScope.launch {
                val fix = locations.newFix()
                if (fix == null) {
                    _ui.value = _ui.value.copy(sending = false, problem = "Allow your location to pass it on from where you are.")
                    return@launch
                }
                val id = requestId?.takeIf { it.first == postId }?.second ?: UUID.randomUUID().toString()
                requestId = postId to id
                // The original's kind (a local win is a made-up name's, never the passer's); else a Learning.
                val type =
                    StudioPostKind.entries.firstOrNull { it.wire == kind && it != StudioPostKind.LOCAL_WIN } ?: StudioPostKind.LEARNING
                val request =
                    PostCreateRequest(
                        clientRequestId = id,
                        content = words.trim(),
                        postType = type.wire,
                        visibility = "neighborhood",
                        postAs = "personal",
                        latitude = fix.latitude,
                        longitude = fix.longitude,
                        gpsTimestamp = fix.at.toString(),
                        gpsLatitude = fix.latitude,
                        gpsLongitude = fix.longitude,
                        showOnProfile = true,
                        profileVisibilityScope = "local_context",
                        audience = "nearby",
                        purpose = type.purpose,
                        quotedPostId = postId,
                    )
                when (val made = repository.create(request, mapOf("passed_on" to true))) {
                    is NetworkResult.Success -> {
                        requestId = null
                        _ui.value = _ui.value.copy(sending = false, passed = _ui.value.passed + postId)
                        onDone()
                    }
                    is NetworkResult.Failure ->
                        _ui.value = _ui.value.copy(sending = false, problem = made.error.displayMessage("Couldn't pass it on. Try again."))
                }
            }
        }
    }

/** "Pass it on" under someone else's post that isn't a pass and isn't under a made-up name; "Passed on" once done. */
@Composable
fun PulsePassItOn(
    postId: String,
    travel: PulseTravelDto?,
    viewer: String?,
    viewModel: PulsePassViewModel = hiltViewModel(),
) {
    if (travel?.mayPass(viewer) != true) return
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    var writing by rememberSaveable(postId) { mutableStateOf(false) }
    if (postId in ui.passed) {
        Text(
            "Passed on, from where you are.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = Spacing.s4).padding(bottom = Spacing.s2).testTag("reinventedPulse.passed.$postId"),
        )
        return
    }
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .padding(bottom = Spacing.s2)
                .heightIn(min = 36.dp)
                .clickable(role = Role.Button) {
                    viewModel.begin(postId)
                    writing = true
                }.testTag("reinventedPulse.passOn.$postId"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.Send, contentDescription = null, size = 15.dp, tint = PantopusColors.primary600)
        Text("Pass it on", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
    }
    if (writing) {
        PassOnSheet(postId, travel.postType, ui, viewModel) { writing = false }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PassOnSheet(
    postId: String,
    kind: String?,
    ui: PulsePassUi,
    viewModel: PulsePassViewModel,
    onDismiss: () -> Unit,
) {
    var words by remember(postId) { mutableStateOf("") }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.testTag("reinventedPulse.passOn.sheet"),
    ) {
        Column(
            modifier =
                Modifier
                    .keepsSheetStill()
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s5)
                    .padding(bottom = Spacing.s5)
                    .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text("Pass it on from where you are", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            Text(
                "It goes to people around you now, with your words, and says you carried it.",
                fontSize = 14.sp,
                color = PantopusColors.appTextSecondary,
            )
            OutlinedTextField(
                value = words,
                onValueChange = { words = it.take(StudioPostDraft.WORDS_LIMIT) },
                placeholder = { Text("Your words") },
                modifier = Modifier.fillMaxWidth().heightIn(min = 96.dp).testTag("reinventedPulse.passOn.words"),
            )
            val problem = if (ui.sending) "Finding where you are…" else ui.problem
            problem?.let {
                Text(
                    it,
                    fontSize = 13.sp,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.testTag("reinventedPulse.passOn.note"),
                )
            }
            val ready = words.isNotBlank() && !ui.sending
            Text(
                "Pass it on",
                color = Color.White,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(percent = 50))
                        .background(if (ready) PantopusColors.primary600 else PantopusColors.appTextSecondary)
                        .clickable(enabled = ready, role = Role.Button) { viewModel.pass(postId, words, kind, onDismiss) }
                        .padding(horizontal = Spacing.s5, vertical = 12.dp)
                        .testTag("reinventedPulse.passOn.send"),
            )
        }
    }
}

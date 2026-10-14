@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.plans.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.chats.ChatRepository
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanState
import app.pantopus.android.data.plans.PlansFeature
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.plans.planKind
import app.pantopus.android.data.plans.planState
import app.pantopus.android.ui.screens.plans.colors
import app.pantopus.android.ui.screens.plans.components.PlanDivider
import app.pantopus.android.ui.screens.plans.components.PlanSwatch
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** A plan room's context: the plan, and whether the room has closed. */
data class PlanChatState(
    val plan: PlanDto? = null,
    val closed: Boolean = false,
)

/**
 * The plan's chat (board A4) on top of the existing chat: reads the room (`type: "plan"`, `plan_id`, `is_active`)
 * and the plan, for the strip under the header and the closed state. Does nothing for other rooms or while the
 * `plans` flag is off.
 */
@HiltViewModel
class PlanChatViewModel
    @Inject
    constructor(
        private val chats: ChatRepository,
        private val plans: PlansRepository,
        private val feature: PlansFeature,
    ) : ViewModel() {
        private val _state = MutableStateFlow(PlanChatState())
        val state: StateFlow<PlanChatState> = _state.asStateFlow()
        private var roomId: String? = null

        fun bind(room: String) {
            if (roomId == room || !feature.isOn) return
            roomId = room
            viewModelScope.launch {
                val detail = (chats.room(room) as? NetworkResult.Success)?.data?.room ?: return@launch
                if (detail.type != "plan") return@launch
                val closedRoom = detail.isActive == false
                _state.value = PlanChatState(closed = closedRoom)
                val planId = detail.planId ?: return@launch
                val plan = (plans.plan(planId) as? NetworkResult.Success)?.data ?: return@launch
                _state.value =
                    PlanChatState(
                        plan = plan,
                        closed = closedRoom || plan.chatOpen == false || plan.planState == PlanState.CANCELLED,
                    )
            }
        }
    }

/** The plan context for a room (empty for a person thread, another room, or while Plans is off). */
@Composable
fun rememberPlanChat(roomId: String?): PlanChatState {
    if (roomId == null) return PlanChatState()
    val viewModel: PlanChatViewModel = hiltViewModel(key = "planChat:$roomId")
    LaunchedEffect(roomId) { viewModel.bind(roomId) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    return state
}

/** The plan strip under a plan room's header (A4): its color, "Sun 1:25 PM · Sam's place" ("Today 5:30 PM"), and a way to it. */
@Composable
fun PlanChatStrip(
    state: PlanChatState,
    onOpenPlan: (String) -> Unit,
) {
    val plan = state.plan ?: return
    val kind = plan.planKind ?: return
    val start = PlanFormat.rowWhen(plan)
    val where = plan.place?.name ?: plan.area?.label
    Row(
        modifier =
            Modifier
                .padding(start = Spacing.s4, end = Spacing.s4, top = 10.dp)
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(kind.colors.tint)
                .clickable(role = Role.Button) { onOpenPlan(plan.id) }
                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                .clearAndSetSemantics {
                    contentDescription = listOfNotNull(plan.title, start, where).joinToString(", ") + ". Open the plan"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        PlanSwatch(kind)
        Text(
            text =
                buildAnnotatedString {
                    withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append(start ?: plan.title) }
                    where?.let {
                        append(" · ")
                        append(it)
                    }
                },
            style = PantopusTextStyle.small,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
            maxLines = 1,
        )
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

/** Instead of the composer once a plan's chat has closed (cancelled, or 24 hours after the end). */
@Composable
fun PlanChatClosedBar() {
    Box(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface).navigationBarsPadding()) {
        PlanDivider()
        Text(
            text = "This chat has closed. It stays here to read.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.padding(horizontal = Spacing.s4, vertical = 14.dp).align(Alignment.Center),
        )
    }
}

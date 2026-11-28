@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.State
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.reinvented.MomentReplyDto
import app.pantopus.android.data.api.models.reinvented.shownConvergence
import app.pantopus.android.data.api.models.reinvented.shownRetake
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.pulse.TogetherRepository
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.components.sheetKeyboardRules
import app.pantopus.android.ui.screens.feed.pulseReportReasons
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * "Pulse, reinvented" phase 3, replies people can see on a Moment (PHASE-3 piece 4, founder's decision 3; CONTRACT 8a;
 * iPhone's `MomentReplies.swift`). On a Friends Moment they show under it; on a Nearby Moment only if its author chose
 * so; never on a made-up-name Moment. Today's private "Reply to …" box stays exactly as it is. The viewer holds still
 * while the replies are open.
 */
internal object MomentRepliesState {
    /** The replies sheet is up. */
    val sheet = mutableStateOf(false)

    /** The viewer holds still: the sheet is up, a pin is being dropped or one is open (8b), or a Retake (8e) or sky piece (8h) is open. */
    val open: State<Boolean> =
        derivedStateOf {
            val together = MomentRetakeState.inViewer.value != null || MomentConvergenceState.inViewer.value != null
            sheet.value || MomentPinsState.holds || together
        }
}

data class MomentRepliesUi(
    val momentId: String? = null,
    val replies: List<MomentReplyDto> = emptyList(),
    val cursor: String? = null,
    val loading: Boolean = false,
    val sending: Boolean = false,
    /** The author's choice as last answered (null until changed here). */
    val shown: Boolean? = null,
    val note: String? = null,
)

@HiltViewModel
class MomentRepliesViewModel
    @Inject
    constructor(
        private val repository: TogetherRepository,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(MomentRepliesUi())
        val ui: StateFlow<MomentRepliesUi> = _ui.asStateFlow()

        fun open(momentId: String) {
            if (_ui.value.momentId != momentId) _ui.value = MomentRepliesUi(momentId = momentId)
            read(cursor = null)
        }

        fun more() = _ui.value.cursor?.let { read(it) }

        private fun read(cursor: String?) {
            val id = _ui.value.momentId ?: return
            _ui.update { it.copy(loading = true) }
            viewModelScope.launch {
                when (val answer = repository.replies(id, cursor)) {
                    is NetworkResult.Success ->
                        _ui.update {
                            val list = if (cursor == null) answer.data.replies else it.replies + answer.data.replies
                            it.copy(replies = list.distinctBy { r -> r.id }, cursor = answer.data.nextCursor, loading = false)
                        }
                    is NetworkResult.Failure -> _ui.update { it.copy(loading = false, note = answer.error.displayMessage(READ_FAILED)) }
                }
            }
        }

        fun send(text: String) {
            val id = _ui.value.momentId ?: return
            val words = text.trim()
            if (words.isEmpty() || _ui.value.sending) return
            _ui.update { it.copy(sending = true, note = null) }
            viewModelScope.launch {
                when (val answer = repository.reply(id, words.take(REPLY_MAX))) {
                    is NetworkResult.Success -> _ui.update { it.copy(replies = it.replies + answer.data, sending = false) }
                    is NetworkResult.Failure -> _ui.update { it.copy(sending = false, note = answer.error.displayMessage(SEND_FAILED)) }
                }
            }
        }

        fun remove(reply: MomentReplyDto) {
            val id = _ui.value.momentId ?: return
            viewModelScope.launch {
                when (val answer = repository.remove(id, reply.id)) {
                    is NetworkResult.Success -> _ui.update { it.copy(replies = it.replies.filterNot { r -> r.id == reply.id }) }
                    is NetworkResult.Failure -> _ui.update { it.copy(note = answer.error.displayMessage("Couldn't remove it. Try again.")) }
                }
            }
        }

        fun report(
            reply: MomentReplyDto,
            reason: String,
        ) {
            val id = _ui.value.momentId ?: return
            viewModelScope.launch {
                val answer = repository.report(id, reply.id, reason)
                _ui.update {
                    it.copy(note = if (answer is NetworkResult.Failure) answer.error.displayMessage(REPORT_FAILED) else "Reported. Thanks.")
                }
            }
        }

        fun setShown(shown: Boolean) {
            val id = _ui.value.momentId ?: return
            _ui.update { it.copy(shown = shown, note = null) }
            viewModelScope.launch {
                val answer = repository.setShown(id, shown)
                if (answer is NetworkResult.Failure) {
                    _ui.update { it.copy(shown = !shown, note = answer.error.displayMessage("Couldn't change that. Try again.")) }
                } else {
                    // Hidden, the server lists none; shown again, the stored replies come back.
                    _ui.update { it.copy(replies = emptyList(), cursor = null) }
                    if (shown) read(cursor = null)
                }
            }
        }

        private companion object {
            const val REPLY_MAX = 500
            const val READ_FAILED = "Couldn't load the replies."
            const val SEND_FAILED = "Couldn't send it. Try again."
            const val REPORT_FAILED = "Couldn't report it. Try again."
        }
    }

/**
 * Under the viewer's header while the switch is on (the caller's `studio`): "3 replies" on a Moment whose replies show,
 * and, on one's own Moment, the way to show or hide them; pins beside it; and a Retake's chip (8e). Nothing where the
 * server sends neither `replies` nor `retake`. [onClose] closes the viewer (a Retake's "Add your frame" opens the Studio).
 */
@Composable
fun MomentRepliesChip(
    moment: MomentDto,
    mine: Boolean,
    modifier: Modifier = Modifier,
    onClose: () -> Unit = {},
    viewModel: MomentRepliesViewModel = hiltViewModel(),
) {
    val state = moment.replies
    if (state == null) {
        OtherChips(moment, onClose, modifier)
        return
    }
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    val shown = ui.shown.takeIf { ui.momentId == moment.id } ?: state.shown
    if (!shown && !mine) {
        OtherChips(moment, onClose, modifier)
        return
    }
    var open by MomentRepliesState.sheet
    DisposableEffect(moment.id) { onDispose { MomentRepliesState.sheet.value = false } }
    val count = if (ui.momentId == moment.id && ui.replies.isNotEmpty()) ui.replies.size else state.count
    val words =
        when {
            !shown -> "Replies hidden"
            count == 0 -> if (state.canReply) "Reply for everyone" else "No replies"
            count == 1 -> "1 reply"
            else -> "$count replies"
        }
    // The row scrolls sideways when the replies, pins and Retake chips don't fit.
    Row(modifier = modifier.horizontalScroll(rememberScrollState()), verticalAlignment = Alignment.CenterVertically) {
        RepliesPill(words) {
            viewModel.open(moment.id)
            open = true
        }
        // Pins on the photo (8b), beside it, then the Retake it belongs to (8e).
        MomentPinsControls(moment, shown)
        MomentRetakeChip(moment, onClose, Modifier.padding(start = Spacing.s2))
        MomentConvergenceChip(moment, Modifier.padding(start = Spacing.s2))
    }
    if (open) {
        RepliesSheet(moment, mine, shown, canReply = state.canReply && shown, ui = ui, viewModel = viewModel) { open = false }
    }
}

/** The Retake's (8e) and the sky piece's (8h) chips on a Moment whose replies don't show. */
@Composable
private fun OtherChips(
    moment: MomentDto,
    onClose: () -> Unit,
    modifier: Modifier,
) {
    if (moment.shownRetake == null && moment.shownConvergence == null) return
    Row(modifier = modifier.horizontalScroll(rememberScrollState()), verticalAlignment = Alignment.CenterVertically) {
        MomentRetakeChip(moment, onClose)
        MomentConvergenceChip(moment, Modifier.padding(start = Spacing.s2))
    }
}

@Composable
private fun RepliesPill(
    words: String,
    onClick: () -> Unit,
) {
    Text(
        text = words,
        color = Color.White,
        fontSize = 14.sp,
        fontWeight = FontWeight.SemiBold,
        modifier =
            Modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(PantopusColors.momentCaptionPill)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 7.dp)
                .testTag("moments.viewer.replies"),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Suppress("LongParameterList") // The sheet's own inputs, each read once.
@Composable
private fun RepliesSheet(
    moment: MomentDto,
    mine: Boolean,
    shown: Boolean,
    canReply: Boolean,
    ui: MomentRepliesUi,
    viewModel: MomentRepliesViewModel,
    onDismiss: () -> Unit,
) {
    var draft by remember { mutableStateOf("") }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appSurface,
        modifier = Modifier.sheetKeyboardRules().testTag("moments.viewer.replies.sheet"),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s5).padding(bottom = Spacing.s4).navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text("Replies", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
            if (mine && moment.author.madeUpName.not()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Show replies under it", fontSize = 15.sp, color = PantopusColors.appText)
                        Text(
                            "Hidden, they stay stored and come back if you show them.",
                            fontSize = 12.5.sp,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                    Switch(
                        checked = shown,
                        onCheckedChange = viewModel::setShown,
                        modifier = Modifier.testTag("moments.viewer.replies.shown"),
                    )
                }
            }
            ui.note?.let { Text(it, fontSize = 13.sp, color = PantopusColors.appTextSecondary) }
            LaunchedEffect(Unit) { if (ui.replies.isEmpty() && !ui.loading) viewModel.open(moment.id) }
            if (ui.replies.isEmpty() && !ui.loading) {
                // The author's own Moment with its replies hidden: they are stored, not gone.
                val empty = if (shown) "No replies yet." else "Replies are hidden. Show them to see them here."
                Text(empty, fontSize = 14.sp, color = PantopusColors.appTextSecondary)
            }
            LazyColumn(
                modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                items(ui.replies, key = { it.id }) { reply -> ReplyRow(reply, viewModel) }
                if (ui.cursor != null) {
                    item { TextButton(onClick = viewModel::more) { Text("Show more") } }
                }
            }
            if (canReply) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    BasicTextField(
                        value = draft,
                        onValueChange = { draft = it.take(500) },
                        textStyle = TextStyle(color = PantopusColors.appText, fontSize = 15.sp),
                        cursorBrush = SolidColor(PantopusColors.appText),
                        modifier =
                            Modifier
                                .keepsKeyboard()
                                .weight(1f)
                                .clip(RoundedCornerShape(12.dp))
                                .background(PantopusColors.appBg)
                                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                                .testTag("moments.viewer.replies.input"),
                    )
                    TextButton(
                        onClick = {
                            viewModel.send(draft)
                            draft = ""
                        },
                        enabled = draft.isNotBlank() && !ui.sending,
                        modifier = Modifier.keepsKeyboard().testTag("moments.viewer.replies.send"),
                    ) { Text("Send") }
                }
            }
        }
    }
}

@Composable
private fun ReplyRow(
    reply: MomentReplyDto,
    viewModel: MomentRepliesViewModel,
) {
    var menu by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth().testTag("moments.viewer.replies.row.${reply.id}"),
        verticalAlignment = Alignment.Top,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = reply.author?.firstName ?: reply.author?.name ?: "Someone",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(reply.text, fontSize = 15.sp, color = PantopusColors.appText)
        }
        TextButton(onClick = { menu = true }, modifier = Modifier.testTag("moments.viewer.replies.more.${reply.id}")) { Text("•••") }
        DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
            if (reply.canRemove) {
                DropdownMenuItem(text = { Text("Remove") }, onClick = {
                    menu = false
                    viewModel.remove(reply)
                })
            }
            if (!reply.mine) {
                pulseReportReasons.forEach { (key, label) ->
                    DropdownMenuItem(text = { Text("Report: $label") }, onClick = {
                        menu = false
                        viewModel.report(reply, key)
                    })
                }
            }
        }
    }
}

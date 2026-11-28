package app.pantopus.android.ui.screens.feed.reinvented.after

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.moments.MomentDto
import app.pantopus.android.data.api.models.reinvented.PinboardDto
import app.pantopus.android.data.api.models.reinvented.PinboardPieceDto
import app.pantopus.android.data.api.models.reinvented.shownPinboard
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.pulse.TogetherRepository
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/*
 * Pinboards ("Pulse, reinvented" phase 3, PHASE-3 piece 3; CONTRACT 8i; iPhone's `MomentPinboard.swift`, the web's
 * `pinboard/Pinboard.tsx`): add your piece to a shared prompt, such as "Best fall tree on your walk". A pinboard is its
 * first photo and the pieces people add for a week, one each; it stays. In Pulse it is one row ("Pinboard · 4 pieces")
 * that opens the board; in the viewer a chip opens it too. "Add your piece" opens the Studio with the prompt in its
 * drawer. Only while the switch is on (a Moment carries `pinboard` only then).
 */

/** The pinboard open, from Pulse ([fromList]) or over the viewer ([inViewer]), one at a time: the start's id. */
internal object MomentPinboardState {
    val fromList = mutableStateOf<String?>(null)
    val inViewer = mutableStateOf<String?>(null)

    /** A Moment of a pinboard opens the board; anything else opens as before (false). */
    fun opens(moment: MomentDto): Boolean {
        val board = moment.shownPinboard ?: return false
        fromList.value = board.startId
        return true
    }

    /** "Add your piece": the board closes, then the Studio opens over Pulse with the prompt in its drawer. */
    fun addPiece(board: PinboardDto) {
        fromList.value = null
        inViewer.value = null
        TogetherStudio.openFor(TogetherStudio.Context.PinboardPiece(board.startId, board.prompt))
    }
}

data class MomentPinboardUi(
    val id: String? = null,
    val board: PinboardDto? = null,
    val failed: Boolean = false,
)

@HiltViewModel
class MomentPinboardViewModel
    @Inject
    constructor(
        private val repository: TogetherRepository,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(MomentPinboardUi())
        val ui: StateFlow<MomentPinboardUi> = _ui.asStateFlow()

        fun read(id: String) {
            _ui.value = MomentPinboardUi(id = id)
            viewModelScope.launch {
                val answer = repository.pinboard(id)
                if (_ui.value.id != id) return@launch
                _ui.value =
                    when (answer) {
                        is NetworkResult.Success -> MomentPinboardUi(id = id, board = answer.data)
                        is NetworkResult.Failure -> MomentPinboardUi(id = id, failed = true)
                    }
            }
        }
    }

/** Pulse's list opens a pinboard here (`ReinventedPulseScreen`). */
@Composable
fun MomentPinboardListSheet() {
    val id = MomentPinboardState.fromList.value ?: return
    MomentPinboardSheet(id, onAdd = MomentPinboardState::addPiece) { MomentPinboardState.fromList.value = null }
}

/**
 * In the viewer's chip row: "Pinboard · 4 pieces", opening the board over the viewer (which holds still meanwhile).
 * [onClose] closes the viewer before "Add your piece" opens the Studio.
 */
@Composable
internal fun MomentPinboardChip(
    moment: MomentDto,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val board = moment.shownPinboard ?: return
    DisposableEffect(moment.id) { onDispose { MomentPinboardState.inViewer.value = null } }
    val spoken = "${board.tag}. Opens the pinboard"
    Row(
        modifier =
            modifier
                .clip(RoundedCornerShape(percent = 50))
                .background(Color.Black.copy(alpha = 0.45f))
                .border(1.dp, Color.White.copy(alpha = 0.35f), RoundedCornerShape(percent = 50))
                .clickable(role = Role.Button) { MomentPinboardState.inViewer.value = board.startId }
                .padding(horizontal = 12.dp, vertical = 6.dp)
                .testTag("moments.viewer.pinboard")
                .semantics(mergeDescendants = true) { contentDescription = spoken },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PantopusIconImage(icon = PantopusIcon.LayoutGrid, contentDescription = null, size = 15.dp, tint = Color.White)
        Text(board.tag, color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold)
    }
    val open = MomentPinboardState.inViewer.value ?: return
    MomentPinboardSheet(
        open,
        onAdd = { found ->
            onClose()
            MomentPinboardState.addPiece(found)
        },
    ) { MomentPinboardState.inViewer.value = null }
}

/** The board: its prompt, who started it, its pieces newest first, and "Add your piece" while the reader may. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MomentPinboardSheet(
    id: String,
    onAdd: (PinboardDto) -> Unit,
    viewModel: MomentPinboardViewModel = hiltViewModel(),
    onDismiss: () -> Unit,
) {
    val ui by viewModel.ui.collectAsStateWithLifecycle()
    LaunchedEffect(id) { viewModel.read(id) }
    val board = ui.board.takeIf { ui.id == id }
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = PantopusColors.appBg,
        modifier = Modifier.testTag("together.pinboard"),
    ) {
        Column(
            modifier =
                Modifier
                    .keepsSheetStill()
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4)
                    .padding(bottom = Spacing.s5)
                    .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            BoardHeader(board)
            when {
                board == null -> BoardNote(if (ui.failed && ui.id == id) "This pinboard couldn’t load." else "Loading…")
                else -> {
                    Pieces(board.pieces)
                    if (board.canAdd) {
                        AddButton { onAdd(board) }
                    } else {
                        BoardNote(if (board.open) "You’ve added your piece." else "This pinboard has closed.")
                    }
                }
            }
        }
    }
}

@Composable
private fun BoardHeader(board: PinboardDto?) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            "PINBOARD",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.primary600,
        )
        Text(
            board?.prompt ?: "…",
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() }.testTag("together.pinboard.prompt"),
        )
        if (board != null) {
            Text(
                board.subtitle(),
                fontSize = 13.5.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.testTag("together.pinboard.subtitle"),
            )
        }
    }
}

/** The pieces, two to a row, each clipped to its cell, with whose it is. */
@Composable
private fun Pieces(pieces: List<PinboardPieceDto>) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("together.pinboard.pieces")) {
        pieces.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
                pair.forEach { piece ->
                    val whose = piece.author?.name ?: "Someone"
                    Column(
                        modifier =
                            Modifier
                                .weight(1f)
                                .semantics(mergeDescendants = true) { contentDescription = "$whose’s piece" },
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .height(PIECE_HEIGHT.dp)
                                .clip(RoundedCornerShape(Radii.md))
                                .background(PantopusColors.appSurfaceRaised),
                        ) {
                            AsyncImage(
                                model = piece.picture,
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                        Text(
                            whose,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PantopusColors.appTextSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun AddButton(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(percent = 50))
                .background(PantopusColors.primary600)
                .clickable(role = Role.Button, onClick = onClick)
                .testTag("together.pinboard.add"),
        contentAlignment = Alignment.Center,
    ) {
        Text("Add your piece", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun BoardNote(words: String) {
    Text(words, fontSize = 14.sp, color = PantopusColors.appTextSecondary, modifier = Modifier.testTag("together.pinboard.note"))
}

private const val PIECE_HEIGHT = 180

@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.feed.living

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
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
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.living.LivingAtlasResultDto
import app.pantopus.android.data.living.LivingRepository
import app.pantopus.android.data.living.searchRefusal
import app.pantopus.android.ui.screens.feed.reinvented.MomentPicture
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

/*
 * "Pulse, reinvented" phase 4, Atlas search (PHASE-4 piece 3; CONTRACT 9b; board B7), as the iPhone's
 * (`ReinventedAtlasSearch.swift`) and the web's (`AtlasSearch.tsx`): at the top of My Atlas, plain words across what the
 * person took, what the people they know captured, what is around their places, and what they learned and answered.
 * Results are dated, newest first, each saying why it is there; a Moment opens in the viewer, a post opens as itself.
 * The words go in a POST body, never in an address, and are never kept.
 */

data class LivingAtlasSearchState(
    val q: String? = null,
    val results: List<LivingAtlasResultDto> = emptyList(),
    val cursor: String? = null,
    val reading: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class LivingAtlasSearchViewModel
    @Inject
    constructor(
        private val repository: LivingRepository,
    ) : ViewModel() {
        private val _state = MutableStateFlow(LivingAtlasSearchState())
        val state: StateFlow<LivingAtlasSearchState> = _state.asStateFlow()
        private var reading: Job? = null

        fun search(text: String) {
            val q = text.trim().take(MAX_WORDS)
            if (q.length < 2) return
            reading?.cancel()
            _state.value = LivingAtlasSearchState(q = q)
            read(q, null)
        }

        fun more() {
            val now = _state.value
            val q = now.q ?: return
            val cursor = now.cursor ?: return
            if (now.reading) return
            read(q, cursor)
        }

        fun clear() {
            reading?.cancel()
            _state.value = LivingAtlasSearchState()
        }

        private fun read(
            q: String,
            cursor: String?,
        ) {
            _state.update { it.copy(reading = true, error = null) }
            reading =
                viewModelScope.launch {
                    when (val answer = repository.atlasSearch(q, cursor)) {
                        is NetworkResult.Success ->
                            _state.update { now ->
                                if (now.q != q) return@update now
                                val seen = now.results.mapTo(mutableSetOf()) { it.key }
                                val fresh = answer.data.results.filter { it.drawable && it.key !in seen }
                                now.copy(results = now.results + fresh, cursor = answer.data.nextCursor, reading = false)
                            }
                        is NetworkResult.Failure -> _state.update { it.copy(reading = false, error = searchRefusal(answer.error)) }
                    }
                }
        }

        private companion object {
            const val MAX_WORDS = 100
        }
    }

/**
 * At the top of My Atlas: the search field, and while a search shows, its results. A Moment of the person's own opens
 * as My Atlas opens it ([onOpenOwn]); anyone else's in the viewer ([onOpenMoment]); a post as itself ([onOpenPost]).
 */
@Composable
internal fun LivingAtlasSearch(
    onOpenOwn: (MomentDto) -> Unit,
    onOpenMoment: (MomentDto) -> Unit,
    onOpenPost: (String) -> Unit,
    viewModel: LivingAtlasSearchViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var text by rememberSaveable { mutableStateOf("") }
    val focus = LocalFocusManager.current
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s1).padding(top = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        LivingSearchBox(
            text = text,
            look = ATLAS_LOOK,
            mode = if (state.q != null || text.isNotEmpty()) LivingSearchMode.CLEARABLE else LivingSearchMode.PLAIN,
            onText = { text = it },
            onSearch = {
                viewModel.search(text)
                focus.clearFocus()
            },
            onClear = {
                text = ""
                viewModel.clear()
            },
        )
        val error = state.error
        val q = state.q
        when {
            error != null ->
                Text(error, fontSize = 14.sp, color = PantopusColors.appText, modifier = Modifier.testTag("reinventedAtlas.search.error"))
            q != null -> Results(q, state, viewModel::more) { open(it, onOpenOwn, onOpenMoment, onOpenPost) }
            // While nothing is searched: what is near (CONTRACT 9c), then the person's cabinet (CONTRACT 9d) and Echoes (9e).
            else ->
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
                    LivingConstellations()
                    LivingCabinet()
                    LivingEchoes()
                }
        }
    }
}

private val ATLAS_LOOK =
    LivingSearchLook(
        hint = "Search your Atlas: mushroom, sunset",
        fieldTag = "reinventedAtlas.search.field",
        clearTag = "reinventedAtlas.search.clear",
        clearWords = "Clear the search",
        pill = false,
    )

@Composable
private fun Results(
    q: String,
    state: LivingAtlasSearchState,
    onMore: () -> Unit,
    onOpen: (LivingAtlasResultDto) -> Unit,
) {
    if (state.results.isEmpty()) {
        if (state.reading) {
            Box(Modifier.fillMaxWidth().height(60.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
            }
        } else {
            Text(
                "Nothing found for “$q”. Try other words.",
                fontSize = 14.sp,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.testTag("reinventedAtlas.search.none"),
            )
        }
        return
    }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        state.results.forEach { result -> ResultRow(result) { onOpen(result) } }
        if (state.cursor != null) {
            TextButton(onClick = onMore, enabled = !state.reading, modifier = Modifier.testTag("reinventedAtlas.search.more")) {
                Text(if (state.reading) "Loading…" else "Show more", fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
        HorizontalDivider(color = PantopusColors.appBorder, modifier = Modifier.padding(vertical = Spacing.s1))
    }
}

@Composable
private fun ResultRow(
    result: LivingAtlasResultDto,
    onOpen: () -> Unit,
) {
    val said = said(result)
    val line = listOfNotNull(result.why.takeIf { it.isNotBlank() }, day(result.at)).joinToString(" · ")
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button, enabled = result.type != "card", onClick = onOpen)
                .semantics(mergeDescendants = true) {}
                .testTag("reinventedAtlas.search.result.${result.key}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Thumb(result)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                said,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (line.isNotEmpty()) Text(line, fontSize = 13.sp, color = PantopusColors.appTextSecondary, maxLines = 1)
        }
    }
}

/** A Moment's own picture; a post or a field guide card a tile with its kind. Decoration only: the row says it all. */
@Composable
private fun Thumb(result: LivingAtlasResultDto) {
    val shape = RoundedCornerShape(8.dp)
    val moment = result.moment
    val frame = Modifier.size(width = 52.dp, height = 64.dp).clip(shape).clearAndSetSemantics {}
    if (result.type == "moment" && moment != null) {
        MomentPicture(moment, frame)
    } else {
        Box(frame.background(PantopusColors.appSurfaceSunken), contentAlignment = Alignment.Center) {
            PantopusIconImage(
                icon = if (result.type == "card") PantopusIcon.Leaf else PantopusIcon.Image,
                contentDescription = null,
                size = 20.dp,
                tint = PantopusColors.primary600,
            )
        }
    }
}

/** A Moment's words (or its place), a post's title (or its words), a card's name. */
private fun said(result: LivingAtlasResultDto): String {
    result.moment?.takeIf { result.type == "moment" }?.let { moment ->
        val words = (if (moment.kind == "text") moment.text else moment.caption)?.trim()
        return words?.takeIf { it.isNotEmpty() } ?: moment.placeLabel?.takeIf { it.isNotBlank() } ?: "A Moment"
    }
    result.post?.takeIf { result.type == "post" }?.let { post ->
        return post.title?.trim()?.takeIf { it.isNotEmpty() } ?: post.content?.trim().orEmpty().ifEmpty { "A post" }
    }
    val card = result.card?.card ?: return "A result"
    return listOfNotNull(card.name, card.scientific).joinToString(" · ")
}

/** "Nov 27": the day a result was captured, in the phone's own time. */
private fun day(at: String?): String? {
    val instant = at?.let { runCatching { Instant.parse(it) }.getOrNull() } ?: return null
    return DateTimeFormatter.ofPattern("MMM d", Locale.getDefault()).format(instant.atZone(ZoneId.systemDefault()))
}

/** A Moment of the person's own opens as My Atlas opens it; anyone else's in the viewer; a post as itself. */
private fun open(
    result: LivingAtlasResultDto,
    onOpenOwn: (MomentDto) -> Unit,
    onOpenMoment: (MomentDto) -> Unit,
    onOpenPost: (String) -> Unit,
) {
    val moment = result.moment
    when {
        result.type == "moment" && moment != null -> if (result.why == "Yours") onOpenOwn(moment) else onOpenMoment(moment)
        result.type == "post" -> onOpenPost(result.post?.id ?: result.id)
    }
}

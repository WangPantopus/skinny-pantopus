package app.pantopus.android.ui.screens.place.today

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.ai.AINeedsYouRepository
import app.pantopus.android.data.api.models.ai.AINeedsYouItemDto
import app.pantopus.android.data.api.net.refusesStoredCopy
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.screens.place.components.placeSurface
import app.pantopus.android.ui.screens.place.detail.TodayHairline
import app.pantopus.android.ui.screens.place.detail.TodayTextAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The rows the card shows before "Show all" (AI assistant phase 3 contract §6.4). */
private const val NEEDS_YOU_FIRST_ROWS = 3

/** Tasks "Coming up at home" may also list (phase 3 brief section 3, decision 2). */
private val TASK_TYPES = setOf("task_overdue", "task_assigned")

/**
 * Today's Needs you (AI assistant phase 3 contract §6.4): what waits on the person, from `GET /api/ai/needs-you`
 * through the screens' store. The last list shows at once and then refreshes, when Today appears, when the store marks
 * it out of date and on a pull. A failed refresh keeps the last list; with none yet the card isn't there.
 */
@HiltViewModel
class NeedsYouViewModel
    @Inject
    constructor(
        private val repo: AINeedsYouRepository,
    ) : ViewModel() {
        private val _items = MutableStateFlow(repo.needsYouCopy()?.items)

        /** The list to show; null before the first answer, or after a refused one (nothing shows). */
        val items: StateFlow<List<AINeedsYouItemDto>?> = _items.asStateFlow()

        private var reading: Job? = null

        /** Today appeared, or the store marked the list out of date: the store reads only an out-of-date copy. */
        fun load() = read(force = false)

        /** Pull to refresh and Retry: reads now. */
        fun pull() = read(force = true)

        private fun read(force: Boolean) {
            if (!force && reading?.isActive == true) return
            reading =
                viewModelScope.launch {
                    var stored = repo.needsYouStored(force)
                    // A token refresh at launch can set an answer aside (no data and no failure): ask once more.
                    if (stored.data == null && stored.failure == null) stored = repo.needsYouStored(force = true)
                    val data = stored.data
                    when {
                        data != null -> _items.value = data.items
                        stored.failure.refusesStoredCopy -> _items.value = null
                    }
                }
        }
    }

/**
 * The card: "Needs you", then up to three rows, each opening its screen with the deep-link router; "Show all (N)"
 * expands it in place. A task row whose task "Coming up at home" lists on the same screen ([agendaTaskIds]) is left
 * out, and N counts what the card shows. Nothing shows when nothing waits.
 */
@Composable
fun NeedsYouCard(
    items: List<AINeedsYouItemDto>?,
    onOpen: (String) -> Unit,
    modifier: Modifier = Modifier,
    agendaTaskIds: Set<String> = emptySet(),
    /** Space above the title: a section's under the sky, none at the top of the screen. */
    topGap: Dp = 24.dp,
) {
    val shown = items.orEmpty().filterNot { it.type in TASK_TYPES && it.subject?.id in agendaTaskIds }
    if (shown.isEmpty()) return
    var showsAll by rememberSaveable { mutableStateOf(false) }
    Column(modifier = modifier.fillMaxWidth().testTag("needsYou.card")) {
        Text(
            "Needs you",
            fontSize = 18.sp,
            lineHeight = 23.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = (-0.2).sp,
            color = PantopusColors.appText,
            modifier = Modifier.padding(top = topGap, bottom = 8.dp, start = 2.dp).semantics { heading() },
        )
        Column(modifier = Modifier.fillMaxWidth().animateContentSize().placeSurface().padding(horizontal = 14.dp)) {
            val rows = if (showsAll) shown else shown.take(NEEDS_YOU_FIRST_ROWS)
            rows.forEachIndexed { index, item ->
                if (index > 0) TodayHairline()
                NeedsYouRow(item, onOpen)
            }
            if (shown.size > NEEDS_YOU_FIRST_ROWS) {
                TodayHairline()
                TodayTextAction(
                    if (showsAll) "Show fewer" else "Show all (${shown.size})",
                    onClick = { showsAll = !showsAll },
                    modifier = Modifier.testTag("needsYou.showAll"),
                )
            }
        }
    }
}

@Composable
private fun NeedsYouRow(
    item: AINeedsYouItemDto,
    onOpen: (String) -> Unit,
) {
    val link = item.link
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 56.dp)
                .then(if (link != null) Modifier.clickable(role = Role.Button, onClickLabel = "Open") { onOpen(link) } else Modifier)
                .semantics(mergeDescendants = true) {}
                .padding(vertical = 12.dp)
                .testTag("needsYou.row.${item.type}"),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlaceIconTile(icon = needsYouIcon(item.type), tone = if (item.type == "task_overdue") PlaceTileTone.MUTED else PlaceTileTone.SKY)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(item.title, fontSize = 15.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            item.subtitle?.takeIf { it.isNotBlank() }?.let {
                Text(it, fontSize = 12.5.sp, lineHeight = 17.sp, color = PantopusColors.appTextSecondary)
            }
        }
        if (link != null) PantopusIconImage(PantopusIcon.ChevronRight, null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

private fun needsYouIcon(type: String): PantopusIcon =
    when (type) {
        "still_coming" -> PantopusIcon.CalendarCheck
        "plan_requests" -> PantopusIcon.Users
        "task_overdue" -> PantopusIcon.AlertCircle
        "task_assigned" -> PantopusIcon.ListChecks
        "home_invite" -> PantopusIcon.Home
        "household_request", "connection_request" -> PantopusIcon.UserPlus
        "nudge_card" -> PantopusIcon.Sparkles
        "question_answered" -> PantopusIcon.MessageCircle
        else -> PantopusIcon.Bell
    }

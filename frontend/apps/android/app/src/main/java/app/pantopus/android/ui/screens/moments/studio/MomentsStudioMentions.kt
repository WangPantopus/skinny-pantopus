@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.studio

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.relationships.RelationshipUserDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.relationships.RelationshipsRepository
import app.pantopus.android.ui.components.keepsKeyboard
import app.pantopus.android.ui.screens.moments.compose.MomentsComposeUiState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/*
 * "Pulse, reinvented"'s Studio, phase 0 step 5: mentions in the caption (CONTRACT 7h; iPhone #5095). Typing "@" at the end
 * of the Studio's caption offers the author's connections; picking one writes "@First Last " into the caption, which
 * stays plain words (today's screens and the released apps show it as text). The ids of the people whose "@Name" is still
 * in the caption go beside it as `mentions` (up to five); never under a made-up name, since a mention says who the
 * author knows. The server keeps only the author's connections who may see the Moment.
 */

/** A person offered after "@": a connection's id and the name the caption gets. */
data class StudioMention(
    val id: String,
    val name: String,
)

/** The most people one Moment mentions (CONTRACT 7h). */
private const val MOST_MENTIONED = 5

/** The words after an "@" that still look for a name: no line break, and not too long. */
private const val LONGEST_QUERY = 30

/** How many people the row offers at once. */
private const val OFFERED = 8

/**
 * The name being looked for: what follows the caption's last "@" (at the start or after a space), while it is still
 * being typed at the end of the caption; null when the caption doesn't end in one.
 */
internal fun mentionQuery(caption: String): String? {
    val at = caption.lastIndexOf('@')
    if (at < 0 || (at > 0 && !caption[at - 1].isWhitespace())) return null
    val query = caption.substring(at + 1)
    return query.takeIf { '\n' !in it && it.length <= LONGEST_QUERY }
}

/**
 * Where "@[name]" stands in [caption] as a whole name: the places it starts, each not followed by a letter or a digit
 * (so "@Ann" is not found inside "@Annabel Lee").
 */
internal fun mentionPlaces(
    caption: String,
    name: String,
): List<Int> {
    val words = "@$name"
    return generateSequence(caption.indexOf(words).takeIf { it >= 0 }) { at -> caption.indexOf(words, at + 1).takeIf { it >= 0 } }
        .filter { at -> caption.getOrNull(at + words.length)?.isLetterOrDigit() != true }
        .toList()
}

/** [caption] with its "@query" at the end replaced by "@Name ". */
internal fun captionWithMention(
    caption: String,
    person: StudioMention,
): String = caption.substring(0, caption.lastIndexOf('@')) + "@${person.name} "

/** The ids that go with the post: people whose "@Name" is still in the caption, at most five; none under a made-up name. */
internal val MomentsComposeUiState.sentMentions: List<String>?
    get() =
        if (madeUp || media == null) {
            null
        } else {
            mentions
                .filter { mentionPlaces(caption, it.name).isNotEmpty() }
                .map { it.id }
                .distinct()
                .take(MOST_MENTIONED)
                .takeIf { it.isNotEmpty() }
        }

/** The author's connections, read once the first time "@" is typed in the Studio's caption. */
@HiltViewModel
class MomentsStudioMentionsViewModel
    @Inject
    constructor(
        private val relationships: RelationshipsRepository,
    ) : ViewModel() {
        private val _people = MutableStateFlow<List<StudioMention>?>(null)

        /** Null until read. */
        val people: StateFlow<List<StudioMention>?> = _people.asStateFlow()

        private var reading = false

        /** Read fresh from the server the first time; a failed or empty read is tried again at the next "@". */
        fun read() {
            if (reading || !_people.value.isNullOrEmpty()) return
            reading = true
            viewModelScope.launch {
                val read = relationships.list(status = "accepted", limit = 100, force = true)
                val people =
                    (read as? NetworkResult.Success)
                        ?.data
                        ?.relationships
                        .orEmpty()
                        .mapNotNull { row -> row.otherUser?.let { user -> StudioMention(user.id, user.displayName()) } }
                        .filter { it.name.isNotBlank() }
                        .distinctBy { it.id }
                        .sortedBy { it.name.lowercase() }
                if (people.isNotEmpty()) _people.value = people
                reading = false
            }
        }

        private fun RelationshipUserDto.displayName(): String =
            listOfNotNull(firstName, lastName).joinToString(" ").ifBlank { name ?: username.orEmpty() }
    }

/**
 * Over the Studio's caption while it ends in "@…": the author's connections whose name holds what follows the "@", as
 * chips; a tap writes "@First Last " and remembers who. Nothing under a made-up name.
 */
@Composable
internal fun StudioMentionRow(
    caption: String,
    madeUp: Boolean,
    onPick: (StudioMention) -> Unit,
    modifier: Modifier = Modifier,
    people: MomentsStudioMentionsViewModel = hiltViewModel(),
) {
    val query = mentionQuery(caption).takeIf { !madeUp } ?: return
    LaunchedEffect(Unit) { people.read() }
    val all by people.people.collectAsStateWithLifecycle()
    val offered = all.orEmpty().filter { it.name.contains(query.trim(), ignoreCase = true) }.take(OFFERED)
    if (offered.isEmpty()) return
    LazyRow(
        modifier = modifier.fillMaxWidth().keepsKeyboard().semantics { contentDescription = "Mention someone" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        items(offered, key = { it.id }) { person ->
            val shape = RoundedCornerShape(18.dp)
            Text(
                text = "@${person.name}",
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .height(36.dp)
                        .clip(shape)
                        .background(PantopusColors.studioPillFill)
                        .border(1.dp, PantopusColors.studioPillOutline, shape)
                        .clickable(role = Role.Button) { onPick(person) }
                        .padding(horizontal = 14.dp, vertical = Spacing.s2)
                        .testTag("moments.studio.mention")
                        .clearAndSetSemantics {
                            contentDescription = "Mention ${person.name}"
                            role = Role.Button
                        },
            )
        }
    }
}

/**
 * What only the Studio sets on the Moment being made is still there (stamps, the made-up name, a guess, mentions, a
 * before and after's item, dots, playable items, a whole photo):
 * today's Post screen lets them go when it takes the Moment back (the view model's `leaveStudio`).
 */
internal val MomentsComposeUiState.holdsStudioChoices: Boolean
    get() =
        stamps.isNotEmpty() || madeUp || guess || mentions.isNotEmpty() || pair != null || dots.isNotEmpty() ||
            items.isNotEmpty() || whole || trim != null

@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.feed.FeedPost
import app.pantopus.android.data.api.models.profile.ProfilePromptDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.posts.PostsRepository
import app.pantopus.android.ui.screens.feed.pulse.PulseIntent
import app.pantopus.android.ui.screens.feed.pulse.PulseReaction
import app.pantopus.android.ui.screens.feed.pulse.tintColors
import app.pantopus.android.ui.screens.shared.media.PostMediaKind
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/*
 * PRF step 5 (`Main.dc.html`, `PromptPicker.dc.html`): "Get to know <name>" (the person's prompt answers, SRV-2) and
 * the Pinned row (up to three posts the person pinned, SRV-3). Both hide whenever the server sends nothing.
 */

/** The prompt catalog (PRF brief Appendix B): the server stores [key]; the app owns the words. */
internal enum class ProfilePrompt(
    val key: String,
    val text: String,
) {
    AskMeAbout("ask_me_about", "Ask me about…"),
    ICanLend("i_can_lend", "I can lend…"),
    BestSpot("best_spot", "Best spot around here…"),
    NewHereRecommend("new_here_recommend", "New here? I'd recommend…"),
    LookingFor("looking_for", "Looking for…"),
    FavoriteLocalFood("favorite_local_food", "My favorite local food…"),
    SomethingLearning("something_learning", "Something I'm learning…"),
    LivedHereSince("lived_here_since", "I've lived here since…"),
    BestWayToSayHi("best_way_to_say_hi", "Best way to say hi…"),
    NeighborhoodTradition("neighborhood_tradition", "A neighborhood tradition I love…"),
    ;

    companion object {
        /** A key from a newer catalog is skipped. */
        fun of(key: String): ProfilePrompt? = entries.firstOrNull { it.key == key }

        const val MAX = 3
        const val ANSWER_LIMIT = 120
    }
}

/** The answers the app can show, in saved order: unknown keys and blank answers are skipped. */
internal fun promptAnswers(prompts: List<ProfilePromptDto>?): List<Pair<ProfilePrompt, String>> =
    prompts.orEmpty().mapNotNull { dto ->
        val prompt = ProfilePrompt.of(dto.key) ?: return@mapNotNull null
        dto.answer.trim().takeIf { it.isNotEmpty() }?.let { prompt to it }
    }

/** "Pin to profile" / "Unpin from profile" toasts, the same on every menu that offers them. */
internal object ProfilePinCopy {
    const val PIN = "Pin to profile"
    const val UNPIN = "Unpin from profile"
    const val PINNED = "Pinned to your profile."
    const val UNPINNED = "Unpinned from your profile."

    /** A failure without the server's own sentence (a 4th pin answers its own: "You can pin up to 3 posts…"). */
    const val FAILED = "Couldn't change the pin. Try again."
}

/** "Get to know Rowan": the person's answers; on your own page, Edit opens the editor. Hidden when there are none. */
@Composable
internal fun GetToKnowCard(
    firstName: String,
    prompts: List<ProfilePromptDto>?,
    onEdit: (() -> Unit)?,
) {
    val answers = promptAnswers(prompts)
    if (answers.isEmpty()) return
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(start = Spacing.s5, end = Spacing.s5, top = Spacing.s5)
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(vertical = Spacing.s2)
                .testTag("profileGetToKnow"),
    ) {
        SectionTitle(title = "Get to know $firstName", onEdit = onEdit, editLabel = "Edit your prompts")
        answers.forEachIndexed { index, (prompt, answer) ->
            if (index > 0) AboutDivider()
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(text = prompt.text, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
                Text(text = answer, fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            }
        }
    }
}

@Composable
private fun SectionTitle(
    title: String,
    onEdit: (() -> Unit)?,
    editLabel: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(start = Spacing.s4, end = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = title,
            fontSize = 17.sp,
            lineHeight = 22.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f).padding(vertical = Spacing.s2).semantics { heading() },
        )
        if (onEdit != null) {
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.pill))
                        .clickable(role = Role.Button, onClickLabel = editLabel, onClick = onEdit)
                        .padding(horizontal = Spacing.s3),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "Edit", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.primary600)
            }
        }
    }
}

/** One pinned post as a small card: its first photo, else the kind's tint and icon; first line; kind and main count. */
internal data class PinnedCard(
    val id: String,
    val title: String,
    val intent: PulseIntent,
    val subline: String,
    val photoUrl: String?,
)

internal fun pinnedCard(post: FeedPost): PinnedCard {
    val card = profilePreviewCard(post)
    val firstLine = (card.title?.takeIf { it.isNotBlank() } ?: card.body).trim().lineSequence().firstOrNull().orEmpty()
    val count = card.attendees?.let { "${it.goingCount} going" } ?: card.reactions.firstOrNull()?.let(::reactionCount)
    val photo = card.media.firstOrNull { it.kind == PostMediaKind.Image }?.let { it.thumbnailUrl ?: it.url }
    return PinnedCard(
        id = post.id,
        title = firstLine,
        intent = card.intent,
        subline = listOfNotNull(card.intent.cardChipLabel.takeIf { it.isNotEmpty() }, count).joinToString(" · "),
        photoUrl = photo,
    )
}

/** The main count in words: "6 helpful", "4 likes", "2 going" (the heart has no label of its own). */
private fun reactionCount(reaction: PulseReaction): String =
    when (reaction.kind) {
        PulseReaction.Kind.Heart -> if (reaction.count == 1) "1 like" else "${reaction.count} likes"
        PulseReaction.Kind.Helpful -> "${reaction.count} helpful"
        PulseReaction.Kind.Going -> "${reaction.count} going"
        PulseReaction.Kind.Seen -> "${reaction.count} seen"
        PulseReaction.Kind.Shared -> "${reaction.count} shared"
    }

/** "Pinned": the person's pinned posts in a row; a tap opens the post (not in a preview); Edit on your own page. */
@Composable
internal fun PinnedRow(
    cards: List<PinnedCard>,
    onOpen: ((String) -> Unit)?,
    onEdit: (() -> Unit)?,
) {
    if (cards.isEmpty()) return
    Column(modifier = Modifier.fillMaxWidth().padding(top = Spacing.s5).testTag("profilePinned")) {
        Box(modifier = Modifier.padding(horizontal = Spacing.s1)) {
            SectionTitle(title = "Pinned", onEdit = onEdit, editLabel = "Edit your pinned posts")
        }
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = Spacing.s5),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            cards.forEach { card -> PinnedPostCard(card = card, onOpen = onOpen) }
        }
    }
}

@Composable
private fun PinnedPostCard(
    card: PinnedCard,
    onOpen: ((String) -> Unit)?,
) {
    val (tint, tintBg) = card.intent.tintColors()
    Column(
        modifier =
            Modifier
                .width(200.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .then(if (onOpen != null) Modifier.clickable(role = Role.Button) { onOpen(card.id) } else Modifier)
                .testTag("profilePinnedCard_${card.id}"),
    ) {
        Box(
            modifier = Modifier.fillMaxWidth().height(96.dp).background(tintBg),
            contentAlignment = Alignment.Center,
        ) {
            if (card.photoUrl != null) {
                SubcomposeAsyncImage(
                    model = card.photoUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize(),
                    error = { PantopusIconImage(icon = card.intent.icon, contentDescription = null, size = 28.dp, tint = tint) },
                )
            } else {
                PantopusIconImage(icon = card.intent.icon, contentDescription = null, size = 28.dp, tint = tint)
            }
        }
        Column(modifier = Modifier.padding(Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = card.title,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (card.subline.isNotEmpty()) {
                Text(text = card.subline, fontSize = 13.sp, lineHeight = 18.sp, color = PantopusColors.appTextMuted)
            }
        }
    }
}

/** Reads a person's pinned posts (`GET /api/posts/user/:id/pinned`); null until read, and on any failure. */
internal class ProfilePinsLoader(
    private val scope: CoroutineScope,
    private val posts: PostsRepository,
) {
    private val _state = MutableStateFlow<List<FeedPost>?>(null)
    val state: StateFlow<List<FeedPost>?> = _state.asStateFlow()
    private var job: Job? = null

    fun load(userId: String) {
        job?.cancel()
        job =
            scope.launch {
                _state.value = (posts.pinnedPosts(userId) as? NetworkResult.Success)?.data?.posts
            }
    }

    /** A block: no pinned post stays on screen. */
    fun clear() {
        job?.cancel()
        _state.value = null
    }
}

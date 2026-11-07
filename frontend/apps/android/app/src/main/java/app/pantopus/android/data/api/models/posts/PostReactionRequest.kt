package app.pantopus.android.data.api.models.posts

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * Response payload for `POST /api/posts/:id/like`. Route: `backend/routes/posts.js` (`router.post('/:id/like'`).
 * An event's Going (`{"liked": Bool}`) answers [message], [liked] and [likeCount]; an emoji reaction
 * (`{"reaction": …}`) also answers the viewer's [reaction] and each emoji's count ([reactions]).
 */
@JsonClass(generateAdapter = true)
data class PostLikeResponse(
    val message: String? = null,
    val liked: Boolean,
    val likeCount: Int,
    /** The viewer's emoji after the change; null once it's taken away (and on a Going request). */
    val reaction: String? = null,
    /** Each emoji's count after the change, the most used first; null when the server couldn't read them. */
    val reactions: List<PostReactionCountDto>? = null,
)

/**
 * One emoji's count on a post: `reactions: [{ "reaction": "👍", "count": 3 }]` on every post the apps read (feeds,
 * profile posts, pinned, saved, `GET /api/posts/:id`) and in the reply above (`backend/utils/postReaction.js`).
 */
@JsonClass(generateAdapter = true)
data class PostReactionCountDto(
    /** The emoji; a mark without one (made before emoji reactions) is 👍. */
    val reaction: String? = null,
    val count: Int = 0,
)

/**
 * How people react to a post, the same on web, iPhone and Android and in the author's notice
 * (`backend/utils/postReaction.js`): Going on an event, one emoji per person ([PostReactionEmoji]) on every other kind.
 */
enum class PostReactionKind(
    val key: String,
    /** The button: "Going", or "React" before anyone picked an emoji. */
    val label: String,
) {
    Going(key = "going", label = "Going"),
    Emoji(key = "emoji", label = "React"),
    ;

    /** The count in words: "2 going", "1 reaction", "3 reactions". */
    fun countText(count: Int): String =
        when (this) {
            Going -> "$count going"
            Emoji -> if (count == 1) "1 reaction" else "$count reactions"
        }

    companion object {
        fun fromPostType(postType: String?): PostReactionKind = if (postType == "event") Going else Emoji
    }
}

/**
 * The emoji a post can get, in the order the picker offers them: the same set on web, iPhone and Android and on the
 * server (`backend/utils/postReaction.js` `POST_REACTION_EMOJIS`), which stores and returns exactly these strings (the
 * heart is U+2764 U+FE0F, with its emoji presentation). [label] is what TalkBack reads ("Love"); [key] names the
 * controls' test tags (`pulseReactionOption_love`, `pulsePostDetail-reaction-love`).
 */
enum class PostReactionEmoji(
    val emoji: String,
    val label: String,
    val key: String,
) {
    Like(emoji = "👍", label = "Like", key = "like"),
    Love(emoji = "❤️", label = "Love", key = "love"),
    Haha(emoji = "😂", label = "Haha", key = "haha"),
    Wow(emoji = "😮", label = "Wow", key = "wow"),
    Sad(emoji = "😢", label = "Sad", key = "sad"),
    Thanks(emoji = "🙏", label = "Thanks", key = "thanks"),
    Celebrate(emoji = "🎉", label = "Celebrate", key = "celebrate"),
    ;

    companion object {
        /** The emoji [value] names, or null when it isn't one of the set. "❤" and "❤️" are the same reaction. */
        fun from(value: String?): PostReactionEmoji? {
            val bare = value?.trim()?.withoutPresentationSelector()?.takeIf { it.isNotEmpty() } ?: return null
            return entries.firstOrNull { it.emoji.withoutPresentationSelector() == bare }
        }

        private fun String.withoutPresentationSelector(): String = replace("\uFE0F", "")
    }
}

/**
 * A post's emoji reactions as every app shows them: each emoji with its count (only counts above 0, the most used first,
 * ties in [PostReactionEmoji] order) and the viewer's own emoji.
 */
data class PostReactionSummary(
    val counts: List<Count> = emptyList(),
    val mine: PostReactionEmoji? = null,
) {
    data class Count(
        val emoji: PostReactionEmoji,
        val count: Int,
    )

    /** How many people reacted. */
    val total: Int get() = counts.sumOf { it.count }

    /** The card's emoji: the three most used, the viewer's own first when it isn't among them. */
    val cardEmoji: List<PostReactionEmoji>
        get() {
            val top = counts.take(CARD_EMOJI).map { it.emoji }
            return if (mine == null || mine in top) top else (listOf(mine) + top).take(CARD_EMOJI)
        }

    /** What TalkBack reads: "Reactions, 6: 3 Like, 2 Love, 1 Haha", or "React" before anyone reacted. */
    val accessibilityLabel: String
        get() =
            if (counts.isEmpty()) {
                PostReactionKind.Emoji.label
            } else {
                "Reactions, $total: " + counts.joinToString(", ") { "${it.count} ${it.emoji.label}" }
            }

    /** "Your reaction: Love"; null while the viewer hasn't reacted. */
    val accessibilityValue: String? get() = mine?.let { "Your reaction: ${it.label}" }

    /** The emoji the viewer's pick of [emoji] leaves them with: that emoji, or none when it already was theirs. */
    fun afterPicking(emoji: PostReactionEmoji): PostReactionEmoji? = emoji.takeIf { it != mine }

    /**
     * The counts once the viewer's reaction is [next] (null takes it away), shown before the server answers: one off
     * their old emoji, one onto the new one, emoji at 0 dropped, the rest re-sorted.
     */
    fun withMine(next: PostReactionEmoji?): PostReactionSummary {
        if (next == mine) return this
        val byEmoji = counts.associate { it.emoji to it.count }.toMutableMap()
        mine?.let { old -> byEmoji[old] = (byEmoji[old] ?: 0) - 1 }
        next?.let { new -> byEmoji[new] = (byEmoji[new] ?: 0) + 1 }
        return from(byEmoji, next)
    }

    /**
     * The server's answer to a reaction: its counts and the viewer's emoji. Without counts (the server couldn't read
     * them) these counts, shown at once, stay.
     */
    fun settled(response: PostLikeResponse): PostReactionSummary =
        response.reactions?.let { of(it, response.likeCount, response.reaction, response.liked) }
            ?: copy(mine = PostReactionEmoji.from(response.reaction))

    companion object {
        /** How many emoji the card shows before its total. */
        const val CARD_EMOJI = 3

        /**
         * A post's `reactions`, `like_count`, `userReaction` and `userHasLiked`. Without counts (an older server, or a
         * failed read) every mark shows as 👍, the viewer's own as theirs; a viewer who reacted without an emoji
         * (before emoji reactions) reacted 👍.
         */
        fun of(
            reactions: List<PostReactionCountDto>?,
            likeCount: Int,
            userReaction: String?,
            userHasLiked: Boolean,
        ): PostReactionSummary {
            val mine = PostReactionEmoji.from(userReaction) ?: PostReactionEmoji.Like.takeIf { userHasLiked }
            val byEmoji = mutableMapOf<PostReactionEmoji, Int>()
            for (row in reactions.orEmpty()) {
                if (row.count <= 0) continue
                val emoji = PostReactionEmoji.from(row.reaction) ?: PostReactionEmoji.Like
                byEmoji[emoji] = (byEmoji[emoji] ?: 0) + row.count
            }
            if (byEmoji.isEmpty() && likeCount > 0) {
                val others = likeCount - (if (mine != null) 1 else 0)
                mine?.let { byEmoji[it] = 1 }
                if (others > 0) byEmoji[PostReactionEmoji.Like] = (byEmoji[PostReactionEmoji.Like] ?: 0) + others
            }
            return from(byEmoji, mine)
        }

        /** Counts by emoji, sorted the way they show. */
        fun from(
            counts: Map<PostReactionEmoji, Int>,
            mine: PostReactionEmoji? = null,
        ): PostReactionSummary =
            PostReactionSummary(
                counts =
                    counts
                        .filterValues { it > 0 }
                        .map { (emoji, count) -> Count(emoji, count) }
                        .sortedWith(compareByDescending<Count> { it.count }.thenBy { it.emoji.ordinal }),
                mine = mine,
            )
    }
}

/**
 * The `{"reaction": "❤️"}` body that sets the viewer's emoji, or `{"reaction": null}`, which takes it away. The null has
 * to reach the server (without a `reaction` key it runs the older like toggle), and Moshi leaves null fields out unless
 * asked to keep them.
 */
fun postReactionRequestBody(reaction: PostReactionEmoji?): RequestBody =
    reactionBodyAdapter.toJson(mapOf("reaction" to reaction?.emoji)).toRequestBody(JSON_MEDIA_TYPE)

private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()

private val reactionBodyAdapter: JsonAdapter<Map<String, String?>> =
    Moshi
        .Builder()
        .build()
        .adapter<Map<String, String?>>(Types.newParameterizedType(Map::class.java, String::class.java, String::class.java))
        .serializeNulls()

@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.inbox.search

import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import app.pantopus.android.ui.screens.inbox.chat.ConversationIdentityChip
import app.pantopus.android.ui.theme.PantopusColors

/** Which conversation endpoint backs a result, so the router can rebuild
 *  the typed destination (`person` vs `room`). */
enum class ChatSearchResultKind { Dm, Group }

/**
 * One Chat Search result row — a single matched conversation. The row
 * shows the conversation identity plus a snippet (the matched message
 * body, or the last-message preview when only the name matched) with the
 * query term highlighted. [matchedMessageId] is set only for body matches
 * and rides the nav hop so the conversation opens scrolled to it.
 */
@Immutable
data class ChatSearchResult(
    val conversationId: String,
    val kind: ChatSearchResultKind,
    val displayName: String,
    val initials: String,
    val identityChip: ConversationIdentityChip?,
    val verified: Boolean,
    val snippet: String,
    val matchedMessageId: String?,
    val query: String,
)

/**
 * Pure text helpers for matching, snippet-windowing, and highlight
 * rendering. Kept free of view state so the rules are unit-testable and
 * mirror the iOS `ChatSearchText` helper.
 */
object ChatSearchText {
    /** Case-insensitive containment — the single matching rule used for
     *  names, bodies, and the highlight scan so search and highlight never
     *  disagree about what counts as a hit. */
    fun matches(
        haystack: String,
        query: String,
    ): Boolean {
        val q = query.trim()
        return q.isNotEmpty() && haystack.contains(q, ignoreCase = true)
    }

    /** Build a snippet centred on the first match. Short bodies are
     *  returned whole; long bodies are windowed with leading/trailing
     *  ellipses so the matched term stays visible in the row's two lines. */
    fun snippet(
        body: String,
        query: String,
        maxLength: Int = DEFAULT_SNIPPET_LENGTH,
    ): String {
        val collapsed = body.trim().replace("\n", " ")
        val q = query.trim()
        if (collapsed.length <= maxLength) return collapsed
        val matchIndex = if (q.isEmpty()) -1 else collapsed.indexOf(q, ignoreCase = true)
        if (matchIndex < 0) return collapsed.take(maxLength) + "…"
        val start = maxOf(0, matchIndex - SNIPPET_LEAD)
        val window = collapsed.substring(start)
        val truncated = window.take(maxLength)
        val prefix = if (start > 0) "…" else ""
        val suffix = if (truncated.length < window.length) "…" else ""
        return prefix + truncated + suffix
    }

    /** Render [text] with every case-insensitive occurrence of [query]
     *  bolded and tinted — colour paired WITH weight so the highlight
     *  reads without relying on colour alone. */
    fun highlighted(
        text: String,
        query: String,
    ): AnnotatedString {
        val q = query.trim()
        if (q.isEmpty()) return AnnotatedString(text)
        return buildAnnotatedString {
            var index = 0
            while (index <= text.length) {
                val match = text.indexOf(q, startIndex = index, ignoreCase = true)
                if (match < 0) {
                    append(text.substring(index))
                    break
                }
                append(text.substring(index, match))
                withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = PantopusColors.primary700)) {
                    append(text.substring(match, match + q.length))
                }
                index = match + q.length
            }
        }
    }

    private const val DEFAULT_SNIPPET_LENGTH = 90
    private const val SNIPPET_LEAD = 24
}

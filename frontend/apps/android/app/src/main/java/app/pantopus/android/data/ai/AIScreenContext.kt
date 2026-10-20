package app.pantopus.android.data.ai

import org.json.JSONArray
import org.json.JSONObject

/**
 * What the person was looking at when they tapped Ask Pantopus (AI assistant phase 1 contract, section 6).
 * It rides with the thread's messages as `context`, so the server adds that screen's facts under the
 * person's own access. [label] is the thread's "About: …" line and [starters] the prompts it offers
 * first (section 7). Context never changes what the person can see or do.
 */
data class AIScreenContext(
    /** `today`, `place`, `nearby`, `post`, `plans` or `plan`. */
    val surface: String,
    /** The post's or the plan's id. */
    val id: String? = null,
    val homeId: String? = null,
    /** A Place detail page's slug (`today`, `your-home`, `risk`, `block`, `money`, `civic`). */
    val section: String? = null,
    val label: String,
    val starters: List<String> = emptyList(),
) {
    /** The `context` object of `POST /api/ai/chat`. */
    fun toRequestJson(): JSONObject =
        JSONObject().put("surface", surface).apply {
            id?.let { put("id", it) }
            homeId?.let { put("home_id", it) }
            section?.let { put("section", it) }
        }

    /** The assistant thread's route argument. */
    fun encode(): String = toRequestJson().put("label", label).put("starters", JSONArray(starters)).toString()

    companion object {
        /** A route argument written by [encode]; null when it is empty or unreadable. */
        fun decode(raw: String?): AIScreenContext? {
            if (raw.isNullOrBlank()) return null
            val json = runCatching { JSONObject(raw) }.getOrNull() ?: return null
            val surface = json.textOrNull("surface") ?: return null
            val starters = json.optJSONArray("starters")
            return AIScreenContext(
                surface = surface,
                id = json.textOrNull("id"),
                homeId = json.textOrNull("home_id"),
                section = json.textOrNull("section"),
                label = json.textOrNull("label") ?: surface,
                starters = (0 until (starters?.length() ?: 0)).mapNotNull { starters?.optString(it)?.takeIf(String::isNotBlank) },
            )
        }

        /** The box at the top of Today. */
        fun today(homeId: String?): AIScreenContext =
            AIScreenContext(
                surface = "today",
                homeId = homeId,
                label = "Today",
                starters = listOf("What do I need to know today?", "Is it a good day to…", "Set my pickup days"),
            )

        /** Place, or one of its section pages when [section] is set. */
        fun place(
            homeId: String,
            section: String?,
            label: String,
        ): AIScreenContext =
            AIScreenContext(
                surface = "place",
                homeId = homeId,
                section = section,
                label = label,
                starters = listOf("What does this mean for us?", "What should we do this season?", "Remind us…"),
            )

        /** The Nearby feed. */
        fun nearby(): AIScreenContext =
            AIScreenContext(
                surface = "nearby",
                label = "Nearby",
                starters = listOf("What did I miss this week?", "Help me post something", "Who do neighbors recommend…"),
            )

        /** The Plans tab, map or list. */
        fun plans(): AIScreenContext =
            AIScreenContext(
                surface = "plans",
                label = "Plans",
                starters = listOf("Find something this weekend", "Host a plan", "What's coming up for me?"),
            )

        /** A plan's page; its host gets the host's prompts. */
        fun plan(
            id: String,
            title: String,
            hosting: Boolean,
        ): AIScreenContext =
            AIScreenContext(
                surface = "plan",
                id = id,
                label = title,
                starters =
                    if (hosting) {
                        listOf("Who wants to join?", "Message everyone", "Move it")
                    } else {
                        listOf("Ask to join", "What should I bring?")
                    },
            )

        /** A post's page. */
        fun post(
            id: String,
            title: String,
        ): AIScreenContext =
            AIScreenContext(
                surface = "post",
                id = id,
                label = title,
                starters = listOf("Draft a reply", "Sum up the replies"),
            )

        private fun JSONObject.textOrNull(name: String): String? = if (isNull(name)) null else optString(name).trim().ifEmpty { null }
    }
}

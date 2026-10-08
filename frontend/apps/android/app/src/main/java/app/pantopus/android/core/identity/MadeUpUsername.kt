package app.pantopus.android.core.identity

/**
 * Nobody picks a username at sign-up, so the server makes one up: `user_` plus 12 random hex characters
 * (20 when the short form collides). It says nothing about the person, so it never stands in for their name
 * and is never shown as "@…". Same rule as `backend/utils/personalUsername.js`, web `@pantopus/utils` and
 * iOS `MadeUpUsername.swift`.
 */
object MadeUpUsername {
    private val pattern = Regex("^user_(?:[0-9a-f]{12}|[0-9a-f]{20})$")

    /** True for a username the server made up, never for one a person chose. */
    fun isMadeUp(username: String?): Boolean = username?.trim()?.let { pattern.matches(it) } ?: false

    /** The username when the person chose it; null for an empty or made-up one. */
    fun chosen(username: String?): String? {
        val value = username?.trim()?.trimStart('@').orEmpty()
        return if (value.isEmpty() || isMadeUp(value)) null else value
    }

    /** "@username" for a username the person chose; null otherwise (show nothing). */
    fun handle(username: String?): String? = chosen(username)?.let { "@$it" }
}

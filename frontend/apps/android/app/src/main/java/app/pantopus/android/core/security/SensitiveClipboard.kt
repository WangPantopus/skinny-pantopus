package app.pantopus.android.core.security

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.PersistableBundle

/**
 * Invite links, access codes and bearer links (residency, fridge-card and live-status links) go on the clipboard
 * marked sensitive, as passwords do: Android 13+ then hides them in the copy preview and keyboard suggestions.
 * Android has no expiry for a clip (iOS's [SensitivePasteboard] counterpart has one); 13+ clears it on its own.
 */
object SensitiveClipboard {
    /** `ClipDescription.EXTRA_IS_SENSITIVE` (API 33); keyboards read the same key on earlier versions. */
    private const val EXTRA_IS_SENSITIVE = "android.content.extra.IS_SENSITIVE"

    /** Copies [text] under [label]. False when the clipboard refused it. */
    fun copy(
        context: Context,
        label: String,
        text: String,
    ): Boolean {
        val clipboard = context.getSystemService(ClipboardManager::class.java) ?: return false
        val clip = ClipData.newPlainText(label, text)
        clip.description.extras = PersistableBundle().apply { putBoolean(EXTRA_IS_SENSITIVE, true) }
        return runCatching { clipboard.setPrimaryClip(clip) }.isSuccess
    }
}

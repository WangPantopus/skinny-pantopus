@file:Suppress("MatchingDeclarationName", "TooManyFunctions")

package app.pantopus.android.ui.components

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.ContactsContract
import androidx.activity.compose.ManagedActivityResultLauncher
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.PickContact
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext

/**
 * P6.6 — system surfaces port of iOS `Core/Design/Components/SystemSheets.swift`.
 *
 * iOS leans on `UIActivityViewController` (share) +
 * `MFMailComposeViewController` (mail) + `CNContactPickerViewController`
 * (contact picker). The Android equivalents are intent-based:
 *   - share  → `Intent.ACTION_SEND` chooser
 *   - mail   → `Intent.ACTION_SENDTO` with `mailto:` URI (falls back to
 *              plain share when no mail app is installed)
 *   - picker → `ActivityResultContracts.PickContact` (no runtime
 *              permission needed; selection runs out-of-process and only
 *              the picked contact is returned to us, matching iOS).
 *
 * The shape of the public API (`MailDraft`, `PickedContact`,
 * `SystemSheetRequest`, `InviteLinks`) mirrors iOS so feature code can be
 * mechanically translated.
 */

// MARK: - Invite copy / links ────────────────────────────────────────────

/**
 * Single source of truth for the invite message + download link shared by
 * every "Invite to Pantopus" / "Find people" surface. Swap
 * [DOWNLOAD_URL] for the real Play Store / App Store smart-link when it
 * ships.
 */
object InviteLinks {
    const val DOWNLOAD_URL = "https://pantopus.app"

    const val INVITE_MESSAGE =
        "Join me on Pantopus — your neighborhood for trusted home help, " +
            "local gigs, and your whole household in one place. $DOWNLOAD_URL"
}

// MARK: - Mail compose ───────────────────────────────────────────────────

/**
 * Draft payload for the system mail composer. Carries a [mailtoUri]
 * fallback for devices with no configured Mail account.
 */
data class MailDraft(
    val subject: String,
    val body: String,
    val recipients: List<String> = emptyList(),
) {
    /**
     * `mailto:…` string for [Intent.ACTION_SENDTO]. Recipients are
     * comma-joined per RFC 6068. Pure string so unit tests don't need the
     * Android URI runtime.
     */
    val mailtoUriString: String
        get() {
            val to = recipients.joinToString(",") { percentEncode(it) }
            val query =
                buildString {
                    append("?subject=").append(percentEncode(subject))
                    append("&body=").append(percentEncode(body))
                }
            return "mailto:$to$query"
        }

    /** [mailtoUriString] wrapped in a [Uri] for `Intent.ACTION_SENDTO`. */
    val mailtoUri: Uri get() = Uri.parse(mailtoUriString)
}

/**
 * RFC 3986 percent-encoding that matches `Uri.encode(s)` byte-for-byte
 * for the characters that appear in subject / body / email fields.
 * Kept pure-Kotlin so it stays unit-testable on the JVM.
 */
internal fun percentEncode(value: String): String =
    java.net.URLEncoder
        .encode(value, Charsets.UTF_8.name())
        // URLEncoder uses application/x-www-form-urlencoded; convert
        // back to RFC 3986 (`Uri.encode` flavour) by undoing the
        // form-encoding quirks.
        .replace("+", "%20")
        .replace("*", "%2A")
        .replace("%7E", "~")

// MARK: - Contact picker ─────────────────────────────────────────────────

/** A contact the user selected from the system picker. */
data class PickedContact(
    val name: String,
    val phone: String?,
    val email: String?,
)

/**
 * Activity-result launcher that opens the system contacts picker and
 * delivers a [PickedContact] (or `null` if the user backed out).
 *
 * Compose-friendly wrapper around `ActivityResultContracts.PickContact`.
 * No `READ_CONTACTS` permission needed — the picker runs out-of-process
 * and only returns the chosen contact.
 *
 * ```kotlin
 * val picker = rememberContactPicker { contact ->
 *     contact?.let(viewModel::onContactPicked)
 * }
 * Button(onClick = { picker.launch(null) }) { Text("Find people") }
 * ```
 */
@Composable
fun rememberContactPicker(onPicked: (PickedContact?) -> Unit = {}): ManagedActivityResultLauncher<Void?, Uri?> {
    val context = LocalContext.current
    return rememberLauncherForActivityResult(PickContact()) { uri ->
        if (uri == null) {
            onPicked(null)
        } else {
            onPicked(readContact(context, uri))
        }
    }
}

private fun readContact(
    context: Context,
    uri: Uri,
): PickedContact? {
    val projection =
        arrayOf(
            ContactsContract.Contacts.DISPLAY_NAME,
            ContactsContract.Contacts._ID,
        )
    context.contentResolver.query(uri, projection, null, null, null)?.use { cursor ->
        if (!cursor.moveToFirst()) return null
        val name = cursor.getString(0).orEmpty()
        val contactId = cursor.getString(1).orEmpty()
        val phone = readPhone(context, contactId)
        val email = readEmail(context, contactId)
        return PickedContact(name = name, phone = phone, email = email)
    }
    return null
}

private fun readPhone(
    context: Context,
    contactId: String,
): String? {
    val phoneProjection = arrayOf(ContactsContract.CommonDataKinds.Phone.NUMBER)
    val selection = ContactsContract.CommonDataKinds.Phone.CONTACT_ID + " = ?"
    context.contentResolver
        .query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            phoneProjection,
            selection,
            arrayOf(contactId),
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) return cursor.getString(0)
        }
    return null
}

private fun readEmail(
    context: Context,
    contactId: String,
): String? {
    val emailProjection = arrayOf(ContactsContract.CommonDataKinds.Email.ADDRESS)
    val selection = ContactsContract.CommonDataKinds.Email.CONTACT_ID + " = ?"
    context.contentResolver
        .query(
            ContactsContract.CommonDataKinds.Email.CONTENT_URI,
            emailProjection,
            selection,
            arrayOf(contactId),
            null,
        )?.use { cursor ->
            if (cursor.moveToFirst()) return cursor.getString(0)
        }
    return null
}

// MARK: - Share + mail invocations ───────────────────────────────────────

/** Fire the system share sheet for plain text ([Intent.ACTION_SEND]). */
fun Context.shareText(
    text: String,
    chooserTitle: String = DEFAULT_SHARE_TITLE,
) {
    val intent =
        Intent(Intent.ACTION_SEND).apply {
            type = TEXT_PLAIN
            putExtra(Intent.EXTRA_TEXT, text)
        }
    startActivity(Intent.createChooser(intent, chooserTitle))
}

/** Fire the system share sheet for a `content://` file. */
fun Context.shareFile(
    uri: Uri,
    mimeType: String,
    chooserTitle: String = DEFAULT_SHARE_TITLE,
) {
    val intent =
        Intent(Intent.ACTION_SEND).apply {
            type = mimeType
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    startActivity(Intent.createChooser(intent, chooserTitle))
}

/** Fire the invite share sheet (text + landing link). */
fun Context.shareInvite() {
    shareText(InviteLinks.INVITE_MESSAGE, chooserTitle = "Invite to Pantopus")
}

/**
 * Open the system mail composer with the provided draft. Falls back to
 * [shareText] (subject + body) when no mail app is configured.
 */
fun Context.composeMail(draft: MailDraft) {
    val intent = Intent(Intent.ACTION_SENDTO, draft.mailtoUri)
    try {
        startActivity(intent)
    } catch (_: ActivityNotFoundException) {
        shareText("${draft.subject}\n\n${draft.body}")
    }
}

/**
 * Legacy positional overload kept so existing call sites (`composeEmail(
 * subject, body, recipient)`) don't need a refactor while the codebase
 * migrates to [MailDraft].
 */
fun Context.composeEmail(
    subject: String,
    body: String,
    recipient: String? = null,
) {
    val draft =
        MailDraft(
            subject = subject,
            body = body,
            recipients = recipient?.let { listOf(it) }.orEmpty(),
        )
    composeMail(draft)
}

// MARK: - SystemSheetRequest (share / mail) ──────────────────────────────

/**
 * A single request payload covering the two iOS-style sheet surfaces.
 * Mirrors iOS `SystemSheetRequest` so feature view-models can model
 * "what would I show next" without owning the dispatch path.
 *
 * On Android there's no equivalent of iOS's `.sheet(item:)` modifier
 * driving a single sheet for both — we just dispatch via [launchOn].
 */
sealed interface SystemSheetRequest {
    data class Share(
        val text: String,
        val title: String = DEFAULT_SHARE_TITLE,
    ) : SystemSheetRequest

    data class ShareFile(
        val uri: Uri,
        val mimeType: String,
        val title: String = DEFAULT_SHARE_TITLE,
    ) : SystemSheetRequest

    data class Mail(
        val draft: MailDraft,
    ) : SystemSheetRequest
}

/** Helper composable that remembers a context-bound dispatcher. */
@Composable
fun rememberSystemSheetDispatcher(): (SystemSheetRequest) -> Unit {
    val context = LocalContext.current
    return remember(context) {
        { request -> request.launchOn(context) }
    }
}

/** Dispatch this request to the platform. */
fun SystemSheetRequest.launchOn(context: Context) {
    when (this) {
        is SystemSheetRequest.Share -> context.shareText(text, title)
        is SystemSheetRequest.ShareFile -> context.shareFile(uri, mimeType, title)
        is SystemSheetRequest.Mail -> context.composeMail(draft)
    }
}

private const val TEXT_PLAIN = "text/plain"
private const val DEFAULT_SHARE_TITLE = "Share"

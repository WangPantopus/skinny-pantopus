package app.pantopus.android.ui.screens.mailbox.cards

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.ContactsContract
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

/**
 * "Choose from contacts" (plan 11.7): the system's pick-a-contact screen, showing email addresses. It hands back the one
 * address chosen, with no permission prompt (the picker lends this app that one row), and nothing else is read or kept.
 * Returns what opens it; [onEmail] gets the address, or nothing if they back out or there's no contacts app.
 */
@Composable
internal fun rememberContactEmailPicker(onEmail: (String) -> Unit): () -> Unit {
    val context = LocalContext.current
    val launcher =
        rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            result.data?.data?.let { uri -> pickedEmail(context, uri) }?.let(onEmail)
        }
    return {
        runCatching { launcher.launch(Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Email.CONTENT_URI)) }
    }
}

/** The one address the picker lent, read once. */
private fun pickedEmail(
    context: Context,
    uri: Uri,
): String? =
    runCatching {
        context.contentResolver
            .query(uri, arrayOf(ContactsContract.CommonDataKinds.Email.ADDRESS), null, null, null)
            ?.use { row -> if (row.moveToFirst()) row.getString(0) else null }
    }.getOrNull()?.trim()?.takeIf { '@' in it }

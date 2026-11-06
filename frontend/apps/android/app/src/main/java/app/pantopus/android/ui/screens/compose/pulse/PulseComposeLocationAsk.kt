package app.pantopus.android.ui.screens.compose.pulse

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Android's `ACCESS_MEDIA_LOCATION`: where a picked photo or video was taken.
 * Asked for once on a phone, and only after someone attaches a photo whose
 * location Android hides, because Android's prompt speaks of all their photos
 * and videos. It gives the app no other photos (measured on Android 16 and 17).
 */
internal object MediaLocationAccess {
    /** Android hides nothing before Android 10, so there's nothing to hold there. */
    fun isHeld(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_MEDIA_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    fun mayAsk(context: Context): Boolean = !isHeld(context) && !prefs(context).getBoolean(ASKED_KEY, false)

    fun markAsked(context: Context) {
        prefs(context).edit().putBoolean(ASKED_KEY, true).apply()
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private const val PREFS = "pantopus.media_location"
    private const val ASKED_KEY = "asked"
}

/** The composer's side of [MediaLocationAccess]. */
internal class PulseComposeLocationAsk(
    val isShowing: Boolean,
    /** New attachments are in the draft: a photo hiding its location starts the ask. */
    val onAttached: (List<PulseComposePhoto>) -> Unit,
    val onAnswer: (allow: Boolean) -> Unit,
)

@Composable
internal fun rememberPulseComposeLocationAsk(viewModel: PulseComposeViewModel): PulseComposeLocationAsk {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var isShowing by rememberSaveable { mutableStateOf(false) }
    // Once allowed, what's already in the draft counts without being attached again. Refusing changes nothing.
    val permission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                scope.launch {
                    viewModel.photos.value.forEach { photo ->
                        val uri = photo.locationSource ?: return@forEach
                        withContext(Dispatchers.IO) { readPickedPlace(context, uri, photo.mimeType) }
                            .captured
                            ?.let { viewModel.placeAttachment(photo.id, it) }
                    }
                }
            }
        }
    return PulseComposeLocationAsk(
        isShowing = isShowing,
        onAttached = { photos ->
            // A video's hidden location leaves no mark, so only a photo starts the ask. Edits can't place a post.
            val hidesLocation = photos.any { it.mimeType.startsWith("image/") && it.locationSource != null }
            if (hidesLocation && !viewModel.isEditing && MediaLocationAccess.mayAsk(context)) isShowing = true
        },
        onAnswer = { allow ->
            isShowing = false
            MediaLocationAccess.markAsked(context)
            if (allow) permission.launch(Manifest.permission.ACCESS_MEDIA_LOCATION)
        },
    )
}

/** Pantopus's own words before Android's prompt, which claims more than the permission gives. */
@Composable
internal fun PulseComposeLocationAskDialog(ask: PulseComposeLocationAsk) {
    if (!ask.isShowing) return
    AlertDialog(
        onDismissRequest = { ask.onAnswer(false) },
        title = { Text("Post where this photo was taken?") },
        text = {
            Text(
                "Android will ask about your photos and videos next. Pantopus still sees only the ones you pick, " +
                    "and this lets it read where they were taken.",
            )
        },
        confirmButton = {
            TextButton(onClick = { ask.onAnswer(true) }, modifier = Modifier.testTag("composeLocationAskContinue")) {
                Text("Continue")
            }
        },
        dismissButton = {
            TextButton(onClick = { ask.onAnswer(false) }, modifier = Modifier.testTag("composeLocationAskNotNow")) {
                Text("Not now")
            }
        },
        modifier = Modifier.testTag("composeLocationAsk"),
    )
}

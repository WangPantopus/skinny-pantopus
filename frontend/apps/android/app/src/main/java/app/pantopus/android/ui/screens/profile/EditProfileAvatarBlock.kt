@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.profile

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * A13.9 §① "Avatar + cover" — the 92dp avatar with a camera badge and a
 * "Change photo" text button, per
 * `A13 — Form (single screen)/edit-profile-frames.jsx:52-90`. Mirrors iOS
 * `EditProfileAvatarBlock`.
 *
 * Tapping the avatar or the button opens the Android Photo Picker
 * ([ActivityResultContracts.PickVisualMedia]), whose out-of-process UI
 * needs no `READ_MEDIA_IMAGES` grant. What *can* still fail is opening the
 * returned `Uri` — a revoked grant, or a cloud-backed file that won't
 * materialise. That path reports `bytes = null` so the view-model can
 * render a real error instead of a silent no-op.
 */
@Composable
internal fun EditProfileAvatarBlock(
    avatarUrl: String?,
    initial: String,
    state: EditProfileAvatarState,
    onPicked: (ByteArray?, String, String) -> Unit,
    onDismissError: () -> Unit,
    scope: CoroutineScope,
) {
    val context = LocalContext.current
    val uploading = state is EditProfileAvatarState.Uploading
    val picker =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.PickVisualMedia(),
        ) { uri: Uri? ->
            // A null Uri is a plain cancel, not a failure — stay silent.
            if (uri == null) return@rememberLauncherForActivityResult
            val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
            val filename = "profile-${System.currentTimeMillis()}.${extensionFor(mimeType)}"
            scope.launch {
                val bytes =
                    withContext(Dispatchers.IO) {
                        runCatching {
                            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        }.getOrNull()
                    }
                onPicked(bytes, filename, mimeType)
            }
        }
    val openPicker = {
        if (!uploading) {
            picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(
            modifier =
                Modifier
                    .size(92.dp)
                    .clickable(enabled = !uploading, onClick = openPicker)
                    .testTag("editProfileAvatar")
                    .semantics { contentDescription = "Profile photo. Opens the photo picker." },
        ) {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .clip(CircleShape)
                        .background(PantopusColors.personalBg)
                        .alpha(if (uploading) 0.6f else 1f),
                contentAlignment = Alignment.Center,
            ) {
                if (avatarUrl.isNullOrBlank()) {
                    AvatarInitial(initial)
                } else {
                    SubcomposeAsyncImage(
                        model = avatarUrl,
                        contentDescription = null,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize(),
                        loading = { AvatarInitial(initial) },
                        error = { AvatarInitial(initial) },
                    )
                }
            }
            Box(
                modifier =
                    Modifier
                        .align(Alignment.BottomEnd)
                        .size(30.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurface)
                        .border(2.dp, PantopusColors.appBg, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Camera,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.primary600,
                )
            }
        }

        Row(
            modifier =
                Modifier
                    .heightIn(min = 44.dp)
                    .clickable(enabled = !uploading, onClick = openPicker)
                    .testTag("editProfileChangePhotoButton"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            if (uploading) {
                CircularProgressIndicator(
                    color = PantopusColors.primary600,
                    strokeWidth = 2.dp,
                    modifier = Modifier.size(15.dp),
                )
                Text(
                    text = "Uploading…",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextSecondary,
                )
            } else {
                Text(
                    text = "Change photo",
                    style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.primary600,
                )
            }
        }

        if (state is EditProfileAvatarState.Failed) {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .testTag("editProfileAvatarError"),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Text(
                    text = state.message,
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.error,
                    textAlign = TextAlign.Center,
                )
                Text(
                    text = "Dismiss",
                    style = PantopusTextStyle.caption.copy(fontWeight = FontWeight.SemiBold),
                    color = PantopusColors.appTextSecondary,
                    modifier =
                        Modifier
                            .clickable(onClick = onDismissError)
                            .semantics { contentDescription = "Dismiss photo error" },
                )
            }
        }
    }
}

@Composable
private fun AvatarInitial(initial: String) {
    Text(
        text = initial,
        fontSize = 30.sp,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.personal,
    )
}

private fun extensionFor(mimeType: String): String =
    when (mimeType.lowercase()) {
        "image/png" -> "png"
        "image/webp" -> "webp"
        "image/heic", "image/heif" -> "heic"
        else -> "jpg"
    }

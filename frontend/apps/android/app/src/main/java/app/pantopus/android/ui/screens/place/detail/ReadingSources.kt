package app.pantopus.android.ui.screens.place.detail

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import java.io.File
import java.util.UUID

/** How a reader (a hauler's flyer, a radon lab report) gets its photo or PDF. */
internal class ReadingSources(
    val hasCamera: Boolean,
    val takePhoto: () -> Unit,
    val choosePhoto: () -> Unit,
    val choosePdf: () -> Unit,
)

/**
 * The camera, which writes into a cache file that is deleted once read, the photo picker and the
 * document picker for PDFs. [onLeave] runs just before the app hands over to one of them and
 * [onCancel] when one comes back with nothing. [read] gets the photo or PDF and what to do once the
 * reading is over.
 */
@Composable
internal fun rememberReadingSources(
    cacheName: String,
    onLeave: () -> Unit = {},
    onCancel: () -> Unit = {},
    read: (Uri, () -> Unit) -> Unit,
): ReadingSources {
    val context = LocalContext.current
    // Saveable so a process death during capture still finds the file.
    var cameraFile by rememberSaveable { mutableStateOf<String?>(null) }
    val chosen: (Uri?) -> Unit = { uri -> if (uri != null) read(uri) {} else onCancel() }
    val library = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia(), chosen)
    val documents = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument(), chosen)
    val camera =
        rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
            val file = cameraFile?.let(::File)
            cameraFile = null
            when {
                file == null -> onCancel()
                // The photo is only needed until it's read.
                taken -> read(FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)) { file.delete() }
                else -> {
                    file.delete()
                    onCancel()
                }
            }
        }
    val takePhoto = {
        val file = File(context.cacheDir, "$cacheName-${UUID.randomUUID()}.jpg")
        cameraFile = file.path
        onLeave()
        // No camera app (or a broken resolver) must not crash the screen.
        runCatching { camera.launch(FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)) }
            .onFailure {
                cameraFile = null
                onCancel()
            }
        Unit
    }
    // CAMERA is declared in the manifest, so the TakePicture intent needs the runtime grant.
    val cameraPermission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) takePhoto() else onCancel()
        }
    val hasCamera = remember(context) { context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) }
    return ReadingSources(
        hasCamera = hasCamera,
        takePhoto = {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                takePhoto()
            } else {
                onLeave()
                cameraPermission.launch(Manifest.permission.CAMERA)
            }
        },
        choosePhoto = {
            onLeave()
            library.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        },
        choosePdf = {
            onLeave()
            documents.launch(arrayOf("application/pdf"))
        },
    )
}

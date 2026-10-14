package app.pantopus.android.ui.screens.place.detail

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import app.pantopus.android.data.ai.PickupFlyerReading
import app.pantopus.android.data.api.models.ai.AIPickupScheduleReadingDto
import app.pantopus.android.ui.components.GhostButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

/**
 * "Read a flyer" at the top of the pickup editor: a photo of the household's hauler's flyer, taken
 * now or chosen from the library, fills in the editor's fields through [onRead]. The reading saves
 * nothing; the person checks the days and taps Save schedule. Mirrors iOS `AddressCalendarCard.flyerControl`.
 */
@Composable
internal fun PickupFlyerControl(
    actions: AddressCalendarActions,
    enabled: Boolean,
    onReadingChange: (Boolean) -> Unit,
    onRead: (AIPickupScheduleReadingDto) -> Unit,
) {
    val scope = rememberCoroutineScope()
    var reading by remember { mutableStateOf(false) }
    var message by rememberSaveable { mutableStateOf<String?>(null) }
    var failed by rememberSaveable { mutableStateOf(false) }
    var choosing by remember { mutableStateOf(false) }
    val sources =
        rememberFlyerPhotoSources { photo, afterwards ->
            reading = true
            onReadingChange(true)
            message = null
            scope.launch {
                try {
                    when (val result = actions.readPickupFlyer(photo)) {
                        is PickupFlyerReading.Read -> {
                            onRead(result.schedule)
                            message =
                                listOfNotNull(result.schedule.summary, result.note, "Check the days, then tap Save schedule.")
                                    .joinToString(" ")
                            failed = false
                        }
                        is PickupFlyerReading.Failed -> {
                            message = result.message
                            failed = true
                        }
                        null -> Unit
                    }
                } finally {
                    afterwards()
                    reading = false
                    onReadingChange(false)
                }
            }
        }

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Box {
            GhostButton(
                "Read a flyer",
                onClick = { if (sources.hasCamera) choosing = true else sources.choosePhoto() },
                modifier = Modifier.fillMaxWidth().testTag("addressCalendarReadFlyer"),
                isLoading = reading,
                isEnabled = enabled && !reading,
            )
            DropdownMenu(expanded = choosing, onDismissRequest = { choosing = false }) {
                DropdownMenuItem(text = { Text("Take a photo") }, onClick = {
                    choosing = false
                    sources.takePhoto()
                })
                DropdownMenuItem(text = { Text("Choose a photo") }, onClick = {
                    choosing = false
                    sources.choosePhoto()
                })
            }
        }
        val shown = if (reading) "Reading the flyer…" else message
        if (shown != null) {
            Text(
                shown,
                fontSize = 12.sp,
                color =
                    when {
                        reading -> PantopusColors.appTextSecondary
                        failed -> PantopusColors.error
                        else -> PantopusColors.appText
                    },
                modifier = Modifier.testTag("addressCalendarFlyerMessage").semantics { liveRegion = LiveRegionMode.Polite },
            )
        }
    }
}

/** The ways to hand over a flyer photo. */
private class FlyerPhotoSources(
    val hasCamera: Boolean,
    val takePhoto: () -> Unit,
    val choosePhoto: () -> Unit,
)

/**
 * The camera, which writes into a cache file that is deleted once read, and the photo picker. [read] gets
 * the photo and what to do once the reading is over.
 */
@Composable
private fun rememberFlyerPhotoSources(read: (Uri, () -> Unit) -> Unit): FlyerPhotoSources {
    val context = LocalContext.current
    // Saveable so a process death during capture still finds the file.
    var cameraFile by rememberSaveable { mutableStateOf<String?>(null) }
    val library =
        rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
            if (uri != null) read(uri) {}
        }
    val camera =
        rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
            val file = cameraFile?.let(::File)
            cameraFile = null
            when {
                file == null -> Unit
                // The photo is only needed until it's read.
                taken -> read(FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)) { file.delete() }
                else -> file.delete()
            }
        }
    val takePhoto = {
        val file = File(context.cacheDir, "pickup-flyer-${UUID.randomUUID()}.jpg")
        cameraFile = file.path
        // No camera app (or a broken resolver) must not crash the editor.
        runCatching { camera.launch(FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)) }
            .onFailure { cameraFile = null }
        Unit
    }
    // CAMERA is declared in the manifest, so the TakePicture intent needs the runtime grant.
    val cameraPermission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) takePhoto()
        }
    val hasCamera = remember(context) { context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) }
    return FlyerPhotoSources(
        hasCamera = hasCamera,
        takePhoto = {
            val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
            if (granted) takePhoto() else cameraPermission.launch(Manifest.permission.CAMERA)
        },
        choosePhoto = { library.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
    )
}

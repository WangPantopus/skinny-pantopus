@file:Suppress("LongMethod")

package app.pantopus.android.ui.screens.crewday.route

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.crewday.CrewDayHomeDto
import app.pantopus.android.data.crewday.CrewDayCameraPhotos
import app.pantopus.android.data.crewday.CrewDayFormat
import app.pantopus.android.ui.components.ErrorState
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.ToastController
import app.pantopus.android.ui.components.ToastHost
import app.pantopus.android.ui.screens.crewday.components.CrewDayFlowScaffold
import app.pantopus.android.ui.screens.crewday.components.CrewDayListPlaceholder
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.screens.plans.components.PlanTonalButton
import app.pantopus.android.ui.screens.plans.detail.PlanRoundButton
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/**
 * One home (screen 17, board `RouteHome`): "123 Maple Lane", "3 of 6"; the address with Open in Maps; the job;
 * access (and "Gate is ready" when the household tapped it); photos (at least one, camera or library, up to eight);
 * the note for the household; Mark done (once there's a photo) and Can't get in.
 */
@Composable
fun CrewDayHomeScreen(
    onBack: () -> Unit,
    viewModel: CrewDayHomeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val toast = remember { ToastController() }
    var cantGetIn by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { viewModel.load() }
    LaunchedEffect(state.notice) {
        state.notice?.let {
            toast.info(it)
            viewModel.noticeShown()
        }
    }
    val library =
        rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(CrewDayHomeState.MAX_PHOTOS)) { uris ->
            scope.launch {
                uris.forEach { uri ->
                    val bytes = withContext(Dispatchers.IO) { context.contentResolver.openInputStream(uri)?.use { it.readBytes() } }
                    bytes?.let(viewModel::addPhoto)
                }
            }
        }
    // The camera app writes into a cache file shared through the FileProvider (crew-day-camera/); its bytes are read
    // and the file deleted at once. Saveable, so the photo still lands if the app was stopped while the camera was open.
    var pendingFile by rememberSaveable { mutableStateOf<String?>(null) }
    val camera =
        rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { taken ->
            val file = pendingFile?.let(::File)
            pendingFile = null
            scope.launch {
                val bytes = withContext(Dispatchers.IO) { file?.takeIf { taken }?.readBytes().also { file?.delete() } }
                bytes?.let(viewModel::addPhoto)
            }
        }
    val cameraPermission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (!granted) return@rememberLauncherForActivityResult
            val file = CrewDayCameraPhotos.newFile(context.cacheDir)
            pendingFile = file.absolutePath
            val opened = runCatching { camera.launch(FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)) }
            if (opened.isFailure) {
                pendingFile = null
                file.delete()
            }
        }
    val canTakePhoto = remember { context.packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) }
    val home = state.home
    val route = state.route
    CrewDayFlowScaffold(
        title = home?.address?.line ?: home?.label ?: "Home",
        onBack = onBack,
        step = route?.let { "${state.position} of ${it.homes.size}" },
        modifier = Modifier.testTag("crewDayRouteHome"),
        footer =
            home?.takeIf { !state.isDone }?.let {
                {
                    state.error?.let { error ->
                        Text(
                            text = error,
                            style = PantopusTextStyle.small,
                            color = PantopusColors.error,
                            modifier = Modifier.testTag("crewDayRouteHomeError"),
                        )
                    }
                    PrimaryButton(
                        title = "Mark done",
                        onClick = viewModel::markDone,
                        isEnabled = state.canMarkDone,
                        isLoading = state.saving,
                        modifier = Modifier.fillMaxWidth().testTag("crewDayRouteHomeDone"),
                    )
                    PlanTonalButton(
                        title = "Can't get in",
                        onClick = { cantGetIn = true },
                        height = 44.dp,
                        enabled = !state.saving,
                        modifier = Modifier.testTag("crewDayRouteHomeCantGetIn"),
                    )
                }
            },
    ) {
        when {
            home != null ->
                HomeContent(
                    home = home,
                    state = state,
                    context = context,
                    viewModel = viewModel,
                    canTakePhoto = canTakePhoto,
                    onCamera = { cameraPermission.launch(Manifest.permission.CAMERA) },
                    onLibrary = { library.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                )
            state.loadError != null ->
                ErrorState(
                    headline = "Couldn't load this home",
                    message = state.loadError.orEmpty(),
                    onRetry = viewModel::load,
                    modifier = Modifier.heightIn(min = 360.dp).testTag("crewDayLoadError"),
                )
            else -> CrewDayListPlaceholder(modifier = Modifier.testTag("crewDayLoading"))
        }
    }
    if (cantGetIn) {
        CantGetInDialog(
            onSend = { note ->
                cantGetIn = false
                viewModel.cantGetIn(note)
            },
            onDismiss = { cantGetIn = false },
        )
    }
    ToastHost(controller = toast)
}

@Composable
private fun HomeContent(
    home: CrewDayHomeDto,
    state: CrewDayHomeState,
    context: Context,
    viewModel: CrewDayHomeViewModel,
    canTakePhoto: Boolean,
    onCamera: () -> Unit,
    onLibrary: () -> Unit,
) {
    val zone = CrewDayFormat.zone(state.route?.timezone)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
        home.address?.let { address ->
            PlanFormCard {
                PlanOptionRow(first = true) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = listOfNotNull(address.line, home.firstName).joinToString(" · "),
                            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.appText,
                        )
                        Text(
                            text = listOfNotNull(address.city, address.state, address.zip).joinToString(", "),
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                    PlanTextButton(
                        title = "Open in Maps",
                        onClick = { context.openInMaps(home) },
                        modifier = Modifier.fillMaxWidth(0.42f).testTag("crewDayRouteHomeMaps"),
                    )
                }
            }
        }
        PlanField("The job") {
            PlanFormCard(modifier = Modifier.testTag("crewDayRouteHomeJob")) {
                val option = home.lineItems.firstOrNull { it.kind == "option" }?.label
                val addOns = home.lineItems.filter { it.kind == "add_on" }.map { it.label }
                PlanOptionRow(first = true) {
                    Column(modifier = Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
                        Text(
                            text = option ?: home.details?.takeIf { it.isNotBlank() } ?: "As booked",
                            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.appText,
                        )
                        addOns.forEach {
                            Text(text = "Add-on: ${it.lowercase()}", style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
                        }
                    }
                }
                if (state.included.isNotEmpty() || state.outsideOnly) {
                    PlanOptionRow {
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                            state.included.forEach { IncludedLine(PantopusIcon.Check, it, PantopusColors.home) }
                            if (state.outsideOnly) IncludedLine(PantopusIcon.Home, "Outside only", PantopusColors.appTextSecondary)
                        }
                    }
                }
                home.priceCents?.let {
                    PlanOptionRow(modifier = Modifier.semantics(mergeDescendants = true) {}) {
                        Text(
                            text = "Price",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = "${CrewDayFormat.price(it)} · ${if (home.status == "price_pending") "after a look" else "confirmed"}",
                            style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                            color = PantopusColors.appText,
                        )
                    }
                }
            }
        }
        PlanField("Access") {
            Text(
                text = home.accessNote?.takeIf { it.isNotBlank() } ?: "No note from the household.",
                style = PantopusTextStyle.body,
                color = if (home.accessNote.isNullOrBlank()) PantopusColors.appTextSecondary else PantopusColors.appText,
                modifier = Modifier.testTag("crewDayRouteHomeAccess"),
            )
            home.gateReadyAt?.let { at ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(
                        icon = PantopusIcon.CheckCircle,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.success,
                    )
                    Text(
                        text = "Gate is ready · ${CrewDayFormat.clock(CrewDayFormat.instant(at), zone).orEmpty()}",
                        style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                        modifier = Modifier.testTag("crewDayRouteHomeGate"),
                    )
                }
            }
        }
        if (state.isDone) {
            Text(
                text = routeStatus(home, zone),
                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                color = PantopusColors.appText,
                modifier = Modifier.testTag("crewDayRouteHomeStatus"),
            )
            return@Column
        }
        PlanField("Photos") {
            if (state.photos.isNotEmpty()) {
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    state.photos.forEach { photo ->
                        val bitmap = remember(photo.id) { BitmapFactory.decodeByteArray(photo.bytes, 0, photo.bytes.size)?.asImageBitmap() }
                        Box {
                            bitmap?.let {
                                Image(
                                    bitmap = it,
                                    contentDescription = "Photo of the finished home",
                                    contentScale = ContentScale.Crop,
                                    modifier =
                                        Modifier
                                            .size(80.dp)
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(PantopusColors.appSurfaceSunken),
                                )
                            }
                            PlanRoundButton(
                                icon = PantopusIcon.X,
                                label = "Remove photo",
                                onClick = { viewModel.removePhoto(photo.id) },
                                modifier = Modifier.align(Alignment.TopEnd).padding(2.dp),
                            )
                        }
                    }
                }
            }
            if (state.photos.size < CrewDayHomeState.MAX_PHOTOS) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (canTakePhoto) {
                        PlanTonalButton(
                            title = "Take a photo",
                            icon = PantopusIcon.Camera,
                            onClick = onCamera,
                            height = 44.dp,
                            modifier = Modifier.weight(1f).testTag("crewDayRouteHomeCamera"),
                        )
                    }
                    PlanTonalButton(
                        title = "From photos",
                        icon = PantopusIcon.Image,
                        onClick = onLibrary,
                        height = 44.dp,
                        modifier = Modifier.weight(1f).testTag("crewDayRouteHomeLibrary"),
                    )
                }
            }
            Text(
                text = "At least one, up to 8. Only the household, your crew and Pantopus see them.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
        PlanField("Note for the household (optional)") {
            PlanTextArea(
                value = state.note,
                onValue = viewModel::setNote,
                placeholder = "Anything they should know",
                label = "Note for the household",
            )
            Text(
                text = "Nothing extra is added without the household's OK.",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

/** One included item with its mark. */
@Composable
private fun IncludedLine(
    icon: PantopusIcon,
    text: String,
    tint: Color,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        PantopusIconImage(icon, contentDescription = null, size = 16.dp, tint = tint, modifier = Modifier.padding(top = 2.dp))
        Text(text = text, style = PantopusTextStyle.small, color = PantopusColors.appTextStrong)
    }
}

/** "Can't get in": a note (required) the household gets right away. */
@Composable
private fun CantGetInDialog(
    onSend: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    var note by remember { mutableStateOf("We're at your home but can't get in. Could you open the gate?") }
    AlertDialog(
        onDismissRequest = onDismiss,
        modifier = Modifier.testTag("crewDayRouteHomeCantGetInDialog"),
        title = { Text("Can't get in") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Text("We tell the household now, with your note.")
                PlanTextArea(
                    value = note,
                    onValue = { note = it.take(CrewDayHomeState.MAX_NOTE) },
                    placeholder = "What's in the way",
                    label = "Note to the household",
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSend(note) },
                enabled = note.isNotBlank(),
                modifier = Modifier.testTag("crewDayRouteHomeCantGetInSend"),
            ) {
                Text("Tell them")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Not now") } },
    )
}

/** Directions to the home in the person's maps app. */
private fun Context.openInMaps(home: CrewDayHomeDto) {
    val address = home.address ?: return
    val query = Uri.encode(listOfNotNull(address.line, address.city, address.state, address.zip).joinToString(", "))
    val uri =
        if (address.latitude != null && address.longitude != null) {
            Uri.parse("geo:${address.latitude},${address.longitude}?q=${address.latitude},${address.longitude}($query)")
        } else {
            Uri.parse("geo:0,0?q=$query")
        }
    runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

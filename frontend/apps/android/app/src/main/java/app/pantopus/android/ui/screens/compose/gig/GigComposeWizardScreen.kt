@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.compose.gig

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.components.FutureDateTimePickerDialogs
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.screens.shared.wizard.blocks.FormFieldsBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.ReviewSummaryBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.ReviewSummaryRow
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.SuccessHeroBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.File
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.UUID

/** Test tag applied to the GigCompose screen container. */
const val GIG_COMPOSE_SCREEN_TAG = "composeGigWizard"

private const val REVIEW_DESCRIPTION_MAX_LENGTH = 140

/**
 * A12.8 — concrete describe-first Post-a-Task wizard composable. The
 * view model survives config changes via Hilt's `SavedStateHandle`, so
 * the wizard restores after process death.
 */
@Composable
fun GigComposeWizardScreen(
    onDismiss: () -> Unit,
    onOpenGigDetail: (String) -> Unit,
    preselectedCategoryKey: String? = null,
    viewModel: GigComposeViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // P0.2 — modern photo picker (no storage permission needed). Picked
    // URIs are copied to bytes and uploaded immediately by the VM.
    val onPicked: (Uri?) -> Unit = { uri ->
        uri?.let { scope.launch { readPickedPhoto(context, it)?.let(viewModel::addPickedPhoto) } }
    }
    val photoPicker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia(), onPicked)
    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent(), onPicked)

    // P6b — real camera capture for the attachment sheet's "Take a
    // photo" row (closes the P0.2 deferral). `TakePicture()` writes into
    // a cache-dir file exposed through the app FileProvider
    // (xml/file_paths.xml cache-path), then the captured URI rides the
    // SAME `onPicked` upload path as library picks. Saveable so a
    // process death during capture still resolves the URI on return.
    var pendingCameraUri by rememberSaveable { mutableStateOf<String?>(null) }
    val cameraCapture =
        rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { success ->
            val uri = pendingCameraUri?.let(Uri::parse)
            pendingCameraUri = null
            if (success) onPicked(uri)
        }
    val launchCamera = {
        val photoFile = File(context.cacheDir, "gig-camera-${UUID.randomUUID()}.jpg")
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", photoFile)
        pendingCameraUri = uri.toString()
        // No camera app (or a broken resolver) must not crash — drop it.
        runCatching { cameraCapture.launch(uri) }.onFailure { pendingCameraUri = null }
        Unit
    }
    // CAMERA is declared in the manifest, so the TakePicture intent
    // requires the runtime grant first. Denial is graceful: skip capture.
    val cameraPermission =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) launchCamera()
        }
    val onTakePhoto = {
        if (
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            launchCamera()
        } else {
            cameraPermission.launch(Manifest.permission.CAMERA)
        }
    }

    // A12.8 — voice-note recording (mic tool button). RECORD_AUDIO is a
    // runtime permission; the recorder writes an m4a/AAC file into the
    // cache dir, which is transcribed via `POST /api/ai/transcribe`.
    var isRecording by remember { mutableStateOf(false) }
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    val voiceNoteFile = remember { File(context.cacheDir, "gigComposeVoiceNote.m4a") }

    fun startRecording() {
        if (isRecording) return
        runCatching {
            val mediaRecorder =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    MediaRecorder(context)
                } else {
                    @Suppress("DEPRECATION")
                    MediaRecorder()
                }
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            mediaRecorder.setOutputFile(voiceNoteFile.absolutePath)
            mediaRecorder.prepare()
            mediaRecorder.start()
            recorder = mediaRecorder
            isRecording = true
        }.onFailure {
            recorder?.release()
            recorder = null
            isRecording = false
        }
    }

    fun stopRecordingAndTranscribe() {
        val active = recorder ?: return
        isRecording = false
        recorder = null
        runCatching {
            active.stop()
            active.release()
        }
        runCatching { voiceNoteFile.readBytes() }
            .getOrNull()
            ?.takeIf { it.isNotEmpty() && it.size <= VOICE_NOTE_MAX_BYTES }
            ?.let { viewModel.transcribeAudio("voice-note.m4a", "audio/mp4", it) }
    }

    val micPermissionLauncher =
        rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) startRecording()
        }

    fun onMicTap() {
        when {
            isRecording -> stopRecordingAndTranscribe()
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED -> startRecording()
            else -> micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    LaunchedEffect(preselectedCategoryKey) {
        viewModel.preselectCategoryIfNeeded(GigComposeCategory.fromRawKey(preselectedCategoryKey))
    }

    // A12.8 — inspiration templates for the empty describe state (silent failure).
    // P6c — my-businesses for the identity chip (silent failure, chip stays static).
    LaunchedEffect(Unit) {
        viewModel.loadTemplatesIfNeeded()
        viewModel.loadIdentitiesIfNeeded()
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            GigComposeOutboundEvent.Dismiss -> {
                viewModel.acknowledgeEvent()
                onDismiss()
            }
            is GigComposeOutboundEvent.OpenGigDetail -> {
                viewModel.acknowledgeEvent()
                onOpenGigDetail(event.gigId)
            }
            null -> Unit
        }
    }

    LaunchedEffect(Unit) {
        val current = state.form.currentStep
        current.stepNumber?.let { number ->
            Analytics.track(
                AnalyticsEvent.ScreenComposeGigWizardStepViewed(
                    stepNumber = number,
                    stepName = current.name,
                ),
            )
        }
    }

    WizardShell(
        model = viewModel,
        modifier = Modifier.testTag(GIG_COMPOSE_SCREEN_TAG),
    ) {
        when (state.form.currentStep) {
            GigComposeStep.Describe ->
                // A12.8 — step 1 renders Magic describe (default) or the
                // manual archetype picker, toggled by `composeMode`.
                if (state.form.composeMode == ComposeMode.Magic) {
                    MagicDescribeStep(
                        state = state,
                        vm = viewModel,
                        isRecording = isRecording,
                        onMicTap = ::onMicTap,
                        onImageTap = {
                            photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        },
                        onAttachTap = { filePicker.launch("*/*") },
                    )
                } else {
                    ManualPickerStep(state, viewModel)
                }
            GigComposeStep.FillGaps -> FillGapsStep(state, viewModel)
            GigComposeStep.BudgetMode -> BudgetModeStep(state, viewModel)
            GigComposeStep.Review -> ReviewStep(state, viewModel)
            GigComposeStep.Success -> SuccessStep(state, viewModel)
        }
        state.errorMessage?.let { ErrorBanner(it) }
    }

    // E.1 — composer picker sheets presented over the wizard. The
    // attachment sheet's sources launch the real pickers (P0.2).
    GigComposePickerSheetHost(
        state = state,
        viewModel = viewModel,
        onPickPhoto = {
            photoPicker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
        },
        onTakePhoto = onTakePhoto,
        onPickFile = { filePicker.launch("*/*") },
    )
}

/** A12.8 — backend transcribe cap (25 MB Whisper limit). */
private const val VOICE_NOTE_MAX_BYTES = 25 * 1024 * 1024

/**
 * P0.2 — copy a picked content URI to bytes + mime for the multipart
 * upload (the same read pattern as `DeliveryProofSheet`). Returns null
 * when the stream can't be opened.
 */
private fun readPickedPhoto(
    context: Context,
    uri: Uri,
): GigComposePickedPhoto? {
    val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
    val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
    return GigComposePickedPhoto(
        filename = "gig-${UUID.randomUUID().toString().take(FILENAME_SUFFIX_LENGTH)}.${extensionFor(mime)}",
        mimeType = mime,
        bytes = bytes,
    )
}

private const val FILENAME_SUFFIX_LENGTH = 6

/** Filename extension for the uploaded part, derived from the mime type. */
private fun extensionFor(mime: String): String =
    when (mime.substringAfterLast('/')) {
        "png" -> "png"
        "webp" -> "webp"
        "gif" -> "gif"
        "pdf" -> "pdf"
        else -> "jpg"
    }

// MARK: - Step 2: Fill gaps

/**
 * A12.8 — title + description (AI-prefilled, editable) + photos + the
 * missing When/Where pickers + the detected archetype's module fields.
 */
@Composable
internal fun FillGapsStep(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    HeadlineBlock("Fill in the gaps")
    SubcopyBlock("We drafted what we could. Check the title, add what's missing, and you're set.")
    FormFieldsBlock {
        PantopusTextField(
            label = "Title",
            value = state.form.title,
            onValueChange = vm::setTitle,
            placeholder = "Hang 3 shelves in the living room",
            fieldTestTag = "composeGig_title",
        )
        DescriptionField(value = state.form.description, onValueChange = vm::setDescription)
        CharacterCounter(
            current = state.form.description.length,
            min = GigComposeLimits.DESCRIPTION_MIN,
            max = GigComposeLimits.DESCRIPTION_MAX,
        )
    }
    PhotoSlotsRow(
        uploadedUrls = state.form.photoIds,
        uploads = state.photoUploads,
        max = GigComposeLimits.MAX_PHOTOS,
        // E.1 — the add tile opens the attachment-source sheet
        // (camera / library / file).
        onAdd = { vm.presentPicker(GigPickerSheet.Attachment) },
        onRemoveUploaded = vm::removePhoto,
        onRemoveUpload = vm::removePhotoUpload,
        onRetryUpload = vm::retryPhotoUpload,
    )
    WhenSection(state, vm)
    WhereSection(state, vm)
    // A12.8 — archetype-specific module fields (care / logistics /
    // remote / event / items).
    GigComposeModuleFields(state, vm)
}

@Composable
private fun WhenSection(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SectionOverline("WHEN")
        GigComposeScheduleType.entries.forEach { type ->
            RadioRow(
                label = type.label,
                subcopy = type.subcopy(),
                isSelected = state.form.scheduleType == type,
                testTag = "composeGig_schedule_${type.name.lowercase()}",
                onTap = { vm.selectScheduleType(type) },
            )
        }
        if (state.form.scheduleType == GigComposeScheduleType.OneTime) {
            OneTimeDateRow(state, vm)
        }
    }
}

@Composable
private fun WhereSection(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SectionOverline("WHERE")
        GigComposeLocationMode.entries.forEach { mode ->
            RadioRow(
                label = mode.label,
                subcopy = mode.subcopy(),
                isSelected = state.form.locationMode == mode,
                testTag = "composeGig_location_${mode.name.lowercase()}",
                onTap = { vm.selectLocationMode(mode) },
            )
        }
        if (state.form.locationMode == GigComposeLocationMode.APlace) {
            FormFieldsBlock {
                PantopusTextField(
                    label = "Street",
                    value = state.form.placeAddress.line1,
                    onValueChange = { vm.updatePlaceAddress(line1 = it) },
                    placeholder = "123 Main St",
                    fieldTestTag = "composeGig_place_line1",
                )
                PantopusTextField(
                    label = "City",
                    value = state.form.placeAddress.city,
                    onValueChange = { vm.updatePlaceAddress(city = it) },
                    fieldTestTag = "composeGig_place_city",
                )
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    PantopusTextField(
                        label = "State",
                        value = state.form.placeAddress.state,
                        onValueChange = { vm.updatePlaceAddress(state = it) },
                        modifier = Modifier.weight(1f),
                        fieldTestTag = "composeGig_place_state",
                    )
                    PantopusTextField(
                        label = "ZIP",
                        value = state.form.placeAddress.zip,
                        onValueChange = { vm.updatePlaceAddress(zip = it) },
                        keyboardType = KeyboardType.Number,
                        modifier = Modifier.weight(1f),
                        fieldTestTag = "composeGig_place_zip",
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionOverline(text: String) {
    Text(
        text,
        fontSize = 10.5.sp,
        fontWeight = FontWeight.SemiBold,
        letterSpacing = 0.6.sp,
        color = PantopusColors.appTextSecondary,
    )
}

@Composable
private fun DescriptionField(
    value: String,
    onValueChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(text = "Description", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 120.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md))
                    .padding(Spacing.s2),
        ) {
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
                cursorBrush = SolidColor(PantopusColors.primary600),
                modifier = Modifier.fillMaxWidth().testTag("composeGig_description"),
                decorationBox = { inner ->
                    if (value.isEmpty()) {
                        Text(
                            text = "Add as much detail as you can.",
                            style = PantopusTextStyle.body,
                            color = PantopusColors.appTextMuted,
                        )
                    }
                    inner()
                },
            )
        }
    }
}

@Composable
private fun CharacterCounter(
    current: Int,
    min: Int,
    max: Int,
) {
    val needsMore = current < min
    val label = if (needsMore) "${min - current} more characters" else "$current / $max"
    val color = if (needsMore) PantopusColors.warning else PantopusColors.appTextSecondary
    Text(
        text = label,
        style = PantopusTextStyle.caption,
        color = color,
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("composeGig_descriptionCounter"),
    )
}

@Composable
private fun PhotoSlotsRow(
    uploadedUrls: List<String>,
    uploads: List<GigComposePhotoUpload>,
    max: Int,
    onAdd: () -> Unit,
    onRemoveUploaded: (Int) -> Unit,
    onRemoveUpload: (String) -> Unit,
    onRetryUpload: (String) -> Unit,
) {
    val total = uploadedUrls.size + uploads.size
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = "Photos & files (optional, up to $max)",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            uploadedUrls.forEachIndexed { index, url ->
                UploadedPhotoTile(url = url, index = index, onRemove = { onRemoveUploaded(index) })
            }
            // P0.2 — in-flight / failed tiles render after the uploaded ones.
            uploads.forEach { upload ->
                UploadingPhotoTile(
                    upload = upload,
                    onRetry = { onRetryUpload(upload.id) },
                    onRemove = { onRemoveUpload(upload.id) },
                )
            }
            if (total < max) {
                Box(
                    modifier =
                        Modifier
                            .size(64.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md))
                            .clickable(role = Role.Button, onClick = onAdd)
                            .testTag("composeGig_addPhoto")
                            .semantics { contentDescription = "Add photo" },
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Plus,
                        contentDescription = null,
                        size = 22.dp,
                        tint = PantopusColors.appTextSecondary,
                        modifier = Modifier.align(Alignment.Center),
                    )
                }
            }
        }
    }
}

@Composable
private fun UploadedPhotoTile(
    url: String,
    index: Int,
    onRemove: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.primary50)
                .clickable(role = Role.Button, onClick = onRemove)
                .testTag("composeGig_photo_$index")
                .semantics { contentDescription = "Remove photo ${index + 1}" },
    ) {
        AsyncImage(
            model = url,
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        PantopusIconImage(
            icon = PantopusIcon.X,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.appTextInverse,
            modifier = Modifier.align(Alignment.TopEnd).padding(Spacing.s1),
        )
    }
}

/** P0.2 — uploading (spinner) or failed (tap-to-retry) tile. */
@Composable
private fun UploadingPhotoTile(
    upload: GigComposePhotoUpload,
    onRetry: () -> Unit,
    onRemove: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (upload.failed) PantopusColors.errorBg else PantopusColors.primary50)
                .border(
                    width = 1.dp,
                    color = if (upload.failed) PantopusColors.error else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.md),
                )
                .clickable(role = Role.Button, enabled = upload.failed, onClick = onRetry)
                .testTag(
                    if (upload.failed) "composeGig_retryUpload_${upload.id}" else "composeGig_uploading_${upload.id}",
                )
                .semantics {
                    contentDescription = if (upload.failed) "Upload failed, tap to retry" else "Uploading photo"
                },
    ) {
        if (upload.failed) {
            PantopusIconImage(
                icon = PantopusIcon.AlertCircle,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.error,
                modifier = Modifier.align(Alignment.Center),
            )
        } else {
            CircularProgressIndicator(
                color = PantopusColors.primary600,
                strokeWidth = 2.dp,
                modifier = Modifier.size(22.dp).align(Alignment.Center),
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(2.dp)
                    .size(18.dp)
                    .clip(CircleShape)
                    .clickable(role = Role.Button, onClick = onRemove)
                    .testTag("composeGig_removeUpload_${upload.id}")
                    .semantics { contentDescription = "Remove photo" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = 12.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
    }
}

// MARK: - Step 3: Budget & mode

/**
 * A12.8 — pay selector (fixed/hourly/offers + amount + estimated hours)
 * plus the editable wire `engagement_mode` segmented control.
 */
@Composable
internal fun BudgetModeStep(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    // P1.G — covers a restored wizard landing directly on this step;
    // the VM dedupes per category so the step-advance fetch isn't repeated.
    LaunchedEffect(Unit) { vm.fetchPriceBenchmark() }
    HeadlineBlock("Budget & mode")
    SubcopyBlock("Pick a price model. Helpers see this on the gig card.")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        GigComposeBudgetType.entries.forEach { type ->
            RadioRow(
                label = type.label,
                subcopy = type.subcopy(),
                isSelected = state.form.budgetType == type,
                testTag = "composeGig_budget_${type.wireValue}",
                onTap = { vm.selectBudgetType(type) },
            )
        }
    }
    val selected = state.form.budgetType
    if (selected != null && selected != GigComposeBudgetType.Offers) {
        val suffix = if (selected == GigComposeBudgetType.Hourly) "/ hr" else "total"
        FormFieldsBlock {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PantopusTextField(
                    label = "Min $suffix",
                    value = state.form.budgetMin,
                    onValueChange = vm::setBudgetMin,
                    placeholder = "20",
                    keyboardType = KeyboardType.Decimal,
                    fieldTestTag = "composeGig_budgetMin",
                    modifier = Modifier.weight(1f),
                )
                PantopusTextField(
                    label = "Max $suffix",
                    value = state.form.budgetMax,
                    onValueChange = vm::setBudgetMax,
                    placeholder = "Optional",
                    keyboardType = KeyboardType.Decimal,
                    fieldTestTag = "composeGig_budgetMax",
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
    if (selected != null && selected != GigComposeBudgetType.Offers) {
        FormFieldsBlock {
            PantopusTextField(
                label = "Estimated hours (optional)",
                value = state.form.estimatedHours,
                onValueChange = vm::setEstimatedHours,
                placeholder = "2",
                keyboardType = KeyboardType.Decimal,
                fieldTestTag = "composeGig_estimatedHours",
            )
        }
    }
    // P1.G — nearby price-benchmark hint; hidden when the fetch failed
    // or there are no comparable tasks.
    state.priceBenchmark?.let { benchmark ->
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .testTag("gigCompose.priceBenchmark"),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = benchmark.hintText,
                fontSize = 12.sp,
                color = PantopusColors.appTextSecondary,
            )
            benchmark.basis?.let { basis ->
                Text(
                    text = basis,
                    fontSize = 11.sp,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
    }
    EngagementWireControl(state, vm)
}

/**
 * A12.8 — segmented control for the wire `engagement_mode`. Selection
 * defaults to [GigComposeViewModel.resolvedEngagementMode]'s inference
 * (pro → quotes, asap/urgent → instant accept, else curated offers).
 */
@Composable
private fun EngagementWireControl(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    val resolvedWire = vm.resolvedEngagementMode(state.form)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SectionOverline("ENGAGEMENT MODE")
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s1),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            GigEngagementMode.entries.forEach { option ->
                val active = option.wireValue == resolvedWire
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(if (active) PantopusColors.appSurface else androidx.compose.ui.graphics.Color.Transparent)
                            .let {
                                if (active) {
                                    it.border(1.dp, PantopusColors.primary600, RoundedCornerShape(Radii.md))
                                } else {
                                    it
                                }
                            }
                            .clickable(role = Role.Button, onClick = { vm.selectEngagementOverride(option) })
                            .padding(vertical = Spacing.s2)
                            .testTag("gigCompose.engagementMode_${option.wireValue}")
                            .semantics { contentDescription = option.label },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        option.label,
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = if (active) PantopusColors.primary700 else PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

// MARK: - Step 4: Review & post

@Composable
private fun ReviewStep(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    HeadlineBlock("Review and post")
    SubcopyBlock("Check the details. Helpers see what's below as your gig card.")
    val form = state.form

    // A12.8 — successful undo lands back here with the form intact.
    if (state.showUndoneToast) {
        UndoneToast(onDismiss = vm::acknowledgeUndoneToast)
    }

    ReviewSummaryBlock(
        rows =
            listOf(
                ReviewSummaryRow("Category", form.category?.label ?: "—"),
                ReviewSummaryRow("Title", form.title.ifEmpty { "—" }),
                ReviewSummaryRow("Description", condensedDescription(form.description)),
                ReviewSummaryRow("Photos", photosSummary(form.photoIds.size)),
                ReviewSummaryRow("Budget", budgetSummary(form)),
                ReviewSummaryRow("Schedule", scheduleSummary(form)),
                ReviewSummaryRow("Location", locationSummary(form)),
                ReviewSummaryRow("Mode", GigEngagementMode.fromWire(vm.resolvedEngagementMode(form))?.label ?: "—"),
            ),
    )
    // E.1 — optional composer fields backed by the picker sheets.
    GigComposeOptionsBlock(form = form, vm = vm)
}

@Composable
private fun UndoneToast(onDismiss: () -> Unit) {
    LaunchedEffect(Unit) {
        delay(UNDONE_TOAST_MS)
        onDismiss()
    }
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.successBg)
                .padding(Spacing.s3)
                .testTag("gigCompose.undoneToast"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.CheckCircle, contentDescription = null, size = 16.dp, tint = PantopusColors.success)
        Text("Task undone", style = PantopusTextStyle.caption, color = PantopusColors.success)
    }
}

private const val UNDONE_TOAST_MS = 4_000L

private fun photosSummary(count: Int): String =
    when (count) {
        0 -> "None"
        1 -> "1 photo"
        else -> "$count photos"
    }

private fun budgetSummary(form: GigComposeFormState): String =
    when (val type = form.budgetType) {
        null -> "—"
        GigComposeBudgetType.Offers -> "Open to bids"
        else -> pricedBudgetSummary(form, type)
    }

private fun pricedBudgetSummary(
    form: GigComposeFormState,
    type: GigComposeBudgetType,
): String {
    val suffix = if (type == GigComposeBudgetType.Hourly) "/hr" else ""
    return if (form.budgetMax.isNotEmpty()) {
        "\$${form.budgetMin}–\$${form.budgetMax}$suffix"
    } else {
        "\$${form.budgetMin}$suffix"
    }
}

private fun scheduleSummary(form: GigComposeFormState): String =
    form.scheduleType?.let { type ->
        if (type == GigComposeScheduleType.OneTime && form.scheduledStartISO != null) {
            formattedScheduledStart(form.scheduledStartISO, type.label)
        } else {
            type.label
        }
    } ?: "—"

private fun formattedScheduledStart(
    iso: String,
    fallback: String,
): String =
    runCatching {
        LocalDateTime
            .ofInstant(Instant.parse(iso), ZoneId.systemDefault())
            .format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT))
    }.getOrNull() ?: fallback

private fun locationSummary(form: GigComposeFormState): String =
    when (form.locationMode) {
        null -> "—"
        GigComposeLocationMode.YourAddress -> "Your saved address"
        GigComposeLocationMode.Virtual -> "Virtual"
        GigComposeLocationMode.APlace -> placeSummary(form.placeAddress)
    }

private fun placeSummary(place: GigComposePlaceAddress): String =
    if (place.isComplete) {
        "${place.line1}, ${place.city}, ${place.state} ${place.zip}"
    } else {
        "A place"
    }

private fun condensedDescription(raw: String): String {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return "—"
    return if (trimmed.length > REVIEW_DESCRIPTION_MAX_LENGTH) {
        trimmed.take(REVIEW_DESCRIPTION_MAX_LENGTH) + "…"
    } else {
        trimmed
    }
}

// MARK: - Success

/**
 * A12.8 — "Task posted" + notified count + 10s undo countdown pill
 * (`POST /api/gigs/:gigId/undo` → back to Review with the form intact).
 */
@Composable
private fun SuccessStep(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    val result = state.postResult
    SuccessHeroBlock(
        headline = "Task posted",
        subcopy = "Helpers can now see it on the Gigs feed. We'll notify you when bids come in.",
    )
    if (result != null) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                "Notified ${result.notifiedCount} nearby helpers",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.testTag("gigCompose.success.notified"),
            )
            UndoCountdownPill(result = result, onUndo = vm::undoPost)
        }
    }
}

@Composable
private fun UndoCountdownPill(
    result: GigComposePostResult,
    onUndo: () -> Unit,
) {
    var remainingMs by remember(result.gigId) {
        mutableLongStateOf(result.undoDeadlineEpochMs - System.currentTimeMillis())
    }
    LaunchedEffect(result.gigId) {
        while (remainingMs > 0) {
            delay(UNDO_TICK_MS)
            remainingMs = result.undoDeadlineEpochMs - System.currentTimeMillis()
        }
    }
    if (remainingMs <= 0) return
    val seconds = ((remainingMs + MS_PER_SECOND - 1) / MS_PER_SECOND).coerceAtLeast(1)
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.appSurfaceSunken)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.pill))
                .clickable(role = Role.Button, onClick = onUndo)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag("gigCompose.success.undo")
                .semantics { contentDescription = "Undo, $seconds seconds left" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.History,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.appTextStrong,
        )
        Text(
            "Undo · ${seconds}s",
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextStrong,
        )
    }
}

private const val UNDO_TICK_MS = 250L
private const val MS_PER_SECOND = 1_000L

// MARK: - Helpers

@Composable
private fun OneTimeDateRow(
    state: GigComposeUiState,
    vm: GigComposeViewModel,
) {
    // P0.3 — real Material3 date (today onward) + time picker pair. The
    // VM keeps the existing "must be in the future" validation on the
    // composed instant.
    var showPickers by remember { mutableStateOf(false) }
    val current =
        state.form.scheduledStartISO?.let { iso ->
            runCatching { Instant.parse(iso) }.getOrNull()
        }
    FormFieldsBlock {
        val formatted =
            current?.let { instant ->
                LocalDateTime.ofInstant(instant, ZoneId.systemDefault())
                    .format(DateTimeFormatter.ofLocalizedDateTime(FormatStyle.MEDIUM, FormatStyle.SHORT))
            } ?: "Pick a date & time"
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md))
                    .clickable(role = Role.Button) { showPickers = true }
                    .padding(Spacing.s3)
                    .testTag("composeGig_scheduledStart"),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Calendar,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = formatted,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
    }
    if (showPickers) {
        FutureDateTimePickerDialogs(
            initial = current?.let { LocalDateTime.ofInstant(it, ZoneId.systemDefault()) },
            onPicked = { picked ->
                showPickers = false
                vm.setScheduledStart(picked.atZone(ZoneId.systemDefault()).toInstant().toString())
            },
            onDismiss = { showPickers = false },
        )
    }
}

@Composable
private fun RadioRow(
    label: String,
    subcopy: String,
    isSelected: Boolean,
    testTag: String,
    onTap: () -> Unit,
) {
    val borderColor = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(width = if (isSelected) 2.dp else 1.dp, color = borderColor, shape = RoundedCornerShape(Radii.md))
                .clickable(role = Role.RadioButton, onClick = onTap)
                .padding(Spacing.s3)
                .testTag(testTag)
                .semantics { contentDescription = "$label. $subcopy" },
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        RadioCircle(isSelected = isSelected)
        Column {
            Text(text = label, style = PantopusTextStyle.body, color = PantopusColors.appText)
            Text(text = subcopy, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun RadioCircle(isSelected: Boolean) {
    val borderColor = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder
    Box(
        modifier =
            Modifier
                .size(22.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurface)
                .border(width = 2.dp, color = borderColor, shape = CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        if (isSelected) {
            Box(
                modifier =
                    Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.primary600),
            )
        }
    }
}

@Composable
private fun ErrorBanner(message: String) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.errorBg)
                .padding(Spacing.s3)
                .testTag("composeGigErrorBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 18.dp, tint = PantopusColors.error)
        Text(text = message, style = PantopusTextStyle.caption, color = PantopusColors.error)
    }
}

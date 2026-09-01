@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions", "MagicNumber")

package app.pantopus.android.ui.screens.compose.listing

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalInspectionMode
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Test tag applied to the Snap & Sell wizard container. */
const val LISTING_COMPOSE_SCREEN_TAG = "listingComposeWizard"

/** Test tag applied to the wizard container in edit mode (P3.3). */
const val LISTING_EDIT_SCREEN_TAG = "listingEditWizard"

/**
 * Snap & Sell wizard composable. The view model survives config
 * changes via Hilt's `SavedStateHandle`, so the wizard restores after
 * process death. The same composable backs both the create flow (from
 * the Marketplace FAB) and the edit flow (P3.3) — the VM reads the
 * mode from the nav-arg listing id, and the screen wires
 * `onListingUpdated` so the host can pop back to the listing detail
 * after a save.
 */
@Composable
fun ListingComposeWizardScreen(
    onDismiss: () -> Unit,
    onOpenListingDetail: (String) -> Unit,
    onListingUpdated: ((String) -> Unit)? = null,
    viewModel: ListingComposeWizardViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()
    var photoPendingRemoval by remember { mutableStateOf<ListingComposePhoto?>(null) }

    ListingComposeEventEffect(
        pendingEvent = pendingEvent,
        viewModel = viewModel,
        onDismiss = onDismiss,
        onOpenListingDetail = onOpenListingDetail,
        onListingUpdated = onListingUpdated,
    )
    ListingComposeInitialLoadEffect(state = state, viewModel = viewModel)
    ListingComposeCameraPermissionEffect(
        isCameraCaptureStep = viewModel.isCameraCaptureStep,
    )

    val screenTag = if (viewModel.isEditMode) LISTING_EDIT_SCREEN_TAG else LISTING_COMPOSE_SCREEN_TAG
    WizardShell(
        model = viewModel,
        modifier = Modifier.testTag(screenTag),
    ) {
        ListingComposeWizardBody(
            state = state,
            viewModel = viewModel,
            onRequestRemove = { photoPendingRemoval = it },
        )
    }

    PhotoRemovalDialog(
        photo = photoPendingRemoval,
        onDismiss = { photoPendingRemoval = null },
        onConfirm = { photo ->
            viewModel.removePhoto(photo.id)
            photoPendingRemoval = null
        },
    )
}

@Composable
private fun ListingComposeEventEffect(
    pendingEvent: ListingComposeOutboundEvent?,
    viewModel: ListingComposeWizardViewModel,
    onDismiss: () -> Unit,
    onOpenListingDetail: (String) -> Unit,
    onListingUpdated: ((String) -> Unit)?,
) {
    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            ListingComposeOutboundEvent.Dismiss -> {
                viewModel.acknowledgeEvent()
                onDismiss()
            }
            is ListingComposeOutboundEvent.OpenListingDetail -> {
                viewModel.acknowledgeEvent()
                onOpenListingDetail(event.listingId)
            }
            is ListingComposeOutboundEvent.ListingUpdated -> {
                viewModel.acknowledgeEvent()
                onListingUpdated?.invoke(event.listingId) ?: onDismiss()
            }
            null -> Unit
        }
    }
}

@Composable
private fun ListingComposeCameraPermissionEffect(isCameraCaptureStep: Boolean) {
    val context = LocalContext.current
    val permissionLauncher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.RequestPermission(),
            onResult = { /* CameraPreviewSurface re-reads grant state on recomposition. */ },
        )

    LaunchedEffect(isCameraCaptureStep) {
        if (!isCameraCaptureStep || listingComposeCameraGranted(context)) return@LaunchedEffect
        permissionLauncher.launch(Manifest.permission.CAMERA)
    }
}

@Composable
private fun ListingComposeInitialLoadEffect(
    state: ListingComposeUiState,
    viewModel: ListingComposeWizardViewModel,
) {
    LaunchedEffect(Unit) {
        // Edit mode: kick the prefill fetch. Idempotent — the VM
        // no-ops in create mode or once the form is non-empty.
        viewModel.loadExistingIfNeeded()
        val current = state.form.currentStep
        current.stepNumber?.let { number ->
            Analytics.track(
                AnalyticsEvent.ScreenListingComposeWizardStepViewed(
                    stepNumber = number,
                    stepName = current.name,
                ),
            )
        }
    }
}

@Composable
private fun ListingComposeWizardBody(
    state: ListingComposeUiState,
    viewModel: ListingComposeWizardViewModel,
    onRequestRemove: (ListingComposePhoto) -> Unit,
) {
    if (state.isLoadingExisting) {
        EditPrefillLoadingBlock()
    } else {
        ListingComposeStepContent(
            state = state,
            viewModel = viewModel,
            onRequestRemove = onRequestRemove,
        )
        state.errorMessage?.let { ErrorBanner(it) }
    }
}

@Composable
private fun ListingComposeStepContent(
    state: ListingComposeUiState,
    viewModel: ListingComposeWizardViewModel,
    onRequestRemove: (ListingComposePhoto) -> Unit,
) {
    val openPhotoPicker = rememberListingPhotoPicker(viewModel)
    when (state.form.currentStep) {
        ListingComposeStep.Photos ->
            if (viewModel.isCameraCaptureStep) {
                CameraCaptureStep(state = state, vm = viewModel, onOpenLibrary = openPhotoPicker)
            } else {
                PhotosStep(
                    state = state,
                    onAdd = openPhotoPicker,
                    onRequestRemove = onRequestRemove,
                    onMoveUp = { index ->
                        viewModel.movePhoto(from = index, to = index - 1)
                    },
                    onMoveDown = { index ->
                        viewModel.movePhoto(from = index, to = index + 1)
                    },
                    onMakeHero = viewModel::makeHero,
                )
            }
        ListingComposeStep.TitleCategory ->
            if (viewModel.isSnapReviewStep) {
                SnapReviewStep(state, viewModel, onOpenLibrary = openPhotoPicker)
            } else {
                TitleCategoryStep(state, viewModel)
            }
        ListingComposeStep.ConditionDescription -> ConditionDescriptionStep(state, viewModel)
        ListingComposeStep.Price -> PriceStep(state, viewModel)
        ListingComposeStep.Location -> LocationStep(state, viewModel)
        ListingComposeStep.Review -> ReviewStep(state)
        ListingComposeStep.Success -> SuccessStep()
    }
}

@Composable
private fun PhotoRemovalDialog(
    photo: ListingComposePhoto?,
    onDismiss: () -> Unit,
    onConfirm: (ListingComposePhoto) -> Unit,
) {
    photo?.let {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = { Text("Remove this photo?") },
            confirmButton = {
                TextButton(
                    onClick = { onConfirm(it) },
                    modifier = Modifier.testTag("listingCompose_removePhotoConfirm"),
                ) {
                    Text("Remove photo")
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) { Text("Cancel") }
            },
        )
    }
}

/**
 * System photo-picker launcher shared by the camera rail, the manual
 * grid's "Add photo" tile, and the snap-review strip. Picks are
 * normalized off the main thread (1600px JPEG, EXIF stripped) before
 * they reach the view model.
 */
@Composable
private fun rememberListingPhotoPicker(vm: ListingComposeWizardViewModel): () -> Unit {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val launcher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.PickMultipleVisualMedia(maxItems = ListingComposeFormState.MAX_PHOTOS),
        ) { uris ->
            if (uris.isEmpty()) return@rememberLauncherForActivityResult
            scope.launch {
                val processed =
                    withContext(Dispatchers.IO) {
                        uris.mapNotNull { uri ->
                            runCatching {
                                context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                            }.getOrNull()?.let { ListingPhotoProcessor.uploadData(it) }
                        }
                    }
                if (processed.isNotEmpty()) vm.addLibraryPhotos(processed)
            }
        }
    return {
        launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
    }
}

// MARK: - Step 1A: Camera capture

@Composable
private fun CameraCaptureStep(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
    onOpenLibrary: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val imageCapture = remember { ImageCapture.Builder().build() }
    val onShutter = {
        imageCapture.takePicture(
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(image: ImageProxy) {
                    val rotation = image.imageInfo.rotationDegrees
                    val buffer = image.planes[0].buffer
                    val bytes = ByteArray(buffer.remaining()).also(buffer::get)
                    image.close()
                    scope.launch {
                        val processed =
                            withContext(Dispatchers.Default) {
                                ListingPhotoProcessor.uploadData(bytes, rotation)
                            }
                        processed?.let(vm::captureSnapPhoto)
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    // Capture failures (camera busy, permission revoked
                    // mid-session) keep the viewfinder live for a retry.
                }
            },
        )
    }
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(612.dp)
                .clip(RoundedCornerShape(Radii.xl))
                .background(Color(0xFF0A0B0D))
                .testTag("listingComposeCameraStep"),
    ) {
        CameraPreviewSurface(imageCapture = imageCapture)
        CameraSceneOverlay()
        RuleOfThirdsGrid(modifier = Modifier.padding(horizontal = 28.dp, vertical = 96.dp))
        FramingBrackets(modifier = Modifier.padding(horizontal = 28.dp, vertical = 96.dp))
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        ) {
            Row(modifier = Modifier.fillMaxWidth()) {
                GhostCameraPill(
                    label = "Skip to manual",
                    icon = PantopusIcon.ArrowRight,
                    onClick = vm::skipToManualPhotoEditor,
                    testTag = "listingComposeSkipManual",
                )
                Box(modifier = Modifier.weight(1f))
            }
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3),
                horizontalArrangement = Arrangement.Center,
            ) {
                AiCoachPill(vm.snapCoachingText)
            }
            CapturedAnglesTray(
                photos = state.form.photos,
                progressText = vm.snapCaptureProgressText,
                modifier = Modifier.padding(top = Spacing.s4),
            )
        }
        Column(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s5),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            BottomTipPill()
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CameraRailButton(
                    icon = PantopusIcon.Image,
                    label = "Library",
                    testTag = "listingComposeLibraryPhoto",
                    onClick = onOpenLibrary,
                )
                Box(modifier = Modifier.weight(1f))
                ShutterButton(onClick = onShutter)
                Box(modifier = Modifier.weight(1f))
                CameraRailButton(
                    icon = PantopusIcon.Zap,
                    label = "Auto",
                    testTag = "listingComposeFlash",
                    onClick = {},
                )
            }
        }
    }
}

private fun listingComposeCameraGranted(context: Context): Boolean =
    ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
        PackageManager.PERMISSION_GRANTED

@Composable
private fun CameraPreviewSurface(imageCapture: ImageCapture) {
    val inspectionMode = LocalInspectionMode.current
    if (inspectionMode) {
        Box(modifier = Modifier.fillMaxWidth().fillMaxHeight().background(Color(0xFF0A0B0D)))
        return
    }
    val context = LocalContext.current
    if (!listingComposeCameraGranted(context)) {
        CameraPermissionPlaceholder()
        return
    }
    val lifecycleOwner = LocalLifecycleOwner.current
    AndroidView(
        modifier = Modifier.fillMaxWidth().fillMaxHeight(),
        factory = { ctx ->
            PreviewView(ctx).apply {
                scaleType = PreviewView.ScaleType.FILL_CENTER
                val providerFuture = ProcessCameraProvider.getInstance(ctx)
                providerFuture.addListener(
                    {
                        runCatching {
                            val provider = providerFuture.get()
                            val preview =
                                Preview.Builder().build().also {
                                    it.setSurfaceProvider(surfaceProvider)
                                }
                            provider.unbindAll()
                            provider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector.DEFAULT_BACK_CAMERA,
                                preview,
                                imageCapture,
                            )
                        }
                    },
                    ContextCompat.getMainExecutor(context),
                )
            }
        },
    )
}

@Composable
private fun CameraPermissionPlaceholder() {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .fillMaxHeight()
                .background(Color(0xFF0A0B0D)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s5)
                    .semantics {
                        contentDescription =
                            "Camera access is off — enable it in Settings to snap photos."
                    },
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Camera,
                contentDescription = null,
                size = 28.dp,
                strokeWidth = 2f,
                tint = Color.White.copy(alpha = 0.5f),
            )
            Text(
                text = "Camera access is off — enable it in Settings to snap photos.",
                style = PantopusTextStyle.caption,
                color = Color.White.copy(alpha = 0.6f),
            )
        }
    }
}

@Composable
private fun CameraSceneOverlay() {
    Canvas(modifier = Modifier.fillMaxWidth().fillMaxHeight()) {
        drawCircle(
            brush =
                Brush.radialGradient(
                    colors = listOf(Color(0x665D7A66), Color.Transparent),
                    center = Offset(size.width / 2f, size.height * 0.6f),
                    radius = size.width * 0.9f,
                ),
        )
        val sofaWidth = size.width * 0.72f
        val sofaX = (size.width - sofaWidth) / 2f
        val sofaY = size.height * 0.56f
        drawRoundRect(
            color = Color(0x884F6658),
            topLeft = Offset(sofaX, sofaY + 28f),
            size = Size(sofaWidth, 90f),
            cornerRadius = CornerRadius(30f, 30f),
        )
        drawRoundRect(
            color = Color(0x99617668),
            topLeft = Offset(sofaX, sofaY),
            size = Size(sofaWidth, 54f),
            cornerRadius = CornerRadius(22f, 22f),
        )
        drawRoundRect(
            color = Color(0xAA465C4E),
            topLeft = Offset(sofaX, sofaY),
            size = Size(40f, 124f),
            cornerRadius = CornerRadius(16f, 16f),
        )
        drawRoundRect(
            color = Color(0xAA465C4E),
            topLeft = Offset(sofaX + sofaWidth - 40f, sofaY),
            size = Size(40f, 124f),
            cornerRadius = CornerRadius(16f, 16f),
        )
    }
}

@Composable
private fun RuleOfThirdsGrid(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.fillMaxWidth().fillMaxHeight()) {
        val lineColor = Color.White.copy(alpha = 0.18f)
        drawLine(lineColor, Offset(size.width / 3f, 0f), Offset(size.width / 3f, size.height))
        drawLine(lineColor, Offset(size.width * 2f / 3f, 0f), Offset(size.width * 2f / 3f, size.height))
        drawLine(lineColor, Offset(0f, size.height / 3f), Offset(size.width, size.height / 3f))
        drawLine(lineColor, Offset(0f, size.height * 2f / 3f), Offset(size.width, size.height * 2f / 3f))
    }
}

@Composable
private fun FramingBrackets(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.fillMaxWidth().fillMaxHeight()) {
        val color = Color.White
        val len = 28f
        val inset = 0f
        val stroke = 4f

        fun corner(
            x: Float,
            y: Float,
            xDir: Float,
            yDir: Float,
        ) {
            drawLine(color, Offset(x, y), Offset(x + len * xDir, y), strokeWidth = stroke, cap = StrokeCap.Round)
            drawLine(color, Offset(x, y), Offset(x, y + len * yDir), strokeWidth = stroke, cap = StrokeCap.Round)
        }
        corner(inset, inset, 1f, 1f)
        corner(size.width - inset, inset, -1f, 1f)
        corner(inset, size.height - inset, 1f, -1f)
        corner(size.width - inset, size.height - inset, -1f, -1f)
    }
}

@Composable
private fun GhostCameraPill(
    label: String,
    icon: PantopusIcon,
    testTag: String,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(Color.Black.copy(alpha = 0.34f))
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag(testTag),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(label, style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = Color.White.copy(alpha = 0.78f))
        PantopusIconImage(icon = icon, contentDescription = null, size = 13.dp, tint = Color.White.copy(alpha = 0.78f))
    }
}

@Composable
private fun AiCoachPill(text: String) {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(Color(0xEA7C3AED))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("listingComposeAiCoachingPill"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Sparkles, contentDescription = null, size = Radii.lg, tint = Color.White)
        Text(text, style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = Color.White)
    }
}

@Composable
private fun CapturedAnglesTray(
    photos: List<ListingComposePhoto>,
    progressText: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = progressText.uppercase(),
            style = PantopusTextStyle.overline,
            color = Color.White.copy(alpha = 0.7f),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
            val labels = listOf("Wide", "Detail", "Tag", "Back")
            repeat(ListingComposeFormState.TARGET_CAPTURE_ANGLES) { index ->
                AngleSlot(
                    isFilled = index < photos.size,
                    label = labels[index],
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun AngleSlot(
    isFilled: Boolean,
    label: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .height(56.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (isFilled) Color(0xCC5C7A66) else Color.White.copy(alpha = 0.06f))
                .border(
                    width = 1.5.dp,
                    color = if (isFilled) Color.White else Color.White.copy(alpha = 0.55f),
                    shape = RoundedCornerShape(Radii.md),
                ),
        contentAlignment = Alignment.Center,
    ) {
        if (isFilled) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(Spacing.s1)
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.success),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.Check, contentDescription = null, size = 9.dp, tint = Color.White)
            }
        } else {
            Text(text = label.uppercase(), style = PantopusTextStyle.overline, color = Color.White.copy(alpha = 0.85f))
        }
    }
}

@Composable
private fun BottomTipPill() {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(Color.Black.copy(alpha = 0.52f))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.Lightbulb, contentDescription = null, size = Radii.lg, tint = Color.White.copy(alpha = 0.9f))
        Text(
            text = "Daylight · clutter-free background = better price",
            style = PantopusTextStyle.caption,
            color = Color.White.copy(alpha = 0.92f),
        )
    }
}

@Composable
private fun CameraRailButton(
    icon: PantopusIcon,
    label: String,
    testTag: String,
    onClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .size(48.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .background(Color.White.copy(alpha = 0.14f))
                .border(1.dp, Color.White.copy(alpha = 0.18f), RoundedCornerShape(Radii.lg))
                .clickable(role = Role.Button, onClick = onClick)
                .testTag(testTag),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 18.dp, tint = Color.White)
        Text(text = label.uppercase(), style = PantopusTextStyle.overline, color = Color.White)
    }
}

@Composable
private fun ShutterButton(onClick: () -> Unit) {
    Box(
        modifier =
            Modifier
                .size(72.dp)
                .clip(CircleShape)
                .border(4.dp, Color.White.copy(alpha = 0.95f), CircleShape)
                .clickable(role = Role.Button, onClick = onClick)
                .testTag("listingComposeShutter"),
        contentAlignment = Alignment.Center,
    ) {
        Box(modifier = Modifier.size(54.dp).clip(CircleShape).background(Color.White))
    }
}

// MARK: - Step 1B: Manual photos

@Composable
private fun PhotosStep(
    state: ListingComposeUiState,
    onAdd: () -> Unit,
    onRequestRemove: (ListingComposePhoto) -> Unit,
    onMoveUp: (Int) -> Unit,
    onMoveDown: (Int) -> Unit,
    onMakeHero: (String) -> Unit,
) {
    HeadlineBlock("Add photos")
    SubcopyBlock(
        "Show your item in good light. The first photo becomes the hero — long-press a tile to reorder, tap to remove.",
    )
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        modifier = Modifier.heightIn(max = 600.dp),
    ) {
        itemsIndexed(state.form.photos, key = { _, p -> p.id }) { index, photo ->
            PhotoTile(
                index = index,
                photo = photo,
                onTap = { onRequestRemove(photo) },
                onMoveUp = if (index > 0) ({ onMoveUp(index) }) else null,
                onMoveDown = if (index < state.form.photos.lastIndex) ({ onMoveDown(index) }) else null,
                onMakeHero = if (index > 0) ({ onMakeHero(photo.id) }) else null,
            )
        }
        if (state.form.photos.size < ListingComposeFormState.MAX_PHOTOS) {
            item {
                AddPhotoTile(onTap = onAdd)
            }
        }
    }
    Text(
        text = "${state.form.photos.size} of ${ListingComposeFormState.MAX_PHOTOS} photos",
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.testTag("listingCompose_photoCount"),
    )
}

@Composable
private fun PhotoTile(
    index: Int,
    photo: ListingComposePhoto,
    onTap: () -> Unit,
    onMoveUp: (() -> Unit)?,
    onMoveDown: (() -> Unit)?,
    onMakeHero: (() -> Unit)?,
) {
    Box(
        modifier =
            Modifier
                .aspectRatio(1f)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceMuted)
                .clickable(role = Role.Button, onClick = onTap)
                .testTag("listingCompose_photo_$index")
                .semantics {
                    contentDescription =
                        if (index == 0) {
                            "Photo ${index + 1} of grid. Hero photo. Tap to remove."
                        } else {
                            "Photo ${index + 1} of grid. Tap to remove."
                        }
                },
        contentAlignment = Alignment.Center,
    ) {
        ListingPhotoImage(
            photo = photo,
            placeholder = {
                PantopusIconImage(
                    icon = PantopusIcon.Image,
                    contentDescription = null,
                    size = 32.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            },
        )
        if (index == 0) {
            HeroChip(
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(Spacing.s2),
            )
        }
        // Hidden reorder controls reachable for accessibility / tests.
        Column(
            modifier = Modifier.align(Alignment.BottomEnd).padding(Spacing.s2),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            onMakeHero?.let {
                ReorderChip(
                    label = "Make hero",
                    testTag = "listingCompose_makeHero_$index",
                    onClick = it,
                )
            }
            onMoveUp?.let {
                ReorderChip(
                    label = "Move up",
                    testTag = "listingCompose_moveUp_$index",
                    onClick = it,
                )
            }
            onMoveDown?.let {
                ReorderChip(
                    label = "Move down",
                    testTag = "listingCompose_moveDown_$index",
                    onClick = it,
                )
            }
        }
    }
}

@Composable
private fun HeroChip(modifier: Modifier = Modifier) {
    Text(
        text = "HERO",
        style = PantopusTextStyle.overline,
        color = PantopusColors.appTextInverse,
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.primary600)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
    )
}

@Composable
private fun ReorderChip(
    label: String,
    testTag: String,
    onClick: () -> Unit,
) {
    Text(
        text = label,
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextInverse,
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.sm))
                .background(PantopusColors.appText)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .testTag(testTag),
    )
}

@Composable
private fun AddPhotoTile(onTap: () -> Unit) {
    Box(
        modifier =
            Modifier
                .aspectRatio(1f)
                .clip(RoundedCornerShape(Radii.lg))
                .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.lg))
                .clickable(role = Role.Button, onClick = onTap)
                .testTag("listingCompose_addPhoto")
                .semantics { contentDescription = "Add photo" },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Camera,
                contentDescription = null,
                size = 28.dp,
                tint = PantopusColors.appTextSecondary,
            )
            Text(
                text = "Add photo",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

// MARK: - Step 2: Snap review

@Composable
private fun SnapReviewStep(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
    onOpenLibrary: () -> Unit,
) {
    if (state.isAnalyzing) {
        AnalyzingBlock()
        return
    }
    IdentityChip()
    HeadlineBlock("Review your listing")
    SubcopyBlock("We pulled title, category, and price from your photos. Edit anything that looks off.")
    SnapPhotoStrip(photos = state.form.photos, onAddPhoto = onOpenLibrary)
    SuggestionsBanner(suggestion = state.form.priceSuggestion)
    SuggestedTitleField(state = state, vm = vm)
    SuggestedCategoryField(state = state, vm = vm)
    SuggestedPriceField(state = state, vm = vm)
    SuggestedConditionControl(state = state, vm = vm)
    PickupDeliveryPanel(state = state, vm = vm)
}

/**
 * Shimmer surface shown while the vision draft is in flight — mirrors
 * the loaded snap-review geometry (photo strip, banner, fields) so the
 * layout doesn't jump when suggestions resolve. iOS state:
 * `listingComposeAnalyzing`.
 */
@Composable
private fun AnalyzingBlock() {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("listingComposeAnalyzing"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PantopusIconImage(icon = PantopusIcon.Sparkles, contentDescription = null, size = 16.dp, tint = PantopusColors.business)
            Text(
                text = "Analyzing your photos…",
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
        }
        Text(
            text = "Pantopus is drafting your title, price, and details.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Shimmer(height = 168.dp, modifier = Modifier.fillMaxWidth())
        Shimmer(height = 52.dp, modifier = Modifier.fillMaxWidth())
        Shimmer(height = 44.dp, modifier = Modifier.fillMaxWidth())
        Shimmer(height = 44.dp, modifier = Modifier.fillMaxWidth())
        Shimmer(height = 96.dp, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun IdentityChip() {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(PantopusColors.personalBg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .testTag("listingComposeIdentityChip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = PantopusIcon.User, contentDescription = null, size = 11.dp, tint = PantopusColors.personal)
        Text(
            text = "Personal · You".uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.personal,
        )
    }
}

@Composable
private fun SnapPhotoStrip(
    photos: List<ListingComposePhoto>,
    onAddPhoto: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("listingComposePhotoStrip")) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Photos · ${photos.size} of ${ListingComposeFormState.MAX_PHOTOS}",
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextSecondary,
            )
            Box(modifier = Modifier.weight(1f))
            Row(
                modifier =
                    Modifier
                        .clip(CircleShape)
                        .background(PantopusColors.successLight)
                        .padding(horizontal = Spacing.s2, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(icon = PantopusIcon.Sparkles, contentDescription = null, size = 11.dp, tint = PantopusColors.success)
                Text("Good lighting", style = PantopusTextStyle.overline, color = PantopusColors.success)
            }
        }
        Row(modifier = Modifier.fillMaxWidth().height(168.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            SnapPhotoTile(
                index = 0,
                photo = photos.getOrNull(0),
                isHero = true,
                modifier = Modifier.weight(2f).fillMaxHeight(),
            )
            Column(modifier = Modifier.weight(2f).fillMaxHeight(), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    SnapPhotoTile(1, photos.getOrNull(1), modifier = Modifier.weight(1f).fillMaxHeight())
                    SnapPhotoTile(2, photos.getOrNull(2), modifier = Modifier.weight(1f).fillMaxHeight())
                }
                Row(modifier = Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    SnapPhotoTile(3, photos.getOrNull(3), modifier = Modifier.weight(1f).fillMaxHeight())
                    AddMoreSnapPhotoTile(onTap = onAddPhoto, modifier = Modifier.weight(1f).fillMaxHeight())
                }
            }
        }
    }
}

@Composable
private fun SnapPhotoTile(
    index: Int,
    photo: ListingComposePhoto?,
    modifier: Modifier = Modifier,
    isHero: Boolean = false,
) {
    val isFilled = photo != null
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(if (isHero) Radii.xl else Radii.lg))
                .background(
                    if (isFilled) {
                        Brush.linearGradient(listOf(Color(0xFF86A889), Color(0xFF48644F)))
                    } else {
                        Brush.linearGradient(listOf(PantopusColors.appSurfaceMuted, PantopusColors.appSurfaceMuted))
                    },
                )
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(if (isHero) Radii.xl else Radii.lg))
                .testTag("listingComposeSnapPhoto_$index"),
        contentAlignment = Alignment.Center,
    ) {
        if (photo != null) {
            ListingPhotoImage(photo = photo, placeholder = { SofaThumbMark() })
        } else {
            PantopusIconImage(icon = PantopusIcon.Image, contentDescription = null, size = if (isHero) 26.dp else 20.dp)
        }
        if (isHero && isFilled) {
            Text(
                text = "Cover".uppercase(),
                style = PantopusTextStyle.overline,
                color = Color.White,
                modifier =
                    Modifier
                        .align(Alignment.TopStart)
                        .padding(Spacing.s2)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.56f))
                        .padding(horizontal = Spacing.s2, vertical = 3.dp),
            )
        }
    }
}

@Composable
private fun SofaThumbMark() {
    Canvas(modifier = Modifier.fillMaxWidth().fillMaxHeight().padding(Spacing.s3)) {
        drawRoundRect(
            color = Color.White.copy(alpha = 0.20f),
            topLeft = Offset(size.width * 0.12f, size.height * 0.42f),
            size = Size(size.width * 0.76f, size.height * 0.34f),
            cornerRadius = CornerRadius(22f, 22f),
        )
        drawRoundRect(
            color = Color.White.copy(alpha = 0.24f),
            topLeft = Offset(size.width * 0.14f, size.height * 0.28f),
            size = Size(size.width * 0.72f, size.height * 0.25f),
            cornerRadius = CornerRadius(18f, 18f),
        )
    }
}

/**
 * Renders the real photo for a tile — local processed bytes for
 * camera/library picks, the hosted URL for remote photos, otherwise
 * the caller's placeholder.
 */
@Composable
private fun ListingPhotoImage(
    photo: ListingComposePhoto,
    placeholder: @Composable () -> Unit,
) {
    val localBitmap =
        remember(photo.id) {
            photo.localImageData?.let { bytes ->
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
            }
        }
    when {
        localBitmap != null ->
            Image(
                bitmap = localBitmap,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().fillMaxHeight(),
            )
        photo.isRemote ->
            AsyncImage(
                model = photo.token,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().fillMaxHeight(),
            )
        else -> placeholder()
    }
}

@Composable
private fun AddMoreSnapPhotoTile(
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceRaised)
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                .clickable(role = Role.Button, onClick = onTap)
                .testTag("listingComposeSnapAddPhoto"),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            PantopusIconImage(icon = PantopusIcon.Plus, contentDescription = null, size = 18.dp, tint = PantopusColors.appTextSecondary)
            Text("Add photo", style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun SuggestionsBanner(suggestion: ListingComposePriceSuggestion? = null) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.magicBgSoft)
                .border(1.dp, PantopusColors.magicBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = 10.dp)
                .testTag("listingComposeSuggestionsBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(28.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.magic),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = PantopusIcon.Sparkles, contentDescription = null, size = 14.dp, tint = Color.White)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "Snap-and-sell suggested everything below",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.magic,
            )
            val comparableCount = suggestion?.comparableCount
            Text(
                if (comparableCount != null && comparableCount > 0) {
                    "Tap any field to edit. Based on $comparableCount similar comps nearby."
                } else {
                    "Tap any field to edit."
                },
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun SuggestedTitleField(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
) {
    SuggestedFieldShell(label = "Title", hint = "Snap-and-sell pulled this from the photos") {
        BasicTextField(
            value = state.form.title,
            onValueChange = vm::setTitle,
            textStyle = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold, color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.primary600),
            singleLine = true,
            modifier = Modifier.weight(1f).testTag("listingComposeSnapTitle"),
        )
        PantopusIconImage(icon = PantopusIcon.Pencil, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun SuggestedCategoryField(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
) {
    SuggestedFieldShell(label = "Category") {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.fillMaxWidth()) {
            ListingComposeCategory.entries.forEach { category ->
                CategoryChip(
                    category = category,
                    selected = state.form.category == category,
                    onClick = { vm.setCategory(category) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun CategoryChip(
    category: ListingComposeCategory,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Text(
        text = category.label,
        style = PantopusTextStyle.caption,
        fontWeight = FontWeight.Bold,
        color = if (selected) PantopusColors.goods else PantopusColors.appTextSecondary,
        modifier =
            modifier
                .clip(CircleShape)
                .background(if (selected) PantopusColors.magicBgSoft else PantopusColors.appSurfaceRaised)
                .border(1.dp, if (selected) PantopusColors.goods else PantopusColors.appBorder, CircleShape)
                .clickable(role = Role.Button, onClick = onClick)
                .padding(horizontal = Spacing.s2, vertical = 7.dp)
                .testTag("listingComposeSnapCategory_${category.key}"),
    )
}

@Composable
private fun SuggestedPriceField(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("listingComposeSnapPrice")) {
        SuggestedLabel("Price")
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("$", style = PantopusTextStyle.h3, color = PantopusColors.appText)
                BasicTextField(
                    value = state.form.priceAmount,
                    onValueChange = vm::setPriceAmount,
                    textStyle = PantopusTextStyle.h2.copy(color = PantopusColors.appText, fontWeight = FontWeight.Bold),
                    cursorBrush = SolidColor(PantopusColors.primary600),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                )
                Text("USD · firm", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
            state.form.priceSuggestion?.let { suggestion ->
                PriceCompRangeTrack(
                    suggestion = suggestion,
                    currentPrice = state.form.priceAmount.toDoubleOrNull(),
                )
            }
        }
    }
}

/**
 * Low–high comp band with a thumb at the current price (or median).
 * Domain pads the band by 30% on either side so the thumb has room —
 * mirrors iOS `PriceCompRangeTrack`.
 */
@Composable
private fun PriceCompRangeTrack(
    suggestion: ListingComposePriceSuggestion,
    currentPrice: Double?,
) {
    val pad = maxOf((suggestion.high - suggestion.low) * 0.3, 1.0)
    val domainStart = suggestion.low - pad
    val domainSpan = (suggestion.high + pad) - domainStart
    val fraction = { value: Double ->
        if (domainSpan <= 0) {
            0.5f
        } else {
            ((value.coerceIn(domainStart, domainStart + domainSpan) - domainStart) / domainSpan).toFloat()
        }
    }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("listingComposeCompRange")) {
        Canvas(modifier = Modifier.fillMaxWidth().height(12.dp)) {
            val y = size.height / 2f
            drawLine(
                color = PantopusColors.appSurfaceSunken,
                start = Offset(0f, y),
                end = Offset(size.width, y),
                strokeWidth = 6f,
                cap = StrokeCap.Round,
            )
            drawLine(
                color = PantopusColors.successLight,
                start = Offset(size.width * fraction(suggestion.low), y),
                end = Offset(size.width * fraction(suggestion.high), y),
                strokeWidth = 6f,
                cap = StrokeCap.Round,
            )
            val thumbX = size.width * fraction(currentPrice ?: suggestion.median)
            drawCircle(color = Color.White, radius = 8f, center = Offset(thumbX, y))
            drawCircle(color = PantopusColors.primary600, radius = 6f, center = Offset(thumbX, y))
        }
        val low = ListingComposeVisionMapping.formatAmount(suggestion.low)
        val median = ListingComposeVisionMapping.formatAmount(suggestion.median)
        val high = ListingComposeVisionMapping.formatAmount(suggestion.high)
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("\$$low low", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            Box(modifier = Modifier.weight(1f))
            Text(
                "\$$median typical",
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.success,
            )
            Box(modifier = Modifier.weight(1f))
            Text("\$$high high", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun SuggestedConditionControl(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SectionLabel("Condition")
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1), modifier = Modifier.fillMaxWidth()) {
            ListingComposeCondition.entries.forEach { condition ->
                val selected = state.form.condition == condition
                Text(
                    text = condition.shortLabel,
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.Bold,
                    color = if (selected) PantopusColors.primary700 else PantopusColors.appTextStrong,
                    modifier =
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurface)
                            .border(
                                width = if (selected) 1.5.dp else 1.dp,
                                color = if (selected) PantopusColors.primary600 else PantopusColors.appBorder,
                                shape = RoundedCornerShape(Radii.md),
                            )
                            .clickable(role = Role.Button, onClick = { vm.setCondition(condition) })
                            .padding(vertical = 9.dp)
                            .testTag("listingComposeSnapCondition_${condition.key}"),
                )
            }
        }
        Text(
            "Light wear on one cushion · minor sun fade. Add notes in description.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

private val ListingComposeCondition.shortLabel: String
    get() =
        when (this) {
            ListingComposeCondition.New -> "New"
            ListingComposeCondition.LikeNew -> "Like new"
            ListingComposeCondition.Good -> "Good"
            ListingComposeCondition.Fair -> "Fair"
            ListingComposeCondition.ForParts -> "Parts"
        }

@Composable
private fun PickupDeliveryPanel(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("listingComposePickupDelivery")) {
        SectionLabel("Pickup & delivery")
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                Box(
                    modifier = Modifier.size(28.dp).clip(RoundedCornerShape(Radii.md)).background(PantopusColors.primary50),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(icon = PantopusIcon.MapPin, contentDescription = null, size = 14.dp, tint = PantopusColors.primary600)
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        "412 Elm St · West Loop",
                        style = PantopusTextStyle.caption,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        "Shown as approximate location to buyers",
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 14.dp,
                    tint = PantopusColors.appTextMuted,
                )
            }
            HorizontalDivider(color = PantopusColors.appBorder)
            Column(modifier = Modifier.padding(Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                FulfillmentToggleRow(
                    icon = PantopusIcon.HandCoins,
                    title = "Local pickup",
                    subtitle = "Buyers come to you",
                    isOn = state.form.fulfillment == ListingComposeFulfillment.Pickup,
                    onClick = { vm.setFulfillment(ListingComposeFulfillment.Pickup) },
                )
                FulfillmentToggleRow(
                    icon = PantopusIcon.Package,
                    title = "Local delivery",
                    subtitle = "Up to 3 mi · $40 fee",
                    isOn = state.form.deliveryEnabled,
                    onClick = { vm.setDeliveryEnabled(!state.form.deliveryEnabled) },
                )
                FulfillmentToggleRow(
                    icon = PantopusIcon.Package,
                    title = "Ship nationwide",
                    subtitle = "Too large to ship",
                    isOn = false,
                    enabled = false,
                    onClick = {},
                )
            }
        }
    }
}

@Composable
private fun FulfillmentToggleRow(
    icon: PantopusIcon,
    title: String,
    subtitle: String,
    isOn: Boolean,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(enabled = enabled, role = Role.Button, onClick = onClick)
                .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 15.dp, tint = PantopusColors.appTextSecondary)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(title, style = PantopusTextStyle.caption, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(subtitle, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        TogglePill(isOn = isOn)
    }
}

@Composable
private fun TogglePill(isOn: Boolean) {
    Box(
        modifier =
            Modifier
                .width(32.dp)
                .height(18.dp)
                .clip(CircleShape)
                .background(if (isOn) PantopusColors.primary600 else PantopusColors.appBorderStrong),
    ) {
        Box(
            modifier =
                Modifier
                    .align(if (isOn) Alignment.CenterEnd else Alignment.CenterStart)
                    .padding(2.dp)
                    .size(14.dp)
                    .clip(CircleShape)
                    .background(Color.White),
        )
    }
}

@Composable
private fun SuggestedFieldShell(
    label: String,
    hint: String? = null,
    content: @Composable RowScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SuggestedLabel(label)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(horizontal = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            content()
        }
        hint?.let {
            Text(it, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
    }
}

@Composable
private fun SuggestedLabel(label: String) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label.uppercase(), style = PantopusTextStyle.overline, color = PantopusColors.appTextSecondary)
        Box(modifier = Modifier.weight(1f))
        Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
            PantopusIconImage(icon = PantopusIcon.Sparkles, contentDescription = null, size = 10.dp, tint = PantopusColors.magic)
            Text("AI suggested", style = PantopusTextStyle.overline, color = PantopusColors.magic)
        }
    }
}

// MARK: - Step 2: Title + Category

@Composable
private fun TitleCategoryStep(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
) {
    HeadlineBlock("Name it & pick a category")
    SubcopyBlock("Keep the title short and specific — buyers scan in a glance.")
    val titleLength = state.form.title.trim().length
    val titleState =
        when {
            titleLength == 0 -> PantopusFieldState.Default
            titleLength < ListingComposeFormState.TITLE_MIN_LENGTH ->
                PantopusFieldState.Error("Title must be at least ${ListingComposeFormState.TITLE_MIN_LENGTH} characters.")
            titleLength > ListingComposeFormState.TITLE_MAX_LENGTH ->
                PantopusFieldState.Error("Title must be at most ${ListingComposeFormState.TITLE_MAX_LENGTH} characters.")
            else -> PantopusFieldState.Valid
        }
    PantopusTextField(
        label = "Title",
        value = state.form.title,
        onValueChange = vm::setTitle,
        placeholder = "Moving boxes — bundle of 18",
        state = titleState,
        fieldTestTag = "listingCompose_title",
    )
    Text(
        text = "$titleLength/${ListingComposeFormState.TITLE_MAX_LENGTH}",
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.fillMaxWidth(),
    )
    SectionLabel("Category")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ListingComposeCategory.entries.forEach { category ->
            CategoryRow(
                category = category,
                isSelected = state.form.category == category,
                onTap = { vm.setCategory(category) },
            )
        }
    }
}

@Composable
private fun CategoryRow(
    category: ListingComposeCategory,
    isSelected: Boolean,
    onTap: () -> Unit,
) {
    RadioOptionRow(
        title = category.label,
        subtitle = category.subtitle,
        isSelected = isSelected,
        testTag = "listingCompose_category_${category.key}",
        onTap = onTap,
    )
}

// MARK: - Step 3: Condition + Description

@Composable
private fun ConditionDescriptionStep(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
) {
    HeadlineBlock("Condition & details")
    SubcopyBlock("Buyers want to know what they're getting before they message you.")
    if (state.form.category?.requiresCondition == true) {
        SectionLabel("Condition")
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ListingComposeCondition.entries.forEach { condition ->
                RadioOptionRow(
                    title = condition.label,
                    subtitle = condition.subtitle,
                    isSelected = state.form.condition == condition,
                    testTag = "listingCompose_condition_${condition.key}",
                    onTap = { vm.setCondition(condition) },
                )
            }
        }
    }
    SectionLabel("Description")
    val descLength = state.form.bodyText.trim().length
    val borderColor =
        when {
            descLength == 0 -> PantopusColors.appBorder
            descLength < ListingComposeFormState.DESCRIPTION_MIN_LENGTH -> PantopusColors.error
            descLength > ListingComposeFormState.DESCRIPTION_MAX_LENGTH -> PantopusColors.error
            else -> PantopusColors.appBorder
        }
    BasicTextField(
        value = state.form.bodyText,
        onValueChange = vm::setBody,
        textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
        cursorBrush = SolidColor(PantopusColors.primary600),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 128.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = borderColor,
                    shape = RoundedCornerShape(Radii.md),
                )
                .padding(Spacing.s3)
                .testTag("listingCompose_description"),
    )
    Row(modifier = Modifier.fillMaxWidth()) {
        if (descLength in 1 until ListingComposeFormState.DESCRIPTION_MIN_LENGTH) {
            Text(
                text = "At least ${ListingComposeFormState.DESCRIPTION_MIN_LENGTH} characters",
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
        Box(modifier = Modifier.weight(1f))
        Text(
            text = "$descLength/${ListingComposeFormState.DESCRIPTION_MAX_LENGTH}",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

// MARK: - Step 4: Price

@Composable
private fun PriceStep(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
) {
    HeadlineBlock("Pricing & fulfillment")
    SubcopyBlock("Choose how to price it and how the buyer will receive it.")
    SectionLabel("Pricing")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ListingComposePriceKind.entries.forEach { kind ->
            RadioOptionRow(
                title = kind.label,
                subtitle = kind.subtitle,
                isSelected = state.form.priceKind == kind,
                testTag = "listingCompose_priceKind_${kind.key}",
                onTap = { vm.setPriceKind(kind) },
            )
        }
    }
    if (state.form.priceKind == ListingComposePriceKind.Fixed ||
        state.form.priceKind == ListingComposePriceKind.Negotiable
    ) {
        val amount = state.form.priceAmount
        val priceState =
            when {
                amount.isEmpty() -> PantopusFieldState.Default
                (amount.toDoubleOrNull() ?: 0.0) <= 0.0 ->
                    PantopusFieldState.Error("Enter an amount greater than zero.")
                else -> PantopusFieldState.Valid
            }
        PantopusTextField(
            label = "Amount (USD)",
            value = amount,
            onValueChange = vm::setPriceAmount,
            placeholder = "0.00",
            state = priceState,
            keyboardType = KeyboardType.Decimal,
            fieldTestTag = "listingCompose_priceAmount",
        )
    }
    SectionLabel("Fulfillment")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ListingComposeFulfillment.entries.forEach { kind ->
            RadioOptionRow(
                title = kind.label,
                subtitle = kind.subtitle,
                isSelected = state.form.fulfillment == kind,
                testTag = "listingCompose_fulfillment_${kind.key}",
                onTap = { vm.setFulfillment(kind) },
            )
        }
    }
}

// MARK: - Step 5: Location

@Composable
private fun LocationStep(
    state: ListingComposeUiState,
    vm: ListingComposeWizardViewModel,
) {
    HeadlineBlock("Where will the handoff happen?")
    SubcopyBlock("Your exact address is only shared with the buyer after both sides commit.")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ListingComposeLocationKind.entries.forEach { kind ->
            RadioOptionRow(
                title = kind.label,
                subtitle = kind.subtitle,
                isSelected = state.form.locationKind == kind,
                testTag = "listingCompose_locationKind_${kind.key}",
                onTap = { vm.setLocationKind(kind) },
            )
        }
    }
    if (state.form.locationKind == ListingComposeLocationKind.MeetPoint) {
        PantopusTextField(
            label = "Meet point name",
            value = state.form.locationLabel,
            onValueChange = vm::setLocationLabel,
            placeholder = "Lincoln Park bandshell",
            fieldTestTag = "listingCompose_locationLabel",
        )
    }
}

// MARK: - Step 6: Review

@Composable
private fun ReviewStep(state: ListingComposeUiState) {
    HeadlineBlock("Review & list")
    SubcopyBlock("Take one last look — you can edit after listing.")
    val rows = buildReviewRows(state)
    ReviewSummaryBlock(rows = rows)
}

private fun buildReviewRows(state: ListingComposeUiState): List<ReviewSummaryRow> {
    val rows = mutableListOf<ReviewSummaryRow>()
    rows += ReviewSummaryRow("Photos", photoSummary(state.form))
    rows += ReviewSummaryRow("Title", state.form.title.trim())
    rows += ReviewSummaryRow("Category", state.form.category?.label ?: "—")
    state.form.condition?.let {
        rows += ReviewSummaryRow("Condition", it.label)
    }
    rows += ReviewSummaryRow("Description", state.form.bodyText.trim())
    rows += ReviewSummaryRow("Price", priceSummary(state.form))
    rows += ReviewSummaryRow("Fulfillment", state.form.fulfillment.label)
    rows += ReviewSummaryRow("Location", locationSummary(state.form))
    return rows
}

private fun photoSummary(form: ListingComposeFormState): String {
    val count = form.photos.size
    if (count == 0) return "0 photos"
    return "$count photo${if (count == 1) "" else "s"} (hero first)"
}

private fun priceSummary(form: ListingComposeFormState): String {
    val kind = form.priceKind ?: return "—"
    return when (kind) {
        ListingComposePriceKind.Free -> "Free"
        ListingComposePriceKind.Fixed ->
            if (form.priceAmount.isEmpty()) "—" else "\$${form.priceAmount}"
        ListingComposePriceKind.Negotiable ->
            if (form.priceAmount.isEmpty()) {
                "Open to offers"
            } else {
                "\$${form.priceAmount} · open to offers"
            }
    }
}

private fun locationSummary(form: ListingComposeFormState): String {
    val kind = form.locationKind ?: return "—"
    return when (kind) {
        ListingComposeLocationKind.SavedAddress -> kind.label
        ListingComposeLocationKind.MeetPoint ->
            if (form.locationLabel.isEmpty()) kind.label else "${kind.label} · ${form.locationLabel}"
    }
}

// MARK: - Success

@Composable
private fun SuccessStep() {
    SuccessHeroBlock(
        headline = "Your listing is live",
        subcopy = "Neighbors can find it in Marketplace now. We'll notify you when an offer comes in.",
    )
}

// MARK: - Shared

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.fillMaxWidth().semantics { heading() },
    )
}

@Composable
private fun RadioOptionRow(
    title: String,
    subtitle: String,
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
                .border(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = borderColor,
                    shape = RoundedCornerShape(Radii.md),
                )
                .clickable(role = Role.RadioButton, onClick = onTap)
                .padding(Spacing.s3)
                .testTag(testTag)
                .semantics { contentDescription = title },
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        RadioCircle(isSelected = isSelected)
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            Text(
                text = title,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
            Text(
                text = subtitle,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
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

/**
 * Internal preview body that renders a single wizard step inline (no
 * `WizardShell`, no view model). Used by Paparazzi snapshot tests to
 * lock the visual contract for each step without standing up Hilt.
 */
@Composable
internal fun ListingComposeStepPreview(
    state: ListingComposeUiState,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        when (state.form.currentStep) {
            ListingComposeStep.Photos ->
                if (state.form.entryMode == ListingComposeEntryMode.Snap) {
                    CameraCapturePreview(state)
                } else {
                    PhotosStep(
                        state = state,
                        onAdd = {},
                        onRequestRemove = {},
                        onMoveUp = {},
                        onMoveDown = {},
                        onMakeHero = {},
                    )
                }
            ListingComposeStep.TitleCategory ->
                if (state.form.entryMode == ListingComposeEntryMode.Snap) {
                    SnapReviewStepPreview(state)
                } else {
                    TitleCategoryStepPreview(state)
                }
            ListingComposeStep.ConditionDescription -> ConditionDescriptionStepPreview(state)
            ListingComposeStep.Price -> PriceStepPreview(state)
            ListingComposeStep.Location -> LocationStepPreview(state)
            ListingComposeStep.Review -> ReviewStep(state)
            ListingComposeStep.Success -> SuccessStep()
        }
        state.errorMessage?.let { ErrorBanner(it) }
    }
}

@Composable
internal fun ListingComposeSnapCameraPreview(
    state: ListingComposeUiState,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
    ) {
        CameraCapturePreview(state)
    }
}

@Composable
internal fun ListingComposeSnapReviewPreview(
    state: ListingComposeUiState,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier =
            modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        SnapReviewStepPreview(state)
    }
}

@Composable
private fun CameraCapturePreview(state: ListingComposeUiState) {
    val count = state.form.photos.size
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(612.dp)
                .clip(RoundedCornerShape(Radii.xl))
                .background(Color(0xFF0A0B0D))
                .testTag("listingComposeCameraStep"),
    ) {
        CameraSceneOverlay()
        RuleOfThirdsGrid(modifier = Modifier.padding(horizontal = 28.dp, vertical = 96.dp))
        FramingBrackets(modifier = Modifier.padding(horizontal = 28.dp, vertical = 96.dp))
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s4),
        ) {
            GhostCameraPill(
                label = "Skip to manual",
                icon = PantopusIcon.ArrowRight,
                testTag = "listingComposeSkipManual",
                onClick = {},
            )
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = Spacing.s3),
                horizontalArrangement = Arrangement.Center,
            ) {
                AiCoachPill(snapCoachingText(count))
            }
            CapturedAnglesTray(
                photos = state.form.photos,
                progressText = snapProgressText(count),
                modifier = Modifier.padding(top = Spacing.s4),
            )
        }
        Column(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s5),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s4),
        ) {
            BottomTipPill()
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                CameraRailButton(PantopusIcon.Image, "Library", "listingComposeLibraryPhoto") {}
                Box(modifier = Modifier.weight(1f))
                ShutterButton {}
                Box(modifier = Modifier.weight(1f))
                CameraRailButton(PantopusIcon.Zap, "Auto", "listingComposeFlash") {}
            }
        }
    }
}

private fun snapCoachingText(count: Int): String =
    when (count) {
        0 -> "Center the whole item · step back a bit"
        1 -> "Get a wider shot for scale"
        2 -> "Move closer for fabric and wear"
        else -> "Looks great — capture now"
    }

private fun snapProgressText(count: Int): String {
    val captured = count.coerceAtMost(ListingComposeFormState.TARGET_CAPTURE_ANGLES)
    val remaining = (ListingComposeFormState.TARGET_CAPTURE_ANGLES - captured).coerceAtLeast(0)
    return if (remaining == 0) "$captured of 4 angles · ready to review" else "$captured of 4 angles · add $remaining more"
}

@Composable
private fun SnapReviewStepPreview(state: ListingComposeUiState) {
    IdentityChip()
    HeadlineBlock("Review your listing")
    SubcopyBlock("We pulled title, category, and price from your photos. Edit anything that looks off.")
    SnapPhotoStrip(photos = state.form.photos, onAddPhoto = {})
    SuggestionsBanner(suggestion = state.form.priceSuggestion ?: previewPriceSuggestion)
    ReadOnlySuggestedField("Title", state.form.title, "Snap-and-sell pulled this from the photos")
    ReadOnlySuggestedField("Category", state.form.category?.label ?: "Goods")
    SuggestedPriceReadOnly(
        amount = state.form.priceAmount.ifEmpty { "280" },
        suggestion = state.form.priceSuggestion ?: previewPriceSuggestion,
    )
    StaticConditionControl(state.form.condition ?: ListingComposeCondition.Good)
    StaticPickupDeliveryPanel(state.form.deliveryEnabled)
}

/** Fixed comp band for Paparazzi previews of the snap-review step. */
private val previewPriceSuggestion =
    ListingComposePriceSuggestion(low = 180.0, median = 280.0, high = 420.0, basis = null, comparableCount = 47)

@Composable
private fun ReadOnlySuggestedField(
    label: String,
    value: String,
    hint: String? = null,
) {
    SuggestedFieldShell(label = label, hint = hint) {
        Text(
            text = value,
            style = PantopusTextStyle.body,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
            modifier = Modifier.weight(1f),
        )
        PantopusIconImage(icon = PantopusIcon.Pencil, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun SuggestedPriceReadOnly(
    amount: String,
    suggestion: ListingComposePriceSuggestion,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.testTag("listingComposeSnapPrice")) {
        SuggestedLabel("Price")
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("$", style = PantopusTextStyle.h3, color = PantopusColors.appText)
                Text(amount, style = PantopusTextStyle.h2, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
                Box(modifier = Modifier.weight(1f))
                Text("USD · firm", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            }
            PriceCompRangeTrack(suggestion = suggestion, currentPrice = amount.toDoubleOrNull())
        }
    }
}

@Composable
private fun StaticConditionControl(selected: ListingComposeCondition) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SectionLabel("Condition")
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1), modifier = Modifier.fillMaxWidth()) {
            ListingComposeCondition.entries.forEach { condition ->
                val active = selected == condition
                Text(
                    text = condition.shortLabel,
                    style = PantopusTextStyle.caption,
                    fontWeight = FontWeight.Bold,
                    color = if (active) PantopusColors.primary700 else PantopusColors.appTextStrong,
                    modifier =
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(if (active) PantopusColors.primary50 else PantopusColors.appSurface)
                            .border(
                                width = if (active) 1.5.dp else 1.dp,
                                color = if (active) PantopusColors.primary600 else PantopusColors.appBorder,
                                shape = RoundedCornerShape(Radii.md),
                            )
                            .padding(vertical = 9.dp),
                )
            }
        }
    }
}

@Composable
private fun StaticPickupDeliveryPanel(deliveryEnabled: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        SectionLabel("Pickup & delivery")
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            FulfillmentToggleRow(PantopusIcon.HandCoins, "Local pickup", "Buyers come to you", true, onClick = {})
            FulfillmentToggleRow(PantopusIcon.Package, "Local delivery", "Up to 3 mi · $40 fee", deliveryEnabled, onClick = {})
            FulfillmentToggleRow(PantopusIcon.Package, "Ship nationwide", "Too large to ship", false, enabled = false, onClick = {})
        }
    }
}

@Composable
private fun TitleCategoryStepPreview(state: ListingComposeUiState) {
    HeadlineBlock("Name it & pick a category")
    SubcopyBlock("Keep the title short and specific — buyers scan in a glance.")
    val titleLength = state.form.title.trim().length
    PantopusTextField(
        label = "Title",
        value = state.form.title,
        onValueChange = {},
        placeholder = "Moving boxes — bundle of 18",
        fieldTestTag = "listingCompose_title",
    )
    Text(
        text = "$titleLength/${ListingComposeFormState.TITLE_MAX_LENGTH}",
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.fillMaxWidth(),
    )
    SectionLabel("Category")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ListingComposeCategory.entries.forEach { category ->
            RadioOptionRow(
                title = category.label,
                subtitle = category.subtitle,
                isSelected = state.form.category == category,
                testTag = "listingCompose_category_${category.key}",
                onTap = {},
            )
        }
    }
}

@Composable
private fun ConditionDescriptionStepPreview(state: ListingComposeUiState) {
    HeadlineBlock("Condition & details")
    SubcopyBlock("Buyers want to know what they're getting before they message you.")
    if (state.form.category?.requiresCondition == true) {
        SectionLabel("Condition")
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            ListingComposeCondition.entries.forEach { condition ->
                RadioOptionRow(
                    title = condition.label,
                    subtitle = condition.subtitle,
                    isSelected = state.form.condition == condition,
                    testTag = "listingCompose_condition_${condition.key}",
                    onTap = {},
                )
            }
        }
    }
    SectionLabel("Description")
    BasicTextField(
        value = state.form.bodyText,
        onValueChange = {},
        textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
        cursorBrush = SolidColor(PantopusColors.primary600),
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 128.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.md),
                )
                .padding(Spacing.s3)
                .testTag("listingCompose_description"),
    )
}

@Composable
private fun PriceStepPreview(state: ListingComposeUiState) {
    HeadlineBlock("Pricing & fulfillment")
    SubcopyBlock("Choose how to price it and how the buyer will receive it.")
    SectionLabel("Pricing")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ListingComposePriceKind.entries.forEach { kind ->
            RadioOptionRow(
                title = kind.label,
                subtitle = kind.subtitle,
                isSelected = state.form.priceKind == kind,
                testTag = "listingCompose_priceKind_${kind.key}",
                onTap = {},
            )
        }
    }
    if (state.form.priceKind == ListingComposePriceKind.Fixed ||
        state.form.priceKind == ListingComposePriceKind.Negotiable
    ) {
        PantopusTextField(
            label = "Amount (USD)",
            value = state.form.priceAmount,
            onValueChange = {},
            placeholder = "0.00",
            keyboardType = KeyboardType.Decimal,
            fieldTestTag = "listingCompose_priceAmount",
        )
    }
    SectionLabel("Fulfillment")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ListingComposeFulfillment.entries.forEach { kind ->
            RadioOptionRow(
                title = kind.label,
                subtitle = kind.subtitle,
                isSelected = state.form.fulfillment == kind,
                testTag = "listingCompose_fulfillment_${kind.key}",
                onTap = {},
            )
        }
    }
}

@Composable
private fun LocationStepPreview(state: ListingComposeUiState) {
    HeadlineBlock("Where will the handoff happen?")
    SubcopyBlock("Your exact address is only shared with the buyer after both sides commit.")
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        ListingComposeLocationKind.entries.forEach { kind ->
            RadioOptionRow(
                title = kind.label,
                subtitle = kind.subtitle,
                isSelected = state.form.locationKind == kind,
                testTag = "listingCompose_locationKind_${kind.key}",
                onTap = {},
            )
        }
    }
    if (state.form.locationKind == ListingComposeLocationKind.MeetPoint) {
        PantopusTextField(
            label = "Meet point name",
            value = state.form.locationLabel,
            onValueChange = {},
            placeholder = "Lincoln Park bandshell",
            fieldTestTag = "listingCompose_locationLabel",
        )
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
                .testTag("listingComposeErrorBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 18.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.error,
        )
    }
}

/**
 * P3.3 — Shimmer placeholder shown while the edit-mode prefill fetch
 * is in flight. Mirrors the rough geometry of the loaded review step
 * (title block + a few rows + a body block) so the layout doesn't jump
 * when the real fields land.
 */
@Composable
private fun EditPrefillLoadingBlock() {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("listingComposeEditLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Shimmer(width = 180.dp, height = 24.dp)
        Shimmer(width = 320.dp, height = 16.dp, modifier = Modifier.fillMaxWidth())
        Shimmer(width = 240.dp, height = 16.dp)
        Shimmer(width = 320.dp, height = 128.dp, modifier = Modifier.fillMaxWidth())
    }
}

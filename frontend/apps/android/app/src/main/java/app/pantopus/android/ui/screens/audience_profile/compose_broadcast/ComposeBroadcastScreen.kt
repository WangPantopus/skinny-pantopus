@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "TooManyFunctions")
@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package app.pantopus.android.ui.screens.audience_profile.compose_broadcast

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
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.rememberTimePickerState
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.audience_profile.tierColor
import app.pantopus.android.ui.screens.compose.placepicker.MediaLocationExtractor
import app.pantopus.android.ui.screens.compose.placepicker.PlacePickerSheet
import app.pantopus.android.ui.screens.compose.placepicker.PostPlaceTag
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Calendar
import java.util.Locale

@Composable
fun ComposeBroadcastScreen(
    onClose: () -> Unit = {},
    onSent: () -> Unit = {},
    viewModel: ComposeBroadcastViewModel = hiltViewModel(),
) {
    val uiState by viewModel.state.collectAsStateWithLifecycle()
    val recentsLoading by viewModel.recentsLoading.collectAsStateWithLifecycle()
    val recentsError by viewModel.recentsError.collectAsStateWithLifecycle()
    val context = LocalContext.current
    LaunchedEffect(Unit) { viewModel.load() }

    // Picker launcher lives on the screen (not the scaffold) so the
    // scaffold renders under Paparazzi without an ActivityResultRegistryOwner.
    val scope = rememberCoroutineScope()
    // Multi-select up to the remaining slots — RN parity
    // (`pickPostMediaFromLibrary(9 - mediaFiles.length)`).
    val remainingSlots = uiState.draft.remainingMediaSlots
    val photoPicker =
        rememberLauncherForActivityResult(
            // The contract is remembered once, so it carries the hard cap;
            // the callback trims to whatever slots are free right now.
            contract = ActivityResultContracts.PickMultipleVisualMedia(ComposeBroadcastDraft.MEDIA_LIMIT),
        ) { uris: List<Uri> ->
            if (uris.isEmpty()) return@rememberLauncherForActivityResult
            scope.launch {
                val picked =
                    withContext(Dispatchers.IO) {
                        // Capture-location extraction runs AFTER the
                        // take(remainingSlots) trim, so only attachments
                        // that actually land in the draft are read.
                        uris.take(remainingSlots).mapNotNull { uri ->
                            val mime = context.contentResolver.getType(uri) ?: "image/jpeg"
                            val bytes =
                                runCatching {
                                    context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                                }.getOrNull() ?: return@mapNotNull null
                            val isVideo = mime.startsWith("video")
                            // Capture-location anchor (ADDENDUM 2): a
                            // LOCAL place-picker anchor only — never
                            // auto-attached to the outgoing broadcast
                            // body. Videos need the picker URI
                            // (MediaMetadataRetriever can't read bytes),
                            // so extraction happens here while the URI is
                            // still in scope; the URI is not kept beyond
                            // this callback. On API 29+ the system photo
                            // picker redacts location metadata at read
                            // time (ACCESS_MEDIA_LOCATION does not apply
                            // to picker URIs), so this legitimately
                            // returns null there → no anchor chips;
                            // API 26-28 media still carries it.
                            val captured =
                                if (isVideo) {
                                    MediaLocationExtractor.fromVideoUri(context, uri)
                                } else {
                                    MediaLocationExtractor.fromImageBytes(bytes)
                                }
                            ComposeMediaPreview(
                                id = uri.toString(),
                                kind = if (isVideo) ComposeMediaPreview.Kind.Video else ComposeMediaPreview.Kind.Image,
                                caption = if (isVideo) "Video attached" else "Photo attached",
                                bytes = bytes,
                                mimeType = mime,
                                capturedLatitude = captured?.latitude,
                                capturedLongitude = captured?.longitude,
                            )
                        }
                    }
                viewModel.attachMedia(picked)
            }
        }

    // The place-picker sheet lives on the screen (not the scaffold) for the
    // same reason as the photo picker: it hosts a runtime-permission
    // launcher + Hilt view-model, which Paparazzi can't provide.
    var showPlacePicker by remember { mutableStateOf(false) }

    ComposeBroadcastScaffold(
        uiState = uiState,
        onClose = onClose,
        onBodyChange = viewModel::updateBody,
        onAudienceSelected = viewModel::setAudience,
        onAddLocation = { showPlacePicker = true },
        onClearLocation = viewModel::clearPlaceTag,
        onLaunchPhotoPicker = {
            if (remainingSlots > 0) {
                photoPicker.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo),
                )
            }
        },
        onRemoveMedia = { id -> viewModel.removeMedia(id) },
        onScheduleConfirm = viewModel::schedule,
        onSendNow = viewModel::sendNow,
        onSaveDraft = viewModel::saveDraft,
        onSend = { viewModel.send(onSent = onSent) },
        onRetry = viewModel::retry,
        recentsLoading = recentsLoading,
        recentsError = recentsError,
        onRetryRecents = viewModel::load,
    )

    if (showPlacePicker) {
        PlacePickerSheet(
            currentTag = uiState.draft.placeTag,
            // Media capture anchor, read at presentation time so it
            // tracks the current attachment set (the sheet re-seeds its
            // VM on every open).
            mediaLocation = uiState.draft.mediaCaptureLocation,
            onSelect = { tag ->
                viewModel.selectPlaceTag(tag)
                showPlacePicker = false
            },
            onRemove = {
                viewModel.clearPlaceTag()
                showPlacePicker = false
            },
            onDismiss = { showPlacePicker = false },
        )
    }
}

@Suppress("LongParameterList")
@Composable
internal fun ComposeBroadcastScaffold(
    uiState: ComposeBroadcastUiState,
    onClose: () -> Unit = {},
    onBodyChange: (String) -> Unit = {},
    onAudienceSelected: (BroadcastAudience) -> Unit = {},
    onAddLocation: () -> Unit = {},
    onClearLocation: () -> Unit = {},
    onLaunchPhotoPicker: () -> Unit = {},
    onRemoveMedia: (String) -> Unit = {},
    onScheduleConfirm: (Long) -> Unit = {},
    onSendNow: () -> Unit = {},
    onSaveDraft: () -> Unit = {},
    onSend: () -> Unit = {},
    onRetry: () -> Unit = {},
    recentsLoading: Boolean = false,
    recentsError: String? = null,
    onRetryRecents: () -> Unit = {},
) {
    var showAudienceSheet by remember { mutableStateOf(false) }
    var showScheduleSheet by remember { mutableStateOf(false) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("composeBroadcast"),
    ) {
        TopBar(isDirty = uiState.isDirty, onClose = onClose, onSaveDraft = onSaveDraft)
        Box(modifier = Modifier.weight(1f)) {
            Scaffold(
                modifier = Modifier.fillMaxSize(),
                containerColor = PantopusColors.appBg,
                bottomBar = { StickyActions(uiState = uiState, onSaveDraft = onSaveDraft, onSend = onSend) },
            ) { inner ->
                Column(
                    modifier =
                        Modifier
                            .fillMaxSize()
                            .padding(inner)
                            .verticalScroll(rememberScrollState())
                            .padding(Spacing.s4)
                            .testTag("composeBroadcastScroll"),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s4),
                ) {
                    (uiState.phase as? ComposePhase.Error)?.let { ErrorBanner(it.message, onRetry) }
                    EditorCard(
                        uiState = uiState,
                        onBodyChange = onBodyChange,
                        onLaunchPhotoPicker = onLaunchPhotoPicker,
                        onRemoveMedia = onRemoveMedia,
                        onAudienceClick = { showAudienceSheet = true },
                    )
                    LocationRow(
                        placeTag = uiState.draft.placeTag,
                        onClick = onAddLocation,
                        onClear = onClearLocation,
                    )
                    ScheduleRow(scheduledLabel = uiState.scheduledLabel, onClick = { showScheduleSheet = true })
                    RecentSection(
                        recents = uiState.recentBroadcasts,
                        loading = recentsLoading,
                        error = recentsError,
                        onRetry = onRetryRecents,
                    )
                }
            }
            if (uiState.isSending) SendingOverlay()
        }
    }

    if (showAudienceSheet) {
        AudienceSheet(
            uiState = uiState,
            onSelect = {
                onAudienceSelected(it)
                showAudienceSheet = false
            },
            onDismiss = { showAudienceSheet = false },
        )
    }
    if (showScheduleSheet) {
        ScheduleSheet(
            initialMillis = uiState.scheduledAtMillis,
            onSchedule = {
                onScheduleConfirm(it)
                showScheduleSheet = false
            },
            onSendNow = {
                onSendNow()
                showScheduleSheet = false
            },
            onDismiss = { showScheduleSheet = false },
        )
    }
}

// MARK: - Top bar

@Composable
private fun TopBar(
    isDirty: Boolean,
    onClose: () -> Unit,
    onSaveDraft: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().height(52.dp).padding(horizontal = Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(44.dp)
                        .clip(CircleShape)
                        .clickable(onClick = onClose)
                        .testTag("composeBroadcastClose")
                        .semantics { contentDescription = "Close" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 22.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appText,
                )
            }
            Spacer(modifier = Modifier.weight(1f))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "Compose broadcast",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                    modifier = Modifier.semantics { heading() },
                )
                if (isDirty) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(5.dp),
                        modifier = Modifier.testTag("composeBroadcastUnsavedChip"),
                    ) {
                        Box(modifier = Modifier.size(5.dp).clip(CircleShape).background(PantopusColors.warning))
                        Text(text = "Unsaved draft", fontSize = 10.sp, color = PantopusColors.appTextMuted)
                    }
                }
            }
            Spacer(modifier = Modifier.weight(1f))
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .widthIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .clickable(enabled = isDirty, onClick = onSaveDraft)
                        .padding(horizontal = Spacing.s2)
                        .testTag("composeBroadcastSaveTop")
                        .semantics { contentDescription = "Save draft" },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Save",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isDirty) PantopusColors.primary600 else PantopusColors.appTextMuted,
                )
            }
        }
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
    }
}

// MARK: - Editor card

@Composable
private fun EditorCard(
    uiState: ComposeBroadcastUiState,
    onBodyChange: (String) -> Unit,
    onLaunchPhotoPicker: () -> Unit,
    onRemoveMedia: (String) -> Unit,
    onAudienceClick: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.xl))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.xl))
                .padding(Spacing.s3)
                .testTag("composeBroadcastEditor"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PersonaRow(uiState.persona)
        BodyField(text = uiState.draft.body, onChange = onBodyChange)
        MediaGrid(media = uiState.draft.media, onRemove = onRemoveMedia)
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
        CounterRow(
            uiState = uiState,
            onLaunchPhotoPicker = onLaunchPhotoPicker,
            onAudienceClick = onAudienceClick,
        )
    }
}

@Composable
private fun PersonaRow(persona: BroadcastPersona) {
    Row(
        modifier = Modifier.fillMaxWidth().testTag("composeBroadcastPersona"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(36.dp).clip(CircleShape).background(persona.kind.accent),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = persona.avatarInitial,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appTextInverse,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = persona.handle,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "Sending as ${persona.kind.label}",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        Box(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(persona.kind.accent.copy(alpha = 0.12f))
                    .padding(horizontal = 7.dp, vertical = 2.dp),
        ) {
            Text(
                text = persona.kind.label.uppercase(),
                fontSize = 9.sp,
                fontWeight = FontWeight.Bold,
                color = persona.kind.accent,
                letterSpacing = 0.4.sp,
            )
        }
    }
}

@Composable
private fun BodyField(
    text: String,
    onChange: (String) -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceMuted)
                .border(1.dp, PantopusColors.appBorderSubtle, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3),
    ) {
        BasicTextField(
            value = text,
            onValueChange = onChange,
            textStyle = TextStyle(fontSize = 15.sp, color = PantopusColors.appText, lineHeight = 20.sp),
            cursorBrush = SolidColor(PantopusColors.primary600),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 140.dp, max = 300.dp)
                    .testTag("composeBroadcastBodyInput"),
            decorationBox = { inner ->
                Box {
                    if (text.isEmpty()) {
                        Text(
                            text = "What's worth sharing with your beacons today?",
                            fontSize = 15.sp,
                            color = PantopusColors.appTextMuted,
                            lineHeight = 20.sp,
                        )
                    }
                    inner()
                }
            },
        )
    }
}

@Composable
private fun MediaGrid(
    media: List<ComposeMediaPreview>,
    onRemove: (String) -> Unit,
) {
    if (media.isEmpty()) return
    if (media.size == 1) {
        MediaTile(media = media.first(), height = 160.dp, onRemove = onRemove)
        return
    }
    // Two or more attachments tile into a 3-up grid; one keeps the
    // full-bleed preview the design shows.
    Column(
        modifier = Modifier.fillMaxWidth().testTag("composeBroadcastMediaGrid"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        media.chunked(GRID_COLUMNS).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                row.forEach { item ->
                    Box(modifier = Modifier.weight(1f)) {
                        MediaTile(media = item, height = 92.dp, onRemove = onRemove)
                    }
                }
                repeat(GRID_COLUMNS - row.size) {
                    Box(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

private const val GRID_COLUMNS = 3

@Composable
private fun MediaTile(
    media: ComposeMediaPreview,
    height: Dp,
    onRemove: (String) -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .height(height)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurfaceSunken)
                .testTag("composeBroadcastMediaPreview")
                .semantics { contentDescription = media.caption?.let { "Attached media: $it" } ?: "Attached media" },
    ) {
        val bytes = media.bytes
        if (bytes != null && media.kind == ComposeMediaPreview.Kind.Image) {
            SubcomposeAsyncImage(
                model = bytes,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                loading = {},
                error = {},
            )
        } else {
            PantopusIconImage(
                icon = if (media.kind == ComposeMediaPreview.Kind.Video) PantopusIcon.Video else PantopusIcon.Image,
                contentDescription = null,
                size = 28.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
                modifier = Modifier.align(Alignment.Center),
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(Spacing.s2)
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(PantopusColors.appText.copy(alpha = 0.55f))
                    .clickable { onRemove(media.id) }
                    .testTag("composeBroadcastRemoveMedia")
                    .semantics { contentDescription = "Remove media" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2.6f,
                tint = PantopusColors.appTextInverse,
            )
        }
        val caption = media.caption
        if (caption != null && height > 120.dp) {
            Row(
                modifier =
                    Modifier
                        .align(Alignment.BottomStart)
                        .padding(Spacing.s2)
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.appText.copy(alpha = 0.45f))
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Image,
                    contentDescription = null,
                    size = 11.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = caption,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

@Composable
private fun CounterRow(
    uiState: ComposeBroadcastUiState,
    onLaunchPhotoPicker: () -> Unit,
    onAudienceClick: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        val attached = uiState.draft.media.size
        val isFull = attached >= ComposeBroadcastDraft.MEDIA_LIMIT
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .clickable(enabled = !isFull, onClick = onLaunchPhotoPicker)
                    .testTag("composeBroadcastAddMedia")
                    .semantics {
                        contentDescription =
                            if (isFull) {
                                "Attachment limit reached, 9 of 9"
                            } else {
                                "Add photos or videos, $attached of ${ComposeBroadcastDraft.MEDIA_LIMIT} attached"
                            }
                    },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Image,
                contentDescription = null,
                size = Radii.xl2,
                strokeWidth = 2f,
                tint = if (isFull) PantopusColors.appTextMuted else PantopusColors.appTextStrong,
            )
        }
        // Counter appears only once a second item is attached, so the
        // single-attachment frame the snapshot baselines pin is unchanged.
        if (attached > 1) {
            Text(
                text = "$attached/${ComposeBroadcastDraft.MEDIA_LIMIT}",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextMuted,
                modifier = Modifier.testTag("composeBroadcastMediaCount"),
            )
        }
        AudienceChip(
            audience = uiState.draft.audience,
            reach = uiState.reach(uiState.draft.audience),
            onClick = onAudienceClick,
        )
        Spacer(modifier = Modifier.weight(1f))
        Text(
            text = "${uiState.characterCount} / ${uiState.maxCharacterCount}",
            fontSize = 11.sp,
            fontWeight = if (uiState.isOverLimit) FontWeight.SemiBold else FontWeight.Normal,
            color = if (uiState.isOverLimit) PantopusColors.warning else PantopusColors.appTextMuted,
            modifier = Modifier.testTag("composeBroadcastCounter"),
        )
    }
}

@Composable
private fun AudienceChip(
    audience: BroadcastAudience,
    reach: Int?,
    onClick: () -> Unit,
) {
    val accent = audienceColor(audience)
    Row(
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(accent.copy(alpha = 0.10f))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s2)
                .testTag("composeBroadcastAudienceChip")
                .semantics { contentDescription = "Audience: ${audience.title}. Tap to change." },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        PantopusIconImage(
            icon = audience.icon,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2f,
            tint = accent,
        )
        Text(
            text = reach?.let { "${audience.title} · ${formatCount(it)}" } ?: audience.title,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = accent,
        )
        PantopusIconImage(
            icon = PantopusIcon.ChevronDown,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2f,
            tint = accent,
        )
    }
}

// MARK: - Schedule row

@Composable
private fun ScheduleRow(
    scheduledLabel: String?,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag("composeBroadcastScheduleRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (scheduledLabel == null) PantopusColors.appSurfaceSunken else PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = if (scheduledLabel == null) PantopusIcon.Send else PantopusIcon.CalendarClock,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2f,
                tint = if (scheduledLabel == null) PantopusColors.appTextStrong else PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = scheduledLabel?.let { "Scheduled · $it" } ?: "Send now",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = if (scheduledLabel == null) "Tap to schedule for later" else "Pinned for 24h after send",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
    }
}

/**
 * Instagram-style place tag — mirrors the Pulse composer's location row
 * (iOS ids `composeBroadcastAddLocationRow` / `…ClearLocationButton`).
 * The row opens the shared PlacePickerSheet; a set tag renders name +
 * address with a ✕ clear button.
 */
@Composable
private fun LocationRow(
    placeTag: PostPlaceTag?,
    onClick: () -> Unit,
    onClear: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag("composeBroadcastAddLocationRow"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(if (placeTag == null) PantopusColors.appSurfaceSunken else PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MapPin,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2f,
                tint = if (placeTag == null) PantopusColors.appTextStrong else PantopusColors.primary600,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = placeTag?.name ?: "Add location",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text =
                    placeTag?.address?.takeIf { it.isNotBlank() }
                        ?: if (placeTag == null) "Tag a place, like Instagram" else "Tap to change",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (placeTag == null) {
            PantopusIconImage(
                icon = PantopusIcon.ChevronRight,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
        } else {
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable(onClick = onClear)
                        .testTag("composeBroadcastClearLocationButton")
                        .semantics { contentDescription = "Remove location" },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

// MARK: - Recent broadcasts

@Composable
private fun RecentSection(
    recents: List<RecentBroadcastContent>,
    loading: Boolean = false,
    error: String? = null,
    onRetry: () -> Unit = {},
) {
    when {
        loading && recents.isEmpty() -> RecentsLoading()
        error != null && recents.isEmpty() -> RecentsError(message = error, onRetry = onRetry)
        recents.isNotEmpty() ->
            Column(
                modifier = Modifier.fillMaxWidth().testTag("composeBroadcastRecentSection"),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                SectionHeader("LAST ${recents.size} BROADCASTS")
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurface)
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
                ) {
                    recents.forEachIndexed { index, broadcast ->
                        RecentRow(broadcast)
                        if (index < recents.lastIndex) {
                            Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorderSubtle))
                        }
                    }
                }
            }
        else ->
            Column(
                modifier = Modifier.fillMaxWidth().testTag("composeBroadcastEmptySection"),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                SectionHeader("PAST BROADCASTS")
                FirstBroadcastCard()
                EmptyAnalyticsStrip()
            }
    }
}

@Composable
private fun RecentsLoading() {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("composeBroadcastRecentLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        SectionHeader("RECENT BROADCASTS")
        Shimmer(width = 360.dp, height = 84.dp, cornerRadius = Radii.lg)
        Shimmer(width = 360.dp, height = 84.dp, cornerRadius = Radii.lg)
    }
}

@Composable
private fun RecentsError(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("composeBroadcastRecentError"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        SectionHeader("RECENT BROADCASTS")
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
            Text(text = message, fontSize = 12.5.sp, color = PantopusColors.appTextSecondary)
            Text(
                text = "Try again",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
                modifier =
                    Modifier
                        .clickable(onClick = onRetry)
                        .testTag("composeBroadcastRecentRetry"),
            )
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        fontSize = 10.5.sp,
        fontWeight = FontWeight.Bold,
        color = PantopusColors.appTextSecondary,
        letterSpacing = 0.6.sp,
        modifier = Modifier.semantics { heading() },
    )
}

@Composable
private fun RecentRow(broadcast: RecentBroadcastContent) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s3).testTag("composeBroadcastRecentRow_${broadcast.id}"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = broadcast.timeLabel,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
            RecentTierChip(broadcast.audience)
            Spacer(modifier = Modifier.weight(1f))
            PantopusIconImage(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = null,
                size = 14.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextMuted,
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = broadcast.body,
                fontSize = 13.sp,
                color = PantopusColors.appText,
                maxLines = 3,
                modifier = Modifier.weight(1f),
            )
            if (broadcast.hasMedia) {
                Box(
                    modifier =
                        Modifier
                            .size(54.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.appSurfaceSunken),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Image,
                        contentDescription = null,
                        size = Radii.xl,
                        strokeWidth = 2f,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            }
        }
        RecentStats(broadcast)
    }
}

@Composable
private fun RecentStats(broadcast: RecentBroadcastContent) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        StatItem(icon = PantopusIcon.RadioTower, value = broadcast.reach)
        StatDot()
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
            PantopusIconImage(
                icon = PantopusIcon.Eye,
                contentDescription = null,
                size = 11.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextSecondary,
            )
            Text(text = broadcast.read, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextStrong)
            Text(text = broadcast.readPct, fontSize = 10.5.sp, fontWeight = FontWeight.Bold, color = PantopusColors.success)
        }
        StatDot()
        StatItem(icon = PantopusIcon.Heart, value = broadcast.reactions)
        StatDot()
        StatItem(icon = PantopusIcon.MessageCircle, value = broadcast.replies)
        Spacer(modifier = Modifier.weight(1f))
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.lg,
            strokeWidth = 2f,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun StatItem(
    icon: PantopusIcon,
    value: String,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        PantopusIconImage(
            icon = icon,
            contentDescription = null,
            size = 11.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextSecondary,
        )
        Text(text = value, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextStrong)
    }
}

@Composable
private fun StatDot() {
    Text(text = "·", fontSize = 11.sp, color = PantopusColors.appTextMuted)
}

@Composable
private fun RecentTierChip(audience: BroadcastAudience) {
    val accent = audienceColor(audience)
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(accent.copy(alpha = 0.12f))
                .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(
            icon = audience.icon,
            contentDescription = null,
            size = 9.dp,
            strokeWidth = 2f,
            tint = accent,
        )
        Text(
            text = audience.title.uppercase(),
            fontSize = 9.sp,
            fontWeight = FontWeight.Bold,
            color = accent,
            letterSpacing = 0.3.sp,
        )
    }
}

@Composable
private fun FirstBroadcastCard() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s5)
                .testTag("composeBroadcastFirstBroadcastCard"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier = Modifier.size(46.dp).clip(CircleShape).background(PantopusColors.primary50),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Send,
                contentDescription = null,
                size = 19.dp,
                strokeWidth = 2f,
                tint = PantopusColors.primary600,
            )
        }
        Text(text = "Send your first broadcast", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appText)
        Text(
            text = "Stats — reach, read, reactions, replies — show here after you send.",
            fontSize = 12.sp,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun EmptyAnalyticsStrip() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        listOf("REACH", "READ", "REACT.", "REPLIES").forEachIndexed { index, label ->
            Column(
                modifier = Modifier.weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(text = "—", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextMuted)
                Text(
                    text = label,
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appTextMuted,
                    letterSpacing = 0.3.sp,
                )
            }
            if (index < 3) {
                Box(modifier = Modifier.width(1.dp).height(24.dp).background(PantopusColors.appBorder))
            }
        }
    }
}

// MARK: - Sticky actions / chrome

@Composable
private fun StickyActions(
    uiState: ComposeBroadcastUiState,
    onSaveDraft: () -> Unit,
    onSend: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth().testTag("composeBroadcastStickyActions")) {
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(PantopusColors.appBorder))
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .widthIn(min = 96.dp)
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .clickable(enabled = uiState.isDirty, onClick = onSaveDraft)
                        .padding(horizontal = Spacing.s3)
                        .testTag("composeBroadcastSaveDraft"),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Save draft",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (uiState.isDirty) PantopusColors.appTextStrong else PantopusColors.appTextMuted,
                )
            }
            Box(
                modifier =
                    Modifier
                        .weight(1f)
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(if (uiState.canSend) PantopusColors.primary600 else PantopusColors.appBorderStrong)
                        .clickable(enabled = uiState.canSend, onClick = onSend)
                        .testTag("composeBroadcastSend")
                        .semantics { contentDescription = uiState.primaryActionTitle },
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (uiState.isSending) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(14.dp),
                            color = PantopusColors.appTextInverse,
                            strokeWidth = 2.dp,
                        )
                    } else {
                        PantopusIconImage(
                            icon = PantopusIcon.Send,
                            contentDescription = null,
                            size = 14.dp,
                            strokeWidth = 2.4f,
                            tint = PantopusColors.appTextInverse,
                        )
                    }
                    Text(
                        text = uiState.primaryActionTitle,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = PantopusColors.appTextInverse,
                    )
                }
            }
        }
    }
}

@Composable
private fun SendingOverlay() {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg.copy(alpha = 0.6f))
                .testTag("composeBroadcastSendingOverlay")
                .semantics { contentDescription = "Sending broadcast" },
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .padding(Spacing.s5),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            CircularProgressIndicator(color = PantopusColors.primary600, strokeWidth = 2.dp)
            Text(text = "Sending broadcast…", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
        }
    }
}

@Composable
private fun ErrorBanner(
    message: String,
    onRetry: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.errorBg)
                .padding(Spacing.s3)
                .testTag("composeBroadcastErrorBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = Radii.xl,
            strokeWidth = 2f,
            tint = PantopusColors.error,
        )
        Text(
            text = message,
            fontSize = 12.5.sp,
            fontWeight = FontWeight.Medium,
            color = PantopusColors.error,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "Dismiss",
            fontSize = 12.5.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.error,
            modifier =
                Modifier
                    .clickable(onClick = onRetry)
                    .testTag("composeBroadcastErrorDismiss"),
        )
    }
}

// MARK: - Sheets

@Composable
private fun AudienceSheet(
    uiState: ComposeBroadcastUiState,
    onSelect: (BroadcastAudience) -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState()
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(bottom = Spacing.s6).testTag("composeBroadcastAudienceSheet"),
        ) {
            Text(
                text = "Who can see this?",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s2).semantics { heading() },
            )
            BroadcastAudience.values().forEach { audience ->
                AudienceOption(
                    audience = audience,
                    reach = uiState.reach(audience),
                    selected = audience == uiState.draft.audience,
                    onClick = { onSelect(audience) },
                )
            }
        }
    }
}

@Composable
private fun AudienceOption(
    audience: BroadcastAudience,
    reach: Int?,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val accent = audienceColor(audience)
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick)
                .heightIn(min = 56.dp)
                .padding(horizontal = Spacing.s4)
                .testTag("composeBroadcastAudienceOption_${audience.key}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(CircleShape).background(accent.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = audience.icon,
                contentDescription = null,
                size = Radii.xl,
                strokeWidth = 2f,
                tint = accent,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(text = audience.title, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            reach?.let {
                Text(text = "${formatCount(it)} people", fontSize = 11.sp, color = PantopusColors.appTextSecondary)
            }
        }
        if (selected) {
            PantopusIconImage(
                icon = PantopusIcon.Check,
                contentDescription = null,
                size = 18.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.primary600,
            )
        }
    }
}

@Composable
private fun ScheduleSheet(
    initialMillis: Long?,
    onSchedule: (Long) -> Unit,
    onSendNow: () -> Unit,
    onDismiss: () -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val seed = initialMillis ?: (System.currentTimeMillis() + 3_600_000L)
    val calendar = remember { Calendar.getInstance().apply { timeInMillis = seed } }
    val dateState = rememberDatePickerState(initialSelectedDateMillis = seed)
    val timeState =
        rememberTimePickerState(
            initialHour = calendar.get(Calendar.HOUR_OF_DAY),
            initialMinute = calendar.get(Calendar.MINUTE),
        )
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = PantopusColors.appSurface,
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(Spacing.s4)
                    .testTag("composeBroadcastScheduleSheet"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Text(
                text = "Schedule broadcast",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
            DatePicker(state = dateState, title = null, headline = null, showModeToggle = false)
            TimePicker(state = timeState, modifier = Modifier.testTag("composeBroadcastTimePicker"))
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 48.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.primary600)
                        .clickable {
                            val day = dateState.selectedDateMillis ?: seed
                            val merged =
                                Calendar.getInstance().apply {
                                    timeInMillis = day
                                    set(Calendar.HOUR_OF_DAY, timeState.hour)
                                    set(Calendar.MINUTE, timeState.minute)
                                    set(Calendar.SECOND, 0)
                                }
                            onSchedule(merged.timeInMillis)
                        }
                        .testTag("composeBroadcastConfirmSchedule"),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "Schedule", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = PantopusColors.appTextInverse)
            }
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clickable(onClick = onSendNow)
                        .testTag("composeBroadcastSendNow"),
                contentAlignment = Alignment.Center,
            ) {
                Text(text = "Send now instead", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appTextStrong)
            }
        }
    }
}

// MARK: - Helpers

/** All-beacons follows the primary accent; tier-locked options borrow the tier ladder. */
internal fun audienceColor(audience: BroadcastAudience) = audience.tierRank?.let { tierColor(it) } ?: PantopusColors.primary600

private fun formatCount(count: Int): String = String.format(Locale.US, "%,d", count)

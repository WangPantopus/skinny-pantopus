@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "TooManyFunctions")

package app.pantopus.android.ui.screens.compose.pulse

import android.app.DatePickerDialog
import android.content.ContentResolver
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.FutureDateTimePickerDialogs
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.compose.placepicker.MediaLocationExtractor
import app.pantopus.android.ui.screens.compose.placepicker.PlacePickerSheet
import app.pantopus.android.ui.screens.compose.placepicker.PostPlaceTag
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDateTime
import java.util.Calendar
import java.util.UUID

/**
 * P2.1 — Pulse compose form. Five intent variants (Ask / Recommend /
 * Event / Lost & Found / Announce). Mirrors the iOS `PulseComposeView`
 * 1:1: same fields, same validators, same identity + visibility chips,
 * same close-confirm via [FormShell].
 */
@Composable
fun PulseComposeScreen(
    onBack: () -> Unit,
    viewModel: PulseComposeViewModel = hiltViewModel(),
    onPosted: (String?) -> Unit = {},
    flowTarget: PulsePostingTarget? = null,
    flowPurpose: PulseComposePurpose? = null,
    /**
     * C2 — when non-null the create submit posts to
     * `POST /api/businesses/:businessId/posts` so the row is authored by the
     * business. Used by the Business owner dashboard's compose FAB.
     */
    businessAuthorId: String? = null,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val activeIntent by viewModel.activeIntent.collectAsStateWithLifecycle()
    val identity by viewModel.identity.collectAsStateWithLifecycle()
    val visibility by viewModel.visibility.collectAsStateWithLifecycle()
    val lostFoundKind by viewModel.lostFoundKind.collectAsStateWithLifecycle()
    val lostFoundContactPref by viewModel.lostFoundContactPref.collectAsStateWithLifecycle()
    val dealExpiresAt by viewModel.dealExpiresAt.collectAsStateWithLifecycle()
    val eligibilityWarning by viewModel.eligibilityWarning.collectAsStateWithLifecycle()
    val precheckNudge by viewModel.precheckNudge.collectAsStateWithLifecycle()
    val precheckCooldown by viewModel.precheckCooldown.collectAsStateWithLifecycle()
    val isVisitorPost by viewModel.isVisitorPost.collectAsStateWithLifecycle()
    val announceAudience by viewModel.announceAudience.collectAsStateWithLifecycle()
    val safetyAlertKind by viewModel.safetyAlertKind.collectAsStateWithLifecycle()
    val askCategory by viewModel.askCategory.collectAsStateWithLifecycle()
    val recommendRating by viewModel.recommendRating.collectAsStateWithLifecycle()
    val fields by viewModel.fields.collectAsStateWithLifecycle()
    val photos by viewModel.photos.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val shouldDismiss by viewModel.shouldDismiss.collectAsStateWithLifecycle()
    val prefillState by viewModel.prefillState.collectAsStateWithLifecycle()
    val selectedPlaceTag by viewModel.selectedPlaceTag.collectAsStateWithLifecycle()
    var showPlacePicker by remember { mutableStateOf(false) }

    LaunchedEffect(flowTarget, flowPurpose) {
        if (flowTarget != null) {
            viewModel.applyFlowContext(flowTarget, flowPurpose)
        }
    }

    LaunchedEffect(businessAuthorId) {
        if (businessAuthorId != null) {
            viewModel.applyBusinessAuthor(businessAuthorId)
        }
    }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        Analytics.track(AnalyticsEvent.ScreenPulseComposeViewed(intent = activeIntent.key))
        if (viewModel.isEditing && prefillState is PulseComposePrefillState.Loading) {
            viewModel.loadForEdit()
        }
    }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    LaunchedEffect(shouldDismiss) {
        if (shouldDismiss) {
            val postId =
                (state as? PulseComposeUiState.Success)?.postId
            viewModel.acknowledgeDismiss()
            delay(700)
            onPosted(postId)
            onBack()
        }
    }

    val photoPicker =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.PickMultipleVisualMedia(maxItems = PULSE_COMPOSE_MAX_PHOTOS),
        ) { uris ->
            if (uris.isEmpty()) return@rememberLauncherForActivityResult
            scope.launch {
                val loaded =
                    withContext(Dispatchers.IO) {
                        uris.take(PULSE_COMPOSE_MAX_PHOTOS).mapNotNull { uri ->
                            readBytes(context.contentResolver, uri)?.let { bytes ->
                                // Capture-location anchor (ADDENDUM 2):
                                // EXIF GPS is read off the picked bytes as
                                // a LOCAL place-picker anchor only — it is
                                // never auto-attached to the outgoing post.
                                // On API 29+ the system photo picker
                                // redacts location EXIF at read time
                                // (ACCESS_MEDIA_LOCATION does not apply to
                                // picker URIs), so this legitimately
                                // returns null there → no anchor chips;
                                // API 26-28 bytes still carry GPS.
                                val captured = MediaLocationExtractor.fromImageBytes(bytes)
                                PulseComposePhoto(
                                    id = UUID.randomUUID().toString(),
                                    data = bytes,
                                    capturedLatitude = captured?.latitude,
                                    capturedLongitude = captured?.longitude,
                                )
                            }
                        }
                    }
                viewModel.setPhotos(loaded)
            }
        }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("composePulseShell"),
    ) {
        // `isValid`/`isDirty` are plain VM getters, not Compose state. Read
        // every collected form input here in the outer scope so this
        // composable recomposes when any of them changes — otherwise the
        // gating would stay frozen at its initial (empty-form) value and the
        // Post action could never enable. `state` covers isSubmitting.
        @Suppress("UNUSED_EXPRESSION")
        run {
            fields
            photos
            identity
            visibility
            lostFoundKind
            lostFoundContactPref
            announceAudience
            askCategory
            recommendRating
            activeIntent
            dealExpiresAt
            selectedPlaceTag
            state
        }
        FormShell(
            title = viewModel.displayTitle,
            rightActionLabel = viewModel.ctaLabel,
            isValid = viewModel.isValid,
            isDirty = viewModel.isDirty,
            isSaving = viewModel.isSubmitting,
            onClose = onBack,
            onCommit = viewModel::submit,
        ) {
            when (val prefill = prefillState) {
                PulseComposePrefillState.Loading -> PulseComposePrefillSkeleton()
                is PulseComposePrefillState.Error ->
                    PulseComposePrefillErrorView(
                        message = prefill.message,
                        onRetry = { viewModel.loadForEdit() },
                    )
                PulseComposePrefillState.Ready ->
                    PulseComposeBody(
                        state =
                            PulseComposeContentState(
                                activeIntent = activeIntent,
                                identity = identity,
                                visibility = visibility,
                                lostFoundKind = lostFoundKind,
                                lostFoundContactPref = lostFoundContactPref,
                                dealExpiresAt = dealExpiresAt,
                                eligibilityWarning = eligibilityWarning,
                                precheckNudge = precheckNudge,
                                precheckCooldown = precheckCooldown,
                                isVisitorPost = isVisitorPost,
                                announceAudience = announceAudience,
                                safetyAlertKind = safetyAlertKind,
                                askCategory = askCategory,
                                recommendRating = recommendRating,
                                fields = fields,
                                photos = photos,
                                selectedPlaceTag = selectedPlaceTag,
                                isIntentLocked = viewModel.isIntentLocked,
                                isFlowMode = viewModel.isFlowMode,
                                composePurpose = viewModel.flowPurpose,
                                postingTargetLabel = viewModel.flowTargetLabel,
                            ),
                        actions =
                            PulseComposeActions(
                                selection =
                                    PulseComposeSelectionActions(
                                        onSelectIntent = viewModel::selectIntent,
                                        onSelectIdentity = viewModel::selectIdentity,
                                        onSelectVisibility = viewModel::selectVisibility,
                                        onSelectLostFoundKind = viewModel::selectLostFoundKind,
                                        onSelectContactPref = viewModel::selectLostFoundContactPref,
                                        onSelectDealExpires = viewModel::selectDealExpires,
                                        onSelectAnnounceAudience = viewModel::selectAnnounceAudience,
                                        onSelectSafetyAlertKind = viewModel::selectSafetyAlertKind,
                                        onSelectAskCategory = viewModel::selectAskCategory,
                                        onSelectRecommendRating = viewModel::selectRecommendRating,
                                    ),
                                onUpdateField = viewModel::update,
                                onPickPhotos = {
                                    photoPicker.launch(
                                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly),
                                    )
                                },
                                onRemovePhoto = viewModel::removePhoto,
                                onBodyEditingEnded = viewModel::runPrecheck,
                                onDismissPrecheckNudge = viewModel::dismissPrecheckNudge,
                                onAddLocation = { showPlacePicker = true },
                                onClearLocation = viewModel::clearPlaceTag,
                            ),
                    )
            }
        }

        toast?.let { payload ->
            PulseComposeToastView(
                payload = payload,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10),
            )
        }
    }

    if (showPlacePicker) {
        PlacePickerSheet(
            currentTag = selectedPlaceTag,
            // Media capture anchor, read at presentation time so it
            // tracks the current photo set (the sheet re-seeds its VM on
            // every open).
            mediaLocation = viewModel.mediaCaptureLocation,
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

private fun readBytes(
    resolver: ContentResolver,
    uri: Uri,
): ByteArray? =
    runCatching {
        resolver.openInputStream(uri)?.use { it.readBytes() }
    }.getOrNull()

@Composable
internal fun PulseComposeToastView(
    payload: PulseComposeToast,
    modifier: Modifier = Modifier,
) {
    Toast(
        message =
            ToastMessage(
                text = payload.text,
                kind = if (payload.isError) ToastKind.Error else ToastKind.Success,
            ),
        modifier = modifier.testTag("composePulseToast"),
    )
}

/** Pure-data snapshot the body composable renders against. */
internal data class PulseComposeContentState(
    val activeIntent: PulseComposeIntent,
    val identity: PulseComposeIdentity = PulseComposeIdentity.Personal,
    val visibility: PulseComposeVisibility = PulseComposeVisibility.Neighbors,
    val lostFoundKind: PulseLostFoundKind = PulseLostFoundKind.Lost,
    val lostFoundContactPref: PulseLostFoundContactPref = PulseLostFoundContactPref.Dm,
    val dealExpiresAt: LocalDateTime = LocalDateTime.now().plusDays(7),
    val eligibilityWarning: String? = null,
    /** Soft nudge from `POST /api/posts/precheck` — dismissible. */
    val precheckNudge: String? = null,
    /** Cooldown copy when the viewer is rate-limited / restricted. */
    val precheckCooldown: String? = null,
    /** True when the precheck classified this as a visitor post. */
    val isVisitorPost: Boolean = false,
    val announceAudience: PulseAnnounceAudience = PulseAnnounceAudience.Neighbors,
    val safetyAlertKind: PulseSafetyAlertKind = PulseSafetyAlertKind.Theft,
    val askCategory: PulseAskCategory = PulseAskCategory.Handyman,
    val recommendRating: Int = 5,
    val fields: Map<PulseComposeField, FormFieldState> = emptyMap(),
    val photos: List<PulseComposePhoto> = emptyList(),
    /** Instagram-style venue tag picked in the PlacePickerSheet. */
    val selectedPlaceTag: PostPlaceTag? = null,
    /** True when the intent picker is non-interactive (edit mode). */
    val isIntentLocked: Boolean = false,
    val isFlowMode: Boolean = false,
    val composePurpose: PulseComposePurpose? = null,
    val postingTargetLabel: String? = null,
)

internal data class PulseComposeSelectionActions(
    val onSelectIntent: (PulseComposeIntent) -> Unit,
    val onSelectIdentity: (PulseComposeIdentity) -> Unit,
    val onSelectVisibility: (PulseComposeVisibility) -> Unit,
    val onSelectLostFoundKind: (PulseLostFoundKind) -> Unit,
    val onSelectContactPref: (PulseLostFoundContactPref) -> Unit,
    val onSelectDealExpires: (LocalDateTime) -> Unit,
    val onSelectAnnounceAudience: (PulseAnnounceAudience) -> Unit,
    val onSelectSafetyAlertKind: (PulseSafetyAlertKind) -> Unit,
    val onSelectAskCategory: (PulseAskCategory) -> Unit,
    val onSelectRecommendRating: (Int) -> Unit,
)

internal data class PulseComposeActions(
    val selection: PulseComposeSelectionActions,
    val onUpdateField: (PulseComposeField, String) -> Unit,
    val onPickPhotos: () -> Unit,
    val onRemovePhoto: (String) -> Unit,
    /** Body-field blur — runs `POST /api/posts/precheck`. */
    val onBodyEditingEnded: () -> Unit = {},
    /** X on the precheck nudge banner. */
    val onDismissPrecheckNudge: () -> Unit = {},
    /** Opens the PlacePickerSheet (also re-opens it from a set tag row). */
    val onAddLocation: () -> Unit = {},
    /** ✕ on the set-tag row — clears the venue tag. */
    val onClearLocation: () -> Unit = {},
)

/**
 * Body-field blur hook. Provided by [PulseComposeBody] and consumed by
 * every per-intent `BodyEditor`, so the pre-post safety precheck fires
 * on blur without threading a callback through seven intent sections.
 */
internal val LocalPulseBodyEditingEnded = staticCompositionLocalOf<() -> Unit> { {} }

@Composable
internal fun PulseComposeBody(
    state: PulseComposeContentState,
    actions: PulseComposeActions,
) {
    CompositionLocalProvider(LocalPulseBodyEditingEnded provides actions.onBodyEditingEnded) {
        PulseComposeBodySections(state, actions)
    }
}

@Composable
private fun PulseComposeBodySections(
    state: PulseComposeContentState,
    actions: PulseComposeActions,
) {
    if (state.isFlowMode) {
        FlowContextHeader(state.composePurpose, state.postingTargetLabel, state.eligibilityWarning)
    } else {
        IntentPicker(
            active = state.activeIntent,
            isLocked = state.isIntentLocked,
            onSelect = actions.selection.onSelectIntent,
        )
        IdentitySection(active = state.identity, onSelect = actions.selection.onSelectIdentity)
    }
    PrecheckBanners(
        cooldown = state.precheckCooldown,
        isVisitorPost = state.isVisitorPost,
        nudge = state.precheckNudge,
        onDismissNudge = actions.onDismissPrecheckNudge,
    )
    IntentSpecificSection(
        state = state,
        onUpdateField = actions.onUpdateField,
        onSelectLostFoundKind = actions.selection.onSelectLostFoundKind,
        onSelectContactPref = actions.selection.onSelectContactPref,
        onSelectDealExpires = actions.selection.onSelectDealExpires,
        onSelectAnnounceAudience = actions.selection.onSelectAnnounceAudience,
        onSelectSafetyAlertKind = actions.selection.onSelectSafetyAlertKind,
        onSelectAskCategory = actions.selection.onSelectAskCategory,
        onSelectRecommendRating = actions.selection.onSelectRecommendRating,
    )
    PhotosSection(photos = state.photos, onPick = actions.onPickPhotos, onRemove = actions.onRemovePhoto)
    // Place tags are create-only (the update pipeline carries no location
    // fields), so hide the row in edit mode — offering a picker whose
    // input the Save path drops would lose data. Mirrors iOS.
    if (!state.isIntentLocked) {
        LocationSection(
            tag = state.selectedPlaceTag,
            onAdd = actions.onAddLocation,
            onClear = actions.onClearLocation,
        )
    }
    if (!state.isFlowMode || state.visibility != PulseComposeVisibility.Connections) {
        VisibilitySection(active = state.visibility, onSelect = actions.selection.onSelectVisibility)
    }
}

@Composable
private fun FlowContextHeader(
    purpose: PulseComposePurpose?,
    targetLabel: String?,
    eligibilityWarning: String? = null,
) {
    purpose?.let { p ->
        Row(
            modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s1),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(icon = purposeIconFor(p), contentDescription = null, size = 16.dp, tint = PantopusColors.primary600)
            Text(text = p.label, style = PantopusTextStyle.small.copy(fontWeight = FontWeight.SemiBold), color = PantopusColors.appText)
        }
    }
    targetLabel?.let { label ->
        Row(
            modifier = Modifier.padding(horizontal = Spacing.s4, vertical = Spacing.s1),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(icon = PantopusIcon.MapPin, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextSecondary)
            Text(text = "Posting to $label", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
    }
    eligibilityWarning?.let { warning ->
        Row(
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.warningBg)
                    .padding(Spacing.s3)
                    .testTag("composePulseEligibilityWarning"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.AlertCircle,
                contentDescription = null,
                size = 16.dp,
                strokeWidth = 2f,
                tint = PantopusColors.warning,
            )
            Text(
                text = warning,
                style = PantopusTextStyle.small.copy(fontSize = 13.sp, lineHeight = 18.sp),
                color = PantopusColors.appText,
            )
        }
    }
}

/**
 * The three precheck outcomes RN renders above the body field: the hard
 * cooldown block, the visitor badge, and the soft nudge
 * (`PostComposerModal.tsx:617-657`).
 */
@Composable
private fun PrecheckBanners(
    cooldown: String?,
    isVisitorPost: Boolean,
    nudge: String?,
    onDismissNudge: () -> Unit,
) {
    cooldown?.let { text ->
        Row(
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.errorBg)
                    .padding(Spacing.s3)
                    .testTag("composePulsePrecheckCooldown"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Ban,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2f,
                tint = PantopusColors.error,
            )
            Text(text = text, style = PantopusTextStyle.caption, color = PantopusColors.error)
        }
    }
    if (isVisitorPost) {
        Row(
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.successBg)
                    .padding(Spacing.s3)
                    .testTag("composePulseVisitorBanner"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Plane,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2f,
                tint = PantopusColors.success,
            )
            Text(
                text = "You're posting as a visitor. Your post will show a visitor badge.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.success,
            )
        }
    }
    nudge?.let { text ->
        Row(
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.warmAmberBg)
                    .padding(Spacing.s3)
                    .testTag("composePulsePrecheckNudge"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Lightbulb,
                contentDescription = null,
                size = 17.dp,
                strokeWidth = 2f,
                tint = PantopusColors.warmAmber,
            )
            Text(
                text = text,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Dismiss suggestion",
                size = 15.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextSecondary,
                modifier =
                    Modifier
                        .clickable { onDismissNudge() }
                        .testTag("composePulsePrecheckNudgeDismiss"),
            )
        }
    }
}

private fun purposeIconFor(purpose: PulseComposePurpose): PantopusIcon =
    when (purpose) {
        PulseComposePurpose.Ask -> PantopusIcon.HelpCircle
        PulseComposePurpose.HeadsUp -> PantopusIcon.Megaphone
        PulseComposePurpose.Recommend -> PantopusIcon.Star
        PulseComposePurpose.LostFound -> PantopusIcon.Search
        PulseComposePurpose.LocalUpdate -> PantopusIcon.FileText
        PulseComposePurpose.NeighborhoodWin -> PantopusIcon.Crown
        PulseComposePurpose.VisitorGuide -> PantopusIcon.Compass
        PulseComposePurpose.Event -> PantopusIcon.Calendar
        PulseComposePurpose.Deal -> PantopusIcon.Tag
    }

@Composable
private fun IntentPicker(
    active: PulseComposeIntent,
    isLocked: Boolean,
    onSelect: (PulseComposeIntent) -> Unit,
) {
    FormFieldGroup("Post type") {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .testTag("composePulseIntentPicker"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PulseComposeIntent.entries.forEach { intent ->
                IntentChip(
                    intent = intent,
                    isActive = intent == active,
                    isLocked = isLocked,
                    onSelect = onSelect,
                )
            }
        }
    }
}

@Composable
private fun IntentChip(
    intent: PulseComposeIntent,
    isActive: Boolean,
    isLocked: Boolean,
    onSelect: (PulseComposeIntent) -> Unit,
) {
    val fg = if (isActive) PantopusColors.appTextInverse else PantopusColors.appTextStrong
    val bg = if (isActive) PantopusColors.primary600 else PantopusColors.appSurface
    val border = if (isActive) Color.Transparent else PantopusColors.appBorder
    val chipModifier =
        Modifier
            .heightIn(min = 32.dp)
            .clip(RoundedCornerShape(Radii.pill))
            .background(bg)
            .border(width = 1.dp, color = border, shape = RoundedCornerShape(Radii.pill))
            .let { base -> if (isLocked) base else base.clickable { onSelect(intent) } }
            .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
            .testTag("composePulseIntentChip_${intent.key}")
            .semantics { contentDescription = "${intent.label} post" }
    Row(
        modifier = chipModifier.alpha(if (isLocked && !isActive) 0.4f else 1f),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = iconFor(intent),
            contentDescription = null,
            size = 14.dp,
            strokeWidth = 2f,
            tint = fg,
        )
        Text(
            text = intent.label,
            style = PantopusTextStyle.small,
            color = fg,
        )
    }
}

private fun iconFor(intent: PulseComposeIntent): PantopusIcon =
    when (intent) {
        PulseComposeIntent.Ask -> PantopusIcon.HelpCircle
        PulseComposeIntent.Recommend -> PantopusIcon.ThumbsUp
        PulseComposeIntent.Event -> PantopusIcon.Calendar
        PulseComposeIntent.Lost -> PantopusIcon.Search
        PulseComposeIntent.Announce -> PantopusIcon.Megaphone
    }

@Composable
private fun IdentitySection(
    active: PulseComposeIdentity,
    onSelect: (PulseComposeIdentity) -> Unit,
) {
    FormFieldGroup("Posting as") {
        Row(
            modifier = Modifier.fillMaxWidth().testTag("composePulseIdentityPicker"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PulseComposeIdentity.entries.forEach { identity ->
                IdentityChip(
                    identity = identity,
                    isActive = identity == active,
                    onSelect = onSelect,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun IdentityChip(
    identity: PulseComposeIdentity,
    isActive: Boolean,
    onSelect: (PulseComposeIdentity) -> Unit,
    modifier: Modifier = Modifier,
) {
    val (fg, bg) =
        when (identity) {
            PulseComposeIdentity.Personal -> PantopusColors.personal to PantopusColors.personalBg
            PulseComposeIdentity.Home -> PantopusColors.home to PantopusColors.homeBg
            PulseComposeIdentity.Business -> PantopusColors.business to PantopusColors.businessBg
        }
    val fill = if (isActive) bg else PantopusColors.appSurface
    val border = if (isActive) fg else PantopusColors.appBorder
    Row(
        modifier =
            modifier
                .heightIn(min = 36.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(fill)
                .border(width = if (isActive) 1.5.dp else 1.dp, color = border, shape = RoundedCornerShape(Radii.md))
                .clickable { onSelect(identity) }
                .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                .testTag("composePulseIdentityChip_${identity.key}")
                .semantics { contentDescription = "${identity.label} identity" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(
            modifier =
                Modifier
                    .size(8.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(fg),
        )
        Text(
            text = identity.label,
            style = PantopusTextStyle.small,
            color = if (isActive) fg else PantopusColors.appText,
        )
    }
}

@Composable
@Suppress("LongParameterList")
private fun IntentSpecificSection(
    state: PulseComposeContentState,
    onUpdateField: (PulseComposeField, String) -> Unit,
    onSelectLostFoundKind: (PulseLostFoundKind) -> Unit,
    onSelectContactPref: (PulseLostFoundContactPref) -> Unit,
    onSelectDealExpires: (LocalDateTime) -> Unit,
    onSelectAnnounceAudience: (PulseAnnounceAudience) -> Unit,
    onSelectSafetyAlertKind: (PulseSafetyAlertKind) -> Unit,
    onSelectAskCategory: (PulseAskCategory) -> Unit,
    onSelectRecommendRating: (Int) -> Unit,
) {
    when (state.activeIntent) {
        PulseComposeIntent.Ask ->
            AskSection(
                fields = state.fields,
                category = state.askCategory,
                onUpdateField = onUpdateField,
                onSelectCategory = onSelectAskCategory,
            )
        PulseComposeIntent.Recommend ->
            RecommendSection(
                fields = state.fields,
                rating = state.recommendRating,
                onUpdateField = onUpdateField,
                onSelectRating = onSelectRecommendRating,
            )
        PulseComposeIntent.Event ->
            EventSection(fields = state.fields, onUpdateField = onUpdateField)
        PulseComposeIntent.Lost ->
            LostSection(
                fields = state.fields,
                kind = state.lostFoundKind,
                contactPref = state.lostFoundContactPref,
                onUpdateField = onUpdateField,
                onSelectKind = onSelectLostFoundKind,
                onSelectContactPref = onSelectContactPref,
            )
        PulseComposeIntent.Announce ->
            when (state.composePurpose) {
                PulseComposePurpose.HeadsUp ->
                    HeadsUpSection(
                        fields = state.fields,
                        audience = state.announceAudience,
                        safetyKind = state.safetyAlertKind,
                        isFlowMode = state.isFlowMode,
                        onUpdateField = onUpdateField,
                        onSelectAudience = onSelectAnnounceAudience,
                        onSelectSafetyKind = onSelectSafetyAlertKind,
                    )
                PulseComposePurpose.Deal ->
                    DealSection(
                        fields = state.fields,
                        dealExpiresAt = state.dealExpiresAt,
                        onUpdateField = onUpdateField,
                        onSelectDealExpires = onSelectDealExpires,
                    )
                else ->
                    AnnounceSection(
                        fields = state.fields,
                        audience = state.announceAudience,
                        purpose = state.composePurpose,
                        isFlowMode = state.isFlowMode,
                        onUpdateField = onUpdateField,
                        onSelectAudience = onSelectAnnounceAudience,
                    )
            }
    }
}

@Composable
private fun AskSection(
    fields: Map<PulseComposeField, FormFieldState>,
    category: PulseAskCategory,
    onUpdateField: (PulseComposeField, String) -> Unit,
    onSelectCategory: (PulseAskCategory) -> Unit,
) {
    FormFieldGroup("Ask") {
        FieldRow(
            field = PulseComposeField.Title,
            label = "Title",
            placeholder = "What do you need?",
            fields = fields,
            onUpdate = onUpdateField,
        )
        ChipRow(
            label = "Category",
            options = PulseAskCategory.entries.map { it.key to it.label },
            activeKey = category.key,
            identifierPrefix = "composePulseAskCategory",
            onSelect = { key -> onSelectCategory(PulseAskCategory.entries.first { it.key == key }) },
        )
        BodyEditor(
            label = "Details",
            placeholder = "Share what you're looking for…",
            fields = fields,
            onUpdate = onUpdateField,
        )
    }
}

@Composable
private fun RecommendSection(
    fields: Map<PulseComposeField, FormFieldState>,
    rating: Int,
    onUpdateField: (PulseComposeField, String) -> Unit,
    onSelectRating: (Int) -> Unit,
) {
    FormFieldGroup("Recommend") {
        FieldRow(
            field = PulseComposeField.RecommendBusiness,
            label = "Business name",
            placeholder = "Search or type…",
            fields = fields,
            onUpdate = onUpdateField,
        )
        RatingPicker(rating = rating, onSelect = onSelectRating)
        BodyEditor(
            label = "Why you recommend it",
            placeholder = "Share your experience…",
            fields = fields,
            onUpdate = onUpdateField,
        )
    }
}

@Composable
private fun RatingPicker(
    rating: Int,
    onSelect: (Int) -> Unit,
) {
    val focusManager = LocalFocusManager.current
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Rating",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            for (value in 1..5) {
                Box(
                    modifier =
                        Modifier
                            .size(44.dp)
                            .clickable {
                                focusManager.clearFocus()
                                onSelect(value)
                            }
                            .testTag("composePulseRecommendStar_$value")
                            .semantics {
                                contentDescription = if (value == 1) "1 star" else "$value stars"
                            },
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.Star,
                        contentDescription = null,
                        size = 28.dp,
                        tint =
                            if (value <= rating) {
                                PantopusColors.warning
                            } else {
                                PantopusColors.appBorderStrong
                            },
                    )
                }
            }
        }
    }
}

@Composable
private fun EventSection(
    fields: Map<PulseComposeField, FormFieldState>,
    onUpdateField: (PulseComposeField, String) -> Unit,
) {
    FormFieldGroup("Event") {
        FieldRow(
            field = PulseComposeField.Title,
            label = "Title",
            placeholder = "What's happening?",
            fields = fields,
            onUpdate = onUpdateField,
        )
        DateRow(
            field = PulseComposeField.EventDate,
            label = "Date & time",
            allowFuture = true,
            allowPast = false,
            fields = fields,
            onUpdate = onUpdateField,
        )
        DateTimeRow(
            field = PulseComposeField.EventEndDate,
            label = "End time (optional)",
            fields = fields,
            onUpdate = onUpdateField,
        )
        FieldRow(
            field = PulseComposeField.EventLocation,
            label = "Location",
            placeholder = "Where?",
            fields = fields,
            onUpdate = onUpdateField,
        )
        BodyEditor(
            label = "Details",
            placeholder = "Add anything attendees should know…",
            fields = fields,
            onUpdate = onUpdateField,
        )
    }
}

@Composable
private fun LostSection(
    fields: Map<PulseComposeField, FormFieldState>,
    kind: PulseLostFoundKind,
    contactPref: PulseLostFoundContactPref,
    onUpdateField: (PulseComposeField, String) -> Unit,
    onSelectKind: (PulseLostFoundKind) -> Unit,
    onSelectContactPref: (PulseLostFoundContactPref) -> Unit,
) {
    FormFieldGroup("Lost & Found") {
        LostFoundToggle(active = kind, onSelect = onSelectKind)
        BodyEditor(
            label = "Description",
            placeholder = "Describe the item…",
            fields = fields,
            onUpdate = onUpdateField,
        )
        FieldRow(
            field = PulseComposeField.LostLastSeenLocation,
            label = "Last seen location",
            placeholder = "Where?",
            fields = fields,
            onUpdate = onUpdateField,
        )
        DateRow(
            field = PulseComposeField.LostLastSeenDate,
            label = "Last seen date (optional)",
            allowFuture = false,
            allowPast = true,
            fields = fields,
            onUpdate = onUpdateField,
        )
        ChipRow(
            label = "How should people contact you?",
            options = PulseLostFoundContactPref.entries.map { it.key to it.label },
            activeKey = contactPref.key,
            identifierPrefix = "composePulseContactPref",
            onSelect = { key -> onSelectContactPref(PulseLostFoundContactPref.entries.first { it.key == key }) },
        )
        if (contactPref == PulseLostFoundContactPref.Phone) {
            FieldRow(
                field = PulseComposeField.ContactPhone,
                label = "Phone number",
                placeholder = "(555) 555-0123",
                keyboardType = KeyboardType.Phone,
                fields = fields,
                onUpdate = onUpdateField,
            )
        }
    }
}

@Composable
private fun LostFoundToggle(
    active: PulseLostFoundKind,
    onSelect: (PulseLostFoundKind) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Type",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md)),
        ) {
            PulseLostFoundKind.entries.forEach { kind ->
                val isActive = kind == active
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .heightIn(min = 36.dp)
                            .background(if (isActive) PantopusColors.primary600 else PantopusColors.appSurface)
                            .clickable { onSelect(kind) }
                            .testTag("composePulseLostFoundKind_${kind.key}")
                            .semantics { contentDescription = "${kind.label} item" },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = kind.label,
                        style = PantopusTextStyle.small,
                        color =
                            if (isActive) {
                                PantopusColors.appTextInverse
                            } else {
                                PantopusColors.appText
                            },
                    )
                }
            }
        }
    }
}

@Composable
private fun HeadsUpSection(
    fields: Map<PulseComposeField, FormFieldState>,
    audience: PulseAnnounceAudience,
    safetyKind: PulseSafetyAlertKind,
    isFlowMode: Boolean,
    onUpdateField: (PulseComposeField, String) -> Unit,
    onSelectAudience: (PulseAnnounceAudience) -> Unit,
    onSelectSafetyKind: (PulseSafetyAlertKind) -> Unit,
) {
    FormFieldGroup("Heads Up") {
        ChipRow(
            label = "Alert type",
            options = PulseSafetyAlertKind.entries.map { it.key to it.label },
            activeKey = safetyKind.key,
            identifierPrefix = "composePulseSafetyKind",
            onSelect = { key ->
                PulseSafetyAlertKind.fromKey(key)?.let(onSelectSafetyKind)
            },
        )
        FieldRow(
            field = PulseComposeField.Title,
            label = "Headline",
            placeholder = "What should people nearby know?",
            fields = fields,
            onUpdate = onUpdateField,
        )
        if (!isFlowMode) {
            ChipRow(
                label = "Audience",
                options = PulseAnnounceAudience.entries.map { it.key to it.label },
                activeKey = audience.key,
                identifierPrefix = "composePulseAnnounceAudience",
                onSelect = { key -> onSelectAudience(PulseAnnounceAudience.entries.first { it.key == key }) },
            )
        }
        BodyEditor(
            label = "Details",
            placeholder = "Describe what happened…",
            fields = fields,
            onUpdate = onUpdateField,
        )
    }
}

@Composable
private fun AnnounceSection(
    fields: Map<PulseComposeField, FormFieldState>,
    audience: PulseAnnounceAudience,
    purpose: PulseComposePurpose?,
    isFlowMode: Boolean,
    onUpdateField: (PulseComposeField, String) -> Unit,
    onSelectAudience: (PulseAnnounceAudience) -> Unit,
) {
    FormFieldGroup(announceSectionTitle(purpose)) {
        FieldRow(
            field = PulseComposeField.Title,
            label = "Headline",
            placeholder = "What's the news?",
            fields = fields,
            onUpdate = onUpdateField,
        )
        if (!isFlowMode) {
            ChipRow(
                label = "Audience",
                options = PulseAnnounceAudience.entries.map { it.key to it.label },
                activeKey = audience.key,
                identifierPrefix = "composePulseAnnounceAudience",
                onSelect = { key -> onSelectAudience(PulseAnnounceAudience.entries.first { it.key == key }) },
            )
        }
        BodyEditor(
            label = "Details",
            placeholder = purpose?.placeholder ?: "Share what your neighbors should know…",
            fields = fields,
            onUpdate = onUpdateField,
        )
    }
}

private fun announceSectionTitle(purpose: PulseComposePurpose?): String =
    when (purpose) {
        PulseComposePurpose.LocalUpdate -> "Local Update"
        PulseComposePurpose.NeighborhoodWin -> "Neighborhood Win"
        PulseComposePurpose.VisitorGuide -> "Visitor Guide"
        else -> "Announcement"
    }

@Composable
private fun DealSection(
    fields: Map<PulseComposeField, FormFieldState>,
    dealExpiresAt: LocalDateTime,
    onUpdateField: (PulseComposeField, String) -> Unit,
    onSelectDealExpires: (LocalDateTime) -> Unit,
) {
    FormFieldGroup("Deal") {
        FieldRow(
            field = PulseComposeField.Title,
            label = "Headline",
            placeholder = "What's the deal?",
            fields = fields,
            onUpdate = onUpdateField,
        )
        FieldRow(
            field = PulseComposeField.DealBusinessName,
            label = "Business (optional)",
            placeholder = "Who's offering it?",
            fields = fields,
            onUpdate = onUpdateField,
        )
        DealExpiryRow(value = dealExpiresAt, onSelect = onSelectDealExpires)
        BodyEditor(
            label = "Details",
            placeholder = "Describe the deal and where to find it…",
            fields = fields,
            onUpdate = onUpdateField,
        )
    }
}

/** Required deal-expiry date+time picker — defaults to now + 7 days. */
@Composable
private fun DealExpiryRow(
    value: LocalDateTime,
    onSelect: (LocalDateTime) -> Unit,
) {
    var showPicker by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Deal ends",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(width = 1.dp, color = PantopusColors.appBorder, shape = RoundedCornerShape(Radii.md))
                    .clickable { showPicker = true }
                    .padding(horizontal = Spacing.s3)
                    .testTag("composePulseField_dealExpires"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = formatPickerDateTime(value),
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
        }
    }
    if (showPicker) {
        FutureDateTimePickerDialogs(
            initial = value,
            onPicked = { picked ->
                showPicker = false
                onSelect(picked)
            },
            onDismiss = { showPicker = false },
        )
    }
}

@Composable
private fun PhotosSection(
    photos: List<PulseComposePhoto>,
    onPick: () -> Unit,
    onRemove: (String) -> Unit,
) {
    FormFieldGroup("Photos (optional)") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                photos.forEach { photo ->
                    PhotoThumbnail(photo = photo, onRemove = onRemove)
                }
                if (photos.size < PULSE_COMPOSE_MAX_PHOTOS) {
                    AddPhotoTile(onPick = onPick)
                }
            }
            Text(
                text = "Up to $PULSE_COMPOSE_MAX_PHOTOS images. Tap a photo to remove it.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun PhotoThumbnail(
    photo: PulseComposePhoto,
    onRemove: (String) -> Unit,
) {
    val bitmap = remember(photo.id) { decodeImage(photo.data) }
    Box(
        modifier =
            Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .clickable { onRemove(photo.id) }
                .testTag("composePulsePhotoThumb_${photo.id}"),
    ) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap,
                contentDescription = "Photo",
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
            )
        }
        Box(
            modifier =
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(2.dp)
                    .size(18.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(PantopusColors.appText.copy(alpha = 0.7f)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.X,
                contentDescription = "Remove photo",
                size = 10.dp,
                strokeWidth = 2.5f,
                tint = PantopusColors.appTextInverse,
            )
        }
    }
}

private fun decodeImage(bytes: ByteArray): ImageBitmap? =
    runCatching {
        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)?.asImageBitmap()
    }.getOrNull()

@Composable
private fun AddPhotoTile(onPick: () -> Unit) {
    Column(
        modifier =
            Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(width = 1.dp, color = PantopusColors.appBorderStrong, shape = RoundedCornerShape(Radii.md))
                .clickable { onPick() }
                .testTag("composePulseAddPhoto")
                .semantics { contentDescription = "Add photo" },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Camera,
            contentDescription = null,
            size = 18.dp,
            strokeWidth = 2f,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Add",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/**
 * Instagram-style place tag — "Add location" opens the shared
 * PlacePickerSheet; a set tag renders name + address with a ✕ clear
 * button (the row itself re-opens the picker).
 */
@Composable
private fun LocationSection(
    tag: PostPlaceTag?,
    onAdd: () -> Unit,
    onClear: () -> Unit,
) {
    FormFieldGroup("Location (optional)") {
        if (tag == null) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clickable(onClick = onAdd)
                        .padding(horizontal = Spacing.s2)
                        .testTag("composePulseAddLocationRow")
                        .semantics { contentDescription = "Add location" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 18.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextSecondary,
                )
                Text(
                    text = "Add location",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appText,
                    modifier = Modifier.weight(1f),
                )
                PantopusIconImage(
                    icon = PantopusIcon.ChevronRight,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.appTextMuted,
                )
            }
        } else {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 44.dp)
                        .clickable(onClick = onAdd)
                        .padding(horizontal = Spacing.s2)
                        .testTag("composePulseAddLocationRow"),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.MapPin,
                    contentDescription = null,
                    size = 18.dp,
                    strokeWidth = 2f,
                    tint = PantopusColors.primary600,
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = tag.name,
                        style = PantopusTextStyle.small,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    tag.address?.takeIf { it.isNotBlank() }?.let { address ->
                        Text(
                            text = address,
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                }
                Box(
                    modifier =
                        Modifier
                            .size(28.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.appSurfaceSunken)
                            .clickable(onClick = onClear)
                            .testTag("composePulseClearLocationButton")
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
}

@Composable
private fun VisibilitySection(
    active: PulseComposeVisibility,
    onSelect: (PulseComposeVisibility) -> Unit,
) {
    FormFieldGroup("Who can see this") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PulseComposeVisibility.entries.forEach { option ->
                VisibilityRow(option = option, isActive = option == active, onSelect = onSelect)
            }
        }
    }
}

@Composable
private fun VisibilityRow(
    option: PulseComposeVisibility,
    isActive: Boolean,
    onSelect: (PulseComposeVisibility) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clickable { onSelect(option) }
                .padding(horizontal = Spacing.s2)
                .testTag("composePulseVisibility_${option.key}")
                .semantics { contentDescription = option.label },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(Radii.pill))
                    .border(
                        width = 2.dp,
                        color = if (isActive) PantopusColors.primary600 else PantopusColors.appBorderStrong,
                        shape = RoundedCornerShape(Radii.pill),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            if (isActive) {
                Box(
                    modifier =
                        Modifier
                            .size(10.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(PantopusColors.primary600),
                )
            }
        }
        Text(
            text = option.label,
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
        )
    }
}

// MARK: - Shared field helpers

@Composable
private fun FieldRow(
    field: PulseComposeField,
    label: String,
    fields: Map<PulseComposeField, FormFieldState>,
    onUpdate: (PulseComposeField, String) -> Unit,
    placeholder: String = "",
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    val snapshot = fields[field] ?: FormFieldState(id = field.key)
    val state =
        when {
            snapshot.error != null -> PantopusFieldState.Error(snapshot.error.orEmpty())
            snapshot.touched && snapshot.isDirty -> PantopusFieldState.Valid
            else -> PantopusFieldState.Default
        }
    PantopusTextField(
        label = label,
        value = snapshot.value,
        onValueChange = { onUpdate(field, it) },
        placeholder = placeholder,
        state = state,
        keyboardType = keyboardType,
        fieldTestTag = "composePulseField_${field.key}",
    )
}

@Composable
private fun BodyEditor(
    label: String,
    placeholder: String,
    fields: Map<PulseComposeField, FormFieldState>,
    onUpdate: (PulseComposeField, String) -> Unit,
) {
    val focusManager = LocalFocusManager.current
    val onEditingEnded = LocalPulseBodyEditingEnded.current
    val snapshot = fields[PulseComposeField.Body] ?: FormFieldState(id = PulseComposeField.Body.key)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 96.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = if (snapshot.error != null) PantopusColors.error else PantopusColors.appBorder,
                        shape = RoundedCornerShape(Radii.md),
                    ).padding(Spacing.s3)
                    .testTag("composePulseField_body"),
        ) {
            BasicTextField(
                value = snapshot.value,
                onValueChange = { onUpdate(PulseComposeField.Body, it) },
                textStyle =
                    TextStyle(
                        color = PantopusColors.appText,
                        fontSize = PantopusTextStyle.body.fontSize,
                    ),
                cursorBrush = SolidColor(PantopusColors.primary600),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                // RN runs the pre-post safety precheck on body blur
                // (`PostComposerModal.tsx:801`).
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .onFocusChanged { if (!it.isFocused) onEditingEnded() },
            )
            if (snapshot.value.isEmpty()) {
                Text(
                    text = placeholder,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
        if (snapshot.error != null) {
            Text(
                text = snapshot.error.orEmpty(),
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun DateRow(
    field: PulseComposeField,
    label: String,
    allowFuture: Boolean,
    allowPast: Boolean,
    fields: Map<PulseComposeField, FormFieldState>,
    onUpdate: (PulseComposeField, String) -> Unit,
) {
    val context = LocalContext.current
    val snapshot = fields[field] ?: FormFieldState(id = field.key)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = if (snapshot.error != null) PantopusColors.error else PantopusColors.appBorder,
                        shape = RoundedCornerShape(Radii.md),
                    ).clickable {
                        val cal = Calendar.getInstance()
                        DatePickerDialog(
                            context,
                            { _, year, month, day ->
                                val formatted =
                                    "%04d-%02d-%02d".format(year, month + 1, day)
                                onUpdate(field, formatted)
                            },
                            cal.get(Calendar.YEAR),
                            cal.get(Calendar.MONTH),
                            cal.get(Calendar.DAY_OF_MONTH),
                        ).apply {
                            if (!allowFuture) datePicker.maxDate = System.currentTimeMillis()
                            if (!allowPast) datePicker.minDate = System.currentTimeMillis()
                        }.show()
                    }.padding(horizontal = Spacing.s3)
                    .testTag("composePulseField_${field.key}"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = if (snapshot.value.isEmpty()) "Tap to pick" else snapshot.value,
                style = PantopusTextStyle.body,
                color =
                    if (snapshot.value.isEmpty()) PantopusColors.appTextMuted else PantopusColors.appText,
                modifier = Modifier.weight(1f),
            )
            if (snapshot.value.isNotEmpty()) {
                Text(
                    text = "Clear",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .clickable { onUpdate(field, "") }
                            .padding(start = Spacing.s2)
                            .testTag("composePulseField_${field.key}_clear"),
                )
            }
        }
        if (snapshot.error != null) {
            Text(
                text = snapshot.error.orEmpty(),
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

/**
 * Optional date+time row backed by [FutureDateTimePickerDialogs]. The
 * field stores the picker-emitted `yyyy-MM-dd HH:mm` shape; a Clear
 * affordance empties it back out.
 */
@Composable
private fun DateTimeRow(
    field: PulseComposeField,
    label: String,
    fields: Map<PulseComposeField, FormFieldState>,
    onUpdate: (PulseComposeField, String) -> Unit,
) {
    val snapshot = fields[field] ?: FormFieldState(id = field.key)
    var showPicker by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = label,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f),
            )
            if (snapshot.value.isNotEmpty()) {
                Text(
                    text = "Clear",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .clickable { onUpdate(field, "") }
                            .padding(start = Spacing.s2)
                            .testTag("composePulseField_${field.key}_clear"),
                )
            }
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = if (snapshot.error != null) PantopusColors.error else PantopusColors.appBorder,
                        shape = RoundedCornerShape(Radii.md),
                    ).clickable { showPicker = true }
                    .padding(horizontal = Spacing.s3)
                    .alpha(if (snapshot.value.isEmpty()) 0.65f else 1f)
                    .testTag("composePulseField_${field.key}"),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = if (snapshot.value.isEmpty()) "Tap to pick" else snapshot.value,
                style = PantopusTextStyle.body,
                color =
                    if (snapshot.value.isEmpty()) PantopusColors.appTextMuted else PantopusColors.appText,
            )
        }
        if (snapshot.error != null) {
            Text(
                text = snapshot.error.orEmpty(),
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
    if (showPicker) {
        FutureDateTimePickerDialogs(
            initial = parsePickerDateTime(snapshot.value),
            onPicked = { picked ->
                showPicker = false
                onUpdate(field, formatPickerDateTime(picked))
            },
            onDismiss = { showPicker = false },
        )
    }
}

/** Encode a [LocalDateTime] as the picker-emitted `yyyy-MM-dd HH:mm` shape. */
private fun formatPickerDateTime(value: LocalDateTime): String =
    "%04d-%02d-%02d %02d:%02d".format(
        value.year,
        value.monthValue,
        value.dayOfMonth,
        value.hour,
        value.minute,
    )

/** Reverse of [formatPickerDateTime]; null for empty/unparsable values. */
private fun parsePickerDateTime(raw: String): LocalDateTime? {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return null
    return runCatching { LocalDateTime.parse(trimmed.replaceFirst(" ", "T")) }.getOrNull()
}

@Composable
private fun ChipRow(
    label: String,
    options: List<Pair<String, String>>,
    activeKey: String,
    identifierPrefix: String,
    onSelect: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            options.forEach { (key, displayLabel) ->
                val isActive = key == activeKey
                Box(
                    modifier =
                        Modifier
                            .heightIn(min = 30.dp)
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(if (isActive) PantopusColors.primary600 else PantopusColors.appSurface)
                            .border(
                                width = 1.dp,
                                color = if (isActive) Color.Transparent else PantopusColors.appBorder,
                                shape = RoundedCornerShape(Radii.pill),
                            )
                            .clickable { onSelect(key) }
                            .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                            .testTag("${identifierPrefix}_$key")
                            .semantics { contentDescription = displayLabel },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = displayLabel,
                        style = PantopusTextStyle.small,
                        color =
                            if (isActive) {
                                PantopusColors.appTextInverse
                            } else {
                                PantopusColors.appTextStrong
                            },
                    )
                }
            }
        }
    }
}

/**
 * Shimmer skeleton shown while the edit-mode prefill is in flight.
 * Mirrors the loaded geometry so layout doesn't jump on resolve.
 */
@Composable
private fun PulseComposePrefillSkeleton() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .testTag("composePulsePrefillSkeleton"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        Shimmer(width = 220.dp, height = 16.dp, cornerRadius = Radii.sm)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Shimmer(width = 64.dp, height = 32.dp, cornerRadius = Radii.pill)
            Shimmer(width = 80.dp, height = 32.dp, cornerRadius = Radii.pill)
            Shimmer(width = 72.dp, height = 32.dp, cornerRadius = Radii.pill)
        }
        Shimmer(width = 160.dp, height = 16.dp, cornerRadius = Radii.sm)
        Shimmer(width = 320.dp, height = 44.dp, cornerRadius = Radii.md)
        Shimmer(width = 100.dp, height = 16.dp, cornerRadius = Radii.sm)
        Shimmer(width = 320.dp, height = 96.dp, cornerRadius = Radii.md)
    }
}

/**
 * Error state shown when the edit-mode prefill fetch fails. Pairs the
 * message with a retry CTA wired back to `loadForEdit`.
 */
@Composable
private fun PulseComposePrefillErrorView(
    message: String,
    onRetry: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .testTag("composePulsePrefillError"),
    ) {
        EmptyState(
            icon = PantopusIcon.AlertCircle,
            headline = "Couldn't load this post",
            subcopy = message,
            ctaTitle = "Try again",
            onCta = onRetry,
        )
    }
}

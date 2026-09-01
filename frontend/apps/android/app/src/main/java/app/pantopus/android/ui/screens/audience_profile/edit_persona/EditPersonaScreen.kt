@file:Suppress("LongMethod", "LongParameterList", "MagicNumber", "MatchingDeclarationName", "PackageNaming", "TooManyFunctions")
@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)

package app.pantopus.android.ui.screens.audience_profile.edit_persona

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
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import coil.compose.SubcomposeAsyncImage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * A13.12 — Edit Beacon. Every control writes into
 * [EditPersonaViewModel]'s form and is persisted by `save()` →
 * `POST /api/personas` / `PATCH /api/personas/:id` plus
 * `POST /api/upload/persona-media/:id`.
 *
 * Sections the persona write contract does not cover (tiers, Stripe
 * Connect, posting cap, quiet hours, analytics) are intentionally absent
 * rather than rendered from a fixture — they belong to the tier and
 * monetization routes.
 */

/**
 * Every editing intent the scaffold needs, bundled so the Paparazzi
 * snapshots can render the loaded frame without a Hilt view-model.
 */
@Suppress("LongParameterList")
data class EditPersonaCallbacks(
    val onHandleChange: (String) -> Unit = {},
    val onDisplayNameChange: (String) -> Unit = {},
    val onBioChange: (String) -> Unit = {},
    val onCategorySelected: (String) -> Unit = {},
    val onAudienceLabelSelected: (PersonaAudienceLabel) -> Unit = {},
    val onAudienceModeSelected: (PersonaAudienceMode) -> Unit = {},
    val onAddLink: () -> Unit = {},
    val onRemoveLink: (String) -> Unit = {},
    val onLinkLabelChange: (String, String) -> Unit = { _, _ -> },
    val onLinkUrlChange: (String, String) -> Unit = { _, _ -> },
    val onAvatarPicked: (PersonaImagePick) -> Unit = {},
    val onBannerPicked: (PersonaImagePick) -> Unit = {},
    val onRemoveAvatarPick: () -> Unit = {},
    val onRemoveBannerPick: () -> Unit = {},
    val onSave: () -> Unit = {},
    val onRetry: () -> Unit = {},
)

@Composable
fun EditPersonaScreen(
    onClose: () -> Unit = {},
    onViewBeacon: (String) -> Unit = {},
    viewModel: EditPersonaViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    LaunchedEffect(Unit) { viewModel.load() }

    EditPersonaScaffold(
        state = state,
        callbacks =
            EditPersonaCallbacks(
                onHandleChange = viewModel::setHandle,
                onDisplayNameChange = viewModel::setDisplayName,
                onBioChange = viewModel::setBio,
                onCategorySelected = viewModel::setCategory,
                onAudienceLabelSelected = viewModel::setAudienceLabel,
                onAudienceModeSelected = viewModel::setAudienceMode,
                onAddLink = viewModel::addLink,
                onRemoveLink = viewModel::removeLink,
                onLinkLabelChange = { id, value -> viewModel.updateLink(id, label = value) },
                onLinkUrlChange = { id, value -> viewModel.updateLink(id, url = value) },
                onAvatarPicked = viewModel::attachAvatar,
                onBannerPicked = viewModel::attachBanner,
                onRemoveAvatarPick = viewModel::removeAvatarPick,
                onRemoveBannerPick = viewModel::removeBannerPick,
                onSave = { viewModel.save(onSaved = onViewBeacon) },
                onRetry = viewModel::refresh,
            ),
        onClose = onClose,
        onViewBeacon = onViewBeacon,
    )
}

/** State-driven body — no Hilt, so Paparazzi can render every frame. */
@Composable
internal fun EditPersonaScaffold(
    state: EditPersonaUiState,
    callbacks: EditPersonaCallbacks = EditPersonaCallbacks(),
    onClose: () -> Unit = {},
    onViewBeacon: (String) -> Unit = {},
) {
    when (state) {
        is EditPersonaUiState.Loading ->
            EditPersonaShell(
                title = "Edit Beacon",
                subtitle = null,
                isValid = false,
                isDirty = false,
                onClose = onClose,
                stickyBottom = null,
            ) { LoadingFrame() }

        is EditPersonaUiState.Editing ->
            EditPersonaEditingContent(
                state = state,
                callbacks = callbacks,
                onClose = onClose,
                onViewBeacon = onViewBeacon,
            )

        is EditPersonaUiState.Error ->
            EditPersonaShell(
                title = "Edit Beacon",
                subtitle = null,
                isValid = false,
                isDirty = false,
                onClose = onClose,
                stickyBottom = null,
            ) { ErrorFrame(state.message, callbacks.onRetry) }
    }
}

@Composable
private fun EditPersonaEditingContent(
    state: EditPersonaUiState.Editing,
    callbacks: EditPersonaCallbacks,
    onClose: () -> Unit,
    onViewBeacon: (String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    EditPersonaShell(
        title = if (state.mode.isCreate) "Create Beacon" else "Edit Beacon",
        subtitle = state.form.atHandle.ifEmpty { null },
        isValid = state.isValid,
        isDirty = state.isDirty,
        onClose = onClose,
        stickyBottom = {
            PersonaStickyBar(
                label = state.saveButtonLabel,
                isSaving = state.isSaving,
                isEnabled = state.isValid && !state.isSaving,
                statusMessage = state.statusMessage,
                errorMessage = state.saveError,
                onDiscard = onClose,
                onSave = callbacks.onSave,
            )
        },
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4)
                    .testTag("editPersonaContent"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s5),
        ) {
            if (state.mode.isCreate) CreateHero()
            MediaSection(state = state, callbacks = callbacks, scope = scope)
            IdentitySection(state = state, callbacks = callbacks)
            CategorySection(state = state, callbacks = callbacks)
            AudienceSection(state = state, callbacks = callbacks)
            LinksSection(state = state, callbacks = callbacks)
            if (!state.mode.isCreate && state.form.shareUrl.isNotEmpty()) {
                ShareSection(url = state.form.shareUrl) { onViewBeacon(state.form.normalizedHandle) }
            }
        }
    }
}

@Composable
private fun EditPersonaShell(
    title: String,
    subtitle: String?,
    isValid: Boolean,
    isDirty: Boolean,
    onClose: () -> Unit,
    stickyBottom: (@Composable () -> Unit)?,
    body: @Composable () -> Unit,
) {
    FormShell(
        title = title,
        subtitle = subtitle,
        rightActionLabel = null,
        isValid = isValid,
        isDirty = isDirty,
        onClose = onClose,
        onCommit = {},
        stickyBottom = stickyBottom,
        body = body,
    )
}

// MARK: - Loading / error

@Composable
private fun LoadingFrame() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4)
                .testTag("editPersonaLoading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        Shimmer(height = 120.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        Shimmer(height = 160.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        Shimmer(height = 200.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
        Shimmer(height = 120.dp, cornerRadius = Radii.lg, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun ErrorFrame(
    message: String,
    onRetry: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s4, vertical = Spacing.s10)
                .testTag("editPersonaError"),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 40.dp,
            tint = PantopusColors.error,
        )
        Text(
            text = "Couldn't load Beacon",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appText,
            modifier = Modifier.semantics { heading() },
        )
        Text(text = message, fontSize = 13.sp, color = PantopusColors.appTextSecondary)
        PrimaryButton(
            title = "Try again",
            onClick = onRetry,
            modifier = Modifier.testTag("editPersonaRetry"),
        )
    }
}

// MARK: - Create hero

@Composable
private fun CreateHero() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.primary50)
                .border(1.dp, PantopusColors.primary200, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("editPersonaCreateHero"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.primary600),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Radio,
                contentDescription = null,
                size = 18.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Create your Beacon",
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.appText,
            )
            Text(
                text = "A public identity, separate from your personal profile. Pick a handle and you're live.",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.primary700,
            )
        }
    }
}

// MARK: - Media

@Composable
private fun MediaSection(
    state: EditPersonaUiState.Editing,
    callbacks: EditPersonaCallbacks,
    scope: CoroutineScope,
) {
    PersonaSection("Beacon media") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            BannerPicker(
                pick = state.form.bannerPick,
                remoteUrl = state.form.bannerUrl,
                scope = scope,
                onPicked = callbacks.onBannerPicked,
                onRemove = callbacks.onRemoveBannerPick,
            )
            AvatarPicker(
                pick = state.form.avatarPick,
                remoteUrl = state.form.avatarUrl,
                scope = scope,
                onPicked = callbacks.onAvatarPicked,
                onRemove = callbacks.onRemoveAvatarPick,
            )
        }
    }
}

@Composable
private fun BannerPicker(
    pick: PersonaImagePick?,
    remoteUrl: String?,
    scope: CoroutineScope,
    onPicked: (PersonaImagePick) -> Unit,
    onRemove: () -> Unit,
) {
    val openPicker = rememberImagePicker(kind = "banner", scope = scope, onPicked = onPicked)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        PLabel(text = "Banner", hint = "16:6")
        Box(modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .height(96.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurfaceSunken)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                        .clickable(onClick = openPicker)
                        .testTag("editPersonaBannerPicker")
                        .semantics { contentDescription = "Choose banner image" },
                contentAlignment = Alignment.Center,
            ) {
                PersonaImagePreview(
                    pick = pick,
                    remoteUrl = remoteUrl,
                    emptyLabel = "Add a banner",
                )
            }
            if (pick != null) {
                RemovePickButton(
                    onClick = onRemove,
                    tag = "editPersonaBannerRemove",
                    modifier = Modifier.align(Alignment.TopEnd).padding(Spacing.s1),
                )
            }
        }
    }
}

@Composable
private fun AvatarPicker(
    pick: PersonaImagePick?,
    remoteUrl: String?,
    scope: CoroutineScope,
    onPicked: (PersonaImagePick) -> Unit,
    onRemove: () -> Unit,
) {
    val openPicker = rememberImagePicker(kind = "avatar", scope = scope, onPicked = onPicked)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box {
            Box(
                modifier =
                    Modifier
                        .size(72.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .border(1.dp, PantopusColors.appBorder, CircleShape)
                        .clickable(onClick = openPicker)
                        .testTag("editPersonaAvatarPicker")
                        .semantics { contentDescription = "Choose avatar image" },
                contentAlignment = Alignment.Center,
            ) {
                PersonaImagePreview(pick = pick, remoteUrl = remoteUrl, emptyLabel = null)
            }
            if (pick != null) {
                RemovePickButton(
                    onClick = onRemove,
                    tag = "editPersonaAvatarRemove",
                    modifier = Modifier.align(Alignment.TopEnd),
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                text = "Avatar",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
            )
            Text(
                text = "Use an image that isn't your personal profile photo — your Beacon is a separate identity.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

@Composable
private fun PersonaImagePreview(
    pick: PersonaImagePick?,
    remoteUrl: String?,
    emptyLabel: String?,
) {
    when {
        pick != null ->
            SubcomposeAsyncImage(
                model = pick.bytes,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                loading = {},
                error = {},
            )
        !remoteUrl.isNullOrBlank() ->
            SubcomposeAsyncImage(
                model = remoteUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
                loading = {},
                error = {},
            )
        else ->
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Image,
                    contentDescription = null,
                    size = 20.dp,
                    tint = PantopusColors.appTextMuted,
                )
                if (emptyLabel != null) {
                    Text(
                        text = emptyLabel,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appTextSecondary,
                    )
                }
            }
    }
}

@Composable
private fun RemovePickButton(
    onClick: () -> Unit,
    tag: String,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(24.dp)
                .clip(CircleShape)
                .background(PantopusColors.appTextStrong)
                .clickable(onClick = onClick)
                .testTag(tag)
                .semantics { contentDescription = "Remove picked image" },
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.X,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.appTextInverse,
        )
    }
}

/**
 * Android Photo Picker — out-of-process, so no `READ_MEDIA_IMAGES` grant is
 * needed. Opening the returned `Uri` can still fail (revoked grant, cloud
 * file that won't materialise); that path simply drops the pick.
 */
@Composable
private fun rememberImagePicker(
    kind: String,
    scope: CoroutineScope,
    onPicked: (PersonaImagePick) -> Unit,
): () -> Unit {
    val context = LocalContext.current
    val launcher =
        rememberLauncherForActivityResult(
            contract = ActivityResultContracts.PickVisualMedia(),
        ) { uri: Uri? ->
            if (uri == null) return@rememberLauncherForActivityResult
            val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
            scope.launch {
                val bytes =
                    withContext(Dispatchers.IO) {
                        runCatching {
                            context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        }.getOrNull()
                    } ?: return@launch
                onPicked(
                    PersonaImagePick(
                        bytes = bytes,
                        // Randomised name — the picker's IMG_xxxx never reaches S3.
                        fileName = "beacon-$kind-${System.currentTimeMillis()}.${extensionFor(mimeType)}",
                        mimeType = mimeType,
                    ),
                )
            }
        }
    return { launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
}

private fun extensionFor(mimeType: String): String =
    when (mimeType.lowercase()) {
        "image/png" -> "png"
        "image/webp" -> "webp"
        "image/heic", "image/heif" -> "heic"
        else -> "jpg"
    }

// MARK: - Identity

@Composable
private fun IdentitySection(
    state: EditPersonaUiState.Editing,
    callbacks: EditPersonaCallbacks,
) {
    PersonaSection("Identity") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            Column {
                PLabel(text = "Handle", required = true, hint = "3–40 chars · letters, numbers, . _ -")
                PersonaField(
                    value = state.form.handle,
                    onValueChange = callbacks.onHandleChange,
                    placeholder = "yourhandle",
                    tag = "editPersonaHandle",
                    monospace = true,
                    prefix = "@",
                )
            }
            Column {
                PLabel(text = "Display name", required = true)
                PersonaField(
                    value = state.form.displayName,
                    onValueChange = callbacks.onDisplayNameChange,
                    placeholder = "What your audience sees",
                    tag = "editPersonaDisplayName",
                )
            }
            Column {
                PLabel(text = "Bio")
                PersonaField(
                    value = state.form.bio,
                    onValueChange = callbacks.onBioChange,
                    placeholder = "What do you post about?",
                    tag = "editPersonaBio",
                    singleLine = false,
                    minHeight = 96.dp,
                )
                Text(
                    text = state.form.bioCharCount,
                    fontSize = 11.sp,
                    color =
                        if (state.form.bio.length > EditPersonaForm.BIO_LIMIT) {
                            PantopusColors.error
                        } else {
                            PantopusColors.appTextMuted
                        },
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .padding(top = Spacing.s1)
                            .testTag("editPersonaBioCount"),
                )
            }
        }
    }
}

// MARK: - Category

@Composable
private fun CategorySection(
    state: EditPersonaUiState.Editing,
    callbacks: EditPersonaCallbacks,
) {
    PersonaSection("Category") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text =
                    "What this Beacon is for. Sensitive professional categories stay gated " +
                        "until credentials are verified.",
                fontSize = 11.sp,
                color = PantopusColors.appTextSecondary,
            )
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                state.categories.forEach { option ->
                    PersonaChoiceChip(
                        label = if (option.enabled) option.label else "${option.label} (gated)",
                        icon = if (option.enabled) null else PantopusIcon.Lock,
                        selected = state.form.category == option.value,
                        enabled = option.enabled,
                        tag = "editPersonaCategory_${option.value}",
                        onClick = { callbacks.onCategorySelected(option.value) },
                    )
                }
            }
        }
    }
}

// MARK: - Audience

@Composable
private fun AudienceSection(
    state: EditPersonaUiState.Editing,
    callbacks: EditPersonaCallbacks,
) {
    PersonaSection("Audience") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s4)) {
            Column {
                PLabel(text = "What you call them")
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    PersonaAudienceLabel.entries.forEach { option ->
                        PersonaChoiceChip(
                            label = option.label,
                            icon = null,
                            selected = state.form.audienceLabel == option,
                            enabled = true,
                            tag = "editPersonaAudienceLabel_${option.wire}",
                            onClick = { callbacks.onAudienceLabelSelected(option) },
                        )
                    }
                }
            }
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                PLabel(text = "How they join")
                PersonaAudienceMode.entries.forEach { option ->
                    PersonaModeRow(
                        option = option,
                        selected = state.form.audienceMode == option,
                        onClick = { callbacks.onAudienceModeSelected(option) },
                    )
                }
            }
        }
    }
}

// MARK: - Public links

@Composable
private fun LinksSection(
    state: EditPersonaUiState.Editing,
    callbacks: EditPersonaCallbacks,
) {
    PersonaSection("Public links") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            if (state.form.links.isEmpty()) {
                Text(
                    text = "Add up to 8 links your audience can open from your Beacon.",
                    fontSize = 11.sp,
                    color = PantopusColors.appTextSecondary,
                )
            }
            state.form.links.forEach { link ->
                PersonaLinkRow(
                    link = link,
                    onLabel = { callbacks.onLinkLabelChange(link.id, it) },
                    onUrl = { callbacks.onLinkUrlChange(link.id, it) },
                    onRemove = { callbacks.onRemoveLink(link.id) },
                )
            }
            if (state.form.hasIncompleteLink) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.testTag("editPersonaLinkError"),
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.AlertCircle,
                        contentDescription = null,
                        size = 12.dp,
                        tint = PantopusColors.error,
                    )
                    Text(
                        text = "Each public link needs both a label and a URL.",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.error,
                    )
                }
            }
            AddLinkRow(enabled = state.canAddLink, onClick = callbacks.onAddLink)
        }
    }
}

@Composable
private fun PersonaLinkRow(
    link: PersonaLinkDraft,
    onLabel: (String) -> Unit,
    onUrl: (String) -> Unit,
    onRemove: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurfaceSunken)
                .padding(Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            PersonaField(
                value = link.label,
                onValueChange = onLabel,
                placeholder = "Label",
                tag = "editPersonaLinkLabel",
            )
            PersonaField(
                value = link.url,
                onValueChange = onUrl,
                placeholder = "https://",
                tag = "editPersonaLinkUrl",
                monospace = true,
                keyboardType = KeyboardType.Uri,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clickable(onClick = onRemove)
                    .testTag("editPersonaRemoveLink")
                    .semantics { contentDescription = "Remove link ${link.label}" },
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Trash,
                contentDescription = null,
                size = 16.dp,
                tint = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun AddLinkRow(
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.lg))
                .border(
                    width = 1.dp,
                    color = if (enabled) PantopusColors.primary200 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                )
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s4)
                .testTag("editPersonaAddLink")
                .semantics { contentDescription = "Add link, up to 8" },
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.PlusCircle,
            contentDescription = null,
            size = 15.dp,
            tint = if (enabled) PantopusColors.primary700 else PantopusColors.appTextMuted,
        )
        Text(
            text = "Add link",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (enabled) PantopusColors.primary700 else PantopusColors.appTextMuted,
            modifier = Modifier.weight(1f),
        )
        Text(text = "up to 8", fontSize = 10.sp, color = PantopusColors.appTextMuted)
    }
}

// MARK: - Share

@Composable
private fun ShareSection(
    url: String,
    onOpen: () -> Unit,
) {
    PersonaSection("Share") {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                    .padding(Spacing.s3)
                    .testTag("editPersonaShareCard"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Text(
                text = "PUBLIC LINK · ANYONE CAN FOLLOW",
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = PantopusColors.primary700,
            )
            Text(
                text = url,
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.appTextStrong,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.sm))
                        .background(PantopusColors.appSurfaceMuted)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.sm))
                        .padding(horizontal = Spacing.s2, vertical = 6.dp),
            )
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 34.dp)
                        .clip(RoundedCornerShape(Radii.sm))
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.sm))
                        .clickable(onClick = onOpen)
                        .testTag("editPersonaShareView")
                        .semantics { contentDescription = "View Beacon" },
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1, Alignment.CenterHorizontally),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.ExternalLink,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.appText,
                )
                Text(
                    text = "View",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = PantopusColors.appText,
                )
            }
        }
    }
}

// MARK: - Sticky bar

@Composable
private fun PersonaStickyBar(
    label: String,
    isSaving: Boolean,
    isEnabled: Boolean,
    statusMessage: String?,
    errorMessage: String?,
    onDiscard: () -> Unit,
    onSave: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        val banner = errorMessage ?: statusMessage
        if (banner != null) {
            val isError = errorMessage != null
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(if (isError) PantopusColors.errorBg else PantopusColors.successBg)
                        .border(
                            width = 1.dp,
                            color = if (isError) PantopusColors.errorLight else PantopusColors.successLight,
                            shape = RoundedCornerShape(Radii.md),
                        )
                        .padding(horizontal = Spacing.s2, vertical = 6.dp)
                        .testTag("editPersonaStatusBanner"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                PantopusIconImage(
                    icon = if (isError) PantopusIcon.AlertCircle else PantopusIcon.CheckCircle,
                    contentDescription = null,
                    size = 13.dp,
                    tint = if (isError) PantopusColors.error else PantopusColors.success,
                )
                Text(
                    text = banner,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = if (isError) PantopusColors.error else PantopusColors.success,
                )
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = "Cancel",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextStrong,
                modifier =
                    Modifier
                        .heightIn(min = 42.dp)
                        .clickable(onClick = onDiscard)
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                        .testTag("editPersonaDiscard"),
            )
            Box(modifier = Modifier.weight(1f))
            PrimaryButton(
                title = label,
                onClick = onSave,
                modifier = Modifier.testTag("editPersonaSave"),
                isLoading = isSaving,
                isEnabled = isEnabled,
            )
        }
    }
}

// MARK: - Shared primitives

@Composable
private fun PersonaSection(
    overline: String,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = overline.uppercase(),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.semantics { heading() },
        )
        content()
    }
}

@Composable
private fun PLabel(
    text: String,
    required: Boolean = false,
    hint: String? = null,
) {
    Row(
        modifier = Modifier.padding(bottom = Spacing.s2),
        horizontalArrangement = Arrangement.spacedBy(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = text,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextStrong,
        )
        if (required) {
            Text(
                text = "*",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.primary600,
            )
        }
        if (hint != null) {
            Text(
                text = hint,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
private fun PersonaField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    tag: String,
    monospace: Boolean = false,
    prefix: String? = null,
    singleLine: Boolean = true,
    minHeight: Dp = 44.dp,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = minHeight)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = if (singleLine) Alignment.CenterVertically else Alignment.Top,
    ) {
        if (prefix != null) {
            Text(
                text = prefix,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                color = PantopusColors.primary600,
                modifier = Modifier.padding(vertical = 11.dp),
            )
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = singleLine,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            textStyle =
                TextStyle(
                    fontSize = 14.sp,
                    color = PantopusColors.appText,
                    fontFamily = if (monospace) FontFamily.Monospace else FontFamily.Default,
                    fontWeight = if (monospace) FontWeight.SemiBold else FontWeight.Normal,
                ),
            cursorBrush = SolidColor(PantopusColors.primary600),
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(text = placeholder, fontSize = 14.sp, color = PantopusColors.appTextMuted)
                }
                inner()
            },
            modifier =
                Modifier
                    .weight(1f)
                    .padding(vertical = 11.dp)
                    .testTag(tag),
        )
    }
}

@Composable
private fun PersonaChoiceChip(
    label: String,
    icon: PantopusIcon?,
    selected: Boolean,
    enabled: Boolean,
    tag: String,
    onClick: () -> Unit,
) {
    val foreground =
        when {
            !enabled -> PantopusColors.appTextMuted
            selected -> PantopusColors.primary700
            else -> PantopusColors.appTextStrong
        }
    val background =
        when {
            !enabled -> PantopusColors.appSurfaceSunken
            selected -> PantopusColors.primary50
            else -> PantopusColors.appSurface
        }
    val border = if (selected && enabled) PantopusColors.primary200 else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .heightIn(min = 34.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(background)
                .border(1.dp, border, RoundedCornerShape(Radii.pill))
                .clickable(enabled = enabled, onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag(tag),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 11.dp, tint = foreground)
        }
        Text(text = label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = foreground)
    }
}

@Composable
private fun PersonaModeRow(
    option: PersonaAudienceMode,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(if (selected) PantopusColors.primary50 else PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = if (selected) PantopusColors.primary200 else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.md),
                )
                .clickable(onClick = onClick)
                .padding(Spacing.s3)
                .testTag("editPersonaAudienceMode_${option.wire}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = if (selected) PantopusIcon.CheckCircle else PantopusIcon.Circle,
            contentDescription = null,
            size = 18.dp,
            tint = if (selected) PantopusColors.primary600 else PantopusColors.appBorderStrong,
        )
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = option.label,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(text = option.blurb, fontSize = 11.sp, color = PantopusColors.appTextSecondary)
        }
    }
}

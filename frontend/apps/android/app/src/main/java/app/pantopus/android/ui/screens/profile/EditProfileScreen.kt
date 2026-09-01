@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.sizeIn
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.PantopusFieldState
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.components.Toast
import app.pantopus.android.ui.components.ToastKind
import app.pantopus.android.ui.components.ToastMessage
import app.pantopus.android.ui.screens.shared.form.FORM_COMMIT_BUTTON_TAG
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormFieldState
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.formShakeOnChange
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

/**
 * P1.4 — Settings → Edit profile. Mirrors the iOS `EditProfileView`
 * 1:1: same sections (About / Skills / Contact / Address / Social /
 * Visibility), same field set, same validators, same dirty-tracked PATCH
 * body. Skills are the one group that doesn't ride that PATCH — they
 * commit through `PUT /api/users/skills` in the same Save.
 *
 * Renders four states out of [EditProfileUiState]: shimmer skeleton,
 * loaded form, error empty-state (with retry), and an inline toast for
 * save success / save failure.
 */
@Composable
fun EditProfileScreen(
    onBack: () -> Unit,
    viewModel: EditProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val fields by viewModel.fields.collectAsStateWithLifecycle()
    val isSaving by viewModel.isSaving.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val shouldDismiss by viewModel.shouldDismiss.collectAsStateWithLifecycle()
    val email by viewModel.email.collectAsStateWithLifecycle()
    val emailVerified by viewModel.emailVerified.collectAsStateWithLifecycle()
    val shakeTrigger by viewModel.shakeTrigger.collectAsStateWithLifecycle()
    val avatarUrl by viewModel.avatarUrl.collectAsStateWithLifecycle()
    val avatarInitial by viewModel.avatarInitial.collectAsStateWithLifecycle()
    val avatarState by viewModel.avatarState.collectAsStateWithLifecycle()
    // Skills ride `PUT /api/users/skills`, not the profile PATCH, but they
    // commit through the same Save (`backend/routes/users.js:2246`).
    // Read with `.value` here rather than `by`: `isDirty`, `dirtyFieldCount`,
    // `canAddSkill` and `canGenerateBio` are plain getters over these flows,
    // and they are evaluated in *this* scope. Reading the flows only inside
    // the slot lambdas below would give those lambdas the invalidation and
    // leave a skills-only edit unable to light the Save CTA or the sticky
    // "N unsaved" pill.
    val skills = viewModel.skills.collectAsStateWithLifecycle().value
    val skillDraft = viewModel.skillDraft.collectAsStateWithLifecycle().value
    val bioDraftState = viewModel.bioDraftState.collectAsStateWithLifecycle().value
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        Analytics.track(AnalyticsEvent.ScreenEditProfileViewed)
        viewModel.load()
    }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    LaunchedEffect(shouldDismiss) {
        if (shouldDismiss) {
            viewModel.acknowledgeDismiss()
            // Hold the success toast on screen briefly before popping
            // so the user actually sees the confirmation — mirrors iOS.
            delay(700)
            onBack()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("editProfileShell"),
    ) {
        when (val current = state) {
            EditProfileUiState.Loading ->
                EditProfileSkeleton()
            EditProfileUiState.Loaded ->
                EditProfileLoaded(
                    state =
                        EditProfileLoadedState(
                            fields = fields,
                            email = email,
                            emailVerified = emailVerified,
                            isValid = viewModel.isValid,
                            isDirty = viewModel.isDirty,
                            dirtyFieldCount = viewModel.dirtyFieldCount,
                            isSaving = isSaving,
                        ),
                    shakeTrigger = shakeTrigger,
                    onClose = onBack,
                    onCommit = viewModel::save,
                    onDiscard = viewModel::discardChanges,
                    onUpdate = viewModel::update,
                    avatarSlot = {
                        EditProfileAvatarBlock(
                            avatarUrl = avatarUrl,
                            initial = avatarInitial,
                            state = avatarState,
                            onPicked = viewModel::uploadAvatar,
                            onDismissError = viewModel::dismissAvatarError,
                            scope = scope,
                        )
                    },
                    skillsSlot = {
                        EditProfileSkillsBlock(
                            skills = skills,
                            draft = skillDraft,
                            canAdd = viewModel.canAddSkill,
                            onDraftChange = viewModel::updateSkillDraft,
                            onAdd = viewModel::addSkill,
                            onRemove = viewModel::removeSkill,
                        )
                    },
                    bioActionSlot = {
                        EditProfileGenerateBioButton(
                            state = bioDraftState,
                            enabled = viewModel.canGenerateBio,
                            onGenerate = viewModel::generateBio,
                        )
                    },
                    bioDraftErrorSlot = {
                        EditProfileBioDraftError(
                            state = bioDraftState,
                            onDismiss = viewModel::dismissBioDraftError,
                        )
                    },
                )
            is EditProfileUiState.Error ->
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load profile",
                    subcopy = current.message,
                    ctaTitle = "Try again",
                    onCta = viewModel::refresh,
                )
        }

        toast?.let { payload ->
            EditProfileToastView(
                payload = payload,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10),
            )
        }
    }
}

@Composable
internal fun EditProfileToastView(
    payload: EditProfileToast,
    modifier: Modifier = Modifier,
) {
    Toast(
        message =
            ToastMessage(
                text = payload.text,
                kind = if (payload.isError) ToastKind.Error else ToastKind.Success,
            ),
        modifier = modifier.testTag("editProfileToast"),
    )
}

internal data class EditProfileLoadedState(
    val fields: Map<EditProfileField, FormFieldState>,
    val email: String,
    val emailVerified: Boolean,
    val isValid: Boolean,
    val isDirty: Boolean,
    val dirtyFieldCount: Int,
    val isSaving: Boolean,
)

@Composable
internal fun EditProfileLoaded(
    state: EditProfileLoadedState,
    onClose: () -> Unit,
    onCommit: () -> Unit,
    onDiscard: () -> Unit,
    onUpdate: (EditProfileField, String) -> Unit,
    shakeTrigger: Int = 0,
    avatarSlot: @Composable () -> Unit = {},
    skillsSlot: @Composable () -> Unit = {},
    bioActionSlot: @Composable () -> Unit = {},
    bioDraftErrorSlot: @Composable () -> Unit = {},
) {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .formShakeOnChange(trigger = shakeTrigger)
                .testTag("editProfileShake"),
    ) {
        FormShell(
            title = "Edit profile",
            rightActionLabel = "Save",
            isValid = state.isValid,
            isDirty = state.isDirty,
            isSaving = state.isSaving,
            onClose = onClose,
            onCommit = onCommit,
            stickyBottom = {
                EditProfileStickyBar(
                    dirtyCount = state.dirtyFieldCount,
                    isValid = state.isValid,
                    isSaving = state.isSaving,
                    onDiscard = onDiscard,
                    onSave = onCommit,
                )
            },
        ) {
            EditProfileSections(
                fields = state.fields,
                email = state.email,
                emailVerified = state.emailVerified,
                onUpdate = onUpdate,
                avatarSlot = avatarSlot,
                skillsSlot = skillsSlot,
                bioActionSlot = bioActionSlot,
                bioDraftErrorSlot = bioDraftErrorSlot,
            )
        }
    }
}

@Composable
private fun EditProfileSections(
    fields: Map<EditProfileField, FormFieldState>,
    email: String,
    emailVerified: Boolean,
    onUpdate: (EditProfileField, String) -> Unit,
    avatarSlot: @Composable () -> Unit = {},
    skillsSlot: @Composable () -> Unit = {},
    bioActionSlot: @Composable () -> Unit = {},
    bioDraftErrorSlot: @Composable () -> Unit = {},
) {
    // A13.9 §① — avatar + "Change photo". The photo does not ride the
    // PATCH body; it has its own multipart route
    // (`POST /api/upload/profile-picture`), so the block sits above the
    // field groups rather than inside one.
    avatarSlot()
    FormFieldGroup("About") {
        TextRow(
            field = EditProfileField.FirstName,
            label = "First name",
            fields = fields,
            onUpdate = onUpdate,
        )
        TextRow(
            field = EditProfileField.MiddleName,
            label = "Middle name (optional)",
            fields = fields,
            onUpdate = onUpdate,
        )
        TextRow(
            field = EditProfileField.LastName,
            label = "Last name",
            fields = fields,
            onUpdate = onUpdate,
        )
        TextRow(
            field = EditProfileField.Tagline,
            label = "Tagline (optional)",
            placeholder = "A short headline",
            fields = fields,
            onUpdate = onUpdate,
        )
        BioField(
            fields = fields,
            onUpdate = onUpdate,
            actionSlot = bioActionSlot,
            draftErrorSlot = bioDraftErrorSlot,
        )
    }
    // Skills live in `UserSkill`, not on `User`, so this group commits
    // through `PUT /api/users/skills` inside the same Save.
    FormFieldGroup("Skills") { skillsSlot() }
    FormFieldGroup("Contact") {
        // Note: the design allows editing email when `verified ==
        // false`. `updateProfileSchema` exposes no `email` key, so
        // the field is read-only until the backend adds it.
        ReadOnlyEmailRow(email = email, verified = emailVerified)
        TextRow(
            field = EditProfileField.PhoneNumber,
            label = "Phone (optional)",
            placeholder = "+15555550123",
            keyboardType = KeyboardType.Phone,
            fields = fields,
            onUpdate = onUpdate,
        )
        DateOfBirthField(fields = fields, onUpdate = onUpdate)
    }
    FormFieldGroup("Address") {
        TextRow(
            field = EditProfileField.Address,
            label = "Street",
            placeholder = "123 Main St",
            fields = fields,
            onUpdate = onUpdate,
        )
        TextRow(
            field = EditProfileField.City,
            label = "City",
            fields = fields,
            onUpdate = onUpdate,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(modifier = Modifier.weight(1f)) {
                TextRow(
                    field = EditProfileField.State,
                    label = "State",
                    fields = fields,
                    onUpdate = onUpdate,
                )
            }
            Box(modifier = Modifier.weight(1f)) {
                TextRow(
                    field = EditProfileField.Zipcode,
                    label = "Zip",
                    fields = fields,
                    onUpdate = onUpdate,
                )
            }
        }
    }
    FormFieldGroup("Social") {
        TextRow(
            field = EditProfileField.Website,
            label = "Website",
            placeholder = "https://example.com",
            keyboardType = KeyboardType.Uri,
            fields = fields,
            onUpdate = onUpdate,
        )
        TextRow(
            field = EditProfileField.Linkedin,
            label = "LinkedIn",
            placeholder = "https://linkedin.com/in/…",
            keyboardType = KeyboardType.Uri,
            fields = fields,
            onUpdate = onUpdate,
        )
        TextRow(
            field = EditProfileField.Twitter,
            label = "Twitter / X",
            placeholder = "https://x.com/…",
            keyboardType = KeyboardType.Uri,
            fields = fields,
            onUpdate = onUpdate,
        )
        TextRow(
            field = EditProfileField.Instagram,
            label = "Instagram",
            placeholder = "https://instagram.com/…",
            keyboardType = KeyboardType.Uri,
            fields = fields,
            onUpdate = onUpdate,
        )
        TextRow(
            field = EditProfileField.Facebook,
            label = "Facebook",
            placeholder = "https://facebook.com/…",
            keyboardType = KeyboardType.Uri,
            fields = fields,
            onUpdate = onUpdate,
        )
    }
    FormFieldGroup("Visibility") {
        // Note: the design also calls for a `show_in_neighbor_discovery`
        // toggle. That key isn't in `updateProfileSchema` today, so it
        // stays omitted; the 3-way `profileVisibility` enum and the two
        // contact-visibility booleans below are the schema's full set
        // (`backend/routes/users.js:797-800`).
        VisibilityPicker(fields = fields, onUpdate = onUpdate)
        ContactVisibilityToggle(
            field = EditProfileField.ShowEmail,
            label = "Show Email on Profile",
            subtitle = "Neighbors viewing your profile can see your email address.",
            fields = fields,
            onUpdate = onUpdate,
        )
        ContactVisibilityToggle(
            field = EditProfileField.ShowPhone,
            label = "Show Phone on Profile",
            subtitle = "Neighbors viewing your profile can see your phone number.",
            fields = fields,
            onUpdate = onUpdate,
        )
    }
}

/**
 * Boolean row backed by a `"true"` / `"false"` [FormFieldState], so it flows
 * through the same dirty / discard / PATCH machinery as every other field.
 * Mirrors RN `settings.tsx:236` and the iOS `contactVisibilityToggle`.
 */
@Composable
private fun ContactVisibilityToggle(
    field: EditProfileField,
    label: String,
    subtitle: String,
    fields: Map<EditProfileField, FormFieldState>,
    onUpdate: (EditProfileField, String) -> Unit,
) {
    val snapshot = fields[field]
    val isOn = snapshot?.value == "true"
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .semantics { contentDescription = "$label, ${if (isOn) "on" else "off"}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            DirtyFieldLabel(label = label, dirty = snapshot?.isDirty == true)
            Text(
                text = subtitle,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        Switch(
            checked = isOn,
            onCheckedChange = { onUpdate(field, if (it) "true" else "false") },
            modifier = Modifier.testTag("field_${field.key}"),
        )
    }
}

@Composable
private fun TextRow(
    field: EditProfileField,
    label: String,
    fields: Map<EditProfileField, FormFieldState>,
    onUpdate: (EditProfileField, String) -> Unit,
    placeholder: String = "",
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    val snapshot = fields[field]
    PantopusTextField(
        label = label,
        value = snapshot?.value.orEmpty(),
        onValueChange = { onUpdate(field, it) },
        placeholder = placeholder,
        state = fieldStateFor(snapshot),
        isRequired = field == EditProfileField.FirstName || field == EditProfileField.LastName,
        isDirty = snapshot?.isDirty == true,
        keyboardType = keyboardType,
        fieldTestTag = "field_${field.key}",
    )
}

@Composable
private fun BioField(
    fields: Map<EditProfileField, FormFieldState>,
    onUpdate: (EditProfileField, String) -> Unit,
    actionSlot: @Composable () -> Unit = {},
    draftErrorSlot: @Composable () -> Unit = {},
) {
    val snapshot = fields[EditProfileField.Bio]
    val error = snapshot?.error
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            DirtyFieldLabel(
                label = "Bio",
                dirty = snapshot?.isDirty == true,
                modifier = Modifier.weight(1f),
            )
            actionSlot()
        }
        BasicTextField(
            value = snapshot?.value.orEmpty(),
            onValueChange = { onUpdate(EditProfileField.Bio, it) },
            textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.primary600),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 96.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(
                        width = 1.dp,
                        color = if (error != null) PantopusColors.error else PantopusColors.appBorder,
                        shape = RoundedCornerShape(Radii.md),
                    ).padding(Spacing.s2)
                    .testTag("field_${EditProfileField.Bio.key}"),
        )
        if (error != null) {
            Text(
                text = error,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
        draftErrorSlot()
    }
}

/**
 * "Generate with AI" — drafts a bio through `POST /api/ai/draft/post`
 * (`backend/routes/ai.js:218`) from the name / skills / tagline / city
 * already on the form and writes it into the bio field, where it rides
 * the normal PATCH. Not clickable while in flight, and not clickable
 * when the form has nothing to prompt with.
 */
@Composable
internal fun EditProfileGenerateBioButton(
    state: EditProfileBioDraftState,
    enabled: Boolean,
    onGenerate: () -> Unit,
) {
    val generating = state is EditProfileBioDraftState.Generating
    val tint = if (enabled) PantopusColors.primary600 else PantopusColors.appTextMuted
    Row(
        modifier =
            Modifier
                .heightIn(min = 44.dp)
                .clickable(enabled = enabled, onClick = onGenerate)
                .testTag("editProfileGenerateBioButton")
                .semantics {
                    contentDescription = "Generate bio with AI, drafts from your name, skills, tagline and city"
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        if (generating) {
            CircularProgressIndicator(
                color = PantopusColors.appTextMuted,
                strokeWidth = 2.dp,
                modifier = Modifier.size(14.dp),
            )
        } else {
            PantopusIconImage(
                icon = PantopusIcon.Sparkles,
                contentDescription = null,
                size = 14.dp,
                tint = tint,
            )
        }
        Text(
            text = if (generating) "Generating…" else "Generate with AI",
            style = PantopusTextStyle.caption,
            color = tint,
        )
    }
}

/** Inline failure line for the bio draft, with a dismiss affordance. */
@Composable
internal fun EditProfileBioDraftError(
    state: EditProfileBioDraftState,
    onDismiss: () -> Unit,
) {
    val failure = state as? EditProfileBioDraftState.Failed ?: return
    Row(
        modifier = Modifier.fillMaxWidth().testTag("editProfileBioDraftError"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = failure.message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.error,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "Dismiss",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .clickable(onClick = onDismiss)
                    .testTag("editProfileBioDraftErrorDismiss"),
        )
    }
}

/**
 * Skills editor — an add-skill input plus tap-to-remove chips. The
 * working list lives on [EditProfileViewModel] and is committed by its
 * `save()` through `PUT /api/users/skills`
 * (`backend/routes/users.js:2246`) alongside the profile PATCH. Chip
 * presentation matches the read-only chips on the public profile
 * (`NeighborSkillChips`, `PublicProfileNeighbor.kt:644`).
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun EditProfileSkillsBlock(
    skills: List<String>,
    draft: String,
    canAdd: Boolean,
    onDraftChange: (String) -> Unit,
    onAdd: () -> Unit,
    onRemove: (String) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag("editProfileSkills"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            verticalAlignment = Alignment.Bottom,
        ) {
            Box(modifier = Modifier.weight(1f)) {
                PantopusTextField(
                    label = "Add a skill",
                    value = draft,
                    onValueChange = onDraftChange,
                    placeholder = "Plumbing, tutoring, dog walking…",
                    fieldTestTag = "field_skillDraft",
                )
            }
            Box(
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .widthIn(min = 56.dp)
                        .clickable(enabled = canAdd, onClick = onAdd)
                        .testTag("editProfileAddSkillButton")
                        .semantics { contentDescription = "Add skill" },
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    text = "Add",
                    style = PantopusTextStyle.body,
                    color = if (canAdd) PantopusColors.primary600 else PantopusColors.appTextMuted,
                )
            }
        }
        if (skills.isEmpty()) {
            Text(
                text = "No skills yet. Neighbors browse these when they're looking for help.",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.testTag("editProfileSkillsEmpty"),
            )
        } else {
            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                skills.forEach { skill ->
                    EditProfileSkillChip(skill = skill, onRemove = onRemove)
                }
            }
        }
    }
}

/** One removable skill chip. */
@Composable
private fun EditProfileSkillChip(
    skill: String,
    onRemove: (String) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(PantopusColors.primary100)
                .clickable { onRemove(skill) }
                .padding(horizontal = Spacing.s3, vertical = 6.dp)
                .testTag("editProfileSkillChip_$skill")
                .semantics { contentDescription = "Remove $skill" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Text(
            text = skill,
            style = PantopusTextStyle.caption,
            color = PantopusColors.primary700,
        )
        PantopusIconImage(
            icon = PantopusIcon.X,
            contentDescription = null,
            size = 12.dp,
            tint = PantopusColors.primary700,
        )
    }
}

@Composable
private fun DateOfBirthField(
    fields: Map<EditProfileField, FormFieldState>,
    onUpdate: (EditProfileField, String) -> Unit,
) {
    val snapshot = fields[EditProfileField.DateOfBirth]
    val value = snapshot?.value.orEmpty()
    val error = snapshot?.error
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            DirtyFieldLabel(
                label = "Date of birth (optional)",
                dirty = snapshot?.isDirty == true,
                modifier = Modifier.weight(1f),
            )
            if (value.isNotEmpty()) {
                Text(
                    text = "Clear",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.primary600,
                    modifier =
                        Modifier
                            .clickable { onUpdate(EditProfileField.DateOfBirth, "") }
                            .testTag("field_${EditProfileField.DateOfBirth.key}_clear")
                            .semantics { contentDescription = "Clear date of birth" },
                )
            }
        }
        // Compose's `DatePicker` is `Modifier`-incompatible with our
        // 44dp inline field and unsupported by Paparazzi; surface a
        // text field accepting `yyyy-MM-dd` and validate via the
        // shared `isoDateOrEmpty()` rule. The system date picker can
        // be wired by the host activity (`UseDatePickerHost`) in a
        // follow-up once we agree on the picker pattern.
        PantopusTextField(
            label = "",
            value = value,
            onValueChange = { onUpdate(EditProfileField.DateOfBirth, it) },
            placeholder = "YYYY-MM-DD",
            state = fieldStateFor(snapshot),
            keyboardType = KeyboardType.Number,
            fieldTestTag = "field_${EditProfileField.DateOfBirth.key}",
        )
        if (error != null) {
            Text(
                text = error,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
            )
        }
    }
}

@Composable
private fun ReadOnlyEmailRow(
    email: String,
    verified: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Text(
            text = "Email",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                    .testTag("field_email")
                    .semantics { contentDescription = "Email $email, read only" },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = email,
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextSecondary,
                modifier = Modifier.weight(1f),
            )
            if (verified) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = PantopusColors.success,
                )
            }
        }
    }
}

@Composable
private fun VisibilityPicker(
    fields: Map<EditProfileField, FormFieldState>,
    onUpdate: (EditProfileField, String) -> Unit,
) {
    val snapshot = fields[EditProfileField.ProfileVisibility]
    val current = snapshot?.value ?: "public"
    val options =
        remember {
            listOf("public" to "Public", "registered" to "Registered", "private" to "Private")
        }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        DirtyFieldLabel(label = "Profile visibility", dirty = snapshot?.isDirty == true)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(Spacing.s1)
                    .testTag("field_${EditProfileField.ProfileVisibility.key}"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            options.forEach { (key, label) ->
                val selected = key == current
                Box(
                    modifier =
                        Modifier
                            .weight(1f)
                            .sizeIn(minHeight = 36.dp)
                            .clip(RoundedCornerShape(Radii.sm))
                            .background(
                                if (selected) PantopusColors.appSurface else PantopusColors.appSurfaceSunken,
                            ).clickable { onUpdate(EditProfileField.ProfileVisibility, key) }
                            .testTag("field_${EditProfileField.ProfileVisibility.key}_$key")
                            .semantics { contentDescription = "$label visibility" },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = label,
                        style = PantopusTextStyle.body,
                        color = if (selected) PantopusColors.appText else PantopusColors.appTextSecondary,
                    )
                }
            }
        }
    }
}

private fun fieldStateFor(snapshot: FormFieldState?): PantopusFieldState =
    when {
        snapshot == null -> PantopusFieldState.Default
        snapshot.error != null -> PantopusFieldState.Error(snapshot.error)
        snapshot.touched && snapshot.isDirty -> PantopusFieldState.Valid
        else -> PantopusFieldState.Default
    }

@Composable
private fun DirtyFieldLabel(
    label: String,
    dirty: Boolean,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        if (dirty) {
            Box(
                modifier =
                    Modifier
                        .padding(start = Spacing.s1)
                        .size(6.dp)
                        .background(PantopusColors.warning, CircleShape),
            )
        }
    }
}

@Composable
private fun EditProfileStickyBar(
    dirtyCount: Int,
    isValid: Boolean,
    isSaving: Boolean,
    onDiscard: () -> Unit,
    onSave: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .testTag("editProfileStickySaveBar"),
    ) {
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            if (dirtyCount > 0) {
                EditProfileDirtyPill(dirtyCount)
                Box(modifier = Modifier.weight(1f))
                EditProfileDiscardButton(enabled = !isSaving, onDiscard = onDiscard)
                EditProfileSaveButton(
                    dirty = true,
                    isValid = isValid,
                    isSaving = isSaving,
                    onSave = onSave,
                )
            } else {
                EditProfileCleanStrip()
                Box(modifier = Modifier.weight(1f))
                EditProfileSaveButton(
                    dirty = false,
                    isValid = isValid,
                    isSaving = isSaving,
                    onSave = onSave,
                )
            }
        }
    }
}

@Composable
private fun EditProfileCleanStrip() {
    Row(
        modifier =
            Modifier
                .heightIn(min = 34.dp)
                .clip(CircleShape)
                .background(PantopusColors.appSurfaceMuted)
                .padding(horizontal = Spacing.s3)
                .testTag("editProfileCleanSavedStrip"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Clock,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextMuted,
        )
        Text(
            text = "All changes saved · just now",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun EditProfileDirtyPill(dirtyCount: Int) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 34.dp)
                .clip(CircleShape)
                .background(PantopusColors.warningBg)
                .border(1.dp, PantopusColors.warningLight, CircleShape)
                .padding(horizontal = Spacing.s3)
                .testTag("editProfileDirtyCountPill")
                .semantics { contentDescription = "$dirtyCount unsaved changes" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        Box(
            modifier =
                Modifier
                    .size(6.dp)
                    .background(PantopusColors.warning, CircleShape),
        )
        Text(
            text = "$dirtyCount unsaved",
            style = PantopusTextStyle.caption,
            color = PantopusColors.warning,
        )
    }
}

@Composable
private fun EditProfileDiscardButton(
    enabled: Boolean,
    onDiscard: () -> Unit,
) {
    Box(
        modifier =
            Modifier
                .height(42.dp)
                .widthIn(min = 78.dp)
                .clip(RoundedCornerShape(Radii.md))
                .clickable(enabled = enabled, onClick = onDiscard)
                .testTag("editProfileDiscardButton")
                .semantics { contentDescription = "Discard" },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = "Discard",
            style = PantopusTextStyle.body,
            color = PantopusColors.appTextStrong,
        )
    }
}

@Composable
private fun EditProfileSaveButton(
    dirty: Boolean,
    isValid: Boolean,
    isSaving: Boolean,
    onSave: () -> Unit,
) {
    val canSave = dirty && isValid && !isSaving
    val primaryPose = dirty && isValid
    Box(
        modifier =
            Modifier
                .height(42.dp)
                .widthIn(min = 86.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(if (primaryPose) PantopusColors.primary600 else PantopusColors.appBorder)
                .clickable(enabled = canSave, onClick = onSave)
                .testTag(FORM_COMMIT_BUTTON_TAG)
                .semantics { contentDescription = "Save" },
        contentAlignment = Alignment.Center,
    ) {
        if (isSaving) {
            CircularProgressIndicator(
                color = if (primaryPose) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                strokeWidth = 2.dp,
                modifier = Modifier.size(20.dp),
            )
        } else if (dirty) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 15.dp,
                    tint = if (primaryPose) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                )
                Text(
                    text = "Save",
                    style = PantopusTextStyle.body,
                    color = if (primaryPose) PantopusColors.appTextInverse else PantopusColors.appTextMuted,
                )
            }
        } else {
            Text(
                text = "Save",
                style = PantopusTextStyle.body,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

@Composable
internal fun EditProfileSkeleton() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .testTag("editProfileSkeleton"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s5),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s4),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Edit profile",
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                modifier = Modifier.semantics { heading() },
            )
        }
        repeat(3) { groupIndex ->
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = Spacing.s4),
                verticalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                Shimmer(width = 96.dp, height = 12.dp)
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurface)
                            .padding(Spacing.s4),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                ) {
                    repeat(if (groupIndex == 0) 4 else 2) {
                        Shimmer(width = 240.dp, height = 44.dp)
                    }
                }
            }
        }
    }
}

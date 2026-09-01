@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.profile.professional

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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The "professional mode is off" frame of the Professional Profile screen —
 * RN's `mode === 'create'` (`professional.tsx:273`). Shown when
 * `GET api/professional/profile/me` returns `profile: null` (never enabled)
 * or a row with `is_active = false` (disabled), and after a successful
 * Disable.
 *
 * The CTA either creates (`POST api/professional/profile`,
 * `backend/routes/professional.js:89`) or re-enables
 * (`PATCH api/professional/profile/me { is_active: true }`,
 * `professional.js:190`), matching RN's split. Mirrors the iOS
 * `ProfessionalEnableFormView`.
 */
@Composable
internal fun ProfessionalEnableForm(
    draft: ProfessionalEnableDraft,
    onBack: () -> Unit,
    onEnable: () -> Unit,
    onHeadlineChange: (String) -> Unit,
    onBioChange: (String) -> Unit,
    onToggleCategory: (String) -> Unit,
    onCityChange: (String) -> Unit,
    onStateChange: (String) -> Unit,
    onRadiusChange: (String) -> Unit,
    onHourlyRateChange: (String) -> Unit,
    onPublicChange: (Boolean) -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().testTag("professionalProfileCreate")) {
        EnableFormShell(
            draft = draft,
            onBack = onBack,
            onEnable = onEnable,
            onHeadlineChange = onHeadlineChange,
            onBioChange = onBioChange,
            onToggleCategory = onToggleCategory,
            onCityChange = onCityChange,
            onStateChange = onStateChange,
            onRadiusChange = onRadiusChange,
            onHourlyRateChange = onHourlyRateChange,
            onPublicChange = onPublicChange,
        )
    }
}

@Composable
private fun EnableFormShell(
    draft: ProfessionalEnableDraft,
    onBack: () -> Unit,
    onEnable: () -> Unit,
    onHeadlineChange: (String) -> Unit,
    onBioChange: (String) -> Unit,
    onToggleCategory: (String) -> Unit,
    onCityChange: (String) -> Unit,
    onStateChange: (String) -> Unit,
    onRadiusChange: (String) -> Unit,
    onHourlyRateChange: (String) -> Unit,
    onPublicChange: (Boolean) -> Unit,
) {
    FormShell(
        title = "Professional",
        rightActionLabel = null,
        bottomActionLabel = draft.ctaLabel,
        bottomActionIcon = PantopusIcon.Briefcase,
        isValid = true,
        isDirty = false,
        isSaving = draft.isSubmitting,
        onClose = onBack,
        onCommit = onEnable,
        leading = FormShellLeading.Back,
    ) {
        EnableHero(draft)
        ProSection("About your work") {
            ProTextInput(
                label = "Headline",
                value = draft.headline,
                placeholder = "e.g. Experienced handyman",
                testTag = "proEnableHeadlineField",
                onValueChange = onHeadlineChange,
            )
            ProTextInput(
                label = "Bio",
                optional = true,
                value = draft.bio,
                placeholder = "Describe your services…",
                testTag = "proEnableBioField",
                onValueChange = onBioChange,
            )
        }
        ProSection("Categories") {
            ProFieldLabel(text = "Up to ${ProfessionalCategory.SELECTION_LIMIT}")
            FlowRow(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .padding(Spacing.s2)
                        .testTag("proCategoryPicker"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
                verticalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                ProfessionalCategory.all.forEach { category ->
                    val isOn = draft.categories.contains(category.key)
                    ProCategoryChip(
                        label = category.label,
                        isOn = isOn,
                        isDisabled = !isOn && !draft.canSelectMoreCategories,
                        testTag = "proCategoryChip_${category.key}",
                        onClick = { onToggleCategory(category.key) },
                    )
                }
            }
        }
        ProSection("Service area") {
            ProTextInput(
                label = "City",
                optional = true,
                value = draft.city,
                placeholder = "City",
                testTag = "proEnableCityField",
                onValueChange = onCityChange,
            )
            ProTextInput(
                label = "State",
                optional = true,
                value = draft.state,
                placeholder = "State",
                testTag = "proEnableStateField",
                onValueChange = onStateChange,
            )
            ProTextInput(
                label = "Radius (km)",
                optional = true,
                value = draft.radiusKm,
                placeholder = "50",
                keyboardType = KeyboardType.Number,
                testTag = "proEnableRadiusField",
                onValueChange = onRadiusChange,
            )
            ProTextInput(
                label = "Hourly rate (USD)",
                optional = true,
                value = draft.hourlyRate,
                placeholder = "0",
                keyboardType = KeyboardType.Decimal,
                testTag = "proEnableHourlyRateField",
                onValueChange = onHourlyRateChange,
            )
        }
        ProSection("Visibility") {
            Column(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
            ) {
                VisRow(
                    row =
                        VisibilityRow(
                            id = "publicProfile",
                            label = "Public profile",
                            sub = "Neighbors can find you on the map and in search.",
                            isOn = draft.isPublic,
                        ),
                    onToggle = onPublicChange,
                )
            }
        }
        draft.errorMessage?.let { message -> EnableError(message) }
    }
}

@Composable
private fun EnableHero(draft: ProfessionalEnableDraft) {
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.businessBg)
                .border(
                    width = 1.dp,
                    color = PantopusColors.business.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(Radii.lg),
                ).padding(Spacing.s4)
                .testTag("proEnableHero"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.business),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Wrench,
                contentDescription = null,
                size = 22.dp,
                tint = PantopusColors.appTextInverse,
            )
        }
        Text(
            text = if (draft.isReEnable) "Turn professional mode back on" else "Enable Professional Mode",
            style = PantopusTextStyle.h2,
            color = PantopusColors.appText,
        )
        Text(
            text = "Become discoverable on the map and in search. Free to enable, no commitment.",
            style = PantopusTextStyle.small,
            color = PantopusColors.appTextSecondary,
        )
    }
}

@Composable
private fun EnableError(message: String) {
    Row(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.errorBg)
                .padding(Spacing.s3)
                .testTag("proEnableError"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.AlertCircle,
            contentDescription = null,
            size = 14.dp,
            tint = PantopusColors.error,
        )
        Text(text = message, style = PantopusTextStyle.caption, color = PantopusColors.error)
    }
}

/**
 * Selectable category chip. Unlike the skill chip (an already-claimed skill
 * with a remove ×) this one toggles, and greys out once the server's
 * 5-category cap is reached — mirroring RN `professional.tsx:494`.
 */
@Composable
internal fun ProCategoryChip(
    label: String,
    isOn: Boolean,
    isDisabled: Boolean,
    testTag: String,
    onClick: () -> Unit,
) {
    val foreground =
        when {
            isOn -> PantopusColors.appTextInverse
            isDisabled -> PantopusColors.appTextMuted
            else -> PantopusColors.appTextStrong
        }
    Box(
        modifier =
            Modifier
                .heightIn(min = 28.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (isOn) PantopusColors.business else PantopusColors.appSurface)
                .border(
                    width = 1.dp,
                    color = if (isOn) PantopusColors.business else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.pill),
                ).clickable(enabled = !isDisabled, onClick = onClick)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .testTag(testTag)
                .semantics {
                    contentDescription = label
                    role = Role.Button
                    selected = isOn
                },
        contentAlignment = Alignment.Center,
    ) {
        Text(text = label, style = PantopusTextStyle.caption, color = foreground, fontWeight = FontWeight.SemiBold)
    }
}

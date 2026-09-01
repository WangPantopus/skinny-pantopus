@file:OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@file:Suppress("MagicNumber", "PackageNaming", "LongMethod", "LongParameterList", "TooManyFunctions")

package app.pantopus.android.ui.screens.profile.professional

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.profile.PillarStrip
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.screens.shared.form.FormShellLeading
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.delay

@Composable
fun ProfessionalProfileScreen(
    onBack: () -> Unit,
    viewModel: ProfessionalProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val toast by viewModel.toast.collectAsStateWithLifecycle()
    val showsDisableConfirm by viewModel.showsDisableConfirm.collectAsStateWithLifecycle()
    val isDisabling by viewModel.isDisabling.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) { viewModel.load() }

    LaunchedEffect(toast) {
        if (toast != null) {
            delay(2_000)
            viewModel.dismissToast()
        }
    }

    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("professionalProfile"),
    ) {
        when (val current = state) {
            ProfessionalProfileUiState.Loading -> ProfessionalProfileSkeleton()
            is ProfessionalProfileUiState.Create ->
                ProfessionalEnableForm(
                    draft = current.draft,
                    onBack = onBack,
                    onEnable = viewModel::enable,
                    onHeadlineChange = viewModel::updateDraftHeadline,
                    onBioChange = viewModel::updateDraftBio,
                    onToggleCategory = viewModel::toggleDraftCategory,
                    onCityChange = viewModel::updateDraftCity,
                    onStateChange = viewModel::updateDraftState,
                    onRadiusChange = viewModel::updateDraftRadius,
                    onHourlyRateChange = viewModel::updateDraftHourlyRate,
                    onPublicChange = viewModel::setDraftPublic,
                )
            is ProfessionalProfileUiState.Verified ->
                ProfessionalProfileLoaded(
                    content = current.content,
                    mode = ProStickyMode.Saved,
                    dirtyCount = 0,
                    pendingCount = current.content.pendingCount,
                    isDisabling = isDisabling,
                    onDisable = viewModel::requestDisable,
                    onBack = onBack,
                    onDiscard = viewModel::discard,
                    onSaveSubmit = viewModel::saveAndSubmit,
                    onTitleChange = viewModel::updateTitle,
                    onYearsChange = viewModel::updateYearsInRole,
                    onAddSkill = viewModel::addSkill,
                    onRemoveSkill = viewModel::removeSkill,
                    onAddCertification = viewModel::addCertification,
                    onRemoveCertification = viewModel::removeCertification,
                    onAddPortfolioLink = viewModel::addPortfolioLink,
                    onVisibilityChange = viewModel::setVisibility,
                    onToggleCategory = viewModel::toggleCategory,
                    onServiceCityChange = viewModel::updateServiceCity,
                    onServiceStateChange = viewModel::updateServiceState,
                    onServiceRadiusChange = viewModel::updateServiceRadius,
                    onHourlyRateChange = viewModel::updateHourlyRate,
                    onStartVerification = { viewModel.startVerification() },
                )
            is ProfessionalProfileUiState.Pending ->
                ProfessionalProfileLoaded(
                    content = current.content,
                    mode = ProStickyMode.PendingSave,
                    dirtyCount = current.dirtyCount,
                    pendingCount = current.pendingCount,
                    isDisabling = isDisabling,
                    onDisable = viewModel::requestDisable,
                    onBack = onBack,
                    onDiscard = viewModel::discard,
                    onSaveSubmit = viewModel::saveAndSubmit,
                    onTitleChange = viewModel::updateTitle,
                    onYearsChange = viewModel::updateYearsInRole,
                    onAddSkill = viewModel::addSkill,
                    onRemoveSkill = viewModel::removeSkill,
                    onAddCertification = viewModel::addCertification,
                    onRemoveCertification = viewModel::removeCertification,
                    onAddPortfolioLink = viewModel::addPortfolioLink,
                    onVisibilityChange = viewModel::setVisibility,
                    onToggleCategory = viewModel::toggleCategory,
                    onServiceCityChange = viewModel::updateServiceCity,
                    onServiceStateChange = viewModel::updateServiceState,
                    onServiceRadiusChange = viewModel::updateServiceRadius,
                    onHourlyRateChange = viewModel::updateHourlyRate,
                    onStartVerification = { viewModel.startVerification() },
                )
            is ProfessionalProfileUiState.Error ->
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load professional profile",
                    subcopy = current.message,
                    ctaTitle = "Try again",
                    onCta = viewModel::refresh,
                    tint = PantopusColors.businessBg,
                    accent = PantopusColors.business,
                )
        }

        toast?.let {
            ProfessionalProfileToastView(
                toast = it,
                modifier =
                    Modifier
                        .align(Alignment.BottomCenter)
                        .padding(bottom = Spacing.s10),
            )
        }
    }

    if (showsDisableConfirm) {
        AlertDialog(
            onDismissRequest = viewModel::dismissDisableConfirm,
            title = { Text("Disable professional mode?") },
            text = { Text("Your profile will no longer be visible to the public.") },
            confirmButton = {
                TextButton(
                    onClick = viewModel::disableConfirmed,
                    modifier = Modifier.testTag("proDisableConfirmButton"),
                ) { Text("Disable") }
            },
            dismissButton = {
                TextButton(onClick = viewModel::dismissDisableConfirm) { Text("Cancel") }
            },
        )
    }
}

internal enum class ProStickyMode { Saved, PendingSave }

@Composable
internal fun ProfessionalProfileLoaded(
    content: ProfessionalProfileContent,
    mode: ProStickyMode,
    dirtyCount: Int,
    pendingCount: Int,
    isDisabling: Boolean,
    onDisable: () -> Unit,
    onBack: () -> Unit,
    onDiscard: () -> Unit,
    onSaveSubmit: () -> Unit,
    onTitleChange: (String) -> Unit,
    onYearsChange: (String) -> Unit,
    onAddSkill: () -> Unit,
    onRemoveSkill: (String) -> Unit,
    onAddCertification: () -> Unit,
    onRemoveCertification: (String) -> Unit,
    onAddPortfolioLink: () -> Unit,
    onVisibilityChange: (String, Boolean) -> Unit,
    onToggleCategory: (String) -> Unit,
    onServiceCityChange: (String) -> Unit,
    onServiceStateChange: (String) -> Unit,
    onServiceRadiusChange: (String) -> Unit,
    onHourlyRateChange: (String) -> Unit,
    onStartVerification: () -> Unit,
) {
    FormShell(
        title = "Professional profile",
        rightActionLabel = null,
        isValid = true,
        isDirty = mode == ProStickyMode.PendingSave,
        onClose = onBack,
        onCommit = {},
        leading = FormShellLeading.Back,
        stickyBottom = {
            ProSticky(
                mode = mode,
                dirtyCount = dirtyCount,
                pendingCount = pendingCount,
                onDiscard = onDiscard,
                onSaveSubmit = onSaveSubmit,
            )
        },
    ) {
        PillarHeader(content)
        RoleSection(
            content = content,
            onTitleChange = onTitleChange,
            onYearsChange = onYearsChange,
        )
        SkillsSection(
            content = content,
            onAddSkill = onAddSkill,
            onRemoveSkill = onRemoveSkill,
        )
        CategoriesSection(content = content, onToggleCategory = onToggleCategory)
        ServiceAreaSection(
            content = content,
            onServiceCityChange = onServiceCityChange,
            onServiceStateChange = onServiceStateChange,
            onServiceRadiusChange = onServiceRadiusChange,
            onHourlyRateChange = onHourlyRateChange,
        )
        CertificationsSection(
            content = content,
            onAddCertification = onAddCertification,
            onRemoveCertification = onRemoveCertification,
        )
        PortfolioSection(content = content, onAddPortfolioLink = onAddPortfolioLink)
        VerificationSection(content = content, onStartVerification = onStartVerification)
        VisibilitySection(content = content, onVisibilityChange = onVisibilityChange)
        DisableSection(isDisabling = isDisabling, onDisable = onDisable)
    }
}

/**
 * RN's destructive "Disable" action (`professional.tsx:410`). Soft disable —
 * `DELETE api/professional/profile/me` keeps the record, so the screen falls
 * back to the re-enable form.
 */
@Composable
private fun DisableSection(
    isDisabling: Boolean,
    onDisable: () -> Unit,
) {
    ProSection("Professional mode") {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.error.copy(alpha = 0.4f), RoundedCornerShape(Radii.lg))
                    .clickable(enabled = !isDisabling, onClick = onDisable)
                    .padding(Spacing.s3)
                    .testTag("proDisableButton")
                    .semantics {
                        contentDescription = "Disable professional mode. Your profile will no longer be visible to the public"
                        role = Role.Button
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Disable professional mode",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.error,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = "Your profile will no longer be visible to the public.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
            if (isDisabling) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    color = PantopusColors.error,
                    modifier = Modifier.size(18.dp),
                )
            } else {
                PantopusIconImage(
                    icon = PantopusIcon.CircleSlash,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.error,
                )
            }
        }
    }
}

@Composable
private fun PillarHeader(content: ProfessionalProfileContent) {
    Column(
        modifier =
            Modifier
                .padding(horizontal = Spacing.s4)
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.businessBg)
                .border(
                    width = 1.dp,
                    color = PantopusColors.business.copy(alpha = 0.2f),
                    shape = RoundedCornerShape(Radii.lg),
                ).padding(Spacing.s3)
                .testTag("proPillarHeader"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Box(
                modifier =
                    Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.business),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Briefcase,
                    contentDescription = null,
                    size = 18.dp,
                    tint = PantopusColors.appTextInverse,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "${content.proName} · Pro",
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appText,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    text = "Separate from your personal & home identities",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.business,
                )
            }
            Text(
                text = "Business",
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextInverse,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.xs))
                        .background(PantopusColors.business)
                        .padding(horizontal = Spacing.s2, vertical = 3.dp),
            )
        }
        PillarStrip(
            title = "Profile strength",
            percent = content.strength,
            tint = PantopusColors.business,
            caption = content.strengthCaption,
            testTag = "proProfileStrength",
        )
    }
}

@Composable
private fun RoleSection(
    content: ProfessionalProfileContent,
    onTitleChange: (String) -> Unit,
    onYearsChange: (String) -> Unit,
) {
    ProSection("Role") {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            ProFieldLabel("Company", dirty = content.company.isDirty)
            CompanyField(company = content.company)
            content.company.hint?.let { hint ->
                Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    PantopusIconImage(PantopusIcon.Info, contentDescription = null, size = 11.dp, tint = PantopusColors.warning)
                    Text(text = hint, style = PantopusTextStyle.caption, color = PantopusColors.warning)
                }
            }
        }
        ProTextInput(
            label = "Title",
            required = true,
            value = content.title.value,
            placeholder = "e.g. Licensed General Handyman",
            testTag = "proTitleField",
            onValueChange = onTitleChange,
        )
        ProTextInput(
            label = "Years in role",
            required = true,
            value = content.yearsInRole.value,
            placeholder = "0",
            keyboardType = KeyboardType.Number,
            testTag = "proYearsInRoleField",
            onValueChange = onYearsChange,
        )
    }
}

@Composable
private fun SkillsSection(
    content: ProfessionalProfileContent,
    onAddSkill: () -> Unit,
    onRemoveSkill: (String) -> Unit,
) {
    ProSection("Skills") {
        ProFieldLabel("Specialties", dirty = content.skills.any { it.isFresh })
        FlowRow(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(Spacing.s2),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            content.skills.forEach { skill ->
                ProSkillChip(skill = skill, onRemove = { onRemoveSkill(skill.id) })
            }
            AddSkillChip(onClick = onAddSkill)
        }
        Text(
            text = "Match jobs Pantopus shows you. Up to 8.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/**
 * `categories[]` on `PATCH api/professional/profile/me`
 * (`professional.js:190`). Server enum + 5-item cap (`professional.js:45`);
 * mirrors RN's chip picker (`professional.tsx:494`).
 */
@Composable
private fun CategoriesSection(
    content: ProfessionalProfileContent,
    onToggleCategory: (String) -> Unit,
) {
    ProSection("Categories") {
        ProFieldLabel(
            text = "Up to ${ProfessionalCategory.SELECTION_LIMIT}",
            dirty = content.categoriesAreDirty,
        )
        FlowRow(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(Spacing.s2)
                    .testTag("proEditCategoryPicker"),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            verticalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            ProfessionalCategory.all.forEach { category ->
                val isOn = content.categories.contains(category.key)
                ProCategoryChip(
                    label = category.label,
                    isOn = isOn,
                    isDisabled = !isOn && !content.canSelectMoreCategories,
                    testTag = "proEditCategoryChip_${category.key}",
                    onClick = { onToggleCategory(category.key) },
                )
            }
        }
        Text(
            text = "Used to rank you in search and on the pro map.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
    }
}

/**
 * `service_area.city/state/radius_km` + `pricing_meta.hourly_rate`
 * (`professional.js:47` and `:54`) — RN's editor writes the same four values
 * (`professional.tsx:123`).
 */
@Composable
private fun ServiceAreaSection(
    content: ProfessionalProfileContent,
    onServiceCityChange: (String) -> Unit,
    onServiceStateChange: (String) -> Unit,
    onServiceRadiusChange: (String) -> Unit,
    onHourlyRateChange: (String) -> Unit,
) {
    ProSection("Service area & pricing") {
        ProTextInput(
            label = "City",
            optional = true,
            value = content.serviceCity.value,
            placeholder = "City",
            testTag = "proServiceCityField",
            onValueChange = onServiceCityChange,
        )
        ProTextInput(
            label = "State",
            optional = true,
            value = content.serviceState.value,
            placeholder = "State",
            testTag = "proServiceStateField",
            onValueChange = onServiceStateChange,
        )
        ProTextInput(
            label = "Radius (km)",
            optional = true,
            value = content.serviceRadiusKm.value,
            placeholder = "50",
            keyboardType = KeyboardType.Number,
            testTag = "proServiceRadiusField",
            onValueChange = onServiceRadiusChange,
        )
        ProTextInput(
            label = "Hourly rate (USD)",
            optional = true,
            value = content.hourlyRate.value,
            placeholder = "0",
            keyboardType = KeyboardType.Decimal,
            testTag = "proHourlyRateField",
            onValueChange = onHourlyRateChange,
        )
    }
}

/**
 * Verification status + RN's "Start verification" CTA
 * (`professional.tsx:377-400`) — `POST api/professional/verification/start`
 * (`professional.js:310`).
 */
@Composable
private fun VerificationSection(
    content: ProfessionalProfileContent,
    onStartVerification: () -> Unit,
) {
    val tone = content.verification.status.tone
    ProSection("Verification") {
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
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
                modifier =
                    Modifier
                        .testTag("proVerificationStatus")
                        .semantics { contentDescription = content.verification.summary },
            ) {
                PantopusIconImage(
                    icon = tone.icon,
                    contentDescription = null,
                    size = 16.dp,
                    tint = tone.foreground,
                )
                Text(
                    text = content.verification.summary,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appText,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            if (content.verification.canStart) {
                Box(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .heightIn(min = 44.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.business)
                            .clickable(
                                enabled = !content.verification.isStarting,
                                onClick = onStartVerification,
                            ).testTag("proStartVerificationButton")
                            .semantics {
                                contentDescription = "Start verification"
                                role = Role.Button
                            },
                    contentAlignment = Alignment.Center,
                ) {
                    if (content.verification.isStarting) {
                        CircularProgressIndicator(
                            strokeWidth = 2.dp,
                            color = PantopusColors.appTextInverse,
                            modifier = Modifier.size(18.dp),
                        )
                    } else {
                        Text(
                            text = "Start verification",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextInverse,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CertificationsSection(
    content: ProfessionalProfileContent,
    onAddCertification: () -> Unit,
    onRemoveCertification: (String) -> Unit,
) {
    ProSection("Certifications") {
        content.certifications.forEach { cert ->
            CertCard(cert = cert, onRemove = { onRemoveCertification(cert.id) })
        }
        AddCertButton(onClick = onAddCertification)
    }
}

@Composable
private fun PortfolioSection(
    content: ProfessionalProfileContent,
    onAddPortfolioLink: () -> Unit,
) {
    ProSection("Portfolio") {
        content.portfolio.forEach { link -> LinkCard(link) }
        AddLinkRow(onClick = onAddPortfolioLink)
    }
}

@Composable
private fun VisibilitySection(
    content: ProfessionalProfileContent,
    onVisibilityChange: (String, Boolean) -> Unit,
) {
    ProSection("Visibility") {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
        ) {
            content.visibility.forEachIndexed { index, row ->
                VisRow(row = row, onToggle = { onVisibilityChange(row.id, it) })
                if (index < content.visibility.lastIndex) {
                    HorizontalDivider(
                        color = PantopusColors.appBorderSubtle,
                        thickness = 1.dp,
                        modifier = Modifier.padding(start = Spacing.s3),
                    )
                }
            }
        }
    }
}

@Composable
internal fun ProSection(
    overline: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Text(
            text = overline,
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier =
                Modifier
                    .padding(horizontal = Spacing.s4)
                    .semantics { heading() },
        )
        Column(
            modifier = Modifier.padding(horizontal = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
            content = content,
        )
    }
}

@Composable
internal fun ProFieldLabel(
    text: String,
    required: Boolean = false,
    optional: Boolean = false,
    dirty: Boolean = false,
) {
    val labelDescription =
        text +
            (if (required) ", required" else "") +
            (if (optional) ", optional" else "") +
            (if (dirty) ", edited" else "")
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        modifier = Modifier.semantics { contentDescription = labelDescription },
    ) {
        Text(text = text, style = PantopusTextStyle.caption, color = PantopusColors.appTextStrong, fontWeight = FontWeight.SemiBold)
        if (required) Text("*", style = PantopusTextStyle.caption, color = PantopusColors.business, fontWeight = FontWeight.Bold)
        if (optional) Text("(optional)", style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted)
        if (dirty) FreshDot()
    }
}

@Composable
internal fun ProTextInput(
    label: String,
    value: String,
    placeholder: String,
    testTag: String,
    onValueChange: (String) -> Unit,
    required: Boolean = false,
    optional: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        ProFieldLabel(text = label, required = required, optional = optional, dirty = false)
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
            singleLine = true,
            cursorBrush = SolidColor(PantopusColors.business),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(PantopusColors.appSurface)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                    .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                    .testTag(testTag)
                    .semantics { contentDescription = label },
            decorationBox = { inner ->
                Box(contentAlignment = Alignment.CenterStart) {
                    if (value.isEmpty()) {
                        Text(text = placeholder, style = PantopusTextStyle.body, color = PantopusColors.appTextMuted)
                    }
                    inner()
                }
            },
        )
    }
}

@Composable
private fun CompanyField(company: CompanyClaim) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 52.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .padding(horizontal = Spacing.s2)
                .semantics {
                    contentDescription = "Company ${company.name}, ${company.locality}, ${company.status.label}"
                }.testTag("proCompanyField"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(32.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.business),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = company.name.take(1).uppercase(),
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextInverse,
                fontWeight = FontWeight.Bold,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = company.name,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(text = company.locality, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                Text(text = "·", style = PantopusTextStyle.caption, color = PantopusColors.appBorderStrong)
                VerifyBadge(company.status)
            }
        }
        PantopusIconImage(
            icon = PantopusIcon.ChevronRight,
            contentDescription = null,
            size = Radii.xl,
            tint = PantopusColors.appTextMuted,
        )
    }
}

@Composable
private fun VerifyBadge(status: ProVerificationStatus) {
    val tone = status.tone
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(tone.background)
                .padding(horizontal = Spacing.s1, vertical = 2.dp)
                .semantics { contentDescription = "Status: ${tone.label}" },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(icon = tone.icon, contentDescription = null, size = 11.dp, tint = tone.foreground)
        Text(text = tone.label, style = PantopusTextStyle.caption, color = tone.foreground, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ProSkillChip(
    skill: ProSkill,
    onRemove: () -> Unit,
) {
    val foreground = if (skill.isFresh) PantopusColors.warning else PantopusColors.business
    val background = if (skill.isFresh) PantopusColors.warningBg else PantopusColors.businessBg
    val border = if (skill.isFresh) PantopusColors.warningLight else PantopusColors.business.copy(alpha = 0.25f)
    Box {
        Row(
            modifier =
                Modifier
                    .clip(RoundedCornerShape(Radii.pill))
                    .background(background)
                    .border(1.dp, border, RoundedCornerShape(Radii.pill))
                    .padding(start = Spacing.s2, end = Spacing.s1, top = Spacing.s1, bottom = Spacing.s1)
                    .semantics {
                        contentDescription =
                            if (skill.isFresh) "${skill.label}, added this session" else skill.label
                    },
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        ) {
            PantopusIconImage(icon = skill.icon, contentDescription = null, size = Radii.lg, tint = foreground)
            Text(text = skill.label, style = PantopusTextStyle.caption, color = foreground, fontWeight = FontWeight.SemiBold)
            Box(
                modifier =
                    Modifier
                        .size(24.dp)
                        .clickable(onClick = onRemove)
                        .testTag("proSkillRemove_${skill.id}")
                        .semantics {
                            contentDescription = "Remove ${skill.label}"
                            role = Role.Button
                        },
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(icon = PantopusIcon.X, contentDescription = null, size = Radii.lg, tint = foreground)
            }
        }
        if (skill.isFresh) FreshDot(Modifier.align(Alignment.TopEnd).offset(x = 1.dp, y = (-1).dp))
    }
}

@Composable
private fun AddSkillChip(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .heightIn(min = 28.dp)
                .clip(RoundedCornerShape(Radii.pill))
                .border(1.dp, PantopusColors.appBorderStrong, RoundedCornerShape(Radii.pill))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                .testTag("proAddSkillChip")
                .semantics {
                    contentDescription = "Add skill"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
    ) {
        PantopusIconImage(PantopusIcon.Plus, contentDescription = null, size = Radii.lg, tint = PantopusColors.appTextSecondary)
        Text("Add", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary, fontWeight = FontWeight.Medium)
    }
}

@Composable
private fun CertCard(
    cert: Certification,
    onRemove: () -> Unit,
) {
    val certDescription =
        "${cert.name}, ${cert.issuer}, issued ${cert.issued}, expires ${cert.expires}, ${cert.status.label}" +
            if (cert.isFresh) ", added this session" else ""
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (cert.isFresh) 2.dp else 1.dp,
                    color = if (cert.isFresh) PantopusColors.warning else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.lg),
                ).padding(Spacing.s3)
                .semantics {
                    contentDescription = certDescription
                }.testTag("proCertCard_${cert.id}"),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(width = 40.dp, height = 48.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurfaceSunken)
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.sm)),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(cert.status.tone.sealIcon, contentDescription = null, size = 18.dp, tint = cert.status.tone.foreground)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(Spacing.s1), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = cert.name,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appText,
                    fontWeight = FontWeight.Bold,
                )
                VerifyBadge(cert.status)
                if (cert.isFresh) FreshDot()
            }
            Text(text = cert.issuer, style = PantopusTextStyle.caption, color = PantopusColors.appTextStrong)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2), modifier = Modifier.padding(top = 2.dp)) {
                Text("Issued ${cert.issued}", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                Text("·", style = PantopusTextStyle.caption, color = PantopusColors.appBorderStrong)
                Text(
                    text = "Expires ${cert.expires}",
                    style = PantopusTextStyle.caption,
                    color = if (cert.status == ProVerificationStatus.Expiring) PantopusColors.error else PantopusColors.appTextSecondary,
                )
            }
        }
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clickable(onClick = onRemove)
                    .testTag("proCertMenu_${cert.id}")
                    .semantics {
                        contentDescription = "Certification options"
                        role = Role.Button
                    },
            contentAlignment = Alignment.TopEnd,
        ) {
            PantopusIconImage(PantopusIcon.MoreHorizontal, contentDescription = null, size = Radii.xl, tint = PantopusColors.appTextMuted)
        }
    }
}

@Composable
private fun AddCertButton(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .border(1.dp, PantopusColors.business.copy(alpha = 0.4f), RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag("proAddCertButton")
                .semantics {
                    contentDescription = "Upload certification"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(PantopusIcon.PlusCircle, contentDescription = null, size = 15.dp, tint = PantopusColors.business)
        Text(
            text = "Upload certification",
            style = PantopusTextStyle.small,
            color = PantopusColors.business,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        Text("PDF · JPG", style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted)
    }
}

@Composable
private fun LinkCard(link: PortfolioLink) {
    val linkDescription =
        "Portfolio link, ${link.title.ifEmpty { link.url }}, ${link.state.accessibilityText}" +
            if (link.isFresh) ", added this session" else ""
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(
                    width = if (link.isFresh) 2.dp else 1.dp,
                    color = if (link.isFresh) PantopusColors.warning else PantopusColors.appBorder,
                    shape = RoundedCornerShape(Radii.md),
                ).padding(Spacing.s2)
                .semantics {
                    contentDescription = linkDescription
                }.testTag("proLinkCard_${link.id}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Box(
            modifier =
                Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(
                        if (link.state == PortfolioLinkState.Loading) {
                            PantopusColors.appSurfaceSunken
                        } else {
                            PantopusColors.appSurface
                        },
                    )
                    .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md)),
            contentAlignment = Alignment.Center,
        ) {
            if (link.state == PortfolioLinkState.Loading) {
                CircularProgressIndicator(
                    strokeWidth = 2.dp,
                    color = PantopusColors.business,
                    modifier = Modifier.size(16.dp),
                )
            } else {
                PantopusIconImage(
                    icon = link.icon,
                    contentDescription = null,
                    size = Radii.xl,
                    tint = if (link.state == PortfolioLinkState.Error) PantopusColors.error else PantopusColors.appTextStrong,
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = link.title.ifEmpty { link.url },
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appText,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                if (link.isFresh) FreshDot()
            }
            Text(
                text =
                    when (link.state) {
                        PortfolioLinkState.Loading -> "Fetching preview..."
                        PortfolioLinkState.Error -> "Couldn't fetch preview"
                        PortfolioLinkState.Resolved -> link.url
                    },
                style = PantopusTextStyle.caption,
                color =
                    when (link.state) {
                        PortfolioLinkState.Loading -> PantopusColors.business
                        PortfolioLinkState.Error -> PantopusColors.error
                        PortfolioLinkState.Resolved -> PantopusColors.appTextSecondary
                    },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        PantopusIconImage(PantopusIcon.GripVertical, contentDescription = null, size = 14.dp, tint = PantopusColors.appTextMuted)
    }
}

@Composable
private fun AddLinkRow(onClick: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(RoundedCornerShape(Radii.md))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                .clickable(onClick = onClick)
                .padding(horizontal = Spacing.s3)
                .testTag("proAddLinkRow")
                .semantics {
                    contentDescription = "Add link"
                    role = Role.Button
                },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.PlusCircle,
            contentDescription = null,
            size = 15.dp,
            tint = PantopusColors.business,
        )
        Text(
            text = "Add link",
            style = PantopusTextStyle.small,
            color = PantopusColors.business,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.weight(1f),
        )
        Text("up to 6", style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted)
    }
}

@Composable
internal fun VisRow(
    row: VisibilityRow,
    onToggle: (Boolean) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s3, vertical = Spacing.s3),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Column(modifier = Modifier.weight(1f)) {
                Text(text = row.label, style = PantopusTextStyle.small, color = PantopusColors.appText, fontWeight = FontWeight.Medium)
                row.sub?.let {
                    Text(text = it, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
                }
            }
            Switch(
                checked = row.isOn,
                onCheckedChange = onToggle,
                modifier =
                    Modifier
                        .testTag("proVisToggle_${row.id}")
                        .semantics { contentDescription = row.label },
                colors =
                    SwitchDefaults.colors(
                        checkedThumbColor = PantopusColors.appTextInverse,
                        checkedTrackColor = PantopusColors.primary600,
                        uncheckedThumbColor = PantopusColors.appTextInverse,
                        uncheckedTrackColor = PantopusColors.appBorderStrong,
                    ),
            )
        }
        if (row.scope != null && row.isOn) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.businessBg)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                        .semantics { contentDescription = "Visible to ${row.scope}" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Users,
                    contentDescription = null,
                    size = 11.dp,
                    tint = PantopusColors.business,
                )
                Text(
                    text = "Visible to ${row.scope}",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.business,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun ProSticky(
    mode: ProStickyMode,
    dirtyCount: Int,
    pendingCount: Int,
    onDiscard: () -> Unit,
    onSaveSubmit: () -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .testTag("proSticky"),
    ) {
        HorizontalDivider(color = PantopusColors.appBorderSubtle, thickness = 1.dp)
        when (mode) {
            ProStickyMode.Saved ->
                SavedSticky(pendingCount)
            ProStickyMode.PendingSave ->
                PendingSticky(
                    dirtyCount = dirtyCount,
                    pendingCount = pendingCount,
                    onDiscard = onDiscard,
                    onSaveSubmit = onSaveSubmit,
                )
        }
    }
}

@Composable
private fun SavedSticky(pendingCount: Int) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3).padding(bottom = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.BadgeCheck,
            contentDescription = null,
            size = 14.dp,
            tint = if (pendingCount == 0) PantopusColors.success else PantopusColors.warning,
        )
        Text(
            text = if (pendingCount == 0) "Published · all claims verified" else "Submitted · $pendingCount in review",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        Box(
            modifier =
                Modifier
                    .heightIn(min = 44.dp)
                    .clip(RoundedCornerShape(Radii.lg))
                    .background(PantopusColors.appSurfaceSunken)
                    .padding(horizontal = Spacing.s5)
                    .testTag("proSaveDisabledButton")
                    .semantics {
                        contentDescription = "Save, disabled - nothing to submit"
                        role = Role.Button
                    },
            contentAlignment = Alignment.Center,
        ) {
            Text("Save", style = PantopusTextStyle.body, color = PantopusColors.appTextMuted, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun PendingSticky(
    dirtyCount: Int,
    pendingCount: Int,
    onDiscard: () -> Unit,
    onSaveSubmit: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s4, vertical = Spacing.s3).padding(bottom = Spacing.s2),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        if (pendingCount > 0) {
            Row(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.warningBg)
                        .border(1.dp, PantopusColors.warningLight, RoundedCornerShape(Radii.md))
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s2),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Clock,
                    contentDescription = null,
                    size = 13.dp,
                    tint = PantopusColors.warning,
                )
                Text(
                    text =
                        "$pendingCount new " +
                            "${if (pendingCount == 1) "claim needs" else "claims need"} " +
                            "verification · usually 1-2 business days",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.warning,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Row(
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .background(PantopusColors.businessBg)
                        .padding(horizontal = Spacing.s2, vertical = Spacing.s1)
                        .semantics { contentDescription = "$dirtyCount unsaved edits" },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                Box(Modifier.size(6.dp).clip(CircleShape).background(PantopusColors.business))
                Text(
                    text = "$dirtyCount ${if (dirtyCount == 1) "edit" else "edits"}",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.business,
                    fontWeight = FontWeight.Bold,
                )
            }
            Spacer(Modifier.weight(1f))
            Text(
                text = "Discard",
                style = PantopusTextStyle.small,
                color = PantopusColors.appTextStrong,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .clickable(onClick = onDiscard)
                        .padding(horizontal = Spacing.s3)
                        .testTag("proDiscardButton")
                        .semantics {
                            contentDescription = "Discard edits"
                            role = Role.Button
                        },
            )
            Row(
                modifier =
                    Modifier
                        .heightIn(min = 44.dp)
                        .clip(RoundedCornerShape(Radii.lg))
                        .background(PantopusColors.business)
                        .clickable(onClick = onSaveSubmit)
                        .padding(horizontal = Spacing.s4)
                        .testTag("proSaveSubmitButton")
                        .semantics {
                            contentDescription = "Save and submit for verification"
                            role = Role.Button
                        },
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 15.dp,
                    tint = PantopusColors.appTextInverse,
                )
                Text(
                    text = "Save & submit",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextInverse,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
internal fun ProfessionalProfileSkeleton() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .testTag("professionalProfileLoading"),
    ) {
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(44.dp)
                    .background(PantopusColors.appSurface)
                    .padding(horizontal = Spacing.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(PantopusIcon.ChevronLeft, contentDescription = null, size = 22.dp, tint = PantopusColors.appTextMuted)
            Spacer(Modifier.weight(1f))
            Text("Professional profile", style = PantopusTextStyle.body, color = PantopusColors.appText)
            Spacer(Modifier.weight(1f))
            Spacer(Modifier.width(22.dp))
        }
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        Column(modifier = Modifier.padding(vertical = Spacing.s4), verticalArrangement = Arrangement.spacedBy(Spacing.s5)) {
            Shimmer(width = 360.dp, height = 96.dp, cornerRadius = Radii.lg, modifier = Modifier.padding(horizontal = Spacing.s4))
            SectionSkeleton(rows = 2, height = 44.dp)
            SectionSkeleton(rows = 1, height = 56.dp)
            SectionSkeleton(rows = 3, height = 64.dp)
        }
    }
}

@Composable
private fun SectionSkeleton(
    rows: Int,
    height: androidx.compose.ui.unit.Dp,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Shimmer(width = 90.dp, height = 12.dp, cornerRadius = Radii.xs, modifier = Modifier.padding(horizontal = Spacing.s4))
        Column(modifier = Modifier.padding(horizontal = Spacing.s4), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            repeat(rows) {
                Shimmer(width = 360.dp, height = height, cornerRadius = Radii.md)
            }
        }
    }
}

@Composable
private fun ProfessionalProfileToastView(
    toast: ProfessionalProfileToast,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(if (toast.isError) PantopusColors.error else PantopusColors.success)
                .padding(horizontal = Spacing.s4, vertical = Spacing.s2)
                .testTag("professionalProfileToast"),
    ) {
        Text(text = toast.text, style = PantopusTextStyle.small, color = PantopusColors.appTextInverse)
    }
}

@Composable
private fun FreshDot(modifier: Modifier = Modifier) {
    Box(
        modifier =
            modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(PantopusColors.warning)
                .semantics { contentDescription = "Added this session" },
    )
}

private data class StatusTone(
    val label: String,
    val icon: PantopusIcon,
    val sealIcon: PantopusIcon,
    val foreground: Color,
    val background: Color,
)

private val ProVerificationStatus.label: String
    get() = tone.label

private val ProVerificationStatus.tone: StatusTone
    get() =
        when (this) {
            ProVerificationStatus.Verified ->
                StatusTone(
                    label = "Verified",
                    icon = PantopusIcon.BadgeCheck,
                    sealIcon = PantopusIcon.Ribbon,
                    foreground = PantopusColors.success,
                    background = PantopusColors.successBg,
                )
            ProVerificationStatus.Pending ->
                StatusTone(
                    label = "Pending",
                    icon = PantopusIcon.Clock,
                    sealIcon = PantopusIcon.Ribbon,
                    foreground = PantopusColors.warning,
                    background = PantopusColors.warningBg,
                )
            ProVerificationStatus.Expiring ->
                StatusTone(
                    label = "Expiring",
                    icon = PantopusIcon.AlertTriangle,
                    sealIcon = PantopusIcon.Ribbon,
                    foreground = PantopusColors.error,
                    background = PantopusColors.errorBg,
                )
            ProVerificationStatus.Unverified ->
                StatusTone(
                    label = "Unverified",
                    icon = PantopusIcon.AlertCircle,
                    sealIcon = PantopusIcon.Ribbon,
                    foreground = PantopusColors.error,
                    background = PantopusColors.errorBg,
                )
        }

private val PortfolioLinkState.accessibilityText: String
    get() =
        when (this) {
            PortfolioLinkState.Resolved -> "resolved"
            PortfolioLinkState.Loading -> "fetching preview"
            PortfolioLinkState.Error -> "preview failed"
        }

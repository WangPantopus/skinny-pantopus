@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.businesses.team

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.businesses.BusinessSeatDto
import app.pantopus.android.data.businesses.BusinessTeamRepository
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.wizard.WizardShell
import app.pantopus.android.ui.screens.shared.wizard.blocks.FormFieldsBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent

/** Test tag on the Invite Teammate wizard root. */
const val INVITE_TEAMMATE_WIZARD_TAG = "businessTeam.inviteWizard"

/**
 * Hilt entry point used to fetch the singleton [BusinessTeamRepository]
 * from a `@Composable` scope (the wizard VM isn't a Hilt VM — the host
 * screen owns its lifecycle).
 */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface InviteTeammateWizardDeps {
    fun businessTeamRepository(): BusinessTeamRepository
}

/**
 * Presents the Invite Teammate wizard as a full-screen Dialog. Cloned from
 * `InviteMemberWizardSheet`.
 *
 * @param onClose returns the created [BusinessSeatDto] on submit, `null`
 *   when the user dismisses without saving
 */
@Composable
fun InviteTeammateWizardSheet(
    businessId: String,
    onClose: (BusinessSeatDto?) -> Unit,
) {
    val context = LocalContext.current
    val repo =
        remember {
            EntryPointAccessors
                .fromApplication(context.applicationContext, InviteTeammateWizardDeps::class.java)
                .businessTeamRepository()
        }
    val viewModel =
        remember(businessId) {
            InviteTeammateWizardViewModel(businessId = businessId, repo = repo)
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            null -> Unit
            InviteTeammateEvent.Dismiss -> {
                viewModel.acknowledgeEvent()
                onClose(null)
            }
            is InviteTeammateEvent.Submitted -> {
                viewModel.acknowledgeEvent()
                onClose(event.seat)
            }
        }
    }

    Dialog(
        onDismissRequest = { onClose(null) },
        properties =
            DialogProperties(
                usePlatformDefaultWidth = false,
                dismissOnBackPress = true,
                dismissOnClickOutside = false,
            ),
    ) {
        Box(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .testTag(INVITE_TEAMMATE_WIZARD_TAG),
        ) {
            WizardShell(model = viewModel) {
                when (state.currentStep) {
                    InviteTeammateStep.Role -> RoleStep(state.form.role, viewModel::setRole)
                    InviteTeammateStep.Identify ->
                        IdentifyStep(
                            displayName = state.form.displayName,
                            email = state.form.email,
                            note = state.form.note,
                            onDisplayName = viewModel::setDisplayName,
                            onEmail = viewModel::setEmail,
                            onNote = viewModel::setNote,
                        )
                    InviteTeammateStep.Review ->
                        ReviewStep(
                            role = state.form.role,
                            displayName = state.form.displayName.trim(),
                            email = state.form.email.trim(),
                            note = state.form.note.trim(),
                        )
                }
                state.errorMessage?.let { ErrorBanner(it) }
            }
        }
    }
}

@Composable
private fun RoleStep(
    selected: BusinessRole,
    onSelect: (BusinessRole) -> Unit,
) {
    HeadlineBlock(InviteTeammateStep.Role.title)
    SubcopyBlock(InviteTeammateStep.Role.subcopy)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        BusinessRole.assignableRoles.forEach { role ->
            RoleTile(role = role, isSelected = selected == role, onSelect = { onSelect(role) })
        }
    }
}

@Composable
private fun RoleTile(
    role: BusinessRole,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    val palette = role.palette
    val borderColor = if (isSelected) PantopusColors.business else PantopusColors.appBorder
    val borderWidth = if (isSelected) 2.dp else 1.dp
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(borderWidth, borderColor, RoundedCornerShape(Radii.lg))
                .clickable(onClick = onSelect)
                .padding(Spacing.s3)
                .testTag("inviteTeammate_role_${role.wire}"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Box(
            modifier =
                Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(palette.background),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(icon = role.icon, contentDescription = null, size = 22.dp, tint = palette.foreground)
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(text = role.label, style = PantopusTextStyle.body, color = PantopusColors.appText, fontWeight = FontWeight.SemiBold)
            Text(text = role.tileSubcopy, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        }
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.business,
            )
        }
    }
}

@Composable
private fun IdentifyStep(
    displayName: String,
    email: String,
    note: String,
    onDisplayName: (String) -> Unit,
    onEmail: (String) -> Unit,
    onNote: (String) -> Unit,
) {
    HeadlineBlock(InviteTeammateStep.Identify.title)
    SubcopyBlock(InviteTeammateStep.Identify.subcopy)
    FormFieldsBlock {
        PantopusTextField(
            label = "Seat name",
            value = displayName,
            onValueChange = onDisplayName,
            placeholder = "e.g. Front desk",
            fieldTestTag = "inviteTeammate_displayName",
        )
        PantopusTextField(
            label = "Email",
            value = email,
            onValueChange = onEmail,
            placeholder = "name@example.com",
            fieldTestTag = "inviteTeammate_email",
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = "Note (optional)", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 80.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface)
                        .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.md))
                        .padding(Spacing.s2),
            ) {
                BasicTextField(
                    value = note,
                    onValueChange = onNote,
                    modifier = Modifier.fillMaxSize().testTag("inviteTeammate_note"),
                    textStyle = TextStyle(color = PantopusColors.appText, fontSize = 14.sp, fontWeight = FontWeight.Normal),
                    cursorBrush = SolidColor(PantopusColors.business),
                )
            }
        }
    }
}

@Composable
private fun ReviewStep(
    role: BusinessRole,
    displayName: String,
    email: String,
    note: String,
) {
    HeadlineBlock(InviteTeammateStep.Review.title)
    SubcopyBlock(InviteTeammateStep.Review.subcopy)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface),
    ) {
        ReviewRow(label = "Role", value = role.label)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        ReviewRow(label = "Seat", value = displayName)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        ReviewRow(label = "Email", value = email)
    }
    if (note.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(text = "Note", style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(Spacing.s3),
            ) {
                Text(text = note, style = PantopusTextStyle.body, color = PantopusColors.appText)
            }
        }
    }
}

@Composable
private fun ReviewRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(Spacing.s3),
        verticalAlignment = Alignment.Top,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Text(text = label, modifier = Modifier.width(96.dp), style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary)
        Text(text = value, modifier = Modifier.weight(1f), style = PantopusTextStyle.body, color = PantopusColors.appText)
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
                .testTag("inviteTeammateErrorBanner"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        PantopusIconImage(icon = PantopusIcon.AlertCircle, contentDescription = null, size = 18.dp, tint = PantopusColors.error)
        Text(text = message, style = PantopusTextStyle.caption, color = PantopusColors.error)
    }
    Spacer(Modifier.height(Spacing.s2))
}

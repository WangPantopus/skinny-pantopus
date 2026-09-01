@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.homes.members

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
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.data.api.models.homes.InvitationDto
import app.pantopus.android.data.homes.HomeMembersRepository
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

/** Test tag on the Invite Member wizard root. */
const val INVITE_MEMBER_WIZARD_TAG = "inviteMemberWizard"

/**
 * Hilt entry point used to fetch the singleton [HomeMembersRepository]
 * from a `@Composable` scope. The wizard VM isn't a Hilt VM — the host
 * screen owns its lifecycle — but it still needs the repo to call the
 * network.
 */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface InviteMemberWizardDeps {
    fun homeMembersRepository(): HomeMembersRepository
}

/**
 * Presents the Invite Member wizard as a full-screen Dialog. Mirrors
 * the iOS pattern where the wizard is presented as a `.sheet(isPresented:)`.
 *
 * @param onClose returns the created [InvitationDto] on submit, `null`
 *   when the user dismisses without saving
 */
@Composable
fun InviteMemberWizardSheet(
    homeId: String,
    onClose: (InvitationDto?) -> Unit,
) {
    val context = LocalContext.current
    val repo =
        remember {
            EntryPointAccessors
                .fromApplication(context.applicationContext, InviteMemberWizardDeps::class.java)
                .homeMembersRepository()
        }
    val viewModel =
        remember(homeId) {
            InviteMemberWizardViewModel(homeId = homeId, repo = repo)
        }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()

    LaunchedEffect(state.currentStep) {
        Analytics.track(
            AnalyticsEvent.ScreenMembersWizardStepViewed(
                stepNumber = state.currentStep.number,
                stepName = state.currentStep.name,
            ),
        )
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            null -> Unit
            InviteMemberEvent.Dismiss -> {
                viewModel.acknowledgeEvent()
                onClose(null)
            }
            is InviteMemberEvent.Submitted -> {
                viewModel.acknowledgeEvent()
                onClose(event.invitation)
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
                    .testTag(INVITE_MEMBER_WIZARD_TAG),
        ) {
            WizardShell(model = viewModel) {
                when (state.currentStep) {
                    InviteMemberStep.Role -> RoleStep(state.form.role, viewModel::setRole)
                    InviteMemberStep.Identify ->
                        IdentifyStep(
                            email = state.form.email,
                            message = state.form.message,
                            onEmail = viewModel::setEmail,
                            onMessage = viewModel::setMessage,
                        )
                    InviteMemberStep.Review ->
                        ReviewStep(
                            role = state.form.role,
                            email = state.form.email.trim(),
                            message = state.form.message.trim(),
                        )
                }
                state.errorMessage?.let { ErrorBanner(it) }
            }
        }
    }
}

// MARK: - Step composables

@Composable
private fun RoleStep(
    selected: MemberRole,
    onSelect: (MemberRole) -> Unit,
) {
    HeadlineBlock(InviteMemberStep.Role.title)
    SubcopyBlock(InviteMemberStep.Role.subcopy)
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        listOf(MemberRole.Member, MemberRole.Guest).forEach { role ->
            RoleTile(
                role = role,
                isSelected = selected == role,
                onSelect = { onSelect(role) },
            )
        }
    }
}

@Composable
private fun RoleTile(
    role: MemberRole,
    isSelected: Boolean,
    onSelect: () -> Unit,
) {
    val palette = role.palette
    val borderColor = if (isSelected) PantopusColors.home else PantopusColors.appBorder
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
                .testTag("inviteMember_role_${role.wire}"),
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
            PantopusIconImage(
                icon = role.icon,
                contentDescription = null,
                size = 22.dp,
                tint = palette.foreground,
            )
        }
        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = role.label,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = roleTileSubcopy(role),
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (isSelected) {
            PantopusIconImage(
                icon = PantopusIcon.CheckCircle,
                contentDescription = null,
                size = Radii.xl2,
                tint = PantopusColors.home,
            )
        }
    }
}

private fun roleTileSubcopy(role: MemberRole): String =
    when (role) {
        MemberRole.Member -> "Full access — tasks, bills, calendar, codes."
        MemberRole.Guest -> "Short-term — sitters, visitors, contractors."
        else -> ""
    }

@Composable
private fun IdentifyStep(
    email: String,
    message: String,
    onEmail: (String) -> Unit,
    onMessage: (String) -> Unit,
) {
    HeadlineBlock(InviteMemberStep.Identify.title)
    SubcopyBlock(InviteMemberStep.Identify.subcopy)
    FormFieldsBlock {
        PantopusTextField(
            label = "Email",
            value = email,
            onValueChange = onEmail,
            placeholder = "name@example.com",
            fieldTestTag = "inviteMember_email",
        )
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Personal note (optional)",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
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
                    value = message,
                    onValueChange = onMessage,
                    modifier = Modifier.fillMaxSize().testTag("inviteMember_message"),
                    textStyle =
                        TextStyle(
                            color = PantopusColors.appText,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Normal,
                        ),
                    cursorBrush = SolidColor(PantopusColors.home),
                )
            }
        }
    }
}

@Composable
private fun ReviewStep(
    role: MemberRole,
    email: String,
    message: String,
) {
    HeadlineBlock(InviteMemberStep.Review.title)
    SubcopyBlock(InviteMemberStep.Review.subcopy)
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface),
    ) {
        ReviewRow(label = "Role", value = role.label)
        HorizontalDivider(color = PantopusColors.appBorderSubtle)
        ReviewRow(label = "Email", value = email)
    }
    if (message.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = "Personal note",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
            Box(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurfaceSunken)
                        .padding(Spacing.s3),
            ) {
                Text(
                    text = message,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                )
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
        Text(
            text = label,
            modifier = Modifier.width(96.dp),
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        Text(
            text = value,
            modifier = Modifier.weight(1f),
            style = PantopusTextStyle.body,
            color = PantopusColors.appText,
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
                .testTag("inviteMemberErrorBanner"),
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
    Spacer(Modifier.height(Spacing.s2))
}

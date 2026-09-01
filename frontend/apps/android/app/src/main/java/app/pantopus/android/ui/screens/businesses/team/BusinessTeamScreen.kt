@file:Suppress("PackageNaming", "LongMethod", "TooManyFunctions", "MagicNumber")

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
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.businesses.BusinessRolePresetDto
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.OfflineBannerHost
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.screens.shared.list_of_rows.GradientPair
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/** Test tag on the Business Team list root container. */
const val BUSINESS_TEAM_TAG = "businessTeam.screen"

/** Which modal sheet is presented. */
private sealed interface TeamSheet {
    data object Invite : TeamSheet

    data class ChangeRole(val row: BusinessTeamMemberRow) : TeamSheet

    data class Permissions(val row: BusinessTeamMemberRow) : TeamSheet
}

/**
 * B2C — owner-side business team & roles management. A faithful clone of
 * the per-home Members screen: a roster grouped into role sections + a
 * pending-invites section, each row with an avatar, name/email, and a role
 * pill, plus an overflow menu (Change role / Manage permissions / Remove)
 * and an invite wizard. Mirrors iOS `BusinessTeamView`.
 */
@Composable
fun BusinessTeamScreen(
    onBack: () -> Unit,
    viewModel: BusinessTeamViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val presets by viewModel.rolePresets.collectAsStateWithLifecycle()
    val online by viewModel.isOnline.collectAsStateWithLifecycle()

    var sheet by remember { mutableStateOf<TeamSheet?>(null) }
    var removeTarget by remember { mutableStateOf<BusinessTeamMemberRow?>(null) }
    var cancelTarget by remember { mutableStateOf<BusinessTeamPendingRow?>(null) }

    LaunchedEffect(Unit) { viewModel.load() }

    val inviteEnabled =
        when (val s = state) {
            is BusinessTeamUiState.Loaded -> s.content.canInvite
            is BusinessTeamUiState.Empty -> s.canInvite
            else -> false
        }

    Box(modifier = Modifier.fillMaxSize().background(PantopusColors.appBg).testTag(BUSINESS_TEAM_TAG)) {
        Column(Modifier.fillMaxSize()) {
            ContentDetailTopBar(title = "Team", onBack = onBack)
            OfflineBannerHost(isOffline = !online) {
                when (val current = state) {
                    BusinessTeamUiState.Loading -> TeamLoading()
                    is BusinessTeamUiState.Loaded ->
                        TeamLoaded(
                            content = current.content,
                            onOverflowChangeRole = { sheet = TeamSheet.ChangeRole(it) },
                            onOverflowPermissions = { sheet = TeamSheet.Permissions(it) },
                            onOverflowRemove = { removeTarget = it },
                            onCancelPending = { cancelTarget = it },
                        )
                    is BusinessTeamUiState.Empty ->
                        EmptyState(
                            icon = PantopusIcon.Users,
                            headline = "No teammates yet",
                            subcopy = "Invite someone to help run your business. You control what each role can see and do.",
                            ctaTitle = if (current.canInvite) "Invite a teammate" else null,
                            onCta = { sheet = TeamSheet.Invite },
                            tint = PantopusColors.businessBg,
                            accent = PantopusColors.business,
                            modifier = Modifier.testTag("businessTeam.empty"),
                        )
                    is BusinessTeamUiState.Error ->
                        EmptyState(
                            icon = PantopusIcon.AlertCircle,
                            headline = "Couldn't load your team",
                            subcopy = current.message,
                            ctaTitle = "Try again",
                            onCta = { viewModel.refresh() },
                            modifier = Modifier.testTag("businessTeam.error"),
                        )
                }
            }
        }

        if (inviteEnabled) {
            InviteFab(
                onClick = { sheet = TeamSheet.Invite },
                modifier = Modifier.align(Alignment.BottomEnd).navigationBarsPadding().padding(Spacing.s4),
            )
        }
    }

    // ─── Sheets ───────────────────────────────────────────────────
    when (val s = sheet) {
        null -> Unit
        TeamSheet.Invite ->
            InviteTeammateWizardSheet(
                businessId = viewModel.businessId,
                onClose = { seat ->
                    sheet = null
                    seat?.let(viewModel::handleInvited)
                },
            )
        is TeamSheet.ChangeRole ->
            ChangeRoleSheet(
                memberName = s.row.name,
                currentRole = s.row.role,
                presets = presets,
                onDismiss = { sheet = null },
                onPick = { preset: BusinessRolePresetDto -> viewModel.changeRole(s.row.userId, preset) },
            )
        is TeamSheet.Permissions ->
            ManagePermissionsSheet(
                memberName = s.row.name,
                loadPermissions = { viewModel.memberPermissions(s.row.userId) },
                toggle = { permission, allowed -> viewModel.togglePermission(s.row.userId, permission, allowed) },
                onDismiss = { sheet = null },
            )
    }

    // ─── Confirms ─────────────────────────────────────────────────
    removeTarget?.let { row ->
        AlertDialog(
            onDismissRequest = { removeTarget = null },
            title = { Text("Remove member?") },
            text = { Text("${row.name} will lose access to this business. They can be re-invited later.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.remove(row.userId)
                        removeTarget = null
                    },
                    modifier = Modifier.testTag("businessTeam_removeConfirm"),
                ) { Text("Remove ${row.name}") }
            },
            dismissButton = { TextButton(onClick = { removeTarget = null }) { Text("Cancel") } },
        )
    }

    cancelTarget?.let { row ->
        AlertDialog(
            onDismissRequest = { cancelTarget = null },
            title = { Text("Cancel invite?") },
            text = { Text("The pending invite for ${row.name} will be withdrawn.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.cancelInvite(row.seatId)
                        cancelTarget = null
                    },
                    modifier = Modifier.testTag("businessTeam_cancelConfirm"),
                ) { Text("Cancel invite") }
            },
            dismissButton = { TextButton(onClick = { cancelTarget = null }) { Text("Keep invite") } },
        )
    }
}

@Composable
private fun TeamLoaded(
    content: BusinessTeamContent,
    onOverflowChangeRole: (BusinessTeamMemberRow) -> Unit,
    onOverflowPermissions: (BusinessTeamMemberRow) -> Unit,
    onOverflowRemove: (BusinessTeamMemberRow) -> Unit,
    onCancelPending: (BusinessTeamPendingRow) -> Unit,
) {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        content.sections.forEach { section ->
            SectionBlock(
                tag = "businessTeam.section.${section.role.wire}",
                title = section.headerTitle,
                count = section.rows.size,
            ) {
                section.rows.forEach { row ->
                    MemberRowCard(
                        row = row,
                        onChangeRole = onOverflowChangeRole,
                        onPermissions = onOverflowPermissions,
                        onRemove = onOverflowRemove,
                    )
                }
            }
        }
        if (content.pending.isNotEmpty()) {
            SectionBlock(
                tag = "businessTeam.pendingSection",
                title = "Pending invites",
                count = content.pending.size,
            ) {
                content.pending.forEach { row ->
                    PendingRowCard(row = row, onCancel = onCancelPending)
                }
            }
        }
        Spacer(Modifier.height(Spacing.s10))
    }
}

@Composable
private fun SectionBlock(
    tag: String,
    title: String,
    count: Int,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth().testTag(tag),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            Text(
                text = title.uppercase(),
                color = PantopusColors.appTextSecondary,
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.8.sp,
                modifier = Modifier.semantics { heading() },
            )
            Text(text = "($count)", style = PantopusTextStyle.caption, color = PantopusColors.appTextMuted)
        }
        content()
    }
}

@Composable
private fun MemberRowCard(
    row: BusinessTeamMemberRow,
    onChangeRole: (BusinessTeamMemberRow) -> Unit,
    onPermissions: (BusinessTeamMemberRow) -> Unit,
    onRemove: (BusinessTeamMemberRow) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("businessTeam.row.${row.userId}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        TeamAvatar(name = row.name, gradient = row.avatarGradient)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = row.name,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
                RolePill(role = row.role)
            }
            row.email?.takeIf { it.isNotEmpty() }?.let { MetaLine(text = it, icon = PantopusIcon.Mail) }
            row.joinedText?.let { MetaLine(text = it, icon = PantopusIcon.Clock) }
        }
        if (row.canManage) {
            OverflowButton(
                row = row,
                onChangeRole = onChangeRole,
                onPermissions = onPermissions,
                onRemove = onRemove,
            )
        }
    }
}

@Composable
private fun PendingRowCard(
    row: BusinessTeamPendingRow,
    onCancel: (BusinessTeamPendingRow) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.warningBg, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("businessTeam.row.${row.seatId}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.Top,
    ) {
        TeamAvatar(name = row.name, gradient = BusinessTeamAvatarTone.toneFor(row.seatId).gradient, icon = PantopusIcon.Mail)
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                Text(
                    text = row.name,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appText,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
                RolePill(role = row.role)
            }
            row.email?.takeIf { it.isNotEmpty() }?.let { MetaLine(text = it, icon = PantopusIcon.Mail) }
            row.invitedText?.let { MetaLine(text = it, icon = PantopusIcon.Mailbox) }
        }
        if (row.canManage) {
            Text(
                text = "Cancel",
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
                fontWeight = FontWeight.SemiBold,
                modifier =
                    Modifier
                        .clip(RoundedCornerShape(Radii.pill))
                        .clickable { onCancel(row) }
                        .padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                        .testTag("businessTeam.pendingCancel.${row.seatId}"),
            )
        }
    }
}

@Composable
private fun OverflowButton(
    row: BusinessTeamMemberRow,
    onChangeRole: (BusinessTeamMemberRow) -> Unit,
    onPermissions: (BusinessTeamMemberRow) -> Unit,
    onRemove: (BusinessTeamMemberRow) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        Box(
            modifier =
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .clickable { expanded = true }
                    .semantics { contentDescription = "More actions for ${row.name}" }
                    .testTag("businessTeam.overflow"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.MoreHorizontal,
                contentDescription = null,
                size = 20.dp,
                tint = PantopusColors.appTextSecondary,
            )
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text("Change role") },
                onClick = {
                    expanded = false
                    onChangeRole(row)
                },
                modifier = Modifier.testTag("businessTeam.changeRole"),
            )
            DropdownMenuItem(
                text = { Text("Manage permissions") },
                onClick = {
                    expanded = false
                    onPermissions(row)
                },
                modifier = Modifier.testTag("businessTeam.managePermissions"),
            )
            DropdownMenuItem(
                text = { Text("Remove from team", color = PantopusColors.error) },
                onClick = {
                    expanded = false
                    onRemove(row)
                },
                modifier = Modifier.testTag("businessTeam.remove"),
            )
        }
    }
}

@Composable
private fun RolePill(role: BusinessRole) {
    val palette = role.palette
    Row(
        modifier =
            Modifier
                .clip(RoundedCornerShape(Radii.pill))
                .background(palette.background)
                .padding(horizontal = Spacing.s2, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        PantopusIconImage(icon = role.icon, contentDescription = null, size = 11.dp, tint = palette.foreground)
        Text(text = role.label, style = PantopusTextStyle.caption, color = palette.foreground)
    }
}

@Composable
private fun MetaLine(
    text: String,
    icon: PantopusIcon,
) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        PantopusIconImage(icon = icon, contentDescription = null, size = 11.dp, tint = PantopusColors.appTextSecondary)
        Text(text = text, style = PantopusTextStyle.caption, color = PantopusColors.appTextSecondary, maxLines = 1)
    }
}

@Composable
private fun TeamAvatar(
    name: String,
    gradient: GradientPair,
    icon: PantopusIcon? = null,
) {
    Box(
        modifier = Modifier.size(40.dp).clip(CircleShape).background(Brush.linearGradient(listOf(gradient.start, gradient.end))),
        contentAlignment = Alignment.Center,
    ) {
        if (icon != null) {
            PantopusIconImage(icon = icon, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextInverse)
        } else {
            Text(text = initials(name), color = PantopusColors.appTextInverse, fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

private fun initials(name: String): String = name.split(" ").filter { it.isNotEmpty() }.take(2).joinToString("") { it.first().uppercase() }

@Composable
private fun InviteFab(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier =
            modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(PantopusColors.business)
                .clickable(onClick = onClick)
                .semantics { contentDescription = "Invite teammate" }
                .testTag("businessTeam.inviteBtn"),
        contentAlignment = Alignment.Center,
    ) {
        PantopusIconImage(icon = PantopusIcon.UserPlus, contentDescription = null, size = 22.dp, tint = PantopusColors.appTextInverse)
    }
}

@Composable
private fun TeamLoading() {
    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.s4).testTag("businessTeam.loading"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        repeat(2) {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                Shimmer(width = 90.dp, height = 12.dp, cornerRadius = Radii.sm)
                repeat(2) {
                    Row(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(Radii.lg))
                                .background(PantopusColors.appSurface)
                                .padding(Spacing.s3),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Shimmer(width = 40.dp, height = 40.dp, cornerRadius = Radii.pill)
                        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                            Shimmer(width = 160.dp, height = 14.dp)
                            Shimmer(width = 120.dp, height = 12.dp)
                        }
                    }
                }
            }
        }
    }
}

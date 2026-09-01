@file:Suppress("PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.members

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen

/** Test tag on the Members list root container. */
const val MEMBERS_LIST_TAG = "membersList"

/**
 * T6.3a / P9 Members per-home list. Thin wrapper around
 * [ListOfRowsScreen]; the VM supplies the rows + chrome and emits a
 * [MembersListEvent] when a row action needs the screen to present a
 * sheet or confirm dialog.
 *
 * Reaches `GET /api/homes/:id/occupants`, `GET /api/homes/:id/me`,
 * `GET /api/homes/:id/household-access-requests`,
 * `POST /api/homes/:id/invite`, `POST …/members/:userId/role`,
 * `POST …/household-access-requests/:requestId/(approve|reject)`, and
 * `DELETE …/members/:userId`.
 */
@Composable
fun MembersListScreen(
    onBack: () -> Unit,
    onAddGuest: () -> Unit = {},
    viewModel: MembersListViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val tabs by viewModel.tabs.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val pendingEvent by viewModel.pendingEvent.collectAsStateWithLifecycle()
    val actionError by viewModel.actionError.collectAsStateWithLifecycle()

    var inviting by remember { mutableStateOf(false) }
    var removeTarget by remember { mutableStateOf<Pair<String, String>?>(null) }
    var actionsTarget by remember { mutableStateOf<MemberActionTarget?>(null) }
    var roleTarget by remember { mutableStateOf<MemberActionTarget?>(null) }
    var approveTarget by remember { mutableStateOf<Pair<String, String>?>(null) }
    var declineTarget by remember { mutableStateOf<Triple<String, String, String>?>(null) }

    LaunchedEffect(Unit) {
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenMembersListViewed)
    }

    LaunchedEffect(pendingEvent) {
        when (val event = pendingEvent) {
            null -> Unit
            MembersListEvent.OpenInvite -> {
                inviting = true
                viewModel.acknowledgeEvent()
            }
            MembersListEvent.OpenAddGuest -> {
                onAddGuest()
                viewModel.acknowledgeEvent()
            }
            is MembersListEvent.OpenMemberActions -> {
                actionsTarget = event.target
                viewModel.acknowledgeEvent()
            }
            is MembersListEvent.ConfirmRemove -> {
                removeTarget = event.userId to event.name
                viewModel.acknowledgeEvent()
            }
            is MembersListEvent.ConfirmApproveRequest -> {
                approveTarget = event.requestId to event.name
                viewModel.acknowledgeEvent()
            }
            is MembersListEvent.ConfirmDeclineRequest -> {
                declineTarget = Triple(event.requestId, event.name, event.identity)
                viewModel.acknowledgeEvent()
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize().testTag(MEMBERS_LIST_TAG)) {
        ListOfRowsScreen(
            title = "Members",
            state = state,
            onRefresh = { viewModel.refresh() },
            onEndReached = { viewModel.loadMoreIfNeeded() },
            tabs = tabs,
            selectedTab = selectedTab,
            onSelectTab = viewModel::selectTab,
            fab = viewModel.fab,
            onBack = onBack,
        )
    }

    if (inviting) {
        InviteMemberWizardSheet(
            homeId = viewModel.homeId,
            onClose = { invitation ->
                inviting = false
                invitation?.let(viewModel::handleInvited)
            },
        )
    }

    actionsTarget?.let { target ->
        MemberActionsDialog(
            target = target,
            onChangeRole = {
                actionsTarget = null
                roleTarget = target
            },
            onRemove = {
                actionsTarget = null
                removeTarget = target.userId to target.name
            },
            onDismiss = { actionsTarget = null },
        )
    }

    roleTarget?.let { target ->
        ChangeMemberRoleDialog(
            target = target,
            onPick = { role ->
                roleTarget = null
                viewModel.changeRole(target.userId, role)
            },
            onDismiss = { roleTarget = null },
        )
    }

    removeTarget?.let { (userId, name) ->
        AlertDialog(
            onDismissRequest = { removeTarget = null },
            title = { Text("Remove member?") },
            text = { Text("$name will lose access to this home. They can be re-invited later.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.remove(userId)
                        removeTarget = null
                    },
                    modifier = Modifier.testTag("membersList_removeConfirm"),
                ) { Text("Remove $name") }
            },
            dismissButton = {
                TextButton(onClick = { removeTarget = null }) { Text("Cancel") }
            },
        )
    }

    approveTarget?.let { (requestId, _) ->
        AlertDialog(
            onDismissRequest = { approveTarget = null },
            title = { Text("Send invitation") },
            text = { Text("This will create a personal invitation for them to accept in the app.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.approveAccessRequest(requestId)
                        approveTarget = null
                    },
                    modifier = Modifier.testTag("membersList_approveRequestConfirm"),
                ) { Text("Approve") }
            },
            dismissButton = {
                TextButton(onClick = { approveTarget = null }) { Text("Cancel") }
            },
        )
    }

    declineTarget?.let { (requestId, name, identity) ->
        AlertDialog(
            onDismissRequest = { declineTarget = null },
            title = { Text("Decline request") },
            text = { Text("Decline $name’s request to join as $identity?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.rejectAccessRequest(requestId)
                        declineTarget = null
                    },
                    modifier = Modifier.testTag("membersList_declineRequestConfirm"),
                ) { Text("Decline") }
            },
            dismissButton = {
                TextButton(onClick = { declineTarget = null }) { Text("Cancel") }
            },
        )
    }

    actionError?.let { message ->
        AlertDialog(
            onDismissRequest = { viewModel.clearActionError() },
            title = { Text("Something went wrong") },
            text = { Text(message) },
            confirmButton = {
                TextButton(onClick = { viewModel.clearActionError() }) { Text("OK") }
            },
        )
    }
}

/**
 * Row kebab → what the viewer may do to this member. Only the entries
 * the backend would accept are rendered (see [HomeRoleAssignment]).
 */
@Composable
private fun MemberActionsDialog(
    target: MemberActionTarget,
    onChangeRole: () -> Unit,
    onRemove: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(target.name) },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                if (target.assignableRoles.isNotEmpty()) {
                    TextButton(
                        onClick = onChangeRole,
                        modifier = Modifier.fillMaxWidth().testTag("membersList_changeRole"),
                    ) { Text("Change role") }
                }
                if (target.canRemove) {
                    TextButton(
                        onClick = onRemove,
                        modifier = Modifier.fillMaxWidth().testTag("membersList_removeAction"),
                    ) { Text("Remove from home") }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

/**
 * Action sheet of assignable roles. The list is already filtered to what
 * `POST /api/homes/:id/members/:userId/role` will accept for this actor
 * / target pair, so every entry is actionable.
 */
@Composable
private fun ChangeMemberRoleDialog(
    target: MemberActionTarget,
    onPick: (HomeAssignableRole) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Change role: ${target.name}") },
        text = {
            Column(modifier = Modifier.fillMaxWidth()) {
                Text("Current role: ${MemberRole.parse(target.currentRole).label}")
                target.assignableRoles.forEach { role ->
                    TextButton(
                        onClick = { onPick(role) },
                        modifier = Modifier.fillMaxWidth().testTag("membersList_role_${role.wire}"),
                    ) { Text(role.label) }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}

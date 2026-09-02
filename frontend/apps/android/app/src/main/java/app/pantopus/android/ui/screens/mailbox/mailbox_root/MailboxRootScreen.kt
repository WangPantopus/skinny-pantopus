@file:Suppress("LongMethod", "LongParameterList", "PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mailbox_root

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.analytics.Analytics
import app.pantopus.android.data.analytics.AnalyticsEvent
import app.pantopus.android.ui.screens.shared.list_of_rows.FabAction
import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsScreen
import app.pantopus.android.ui.screens.shared.list_of_rows.TopBarAction
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage

/**
 * B.1 — Mailbox root archetype. One screen: a 4-drawer chip row
 * (Me / Home / Biz / Earn) + a 3-tab segmented bar (Incoming / Counter /
 * Vault) + the mail list for the active (drawer, tab). Replaces the
 * MailboxDrawersScreen (drawer list) + MailboxListScreen (flat list) pair.
 *
 * Built on the List-of-Rows archetype: the drawer chips and tab bar render
 * in the shell's `customHeader`; the list, loading, empty, and error
 * states all come from the shell.
 */
@Composable
fun MailboxRootScreen(
    onOpenMail: (String) -> Unit,
    onOpenSearch: () -> Unit = {},
    onOpenMap: () -> Unit = {},
    onOpenMailDay: () -> Unit = {},
    onOpenEarn: () -> Unit = {},
    onOpenVacationHold: () -> Unit = {},
    onOpenStamps: () -> Unit = {},
    onOpenUnboxing: () -> Unit = {},
    onOpenCompose: () -> Unit = {},
    onOpenRoutingQueue: () -> Unit = {},
    onOpenMailParty: () -> Unit = {},
    onOpenCommunity: () -> Unit = {},
    onOpenRecords: () -> Unit = {},
    onOpenMailTasks: () -> Unit = {},
    onBack: (() -> Unit)? = null,
    /** Wedge v2 D2: Messages lives inside Mail — the inbox entry above the drawers. */
    onOpenInbox: (() -> Unit)? = null,
    viewModel: MailboxRootViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selectedDrawer by viewModel.selectedDrawer.collectAsStateWithLifecycle()
    val selectedTab by viewModel.selectedTab.collectAsStateWithLifecycle()
    val pendingRoutingCount by viewModel.pendingRoutingCount.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.configureNavigation(
            onOpenMail = onOpenMail,
            onOpenSearch = onOpenSearch,
            onOpenMap = onOpenMap,
            onOpenEarn = onOpenEarn,
        )
        viewModel.load()
        Analytics.track(AnalyticsEvent.ScreenMailboxRootViewed)
    }

    ListOfRowsScreen(
        title = "Mailbox",
        state = state,
        onRefresh = { viewModel.refresh() },
        onEndReached = { viewModel.loadMoreIfNeeded() },
        topBarAction =
            TopBarAction(
                icon = PantopusIcon.Search,
                contentDescription = "Search mail",
                onClick = onOpenSearch,
            ),
        // Compose FAB — the canonical create action of the Mailbox,
        // opening the four-moment Ceremonial Mail wizard (Porch Call →
        // Address It → Write It → Seal & Send). Mirrors RN's compose FAB
        // (`src/app/mailbox/index.tsx:300-307`).
        //
        // Shown in *every* state, including empty: an empty mailbox is
        // exactly when a user wants to write. The design's
        // `mode !== 'empty'` guard applied to the old scan-line FAB, which
        // now lives in the overflow menu ("Find a mailbox") so the map
        // surface stays reachable.
        fab =
            FabAction(
                icon = PantopusIcon.Pencil,
                contentDescription = "Write a letter",
                onClick = onOpenCompose,
            ),
        onBack = onBack,
        customHeader = {
            Column {
                if (onOpenInbox != null) MailboxInboxEntry(onOpenInbox)
                MailboxRootHeader(
                    drawers = viewModel.drawers,
                    selectedDrawer = selectedDrawer,
                    tabs = viewModel.mailTabs,
                    selectedTab = selectedTab,
                    drawerBadge = viewModel::drawerBadge,
                    tabBadge = viewModel::tabBadge,
                    onSelectDrawer = viewModel::selectDrawer,
                    onSelectTab = viewModel::selectTab,
                    onOpenMailDay = onOpenMailDay,
                    pendingRoutingCount = pendingRoutingCount,
                    onOpenRoutingQueue = onOpenRoutingQueue,
                )
            }
        },
        extraTopBarAction = {
            IconButton(onClick = onOpenStamps, modifier = Modifier.testTag("mailboxRootStamps")) {
                PantopusIconImage(
                    icon = PantopusIcon.Gift,
                    contentDescription = "Stamps",
                    size = 22.dp,
                    tint = PantopusColors.appText,
                )
            }
            MailboxRootSettingsMenu(
                onOpenMap = onOpenMap,
                onOpenUnboxing = onOpenUnboxing,
                onOpenVacationHold = onOpenVacationHold,
                onOpenStamps = onOpenStamps,
                onOpenMailParty = onOpenMailParty,
                onOpenCommunity = onOpenCommunity,
                onOpenRecords = onOpenRecords,
                onOpenMailTasks = onOpenMailTasks,
            )
        },
    )
}

/**
 * Overflow / settings menu on the Mailbox root top bar. Carries the
 * A17.14 "Scan an item" entry (the scan/add affordance → Unboxing) and
 * Vacation hold (A14.8). Future mailbox-scoped settings can land in the
 * same menu without changing the chrome.
 */
@Composable
private fun MailboxRootSettingsMenu(
    onOpenMap: () -> Unit,
    onOpenUnboxing: () -> Unit,
    onOpenVacationHold: () -> Unit,
    onOpenStamps: () -> Unit,
    onOpenMailParty: () -> Unit,
    onOpenCommunity: () -> Unit,
    onOpenRecords: () -> Unit,
    onOpenMailTasks: () -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    IconButton(
        onClick = { expanded = true },
        modifier = Modifier.testTag("mailboxRootSettings"),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.MoreVertical,
            contentDescription = "Mailbox settings",
            size = 22.dp,
            tint = PantopusColors.appText,
        )
    }
    DropdownMenu(
        expanded = expanded,
        onDismissRequest = { expanded = false },
    ) {
        DropdownMenuItem(
            text = { Text("Find a mailbox", color = PantopusColors.appText) },
            onClick = {
                expanded = false
                onOpenMap()
            },
            modifier = Modifier.testTag("mailboxRootSettings.map"),
        )
        DropdownMenuItem(
            text = { Text("Scan an item", color = PantopusColors.appText) },
            onClick = {
                expanded = false
                onOpenUnboxing()
            },
            modifier = Modifier.testTag("mailboxRootSettings.scanUnboxing"),
        )
        DropdownMenuItem(
            text = { Text("Mail tasks", color = PantopusColors.appText) },
            onClick = {
                expanded = false
                onOpenMailTasks()
            },
            modifier = Modifier.testTag("mailboxRootSettings.mailTasks"),
        )
        DropdownMenuItem(
            text = { Text("Mail party", color = PantopusColors.appText) },
            onClick = {
                expanded = false
                onOpenMailParty()
            },
            modifier = Modifier.testTag("mailboxRootSettings.mailParty"),
        )
        DropdownMenuItem(
            text = { Text("Community mail", color = PantopusColors.appText) },
            onClick = {
                expanded = false
                onOpenCommunity()
            },
            modifier = Modifier.testTag("mailboxRootSettings.community"),
        )
        DropdownMenuItem(
            text = { Text("Home records", color = PantopusColors.appText) },
            onClick = {
                expanded = false
                onOpenRecords()
            },
            modifier = Modifier.testTag("mailboxRootSettings.homeRecords"),
        )
        DropdownMenuItem(
            text = { Text("Stamps", color = PantopusColors.appText) },
            onClick = {
                expanded = false
                onOpenStamps()
            },
            modifier = Modifier.testTag("mailboxRootSettings.stamps"),
        )
        DropdownMenuItem(
            text = { Text("Vacation hold", color = PantopusColors.appText) },
            onClick = {
                expanded = false
                onOpenVacationHold()
            },
            modifier = Modifier.testTag("mailboxRootSettings.vacationHold"),
        )
    }
}

/** Messages as Mail's inbox (Wedge v2 D2): one row above the drawers, into the chat list. */
@Composable
private fun MailboxInboxEntry(onOpenInbox: () -> Unit) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appSurface)
                .clickable(onClick = onOpenInbox)
                .padding(horizontal = 16.dp, vertical = 12.dp)
                .testTag("mailboxRootInbox"),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(icon = PantopusIcon.MessageCircle, contentDescription = null, size = 20.dp, tint = PantopusColors.primary600)
        Column(modifier = Modifier.weight(1f)) {
            Text("Messages", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = PantopusColors.appText)
            Text(
                "Your inbox — neighbors, businesses, and the people you follow",
                fontSize = 12.5.sp,
                color = PantopusColors.appTextSecondary,
            )
        }
        PantopusIconImage(icon = PantopusIcon.ChevronRight, contentDescription = null, size = 16.dp, tint = PantopusColors.appTextMuted)
    }
}

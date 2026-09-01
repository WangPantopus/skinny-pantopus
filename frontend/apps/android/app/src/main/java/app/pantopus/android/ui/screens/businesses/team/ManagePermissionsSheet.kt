@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.businesses.team

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import kotlinx.coroutines.launch

/** One togglable permission with a human label, grouped by area. */
data class BusinessPermissionOption(
    val key: String,
    val label: String,
    val group: String,
)

/**
 * Curated catalog the sheet exposes — a faithful subset of the backend's
 * permission vocabulary (`businessPermissions.js`), the management-relevant
 * grants an owner is most likely to tune per member. Parity with iOS.
 */
object BusinessPermissionCatalog {
    val options =
        listOf(
            BusinessPermissionOption("profile.edit", "Edit profile", "Profile & pages"),
            BusinessPermissionOption("pages.publish", "Publish pages", "Profile & pages"),
            BusinessPermissionOption("catalog.manage", "Manage catalog", "Catalog & gigs"),
            BusinessPermissionOption("gigs.manage", "Manage gigs", "Catalog & gigs"),
            BusinessPermissionOption("reviews.respond", "Respond to reviews", "Customers"),
            BusinessPermissionOption("team.invite", "Invite teammates", "Team"),
            BusinessPermissionOption("team.manage", "Manage team", "Team"),
            BusinessPermissionOption("finance.manage", "Manage finances", "Money"),
            BusinessPermissionOption("insights.view", "View insights", "Money"),
        )

    val groupOrder = listOf("Profile & pages", "Catalog & gigs", "Customers", "Team", "Money")
}

private sealed interface PermissionsLoad {
    data object Loading : PermissionsLoad

    data object Loaded : PermissionsLoad

    data class Error(val message: String) : PermissionsLoad
}

/**
 * Presented from a member row's overflow → "Manage permissions". Fetches
 * the member's effective permission set and lets the owner toggle a curated
 * set of scoped permissions, optimistically with rollback. Mirrors iOS
 * `ManagePermissionsSheet`.
 */
@Composable
fun ManagePermissionsSheet(
    memberName: String,
    loadPermissions: suspend () -> Result<List<String>>,
    toggle: suspend (String, Boolean) -> Boolean,
    onDismiss: () -> Unit,
) {
    var load by remember { mutableStateOf<PermissionsLoad>(PermissionsLoad.Loading) }
    var granted by remember { mutableStateOf<Set<String>>(emptySet()) }
    var inFlight by remember { mutableStateOf<Set<String>>(emptySet()) }
    val scope = rememberCoroutineScope()

    suspend fun reload() {
        load = PermissionsLoad.Loading
        loadPermissions()
            .onSuccess {
                granted = it.toSet()
                load = PermissionsLoad.Loaded
            }
            .onFailure { load = PermissionsLoad.Error(it.message ?: "Couldn't load permissions.") }
    }

    LaunchedEffect(Unit) { reload() }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, dismissOnBackPress = true, dismissOnClickOutside = false),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .background(PantopusColors.appBg)
                    .testTag("businessTeam.permissionsSheet"),
        ) {
            ContentDetailTopBar(title = "Permissions", onBack = onDismiss)
            when (val current = load) {
                PermissionsLoad.Loading ->
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(Spacing.s4),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
                    ) {
                        repeat(6) {
                            Shimmer(height = 48.dp, cornerRadius = Radii.md, modifier = Modifier.fillMaxWidth())
                        }
                    }
                is PermissionsLoad.Error ->
                    EmptyState(
                        icon = PantopusIcon.AlertCircle,
                        headline = "Couldn't load permissions",
                        subcopy = current.message,
                        ctaTitle = "Try again",
                        onCta = { scope.launch { reload() } },
                    )
                PermissionsLoad.Loaded ->
                    Column(
                        modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(Spacing.s4),
                        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
                    ) {
                        Text(
                            text = "Fine-tune what $memberName can do. These override their role defaults.",
                            style = PantopusTextStyle.caption,
                            color = PantopusColors.appTextSecondary,
                        )
                        BusinessPermissionCatalog.groupOrder.forEach { group ->
                            val options = BusinessPermissionCatalog.options.filter { it.group == group }
                            if (options.isNotEmpty()) {
                                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                                    Text(
                                        text = group.uppercase(),
                                        style = PantopusTextStyle.caption,
                                        color = PantopusColors.appTextSecondary,
                                    )
                                    Column(
                                        modifier =
                                            Modifier
                                                .fillMaxWidth()
                                                .clip(RoundedCornerShape(Radii.lg))
                                                .background(PantopusColors.appSurface)
                                                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg)),
                                    ) {
                                        options.forEachIndexed { index, option ->
                                            PermissionToggleRow(
                                                option = option,
                                                isOn = granted.contains(option.key),
                                                isBusy = inFlight.contains(option.key),
                                                onToggle = { newValue ->
                                                    if (inFlight.contains(option.key)) return@PermissionToggleRow
                                                    val previous = granted
                                                    inFlight = inFlight + option.key
                                                    granted = if (newValue) granted + option.key else granted - option.key
                                                    scope.launch {
                                                        val ok = toggle(option.key, newValue)
                                                        if (!ok) granted = previous
                                                        inFlight = inFlight - option.key
                                                    }
                                                },
                                            )
                                            if (index < options.lastIndex) {
                                                HorizontalDivider(
                                                    color = PantopusColors.appBorderSubtle,
                                                    modifier = Modifier.padding(start = Spacing.s3),
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
            }
        }
    }
}

@Composable
private fun PermissionToggleRow(
    option: BusinessPermissionOption,
    isOn: Boolean,
    isBusy: Boolean,
    onToggle: (Boolean) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("businessTeam.permission.${option.key}"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(text = option.label, style = PantopusTextStyle.body, color = PantopusColors.appText)
        Box(modifier = Modifier.weight(1f))
        Switch(
            checked = isOn,
            onCheckedChange = onToggle,
            enabled = !isBusy,
            colors = SwitchDefaults.colors(checkedTrackColor = PantopusColors.business, checkedThumbColor = Color.White),
            modifier = Modifier.semantics { contentDescription = option.label },
        )
    }
}

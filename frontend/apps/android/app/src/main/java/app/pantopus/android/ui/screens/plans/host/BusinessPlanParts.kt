package app.pantopus.android.ui.screens.plans.host

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.plans.HostAsBusinessDto
import app.pantopus.android.data.api.models.plans.HostAsLocationDto
import app.pantopus.android.ui.screens.plans.components.PlanBusinessShape
import app.pantopus.android.ui.screens.plans.components.PlanDivider
import app.pantopus.android.ui.screens.plans.components.PlanField
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanScopeLine
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/*
 * Plans with businesses, board B2: where a business's plan meets. Always one of the business's own locations (a
 * storefront, an office, a warehouse on the map), never a home and never a place typed by hand. Shared by posting
 * (the host flow) and moving a plan (the change page).
 */

/** "Where": the business's location, with a chooser when it has more than one, and the promise under it. */
@Composable
internal fun ColumnScope.BusinessWhereField(
    business: HostAsBusinessDto,
    locationId: String?,
    onPick: (String) -> Unit,
) {
    var choosing by remember { mutableStateOf(false) }
    val location = business.locations.firstOrNull { it.id == locationId }
    val canChoose = business.locations.size > 1
    PlanField(label = "Where") {
        PlanFormCard {
            PlanOptionRow(
                first = true,
                onClick = if (canChoose) ({ choosing = true }) else null,
                modifier =
                    Modifier.testTag("planBusinessLocation").semantics(mergeDescendants = true) {
                        if (canChoose) role = Role.Button
                    },
            ) {
                PlanBusinessShape(size = 36.dp, avatarUrl = business.avatarUrl)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = locationTitle(business, location),
                        style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                        color = PantopusColors.appText,
                    )
                    Text(
                        text = location?.address ?: "Choose one of your business's locations",
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                if (canChoose) {
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronRight,
                        contentDescription = null,
                        size = 16.dp,
                        tint = PantopusColors.appTextMuted,
                    )
                }
            }
        }
        PlanScopeLine(
            text = "A business's plan shows its place to everyone. You choose from your business's own locations.",
            icon = PantopusIcon.MapPin,
        )
    }
    if (choosing) {
        BusinessLocationChooser(
            business = business,
            selectedId = locationId,
            onPick = { id ->
                choosing = false
                onPick(id)
            },
            onDismiss = { choosing = false },
        )
    }
}

/** The business's name, and which of its places when it has more than one ("Lacamas Pickleball Club · East courts"). */
internal fun locationTitle(
    business: HostAsBusinessDto,
    location: HostAsLocationDto?,
): String =
    if (location != null && business.locations.size > 1 && !location.label.isNullOrBlank()) {
        "${business.name} · ${location.label}"
    } else {
        business.name
    }

/** "Where?": the business's locations to pick from. */
@Composable
private fun BusinessLocationChooser(
    business: HostAsBusinessDto,
    selectedId: String?,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Where?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.s0)) {
                business.locations.forEachIndexed { index, location ->
                    if (index > 0) PlanDivider()
                    val chosen = location.id == selectedId
                    Column(
                        modifier =
                            Modifier
                                .fillMaxWidth()
                                .heightIn(min = 48.dp)
                                .clickable(role = Role.RadioButton) { onPick(location.id) }
                                .semantics(mergeDescendants = true) { selected = chosen }
                                .padding(vertical = 10.dp),
                    ) {
                        Text(
                            text = location.label?.takeIf(String::isNotBlank) ?: business.name,
                            style = PantopusTextStyle.body.copy(fontWeight = if (chosen) FontWeight.Bold else FontWeight.SemiBold),
                            color = if (chosen) PantopusColors.primary700 else PantopusColors.appText,
                        )
                        location.address?.let {
                            Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

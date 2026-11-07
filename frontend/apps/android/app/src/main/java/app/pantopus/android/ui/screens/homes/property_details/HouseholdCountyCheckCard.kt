package app.pantopus.android.ui.screens.homes.property_details

import android.content.Context
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.semantics
import androidx.core.content.edit
import app.pantopus.android.data.api.models.homes.HouseholdCountyCheckDto
import app.pantopus.android.data.api.models.homes.HouseholdCountyPageDto
import app.pantopus.android.data.api.models.homes.HouseholdFactChange
import app.pantopus.android.data.api.models.homes.HouseholdGroupDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

// Link and confirm (backend/config/countyLinks.js): the county's own page for a home with no county record, then
// "Is this right?" with year built, size, bedrooms and baths once the person is back. Drawn only when the server
// sends county_check.

private const val PREFS = "county_links"

/** Whether this person opened the county's page for [homeId] on this device, and a way to say they did. A relaunch still asks. */
@Composable
internal fun rememberCountyPageOpened(homeId: String): Pair<Boolean, () -> Unit> {
    val prefs = LocalContext.current.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    var opened by remember(homeId) { mutableStateOf(prefs.getBoolean("opened.$homeId", false)) }
    return opened to {
        opened = true
        prefs.edit { putBoolean("opened.$homeId", true) }
    }
}

/**
 * Link and confirm on Property details, for a home no county record answers: the county's page, then "Is this
 * right?" with year built, size, bedrooms and baths once the person is back. Yes keeps them as the household's own.
 */
@Composable
internal fun HouseholdCountyCheckCard(
    page: HouseholdCountyPageDto,
    check: HouseholdCountyCheckDto,
    actions: HouseholdActions,
) {
    val (opened, markOpened) = rememberCountyPageOpened(actions.homeId)
    Column(
        modifier = Modifier.fillMaxWidth().householdCard().padding(Spacing.s4).testTag("propertyDetails_countyCheck"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        HouseholdCountyPageLink(page, onOpen = markOpened)
        if (opened || check.confirmed != null) {
            Text(text = check.lead, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
            if (check.facts.any { it.value != null }) {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                    check.facts.forEach { fact ->
                        Row(
                            modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(text = fact.label, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                            Text(text = fact.value ?: "—", style = PantopusTextStyle.small, color = PantopusColors.appText)
                        }
                    }
                }
            }
            check.confirmed?.let { confirmed ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(
                        text = confirmed,
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                        modifier = Modifier.weight(1f),
                    )
                    if (check.canUndo) {
                        HouseholdAction("Undo", !actions.saving, "propertyDetails_countyCheck_undo") {
                            actions.save(listOf(HouseholdFactChange.undoConfirm(check.group)))
                        }
                    }
                }
            }
            check.prompt?.let { prompt ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    Text(text = prompt, style = PantopusTextStyle.small, color = PantopusColors.appText, modifier = Modifier.weight(1f))
                    HouseholdAction("Yes", !actions.saving, "propertyDetails_countyCheck_yes") {
                        actions.save(listOf(HouseholdFactChange.confirm(check.group)))
                    }
                }
            }
            HouseholdAction(check.fix, !actions.saving, "propertyDetails_countyCheck_fix") { actions.edit(check.asGroup()) }
        }
    }
}

/** "Fix something" from "Is this right?" after the county's page: its four facts. */
private fun HouseholdCountyCheckDto.asGroup() = HouseholdGroupDto(id = group, title = prompt ?: fix, lead = lead, facts = facts)

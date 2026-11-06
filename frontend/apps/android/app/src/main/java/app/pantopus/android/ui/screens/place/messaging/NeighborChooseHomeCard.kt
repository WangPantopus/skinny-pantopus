package app.pantopus.android.ui.screens.place.messaging

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.api.models.homediscovery.DiscoveredHomeDto
import app.pantopus.android.ui.components.AddressSuggestionList
import app.pantopus.android.ui.components.firstTapClosesKeyboard
import app.pantopus.android.ui.components.rememberAddressSuggestions
import app.pantopus.android.ui.screens.place.components.PlaceIconTile
import app.pantopus.android.ui.screens.place.components.PlaceTileTone
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Choose a home: the house number and street, with address suggestions (nearest your Home first). A picked
 * suggestion is looked up at once among discoverable homes; Search homes looks up what was typed. Only homes whose
 * household turned discovery on can appear, and sending still needs a verified household on your block (the server
 * checks both). Parity: iOS `ChooseNeighborCard` (NeighborMessageModels.swift).
 */
@Composable
internal fun ChooseHomeCard(viewModel: NeighborMessageComposeViewModel) {
    val query by viewModel.recipientQuery.collectAsStateWithLifecycle()
    val search by viewModel.recipientSearch.collectAsStateWithLifecycle()
    val suggestions = rememberAddressSuggestions(nearHomeId = viewModel.homeId)
    val focus = LocalFocusManager.current
    val canSearch = viewModel.canSearch(query)
    val runSearch = {
        focus.clearFocus()
        suggestions?.dismiss()
        viewModel.searchRecipients()
    }

    Column(
        modifier = Modifier.fillMaxWidth().placeCard().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = "Choose a home",
            fontSize = 15.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appText,
        )
        Text(
            text =
                "Enter the house number and street. Only homes with discovery enabled appear; " +
                    "sending requires a verified household on your block.",
            fontSize = 13.sp,
            color = PantopusColors.appTextMuted,
        )
        OutlinedTextField(
            value = query,
            onValueChange = {
                viewModel.updateRecipientQuery(it)
                suggestions?.onTextChanged(it)
            },
            placeholder = { Text("House number and street") },
            singleLine = true,
            keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { if (canSearch) runSearch() }),
            modifier = Modifier.fillMaxWidth().testTag("neighbor.recipientQuery"),
        )
        Text(
            text = if (search is RecipientSearchState.Loading) "Searching…" else "Search homes",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (canSearch) PantopusColors.primary600 else PantopusColors.appTextMuted,
            modifier = Modifier.clickable(enabled = canSearch, role = Role.Button) { runSearch() }.testTag("neighbor.searchRecipients"),
        )
        AddressSuggestionList(suggestions, testTagPrefix = "neighbor.addressSuggestion") { picked ->
            focus.clearFocus()
            // The picked address is exact: look it up at once.
            picked.address?.takeIf { it.isNotBlank() }?.let { viewModel.searchRecipients(it) }
        }
        RecipientResults(search = search, onSelect = viewModel::selectRecipient)
    }
}

@Composable
private fun RecipientResults(
    search: RecipientSearchState,
    onSelect: (DiscoveredHomeDto) -> Unit,
) {
    when (search) {
        RecipientSearchState.Idle, RecipientSearchState.Loading -> Unit
        is RecipientSearchState.Error -> NeighborErrorBanner(message = search.message)
        is RecipientSearchState.Loaded ->
            if (search.homes.isEmpty()) {
                Text(
                    text =
                        "No selectable homes found. Check the number and street; private homes and your own " +
                            "household won't appear.",
                    fontSize = 13.sp,
                    color = PantopusColors.appTextMuted,
                )
            } else {
                Column(modifier = Modifier.firstTapClosesKeyboard()) {
                    search.homes.forEach { home -> RecipientRow(home = home, onSelect = onSelect) }
                }
            }
    }
}

@Composable
private fun RecipientRow(
    home: DiscoveredHomeDto,
    onSelect: (DiscoveredHomeDto) -> Unit,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clickable(role = Role.Button) { onSelect(home) }
                .padding(vertical = 8.dp)
                .testTag("neighbor.recipient.${home.id}"),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PlaceIconTile(icon = PantopusIcon.Home, tone = PlaceTileTone.HOME, size = 32.dp)
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = home.address.orEmpty(),
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text = listOfNotNull(home.city, home.state).joinToString(", "),
                fontSize = 12.sp,
                color = PantopusColors.appTextMuted,
            )
        }
    }
}

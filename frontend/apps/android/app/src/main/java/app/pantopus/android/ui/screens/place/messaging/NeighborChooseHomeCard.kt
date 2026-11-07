package app.pantopus.android.ui.screens.place.messaging

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.ui.components.AddressSuggestionList
import app.pantopus.android.ui.components.rememberAddressSuggestions
import app.pantopus.android.ui.screens.place.components.placeCard
import app.pantopus.android.ui.theme.PantopusColors

/**
 * Choose a home: the house number and street of any home on your block, with address suggestions (nearest your Home
 * first). A picked suggestion is checked at once; Use this address checks what was typed. The note reaches a verified
 * household if one lives there, and nothing here or after sending says whether one does. Parity: iOS
 * `ChooseNeighborCard` (NeighborMessageModels.swift).
 */
@Composable
internal fun ChooseHomeCard(viewModel: NeighborMessageComposeViewModel) {
    val query by viewModel.recipientQuery.collectAsStateWithLifecycle()
    val check by viewModel.addressCheck.collectAsStateWithLifecycle()
    val suggestions = rememberAddressSuggestions(nearHomeId = viewModel.homeId)
    val focus = LocalFocusManager.current
    val canUse = viewModel.canUseTyped(query)
    val useTyped = {
        focus.clearFocus()
        suggestions?.dismiss()
        viewModel.useTypedAddress()
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
                "Enter the house number and street of any home on your block. If a verified household lives there, " +
                    "they'll get your note. We won't tell you either way.",
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
            keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { if (canUse) useTyped() }),
            modifier = Modifier.fillMaxWidth().testTag("neighbor.recipientQuery"),
        )
        Text(
            text = if (check is AddressCheckState.Checking) "Checking…" else "Use this address",
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = if (canUse) PantopusColors.primary600 else PantopusColors.appTextMuted,
            modifier =
                Modifier
                    .clickable(enabled = canUse, role = Role.Button) { useTyped() }
                    .testTag("neighbor.useAddress"),
        )
        AddressSuggestionList(suggestions, testTagPrefix = "neighbor.addressSuggestion") { picked ->
            focus.clearFocus()
            viewModel.choosePicked(picked)
        }
        (check as? AddressCheckState.Refused)?.let { NeighborErrorBanner(message = it.message) }
    }
}

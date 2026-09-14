package app.pantopus.android.ui.screens.homes.postal

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

@Composable
internal fun HomePostalMailForm(
    state: HomePostalUiState,
    viewModel: HomePostalViewModel,
) {
    val focus = LocalFocusManager.current
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text("Confirm your mailing address", style = PantopusTextStyle.h3)
        HomePostalAddressField.entries.forEach { field ->
            val (label, value) =
                when (field) {
                    HomePostalAddressField.Line1 -> "Street address" to state.address.line1
                    HomePostalAddressField.Line2 -> "Apartment or unit (optional)" to state.address.line2
                    HomePostalAddressField.City -> "City" to state.address.city
                    HomePostalAddressField.State -> "State" to state.address.state
                    HomePostalAddressField.Zip -> "ZIP or postal code" to state.address.zip
                    HomePostalAddressField.Country -> "Country" to state.address.country
                }
            PantopusTextField(
                label = label,
                value = value,
                onValueChange = { viewModel.updateAddress(field, it) },
                modifier = Modifier.fillMaxWidth(),
                isRequired = field != HomePostalAddressField.Line2,
                fieldTestTag = "homePostal${field.name}",
                keyboardOptions = KeyboardOptions(autoCorrectEnabled = false, imeAction = ImeAction.Done),
            )
        }
        Text("Include your apartment or unit. The complete address is checked before mailing.", style = PantopusTextStyle.caption)
        PrimaryButton("Request postcard", {
            focus.clearFocus()
            viewModel.reviewMail()
        }, Modifier.testTag("homePostalRequestMail"), isEnabled = viewModel.canRequestMail)
    }
}

@Composable
internal fun HomePostalCodeForm(
    state: HomePostalUiState,
    viewModel: HomePostalViewModel,
) {
    val focus = LocalFocusManager.current
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
        Text("Enter the code from this postcard", style = PantopusTextStyle.h3)
        PantopusTextField(
            label = "Postcard code",
            value = state.codeInput,
            onValueChange = viewModel::updateCode,
            modifier = Modifier.fillMaxWidth(),
            isRequired = true,
            fieldTestTag = "homePostalCode",
            keyboardOptions =
                KeyboardOptions(
                    keyboardType = KeyboardType.Ascii,
                    autoCorrectEnabled = false,
                    imeAction = ImeAction.Done,
                ),
        )
        PrimaryButton("Verify this code", {
            focus.clearFocus()
            viewModel.verifyCode()
        }, Modifier.testTag("homePostalVerifyCode"), isEnabled = viewModel.canVerifyCode)
    }
}

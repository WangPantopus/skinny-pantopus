@file:Suppress("LongParameterList")

package app.pantopus.android.ui.screens.crewday.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import app.pantopus.android.data.api.models.geo.GeoSuggestion
import app.pantopus.android.ui.components.firstTapClosesKeyboard
import app.pantopus.android.ui.screens.plans.components.PlanFormCard
import app.pantopus.android.ui.screens.plans.components.PlanOptionRow
import app.pantopus.android.ui.screens.plans.components.PlanTextArea
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/**
 * An address typed with suggestions under it (the existing address autocomplete): a household's home on "Your
 * price", a crew's center on "Where and when". Picking a suggestion is the only way to set the address.
 */
@Composable
fun CrewDayAddressField(
    query: String,
    onQuery: (String) -> Unit,
    suggestions: List<GeoSuggestion>,
    onPick: (GeoSuggestion) -> Unit,
    label: String,
    placeholder: String,
    modifier: Modifier = Modifier,
    testTag: String? = null,
) {
    Column(modifier = modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        Column(modifier = testTag?.let { Modifier.testTag(it) } ?: Modifier) {
            PlanTextArea(
                value = query,
                onValue = onQuery,
                placeholder = placeholder,
                label = label,
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Search),
            )
        }
        if (suggestions.isNotEmpty()) {
            PlanFormCard(modifier = Modifier.firstTapClosesKeyboard()) {
                suggestions.forEachIndexed { index, suggestion ->
                    PlanOptionRow(
                        first = index == 0,
                        onClick = { onPick(suggestion) },
                        modifier = Modifier.testTag("${testTag ?: "crewDayAddress"}Suggestion"),
                    ) {
                        PantopusIconImage(
                            icon = PantopusIcon.MapPin,
                            contentDescription = null,
                            size = Spacing.s4,
                            tint = PantopusColors.appTextSecondary,
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = suggestion.primaryText,
                                style = PantopusTextStyle.body.copy(fontWeight = FontWeight.SemiBold),
                                color = PantopusColors.appText,
                            )
                            suggestion.secondaryText?.takeIf { it.isNotBlank() }?.let {
                                Text(text = it, style = PantopusTextStyle.small, color = PantopusColors.appTextSecondary)
                            }
                        }
                    }
                }
            }
        }
    }
}

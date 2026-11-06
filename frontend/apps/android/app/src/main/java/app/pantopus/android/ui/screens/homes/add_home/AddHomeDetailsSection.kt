@file:Suppress("PackageNaming", "LongMethod", "LongParameterList", "MagicNumber")

package app.pantopus.android.ui.screens.homes.add_home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import app.pantopus.android.core.LaunchFeatures
import app.pantopus.android.data.api.models.homes.PropertySuggestionsFields
import app.pantopus.android.data.api.models.homes.RecordProvenanceDto
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import java.text.NumberFormat

/** 1 dp hairline — off the on-scale ramp, so not a token. */
internal val ADD_HOME_HAIRLINE: Dp = 1.dp

/**
 * A12.2 — the Add-Home wizard's property Details block. Ports RN's
 * `src/components/homes/DetailsStep.tsx`: a public-records card fed by
 * `POST /api/homes/property-suggestions` (county record → heuristics → optional
 * LLM), followed by the eight editable fields — nickname, home type,
 * bedrooms, bathrooms, home size, lot size, year built and description.
 *
 * It renders inside the wizard's Confirm step, directly under the address
 * confirmation, because that step is already "review what we found for
 * this property before continuing".
 */
@Composable
internal fun AddHomeDetailsSection(
    state: AddHomeUiState,
    vm: AddHomeWizardViewModel,
) {
    val suggestions = state.propertySuggestions
    val hasRecord = suggestions?.hasPublicRecord == true
    val buildingOnly = suggestions?.isBuildingOnly == true
    // While the county record is on its way, the fields it fills say so.
    val lookingUp = "Looking up…".takeIf { state.propertyLookupPending }
    // Beside a field the person changed, once the record names its source.
    val named = suggestions?.provenance != null
    val recorded = suggestions?.suggestions
    val ownEntry = { value: String, record: String? -> "Your entry".takeIf { named && value.isNotEmpty() && value != record } }
    Column(
        modifier = Modifier.fillMaxWidth().testTag("addHomeDetailsSection"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s4),
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text =
                    when {
                        hasRecord && !buildingOnly -> "Review public property details"
                        state.propertyLookupComplete -> "Confirm property details"
                        else -> "Tell us about your home"
                    },
                style = PantopusTextStyle.body,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appText,
            )
            Text(
                text =
                    when {
                        buildingOnly -> state.propertyLookupMessage
                        hasRecord ->
                            "We found public records for this address. Check the details, " +
                                "then edit anything that looks off."
                        state.propertyLookupComplete ->
                            "Confirm the basic home details before continuing."
                        state.propertyLookupPending ->
                            "Looking up public records for this address. The details below fill in by themselves."
                        else -> "All optional — you can always add these later."
                    },
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }

        when {
            state.isLoadingPropertySuggestions || state.propertyLookupPending -> PublicRecordsSkeleton()
            state.propertyLookupComplete ->
                PublicRecordsCard(
                    hasRecord = hasRecord,
                    provenance = suggestions?.provenance,
                    message = state.propertyLookupMessage,
                    fields = suggestions?.suggestions,
                    sources = suggestions?.fieldSources.orEmpty(),
                    tags = suggestions?.fieldTags.orEmpty(),
                )
        }

        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            Text(
                text = "Editable details",
                style = PantopusTextStyle.overline,
                color = PantopusColors.appTextSecondary,
            )
            AddHomeTextField(
                label = "Nickname",
                placeholder = "e.g., Our Cozy Apartment",
                value = state.form.details.nickname,
                onValueChange = vm::updateNickname,
                testTag = "addHome_nickname",
            )
            HomeTypeChips(selected = state.form.details.homeType, onSelect = vm::selectHomeType)
            // Movers first (Wedge v2 D5): one tap, and the place page opens on the first-week checklist.
            Row(
                modifier = Modifier.fillMaxWidth().testTag("addHome_justMoved"),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Just moved here",
                        style = PantopusTextStyle.body,
                        fontWeight = FontWeight.SemiBold,
                        color = PantopusColors.appText,
                    )
                    Text(
                        // Launch cut #10 (Mailbox): the previous resident's mail is handled in the mailbox.
                        if (LaunchFeatures.mailbox) {
                            "We'll start you on the first week: pickup day, the previous resident's mail, your districts."
                        } else {
                            "We'll start you on the first week: pickup day, your districts, and who's on the block."
                        },
                        style = PantopusTextStyle.small,
                        color = PantopusColors.appTextSecondary,
                    )
                }
                Switch(checked = state.form.details.justMoved, onCheckedChange = vm::setJustMoved)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                AddHomeTextField(
                    label = "Bedrooms",
                    placeholder = lookingUp ?: "3",
                    value = state.form.details.bedrooms,
                    onValueChange = vm::updateBedrooms,
                    tag = ownEntry(state.form.details.bedrooms, recorded?.bedrooms?.toString()),
                    keyboardType = KeyboardType.Number,
                    modifier = Modifier.weight(1f),
                    testTag = "addHome_bedrooms",
                )
                AddHomeTextField(
                    label = "Bathrooms",
                    placeholder = lookingUp ?: "2",
                    value = state.form.details.bathrooms,
                    onValueChange = vm::updateBathrooms,
                    tag = ownEntry(state.form.details.bathrooms, recorded?.bathrooms?.let(AddHomeWizardViewModel::trimTrailingZero)),
                    keyboardType = KeyboardType.Decimal,
                    modifier = Modifier.weight(1f),
                    testTag = "addHome_bathrooms",
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                AddHomeTextField(
                    label = "Home size (sq ft)",
                    placeholder = lookingUp ?: "e.g. 1200",
                    value = state.form.details.sqFt,
                    onValueChange = vm::updateSqFt,
                    tag = ownEntry(state.form.details.sqFt, recorded?.sqFt?.toString()),
                    optional = true,
                    keyboardType = KeyboardType.Number,
                    modifier = Modifier.weight(1f),
                    testTag = "addHome_sqFt",
                )
                AddHomeTextField(
                    label = "Lot size (sq ft)",
                    placeholder = lookingUp ?: "e.g. 5000",
                    value = state.form.details.lotSqFt,
                    onValueChange = vm::updateLotSqFt,
                    tag = ownEntry(state.form.details.lotSqFt, recorded?.lotSqFt?.toString()),
                    optional = true,
                    keyboardType = KeyboardType.Number,
                    modifier = Modifier.weight(1f),
                    testTag = "addHome_lotSqFt",
                )
            }
            AddHomeTextField(
                label = "Year built",
                placeholder = lookingUp ?: "e.g. 2017",
                value = state.form.details.yearBuilt,
                onValueChange = vm::updateYearBuilt,
                tag = ownEntry(state.form.details.yearBuilt, recorded?.yearBuilt?.toString()),
                optional = true,
                keyboardType = KeyboardType.Number,
                testTag = "addHome_yearBuilt",
            )
            AddHomeTextField(
                label = "Description",
                placeholder = "Describe your home…",
                value = state.form.details.description,
                onValueChange = vm::updateDescription,
                optional = true,
                singleLine = false,
                testTag = "addHome_description",
            )
        }
    }
}

@Composable
private fun HomeTypeChips(
    selected: AddHomeHomeType,
    onSelect: (AddHomeHomeType) -> Unit,
) {
    Column(
        modifier = Modifier.testTag("addHome_homeTypePicker"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = "Home Type",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            AddHomeHomeType.entries.forEach { type ->
                val isSelected = type == selected
                Text(
                    text = type.label,
                    style = PantopusTextStyle.caption,
                    fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal,
                    color = if (isSelected) PantopusColors.appTextInverse else PantopusColors.appText,
                    modifier =
                        Modifier
                            .clip(RoundedCornerShape(Radii.pill))
                            .background(
                                if (isSelected) PantopusColors.primary600 else PantopusColors.appSurface,
                            ).border(
                                width = ADD_HOME_HAIRLINE,
                                color = if (isSelected) PantopusColors.primary600 else PantopusColors.appBorder,
                                shape = RoundedCornerShape(Radii.pill),
                            ).selectable(
                                selected = isSelected,
                                role = Role.RadioButton,
                                onClick = { onSelect(type) },
                            ).padding(horizontal = Spacing.s3, vertical = Spacing.s2)
                            .testTag("addHome_homeType_${type.wireValue}"),
                )
            }
        }
    }
}

/**
 * The public records card. Renders the structured fields the lookup returned
 * and where each came from, or the explanatory copy when nothing came back.
 */
@Composable
private fun PublicRecordsCard(
    hasRecord: Boolean,
    provenance: RecordProvenanceDto?,
    message: String,
    fields: PropertySuggestionsFields?,
    sources: Map<String, String>,
    tags: Map<String, String>,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(ADD_HOME_HAIRLINE, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("addHome_publicRecordsCard"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(
            text = provenance?.title?.takeIf { hasRecord } ?: "Public records",
            style = PantopusTextStyle.caption,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.appTextSecondary,
        )
        Text(
            text = if (hasRecord) provenance?.label ?: "Data from public records." else message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
        )
        if (hasRecord) {
            publicRecordRows(fields, sources, tags).forEach { row ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = row.label,
                        style = PantopusTextStyle.caption,
                        color = PantopusColors.appTextSecondary,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
                        Text(
                            text = row.value,
                            style = PantopusTextStyle.caption,
                            fontWeight = FontWeight.Medium,
                            color = PantopusColors.appText,
                        )
                        row.source?.let { source ->
                            Text(
                                text = source.uppercase(),
                                style = PantopusTextStyle.overline,
                                color = PantopusColors.appTextMuted,
                            )
                        }
                    }
                }
            }
        }
    }
}

private data class PublicRecordRow(
    val label: String,
    val value: String,
    val source: String?,
)

/** The server's tag for a field, or plain words for where it came from. */
private fun fieldTag(
    field: String,
    sources: Map<String, String>,
    tags: Map<String, String>,
): String? =
    tags[field]
        ?: when (sources[field]) {
            "attom", "record" -> "Public record"
            "heuristic" -> "Address hint"
            "llm" -> "Estimate"
            else -> null
        }

private fun publicRecordRows(
    fields: PropertySuggestionsFields?,
    sources: Map<String, String>,
    tags: Map<String, String>,
): List<PublicRecordRow> {
    if (fields == null) return emptyList()
    val rows = mutableListOf<PublicRecordRow>()
    fields.homeType?.let {
        rows.add(
            PublicRecordRow(
                "Property type",
                AddHomeHomeType.fromCanonical(it)?.label ?: it,
                fieldTag("home_type", sources, tags),
            ),
        )
    }
    fields.bedrooms?.let { rows.add(PublicRecordRow("Bedrooms", it.toString(), fieldTag("bedrooms", sources, tags))) }
    fields.bathrooms?.let {
        val text = if (it == Math.floor(it)) it.toInt().toString() else it.toString()
        rows.add(PublicRecordRow("Bathrooms", text, fieldTag("bathrooms", sources, tags)))
    }
    fields.sqFt?.let { rows.add(PublicRecordRow("Home size", sqFtText(it), fieldTag("sq_ft", sources, tags))) }
    fields.lotSqFt?.let { rows.add(PublicRecordRow("Lot size", sqFtText(it), fieldTag("lot_sq_ft", sources, tags))) }
    fields.yearBuilt?.let {
        rows.add(PublicRecordRow("Year built", it.toString(), fieldTag("year_built", sources, tags)))
    }
    return rows
}

/**
 * Shimmer that mirrors the loaded public-records card geometry so the
 * lookup never shows a bare spinner.
 */
@Composable
private fun PublicRecordsSkeleton() {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(ADD_HOME_HAIRLINE, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(Spacing.s3)
                .testTag("addHome_publicRecordsSkeleton"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Shimmer(width = Spacing.s16 * 2, height = Spacing.s3)
        repeat(3) {
            Shimmer(width = Spacing.s16 * 4, height = Spacing.s3)
        }
    }
}

/**
 * Compact labelled text field shared by the Details and Setup blocks.
 * Mirrors iOS's `AddHomeTextField`.
 */
@Composable
internal fun AddHomeTextField(
    label: String,
    placeholder: String,
    value: String,
    onValueChange: (String) -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
    optional: Boolean = false,
    // Beside the label, where "Optional" goes: "Your entry".
    tag: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    isSecure: Boolean = false,
    errorText: String? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = label,
                style = PantopusTextStyle.caption,
                fontWeight = FontWeight.SemiBold,
                color = PantopusColors.appTextSecondary,
            )
            (tag ?: "Optional".takeIf { optional })?.let {
                Text(
                    text = it,
                    style = PantopusTextStyle.overline,
                    color = PantopusColors.appTextMuted,
                )
            }
        }
        TextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = {
                Text(
                    text = placeholder,
                    style = PantopusTextStyle.body,
                    color = PantopusColors.appTextMuted,
                )
            },
            singleLine = singleLine,
            isError = errorText != null,
            visualTransformation =
                if (isSecure) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            trailingIcon = trailing,
            textStyle = PantopusTextStyle.body,
            colors =
                TextFieldDefaults.colors(
                    focusedContainerColor = PantopusColors.appSurface,
                    unfocusedContainerColor = PantopusColors.appSurface,
                    errorContainerColor = PantopusColors.appSurface,
                    focusedIndicatorColor = PantopusColors.primary600,
                    unfocusedIndicatorColor = PantopusColors.appBorder,
                    errorIndicatorColor = PantopusColors.error,
                    focusedTextColor = PantopusColors.appText,
                    unfocusedTextColor = PantopusColors.appText,
                    cursorColor = PantopusColors.primary600,
                ),
            shape = RoundedCornerShape(Radii.md),
            modifier =
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = Spacing.s10 + Spacing.s2)
                    .testTag(testTag)
                    .semantics { contentDescription = label },
        )
        errorText?.let {
            Text(
                text = it,
                style = PantopusTextStyle.caption,
                color = PantopusColors.error,
                modifier = Modifier.testTag("${testTag}_error"),
            )
        }
    }
}

/** "45000 sq ft" with the locale's digit grouping ("45,000 sq ft"). */
private fun sqFtText(value: Number): String = "${NumberFormat.getIntegerInstance().format(value)} sq ft"

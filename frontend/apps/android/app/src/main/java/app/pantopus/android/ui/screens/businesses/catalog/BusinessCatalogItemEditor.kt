@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.businesses.catalog

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.ChipPicker
import app.pantopus.android.ui.components.ChipPickerOption
import app.pantopus.android.ui.components.ChipPickerStyle
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.form.FormFieldGroup
import app.pantopus.android.ui.screens.shared.form.FormShell
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Spacing

/** Sentinel id for the "None" category chip — null can't be a chip id. */
private const val NO_CATEGORY_ID = "__none__"

/**
 * Add / edit a catalog item. Reuses the A13 Form archetype ([FormShell] +
 * [FormFieldGroup] + [PantopusTextField] + [ChipPicker]) rather than a
 * bespoke sheet, and carries the same field vocabulary as the React Native
 * editor (`src/components/business/tabs/CatalogTab.tsx:296-369`): name ·
 * type · price · max price · price unit · duration · description ·
 * category · featured · active-vs-draft.
 *
 * Donation items hide the price inputs: the backend rejects a fixed price
 * on `kind = donation` (`DONATION_NO_FIXED_PRICE`,
 * `backend/routes/businesses.js:2350`).
 *
 * iOS twin: `Features/Businesses/Catalog/BusinessCatalogItemEditorView.swift`.
 */
@Composable
internal fun BusinessCatalogItemEditor(
    initialDraft: BusinessCatalogItemDraft,
    isEditing: Boolean,
    categories: List<BusinessCatalogCategoryRow>,
    isSaving: Boolean,
    onClose: () -> Unit,
    onSave: (BusinessCatalogItemDraft) -> Unit,
) {
    val original = initialDraft
    var draft by remember(initialDraft) { mutableStateOf(initialDraft) }

    FormShell(
        title = if (isEditing) "Edit item" else "New item",
        isValid = draft.isValid,
        isDirty = draft != original,
        onClose = onClose,
        onCommit = { onSave(draft) },
        rightActionLabel = null,
        bottomActionLabel = if (isEditing) "Save item" else "Add item",
        isSaving = isSaving,
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().testTag("businessCatalog.editor"),
            verticalArrangement = Arrangement.spacedBy(Spacing.s5),
        ) {
            FormFieldGroup(title = "Item") {
                PantopusTextField(
                    label = "Name",
                    value = draft.name,
                    onValueChange = { draft = draft.copy(name = it) },
                    placeholder = "e.g. Deep clean, Large pizza",
                    isRequired = true,
                    fieldTestTag = "businessCatalog.editor.name",
                )
                FieldLabel("Type")
                ChipPicker(
                    options =
                        BusinessCatalogKind.entries.map {
                            ChipPickerOption(id = it.wire, label = it.label, icon = it.icon)
                        },
                    selectedId = draft.kind.wire,
                    onSelectionChange = { draft = draft.copy(kind = BusinessCatalogKind.from(it)) },
                    style = ChipPickerStyle.Tinted,
                    testTag = "businessCatalog.editor.kind",
                )
                PantopusTextField(
                    label = "Description",
                    value = draft.description,
                    onValueChange = { draft = draft.copy(description = it) },
                    placeholder = "What's included?",
                    fieldTestTag = "businessCatalog.editor.description",
                )
            }

            if (draft.kind != BusinessCatalogKind.Donation) {
                FormFieldGroup(title = "Pricing") {
                    PantopusTextField(
                        label = "Price (cents)",
                        value = draft.priceCents,
                        onValueChange = { draft = draft.copy(priceCents = it) },
                        placeholder = "1500 = $15.00",
                        keyboardType = KeyboardType.Number,
                        fieldTestTag = "businessCatalog.editor.price",
                    )
                    PantopusTextField(
                        label = "Max price (cents)",
                        value = draft.priceMaxCents,
                        onValueChange = { draft = draft.copy(priceMaxCents = it) },
                        placeholder = "For a price range",
                        keyboardType = KeyboardType.Number,
                        fieldTestTag = "businessCatalog.editor.priceMax",
                    )
                    PantopusTextField(
                        label = "Price unit",
                        value = draft.priceUnit,
                        onValueChange = { draft = draft.copy(priceUnit = it) },
                        placeholder = "e.g. hour, day, visit",
                        fieldTestTag = "businessCatalog.editor.priceUnit",
                    )
                    PantopusTextField(
                        label = "Duration (minutes)",
                        value = draft.durationMinutes,
                        onValueChange = { draft = draft.copy(durationMinutes = it) },
                        placeholder = "e.g. 60",
                        keyboardType = KeyboardType.Number,
                        fieldTestTag = "businessCatalog.editor.duration",
                    )
                }
            }

            FormFieldGroup(title = "Placement") {
                if (categories.isNotEmpty()) {
                    FieldLabel("Category")
                    ChipPicker(
                        options =
                            listOf(ChipPickerOption(id = NO_CATEGORY_ID, label = "None")) +
                                categories.map { ChipPickerOption(id = it.id, label = it.name) },
                        selectedId = draft.categoryId ?: NO_CATEGORY_ID,
                        onSelectionChange = {
                            draft = draft.copy(categoryId = if (it == NO_CATEGORY_ID) null else it)
                        },
                        style = ChipPickerStyle.Tinted,
                        testTag = "businessCatalog.editor.category",
                    )
                }
                ToggleRow(
                    title = "Featured",
                    subtitle = "Pin this to the top of your public page.",
                    checked = draft.isFeatured,
                    onToggle = { draft = draft.copy(isFeatured = it) },
                    testTag = "businessCatalog.editor.featured",
                )
                ToggleRow(
                    title = "Save as draft",
                    subtitle = "Drafts stay hidden from neighbors until you switch them to active.",
                    checked = draft.isDraft,
                    onToggle = { draft = draft.copy(isDraft = it) },
                    testTag = "businessCatalog.editor.draft",
                )
            }
        }
    }
}

@Composable
private fun FieldLabel(text: String) {
    Text(
        text = text,
        style = PantopusTextStyle.caption,
        color = PantopusColors.appTextSecondary,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun ToggleRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    onToggle: (Boolean) -> Unit,
    testTag: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = subtitle,
                color = PantopusColors.appTextSecondary,
                fontSize = 11.sp,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        Switch(
            checked = checked,
            onCheckedChange = onToggle,
            colors =
                SwitchDefaults.colors(
                    checkedThumbColor = PantopusColors.appTextInverse,
                    checkedTrackColor = PantopusColors.business,
                ),
            modifier = Modifier.testTag(testTag),
        )
    }
}

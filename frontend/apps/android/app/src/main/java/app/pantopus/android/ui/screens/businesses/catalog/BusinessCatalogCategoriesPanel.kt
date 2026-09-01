@file:Suppress("PackageNaming", "MagicNumber", "LongMethod", "LongParameterList")

package app.pantopus.android.ui.screens.businesses.catalog

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.components.PantopusTextField
import app.pantopus.android.ui.screens.shared.content_detail.ContentDetailTopBar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * Category manager for the owner catalog. Mirrors the React Native
 * "Categories" panel (`CatalogTab.tsx:205-232`) — list, add, and delete —
 * and adds the rename the backend already supports
 * (`PATCH …/catalog/categories/:catId`, `backend/routes/businesses.js:2277`).
 *
 * Deleting names the category in the confirm, per the destructive-action
 * rule.
 *
 * iOS twin: `Features/Businesses/Catalog/BusinessCatalogCategoriesView.swift`.
 */
@Composable
internal fun BusinessCatalogCategoriesPanel(
    categories: List<BusinessCatalogCategoryRow>,
    isSaving: Boolean,
    onClose: () -> Unit,
    onCreate: (String, (Boolean) -> Unit) -> Unit,
    onRename: (String, String) -> Unit,
    onDelete: (String) -> Unit,
) {
    var newName by remember { mutableStateOf("") }
    var renameTarget by remember { mutableStateOf<BusinessCatalogCategoryRow?>(null) }
    var renameText by remember { mutableStateOf("") }
    var pendingDelete by remember { mutableStateOf<BusinessCatalogCategoryRow?>(null) }

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .background(PantopusColors.appBg)
                .statusBarsPadding()
                .testTag("businessCatalog.categoriesSheet"),
    ) {
        ContentDetailTopBar(title = "Categories", onBack = onClose)
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = Spacing.s4, vertical = Spacing.s4),
            verticalArrangement = Arrangement.spacedBy(Spacing.s3),
        ) {
            if (categories.isEmpty()) {
                Text(
                    text =
                        "No categories yet. Group your services and products so neighbors " +
                            "can scan your page faster.",
                    color = PantopusColors.appTextSecondary,
                    fontSize = 12.5.sp,
                    modifier = Modifier.testTag("businessCatalog.categoriesSheet.empty"),
                )
            } else {
                Column(
                    modifier =
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(Radii.lg))
                            .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                            .background(PantopusColors.appSurface),
                ) {
                    categories.forEachIndexed { index, category ->
                        CategoryRow(
                            category = category,
                            onRename = {
                                renameText = category.name
                                renameTarget = category
                            },
                            onDelete = { pendingDelete = category },
                        )
                        if (index < categories.size - 1) {
                            HorizontalDivider(
                                color = PantopusColors.appBorderSubtle,
                                modifier = Modifier.padding(start = 14.dp),
                            )
                        }
                    }
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
            ) {
                PantopusTextField(
                    label = "New category",
                    value = newName,
                    onValueChange = { newName = it },
                    modifier = Modifier.weight(1f),
                    placeholder = "e.g. Giving, Repairs",
                    fieldTestTag = "businessCatalog.newCategoryName",
                )
                val canAdd = newName.trim().isNotEmpty() && !isSaving
                Box(
                    modifier =
                        Modifier
                            .heightIn(min = 44.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .background(PantopusColors.business)
                            .alpha(if (canAdd) 1f else 0.5f)
                            .clickable(enabled = canAdd) {
                                onCreate(newName) { ok -> if (ok) newName = "" }
                            }
                            .padding(horizontal = Spacing.s4)
                            .semantics { contentDescription = "Add category" }
                            .testTag("businessCatalog.addCategory"),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = "Add",
                        color = PantopusColors.appTextInverse,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
    }

    renameTarget?.let { category ->
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            title = { Text(text = "Rename category") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    Text(text = "Rename “${category.name}”.", color = PantopusColors.appTextSecondary, fontSize = 12.5.sp)
                    PantopusTextField(
                        label = "Category name",
                        value = renameText,
                        onValueChange = { renameText = it },
                        fieldTestTag = "businessCatalog.renameCategoryField",
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val name = renameText
                    renameTarget = null
                    onRename(category.id, name)
                }) {
                    Text(text = "Save")
                }
            },
            dismissButton = {
                TextButton(onClick = { renameTarget = null }) { Text(text = "Cancel") }
            },
            modifier = Modifier.testTag("businessCatalog.renameCategoryDialog"),
        )
    }

    pendingDelete?.let { category ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text(text = "Delete category") },
            text = {
                Text(text = "Delete “${category.name}”? Items keep their prices but lose this grouping.")
            },
            confirmButton = {
                TextButton(onClick = {
                    pendingDelete = null
                    onDelete(category.id)
                }) {
                    Text(text = "Delete", color = PantopusColors.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingDelete = null }) { Text(text = "Cancel") }
            },
            modifier = Modifier.testTag("businessCatalog.deleteCategoryConfirm"),
        )
    }
}

@Composable
private fun CategoryRow(
    category: BusinessCatalogCategoryRow,
    onRename: () -> Unit,
    onDelete: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Tag,
            contentDescription = null,
            size = 16.dp,
            strokeWidth = 2f,
            tint = PantopusColors.business,
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = category.name,
                color = PantopusColors.appText,
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
            )
            category.detail?.takeIf { it.isNotEmpty() }?.let {
                Text(text = it, color = PantopusColors.appTextSecondary, fontSize = 11.sp, maxLines = 1)
            }
        }
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clickable(onClick = onRename)
                    .semantics { contentDescription = "Rename ${category.name}" }
                    .testTag("businessCatalog.renameCategory.${category.id}"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Pencil,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2f,
                tint = PantopusColors.appTextSecondary,
            )
        }
        Box(
            modifier =
                Modifier
                    .size(30.dp)
                    .clickable(onClick = onDelete)
                    .semantics { contentDescription = "Delete ${category.name}" }
                    .testTag("businessCatalog.deleteCategory.${category.id}"),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Trash2,
                contentDescription = null,
                size = 15.dp,
                strokeWidth = 2f,
                tint = PantopusColors.error,
            )
        }
    }
}

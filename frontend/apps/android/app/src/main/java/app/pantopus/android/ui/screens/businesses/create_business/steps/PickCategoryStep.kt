@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.businesses.create_business.steps

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.businesses.create_business.BusinessCategory
import app.pantopus.android.ui.screens.businesses.create_business.CreateBusinessUiState
import app.pantopus.android.ui.screens.businesses.create_business.WhatYouGetItem
import app.pantopus.android.ui.screens.shared.wizard.blocks.HeadlineBlock
import app.pantopus.android.ui.screens.shared.wizard.blocks.SubcopyBlock
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusElevation
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing
import app.pantopus.android.ui.theme.pantopusShadow

/**
 * A12.10 Frame 1 (populated) — pick-category step content. Composed
 * inside `WizardShell` whose top bar + progress + sticky CTA chrome is
 * owned by the parent screen.
 */
@Composable
fun PickCategoryStep(
    state: CreateBusinessUiState,
    onSearchTextChanged: (String) -> Unit,
    onPickCategory: (BusinessCategory) -> Unit,
) {
    BusinessIdentityChip()

    HeadlineBlock("What does your business do?")
    SubcopyBlock(
        "Pick the closest fit — this shapes your listings, tax setup, and the badges " +
            "customers see. You can refine the specifics on step 3.",
    )

    BusinessSearchField(value = state.searchText, focused = false, onChange = onSearchTextChanged)

    CategoryGrid(selected = state.selectedCategory, onPick = onPickCategory)

    val selected = state.selectedCategory
    if (state.whatYouGetItems.isNotEmpty() && selected != null) {
        WhatYouGetStrip(category = selected, items = state.whatYouGetItems)
    }

    StepPreviewMeta()
}

// MARK: - Business identity chip (violet)

@Composable
internal fun BusinessIdentityChip() {
    Row(
        modifier =
            Modifier
                .clip(CircleShape)
                .background(PantopusColors.businessBg)
                .padding(horizontal = Spacing.s3, vertical = Spacing.s1)
                .semantics { contentDescription = "Business, new" }
                .testTag("createBusinessIdentityChip"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Building2,
            contentDescription = null,
            size = 11.dp,
            tint = PantopusColors.business,
        )
        Text(
            text = "BUSINESS · NEW",
            style = PantopusTextStyle.overline,
            color = PantopusColors.business,
        )
    }
}

// MARK: - Category grid (2 × 4)

@Composable
internal fun CategoryGrid(
    selected: BusinessCategory?,
    onPick: (BusinessCategory) -> Unit,
) {
    val rows = BusinessCategory.entries.chunked(2)
    Column(
        modifier = Modifier.fillMaxWidth().testTag("createBusinessCategoryGrid"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        rows.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            ) {
                row.forEach { category ->
                    CategoryCard(
                        category = category,
                        selected = selected == category,
                        onPick = { onPick(category) },
                        modifier = Modifier.weight(1f),
                    )
                }
                if (row.size == 1) {
                    Box(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun CategoryCard(
    category: BusinessCategory,
    selected: Boolean,
    onPick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val shape = RoundedCornerShape(Radii.lg)
    val borderColor = if (selected) category.accent else PantopusColors.appBorder
    val borderWidth = if (selected) 1.5.dp else 1.dp
    val shadow =
        if (selected) {
            PantopusElevation(
                color = category.accent,
                alpha = 0.13f,
                radius = 16.dp,
                offsetX = 0.dp,
                offsetY = 6.dp,
            )
        } else {
            PantopusElevation(
                color = Color.Black,
                alpha = 0.03f,
                radius = 2.dp,
                offsetX = 0.dp,
                offsetY = 1.dp,
            )
        }
    Box(
        modifier =
            modifier
                .heightIn(min = 110.dp)
                .pantopusShadow(shadow, shape = shape)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(borderWidth, borderColor, shape)
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = onPick,
                ).semantics {
                    role = Role.Button
                    contentDescription = "${category.label}. ${category.subcopy}"
                    this.selected = selected
                }.testTag("createBusinessCategoryTile_${category.name.lowercase()}"),
    ) {
        Column(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(Spacing.s3),
            verticalArrangement = Arrangement.spacedBy(Spacing.s2),
        ) {
            Box(
                modifier =
                    Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(
                            if (selected) category.accent else category.accent.copy(alpha = 0.1f),
                        ),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = category.icon,
                    contentDescription = null,
                    size = 16.dp,
                    tint = if (selected) PantopusColors.appTextInverse else category.accent,
                )
            }
            Text(
                text = category.label,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
            Text(
                text = category.subcopy,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (selected) {
            Box(
                modifier =
                    Modifier
                        .align(Alignment.TopEnd)
                        .padding(Spacing.s2)
                        .size(18.dp)
                        .clip(CircleShape)
                        .background(category.accent),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 11.dp,
                    strokeWidth = 3.5f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

// MARK: - "What you'll get" strip

@Composable
private fun WhatYouGetStrip(
    category: BusinessCategory,
    items: List<WhatYouGetItem>,
) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.businessBg.copy(alpha = 0.6f))
                .border(1.dp, PantopusColors.businessBg, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s4, vertical = Spacing.s3)
                .testTag("createBusinessWhatYouGetStrip"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s3),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.s1),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            PantopusIconImage(
                icon = PantopusIcon.Sparkles,
                contentDescription = null,
                size = 11.dp,
                tint = PantopusColors.businessDark,
            )
            Text(
                text = "WHAT YOU'LL GET WITH ${category.label.uppercase()}",
                style = PantopusTextStyle.overline,
                color = PantopusColors.businessDark,
            )
        }
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            items.forEach { item ->
                WhatYouGetRow(item)
            }
        }
    }
}

@Composable
private fun WhatYouGetRow(item: WhatYouGetItem) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.Top,
    ) {
        Box(
            modifier =
                Modifier
                    .size(20.dp)
                    .clip(RoundedCornerShape(Radii.sm))
                    .background(PantopusColors.appSurface),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = item.icon,
                contentDescription = null,
                size = 11.dp,
                strokeWidth = 2.4f,
                tint = PantopusColors.business,
            )
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.label,
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
            Text(
                text = item.subcopy,
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
    }
}

// MARK: - Step preview meta row

@Composable
private fun StepPreviewMeta() {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(Radii.lg))
                .background(PantopusColors.appSurface)
                .border(1.dp, PantopusColors.appBorder, RoundedCornerShape(Radii.lg))
                .padding(horizontal = Spacing.s3, vertical = Spacing.s3)
                .testTag("createBusinessStepPreview"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Map,
            contentDescription = null,
            size = 13.dp,
            tint = PantopusColors.appTextSecondary,
        )
        Text(
            text = "Next: legal info · profile · confirm",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextStrong,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "~6 min",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextMuted,
        )
    }
}

// MARK: - Search field (shared with the search frame)

@Composable
internal fun BusinessSearchField(
    value: String,
    focused: Boolean,
    onChange: (String) -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    val borderColor =
        if (focused || value.isNotEmpty()) PantopusColors.business else PantopusColors.appBorder
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .heightIn(min = 44.dp)
                .clip(shape)
                .background(PantopusColors.appSurface)
                .border(1.dp, borderColor, shape)
                .padding(horizontal = Spacing.s3),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        PantopusIconImage(
            icon = PantopusIcon.Search,
            contentDescription = null,
            size = 16.dp,
            tint = PantopusColors.appTextSecondary,
        )
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = PantopusTextStyle.body.copy(color = PantopusColors.appText),
            cursorBrush = SolidColor(PantopusColors.business),
            keyboardOptions =
                KeyboardOptions(
                    capitalization = KeyboardCapitalization.None,
                    autoCorrect = false,
                    imeAction = ImeAction.Search,
                ),
            modifier =
                Modifier
                    .weight(1f)
                    .testTag("createBusinessSearchField"),
            decorationBox = { inner ->
                if (value.isEmpty()) {
                    Text(
                        text = "Search categories — e.g. \"tutor\", \"lawn care\"",
                        style = PantopusTextStyle.body,
                        color = PantopusColors.appTextMuted,
                    )
                }
                inner()
            },
        )
        if (value.isNotEmpty()) {
            Box(
                modifier =
                    Modifier
                        .size(22.dp)
                        .clip(CircleShape)
                        .background(PantopusColors.appSurfaceSunken)
                        .clickable { onChange("") }
                        .semantics { contentDescription = "Clear search" }
                        .testTag("createBusinessSearchClear"),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.X,
                    contentDescription = null,
                    size = 12.dp,
                    tint = PantopusColors.appTextSecondary,
                )
            }
        }
    }
}

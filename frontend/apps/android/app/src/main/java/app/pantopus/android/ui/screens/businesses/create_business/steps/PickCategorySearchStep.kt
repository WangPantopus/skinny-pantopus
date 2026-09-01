@file:Suppress("PackageNaming", "LongMethod", "MagicNumber")

package app.pantopus.android.ui.screens.businesses.create_business.steps

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.screens.businesses.create_business.CategorySearchHit
import app.pantopus.android.ui.screens.businesses.create_business.CreateBusinessUiState
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
 * A12.10 Frame 2 (search) — active-typeahead variant of the
 * pick-category step. The chip + headline are shared with Frame 1, but
 * the body swaps to a focused search field + ranked-results header +
 * up to 3 hits with the matched substring highlighted + a dashed-violet
 * "Add as custom category" fallback row.
 */
@Composable
fun PickCategorySearchStep(
    state: CreateBusinessUiState,
    onSearchTextChanged: (String) -> Unit,
    onPickHit: (CategorySearchHit) -> Unit,
    onSubmitCustom: () -> Unit,
) {
    val query = state.searchText.trim()
    BusinessIdentityChip()

    HeadlineBlock("What does your business do?")
    SubcopyBlock(
        "Pick the closest fit — this shapes your listings, tax setup, and the badges " +
            "customers see.",
    )

    BusinessSearchField(value = state.searchText, focused = true, onChange = onSearchTextChanged)

    SearchResultsHeader(
        matchCount = state.searchHits.size,
        query = query,
    )

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
        state.searchHits.forEach { hit ->
            SearchResultRow(
                hit = hit,
                query = query,
                selected = state.selectedCategory == hit.category,
                onPick = { onPickHit(hit) },
            )
        }
    }

    if (state.searchHits.isEmpty() && query.isNotEmpty()) {
        // No-match fallback from the design pack. Submitting is still
        // logged-only — there is no POST /custom-categories to invent — so
        // the row's subcopy promises exactly what happens.
        AddCustomCategoryRow(
            label = query,
            isSubmitting = state.isSubmittingCustom,
            onTap = onSubmitCustom,
        )
    } else {
        Text(
            text = "Custom categories aren't available yet. Pick a listed category above.",
            style = PantopusTextStyle.caption,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.testTag("createBusinessCustomCategoryBlocked"),
        )
    }

    state.submitError?.let { message ->
        Text(
            text = message,
            style = PantopusTextStyle.caption,
            color = PantopusColors.error,
            modifier = Modifier.testTag("createBusinessSubmitError"),
        )
    }
}

// MARK: - Search results header

@Composable
private fun SearchResultsHeader(
    matchCount: Int,
    query: String,
) {
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
                .testTag("createBusinessSearchResultsHeader"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val matchesLabel = if (matchCount == 1) "match" else "matches"
        Text(
            text = "$matchCount $matchesLabel FOR \"$query\"".uppercase(),
            style = PantopusTextStyle.overline,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = "Browse all",
            style = PantopusTextStyle.caption,
            color = PantopusColors.business,
            modifier =
                Modifier
                    .clickable { /* clears on next user gesture */ }
                    .testTag("createBusinessBrowseAll"),
        )
    }
}

// MARK: - Search result row

@Composable
private fun SearchResultRow(
    hit: CategorySearchHit,
    query: String,
    selected: Boolean,
    onPick: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    val borderColor = if (selected) hit.category.accent else PantopusColors.appBorder
    val borderWidth = if (selected) 1.5.dp else 1.dp
    val shadow =
        if (selected) {
            PantopusElevation(
                color = hit.category.accent,
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
    Row(
        modifier =
            Modifier
                .fillMaxWidth()
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
                    contentDescription = "${hit.label}, in ${hit.category.label}"
                    this.selected = selected
                }.padding(Spacing.s3)
                .testTag("createBusinessSearchResult_${hit.id}"),
        horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier =
                Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(Radii.md))
                    .background(
                        if (selected) hit.category.accent else hit.category.accent.copy(alpha = 0.1f),
                    ),
            contentAlignment = Alignment.Center,
        ) {
            PantopusIconImage(
                icon = hit.category.icon,
                contentDescription = null,
                size = 16.dp,
                tint = if (selected) PantopusColors.appTextInverse else hit.category.accent,
            )
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(Spacing.s1)) {
            Text(
                text = highlightedText(hit.label, query),
                style = PantopusTextStyle.body,
                color = PantopusColors.appText,
            )
            Text(
                text =
                    buildAnnotatedString {
                        append("in ")
                        withStyle(SpanStyle(color = PantopusColors.appTextStrong)) {
                            append(hit.category.label)
                        }
                    },
                style = PantopusTextStyle.caption,
                color = PantopusColors.appTextSecondary,
            )
        }
        if (selected) {
            Box(
                modifier =
                    Modifier
                        .size(20.dp)
                        .clip(CircleShape)
                        .background(hit.category.accent),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Check,
                    contentDescription = null,
                    size = 12.dp,
                    strokeWidth = 3f,
                    tint = PantopusColors.appTextInverse,
                )
            }
        }
    }
}

/**
 * Substring-matches [query] inside [text] (case-insensitive) and renders
 * the match with a violet pill highlight via [AnnotatedString]. Falls
 * back to plain text when the query doesn't occur in the label.
 */
private fun highlightedText(
    text: String,
    query: String,
): AnnotatedString {
    if (query.isEmpty()) return AnnotatedString(text)
    val idx = text.indexOf(query, ignoreCase = true)
    if (idx < 0) return AnnotatedString(text)
    return buildAnnotatedString {
        append(text.substring(0, idx))
        withStyle(
            SpanStyle(
                color = PantopusColors.businessDark,
                background = PantopusColors.businessBg,
            ),
        ) {
            append(text.substring(idx, idx + query.length))
        }
        append(text.substring(idx + query.length))
    }
}

// MARK: - Dashed-violet "Add as custom category" fallback row

/**
 * Spoken label for the fallback row. Matches iOS
 * `AddCustomCategoryRow.accessibilityLabel`.
 */
private fun customCategoryAccessibilityLabel(label: String): String =
    "Add $label as a custom category. " +
        "We'll pass the request on — custom categories aren't live yet."

@Composable
private fun AddCustomCategoryRow(
    label: String,
    isSubmitting: Boolean,
    onTap: () -> Unit,
) {
    val shape = RoundedCornerShape(Radii.lg)
    Box(
        modifier =
            Modifier
                .fillMaxWidth()
                .clip(shape)
                .background(PantopusColors.businessBg.copy(alpha = 0.6f))
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    enabled = !isSubmitting,
                    onClick = onTap,
                ).semantics {
                    role = Role.Button
                    contentDescription = customCategoryAccessibilityLabel(label)
                }.testTag("createBusinessAddCustomCategory"),
    ) {
        // Draw a dashed violet border via Canvas because Compose's `border()`
        // modifier doesn't accept dash patterns.
        Canvas(modifier = Modifier.matchParentSize()) {
            val stroke =
                Stroke(
                    width = 1.dp.toPx(),
                    pathEffect =
                        PathEffect.dashPathEffect(
                            floatArrayOf(4.dp.toPx(), 3.dp.toPx()),
                            0f,
                        ),
                )
            drawRoundRect(
                color = PantopusColors.business.copy(alpha = 0.33f),
                style = stroke,
                cornerRadius =
                    androidx.compose.ui.geometry.CornerRadius(
                        Radii.lg.toPx(),
                        Radii.lg.toPx(),
                    ),
            )
        }
        Row(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(Spacing.s3),
            horizontalArrangement = Arrangement.spacedBy(Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier =
                    Modifier
                        .size(28.dp)
                        .clip(RoundedCornerShape(Radii.md))
                        .background(PantopusColors.appSurface),
                contentAlignment = Alignment.Center,
            ) {
                PantopusIconImage(
                    icon = PantopusIcon.Plus,
                    contentDescription = null,
                    size = 14.dp,
                    strokeWidth = 2.5f,
                    tint = PantopusColors.business,
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Add \"$label\" as a custom category",
                    style = PantopusTextStyle.body,
                    color = PantopusColors.businessDark,
                )
                Text(
                    text = "We'll pass the request on — custom categories aren't live yet.",
                    style = PantopusTextStyle.caption,
                    color = PantopusColors.appTextSecondary,
                )
            }
            PantopusIconImage(
                icon = PantopusIcon.ArrowRight,
                contentDescription = null,
                size = 14.dp,
                tint = PantopusColors.business,
            )
        }
    }
}

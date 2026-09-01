@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.business_profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.pantopus.android.ui.components.Shimmer
import app.pantopus.android.ui.screens.businesses.page_blocks.BusinessPageBlocksPreview
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * C4 — the named custom-page section on the public business profile. Rendered
 * only when the entry point carried a slug (`pantopus://b/:username/:slug`, or
 * `pantopus://business/:username?pageSlug=…`). Mirrors RN
 * `src/app/business/[username].tsx:495-517` and iOS
 * `BusinessProfileNamedPageSection`.
 */
@Composable
internal fun BusinessProfileNamedPageSection(
    state: BusinessProfileNamedPageState,
    modifier: Modifier = Modifier,
) {
    when (state) {
        BusinessProfileNamedPageState.None -> Unit
        is BusinessProfileNamedPageState.Loading ->
            Section(title = state.title, modifier = modifier) {
                Column(
                    modifier = Modifier.fillMaxWidth().testTag("businessProfile.page.loading"),
                    verticalArrangement = Arrangement.spacedBy(Spacing.s2),
                ) {
                    Shimmer(width = 320.dp, height = 18.dp, cornerRadius = Radii.sm, modifier = Modifier.fillMaxWidth())
                    Shimmer(width = 320.dp, height = 72.dp, cornerRadius = Radii.md, modifier = Modifier.fillMaxWidth())
                }
            }
        is BusinessProfileNamedPageState.Failed ->
            Section(title = state.title, modifier = modifier) {
                Text(
                    text = state.message,
                    style = PantopusTextStyle.small,
                    color = PantopusColors.appTextSecondary,
                    modifier = Modifier.fillMaxWidth().testTag("businessProfile.page.error"),
                )
            }
        is BusinessProfileNamedPageState.Loaded ->
            Section(title = state.title, modifier = modifier) {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    if (!state.description.isNullOrEmpty()) {
                        Text(
                            text = state.description,
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                        )
                    }
                    if (state.blocks.isEmpty()) {
                        Text(
                            text = "This business page has no published content yet.",
                            style = PantopusTextStyle.small,
                            color = PantopusColors.appTextSecondary,
                            modifier = Modifier.testTag("businessProfile.page.empty"),
                        )
                    } else {
                        BusinessPageBlocksPreview(blocks = state.blocks)
                    }
                }
            }
    }
}

@Composable
private fun Section(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(top = Spacing.s4).testTag("businessProfile.page"),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) {
        Text(text = title, style = PantopusTextStyle.h3, color = PantopusColors.appTextStrong)
        content()
    }
}

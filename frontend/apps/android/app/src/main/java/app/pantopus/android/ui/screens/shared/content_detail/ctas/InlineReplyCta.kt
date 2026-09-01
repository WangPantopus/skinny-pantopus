@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.shared.content_detail.ctas

import androidx.compose.runtime.Composable

/**
 * `inline_reply` CTA slot for the Pulse post detail. The reply composer
 * is part of the body (see `BodyReactionsBody`), so this CTA renders
 * nothing — it exists as a named slot for symmetry with the design
 * vocabulary.
 */
@Composable
fun InlineReplyCta() {
    // Intentionally empty — composer lives inline in the body.
}

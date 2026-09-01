@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.shared.content_detail.ctas

/**
 * P6.5 — Per-kind sticky CTA model for the Public Profile detail.
 *
 * - [Persona] surfaces a single primary "Follow" CTA.
 * - [Local] surfaces a primary "Message" CTA + an outline "Connect" CTA.
 *
 * The CTAs track action states so the buttons reflect in-flight /
 * succeeded poses without re-fetching the profile.
 */
sealed interface ActionRowCtaKind {
    data class Persona(
        val followInFlight: Boolean,
        val isFollowing: Boolean,
        val onFollow: () -> Unit,
    ) : ActionRowCtaKind

    data class Local(
        val messageInFlight: Boolean,
        val connectInFlight: Boolean,
        val isConnectRequested: Boolean,
        val onMessage: () -> Unit,
        val onConnect: () -> Unit,
    ) : ActionRowCtaKind
}

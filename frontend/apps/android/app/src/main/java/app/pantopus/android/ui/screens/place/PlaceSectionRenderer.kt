package app.pantopus.android.ui.screens.place

import androidx.compose.runtime.Composable
import app.pantopus.android.data.api.models.place.PlaceSectionAccess
import app.pantopus.android.data.api.models.place.PlaceSectionEnvelope
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PlaceSectionStatus
import app.pantopus.android.ui.screens.place.components.PlaceDensityCard
import app.pantopus.android.ui.screens.place.components.PlaceLockedCard
import app.pantopus.android.ui.screens.place.components.PlaceSectionCard
import app.pantopus.android.ui.screens.place.components.PlaceSectionCardState
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Renders one PlaceIntelligence section envelope as the right card —
 * the port of `presentation.tsx` `renderSection` and the iOS
 * `PlaceSectionView`. block_density gets the DensityCard; locked sections
 * get a LockedCard routed by band; everything else is a SectionCard
 * driven by [PlacePresentation]. Reused by the dashboard + detail pages.
 */
@Composable
fun PlaceSectionView(
    env: PlaceSectionEnvelope,
    onOpen: (() -> Unit)? = null,
    onVerify: (() -> Unit)? = null,
    onClaim: (() -> Unit)? = null,
) {
    val lockHandler =
        if (env.band == app.pantopus.android.data.api.models.place.PlaceBand.D) onVerify else onClaim

    when {
        env.sectionId == PlaceSectionId.BLOCK_DENSITY -> {
            val density = env.blockDensity
            val hasData =
                density != null &&
                    (
                        env.status == PlaceSectionStatus.READY ||
                            env.status == PlaceSectionStatus.PARTIAL ||
                            env.status == PlaceSectionStatus.STALE
                    )
            when {
                env.access == PlaceSectionAccess.LOCKED ->
                    PlaceLockedCard(
                        title = "Verified homes nearby",
                        reason = PlacePresentation.lockReason(env),
                        cta = PlacePresentation.lockCta(env),
                        icon = PantopusIcon.Users,
                        onTap = lockHandler,
                    )
                hasData ->
                    PlaceDensityCard(
                        bucket = density!!.bucket,
                        label = density.label,
                        ctaTitle = null,
                        onTap = onOpen,
                    )
                else ->
                    PlaceSectionCard(
                        title = "Verified homes nearby",
                        icon = PantopusIcon.Users,
                        state = PlacePresentation.cardState(env),
                        caption = env.unavailableReason,
                        onTap = onOpen,
                    )
            }
        }
        env.access == PlaceSectionAccess.LOCKED -> {
            val cfg = PlacePresentation.config(env.sectionId)
            PlaceLockedCard(
                title = cfg.title,
                reason = PlacePresentation.lockReason(env),
                cta = PlacePresentation.lockCta(env),
                icon = cfg.icon,
                onTap = lockHandler,
            )
        }
        else -> {
            val cfg = PlacePresentation.config(env.sectionId)
            val state = PlacePresentation.cardState(env)
            val isLive = state == PlaceSectionCardState.LOADED || state == PlaceSectionCardState.STALE
            val reading = if (isLive) PlacePresentation.reading(env) else PlaceSectionReading()
            PlaceSectionCard(
                title = cfg.title,
                icon = cfg.icon,
                asOf = if (isLive) PlacePresentation.asOf(env) else null,
                state = state,
                value = reading.value,
                caption = if (state == PlaceSectionCardState.UNAVAILABLE) env.unavailableReason else reading.caption,
                chip = reading.chip,
                statusDot = reading.statusDot,
                sparkline = cfg.sparkline && isLive,
                inline = cfg.inline,
                onTap = onOpen,
            )
        }
    }
}

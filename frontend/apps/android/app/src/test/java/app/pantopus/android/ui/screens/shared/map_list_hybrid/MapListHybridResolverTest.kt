@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.shared.map_list_hybrid

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * T6.6a (P24) — pure unit tests for the Android detent resolver.
 *
 * Mirrors `MapListHybridShellTests.swift` on iOS. The detent heights
 * and velocity nudge thresholds must stay in sync so both platforms
 * snap the same way on the same gesture.
 *
 * Conventions: in Compose's `draggable`, positive `delta` = downward,
 * positive `velocity` = downward-flick. Therefore `velocity > threshold`
 * shrinks the sheet (toward Collapsed); `velocity < -threshold` grows
 * it (toward Expanded).
 */
class MapListHybridResolverTest {
    // Detents are screen-relative fractions now; resolve them against a
    // reference container so the resolver math stays in px space.
    // 0.20/0.40/0.90 × 800 = 160 / 320 / 720.
    private val containerPx = 800f
    private val targets: Map<MapListHybridDetent, Float> =
        MapListHybridDetent.entries.associateWith { it.heightFraction * containerPx }

    // MARK: - Snap-to-nearest

    @Test
    fun resolves_to_collapsed_when_sheet_released_near_collapsed_height() {
        val next =
            MapListHybridDetentResolver.resolve(
                current = MapListHybridDetent.Standard,
                velocity = 0f,
                displacedHeightPx = 170f,
                targetsPx = targets,
            )
        assertEquals(MapListHybridDetent.Collapsed, next)
    }

    @Test
    fun resolves_to_standard_when_sheet_released_near_standard_height() {
        val next =
            MapListHybridDetentResolver.resolve(
                current = MapListHybridDetent.Collapsed,
                velocity = 0f,
                displacedHeightPx = 290f,
                targetsPx = targets,
            )
        assertEquals(MapListHybridDetent.Standard, next)
    }

    @Test
    fun resolves_to_expanded_when_sheet_released_near_expanded_height() {
        val next =
            MapListHybridDetentResolver.resolve(
                current = MapListHybridDetent.Standard,
                velocity = 0f,
                // near expanded (720)
                displacedHeightPx = 680f,
                targetsPx = targets,
            )
        assertEquals(MapListHybridDetent.Expanded, next)
    }

    // MARK: - Velocity nudge

    @Test
    fun flick_up_from_collapsed_advances_to_standard() {
        val next =
            MapListHybridDetentResolver.resolve(
                current = MapListHybridDetent.Collapsed,
                velocity = -1_500f,
                displacedHeightPx = 165f,
                targetsPx = targets,
            )
        assertEquals(MapListHybridDetent.Standard, next)
    }

    @Test
    fun flick_up_from_standard_advances_to_expanded() {
        val next =
            MapListHybridDetentResolver.resolve(
                current = MapListHybridDetent.Standard,
                velocity = -2_000f,
                displacedHeightPx = 320f,
                targetsPx = targets,
            )
        assertEquals(MapListHybridDetent.Expanded, next)
    }

    @Test
    fun flick_up_from_expanded_stays_expanded() {
        val next =
            MapListHybridDetentResolver.resolve(
                current = MapListHybridDetent.Expanded,
                velocity = -2_000f,
                displacedHeightPx = 510f,
                targetsPx = targets,
            )
        assertEquals(MapListHybridDetent.Expanded, next)
    }

    @Test
    fun flick_down_from_expanded_retreats_to_standard() {
        val next =
            MapListHybridDetentResolver.resolve(
                current = MapListHybridDetent.Expanded,
                velocity = 1_500f,
                displacedHeightPx = 500f,
                targetsPx = targets,
            )
        assertEquals(MapListHybridDetent.Standard, next)
    }

    @Test
    fun flick_down_from_standard_retreats_to_collapsed() {
        val next =
            MapListHybridDetentResolver.resolve(
                current = MapListHybridDetent.Standard,
                velocity = 2_000f,
                displacedHeightPx = 280f,
                targetsPx = targets,
            )
        assertEquals(MapListHybridDetent.Collapsed, next)
    }

    @Test
    fun flick_down_from_collapsed_stays_collapsed() {
        val next =
            MapListHybridDetentResolver.resolve(
                current = MapListHybridDetent.Collapsed,
                velocity = 2_000f,
                displacedHeightPx = 150f,
                targetsPx = targets,
            )
        assertEquals(MapListHybridDetent.Collapsed, next)
    }

    @Test
    fun small_velocity_within_threshold_uses_snap_to_nearest() {
        val next =
            MapListHybridDetentResolver.resolve(
                current = MapListHybridDetent.Collapsed,
                velocity = MapListHybridDetentResolver.VELOCITY_THRESHOLD * 0.5f,
                displacedHeightPx = 250f,
                targetsPx = targets,
            )
        assertEquals(MapListHybridDetent.Standard, next)
    }

    // MARK: - Detent contract

    @Test
    fun detent_fractions_match_q9_contract() {
        assertEquals(0.20f, MapListHybridDetent.Collapsed.heightFraction)
        assertEquals(0.40f, MapListHybridDetent.Standard.heightFraction)
        assertEquals(0.90f, MapListHybridDetent.Expanded.heightFraction)
    }

    @Test
    fun detent_entries_are_ordered_low_to_high() {
        assertEquals(
            listOf(
                MapListHybridDetent.Collapsed,
                MapListHybridDetent.Standard,
                MapListHybridDetent.Expanded,
            ),
            MapListHybridDetent.entries.toList(),
        )
    }
}

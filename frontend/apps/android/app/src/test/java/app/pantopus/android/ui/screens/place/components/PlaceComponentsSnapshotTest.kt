@file:Suppress("LongMethod", "MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.place.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.place.PlaceDensityBucket
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * Paparazzi snapshots for the Place component kit — the 1:1 port of
 * `reference/address-anchored/place-components.jsx`. Locks the visual
 * contract for the SectionCard states, LockedCard, DensityCard, and
 * HeroCard before the Phase-3 dashboard assembles them. Mirrors the
 * iOS `#Preview` galleries in `Features/Place/Components/`.
 *
 * Baselines live under `app/src/test/snapshots/images/`; regenerate via
 * `./gradlew paparazziRecord`.
 */
class PlaceComponentsSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig = DeviceConfig.PIXEL_5.copy(softButtons = false),
        )

    @Test
    fun place_atoms() {
        paparazzi.snapshot { AtomsGallery() }
    }

    @Test
    fun place_section_card_states() {
        paparazzi.snapshot { SectionCardStatesGallery() }
    }

    @Test
    fun place_section_card_inline() {
        paparazzi.snapshot { InlineCardsGallery() }
    }

    @Test
    fun place_composite_cards() {
        paparazzi.snapshot { CompositeCardsGallery() }
    }

    @Test
    fun place_hero_variants() {
        paparazzi.snapshot { HeroGallery() }
    }
}

@Composable
private fun Gallery(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .fillMaxWidth()
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
        verticalArrangement = Arrangement.spacedBy(Spacing.s2),
    ) { content() }
}

@Composable
private fun AtomsGallery() {
    Gallery {
        PlaceGroupLabel(text = "Atoms")
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            PlaceIconTile(icon = PantopusIcon.Wind, tone = PlaceTileTone.HOME)
            PlaceIconTile(icon = PantopusIcon.Lock, tone = PlaceTileTone.MUTED)
            PlaceIconTile(icon = PantopusIcon.MapPin, tone = PlaceTileTone.SKY)
            PlaceVerifiedAvatar()
            PlaceChevron()
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
            PlaceChip(PlaceChipModel(PlaceChipTone.SUCCESS, "All clear", PantopusIcon.Check))
            PlaceChip(PlaceChipModel(PlaceChipTone.WARNING, "Air quality", PantopusIcon.Wind))
            PlaceChip(PlaceChipModel(PlaceChipTone.SKY, "Verified"))
            PlaceChip(PlaceChipModel(PlaceChipTone.NEUTRAL, "Current"))
        }
        PlaceTextButton(title = "Be one of the first to verify on your block")
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s3)) {
            PlaceDensityDots(level = 2)
            PlaceSparkline()
        }
    }
}

@Composable
private fun SectionCardStatesGallery() {
    Gallery {
        PlaceSectionCard(
            title = "Air quality",
            icon = PantopusIcon.Wind,
            asOf = "9:00 AM",
            state = PlaceSectionCardState.LOADED,
            value = "AQI 38 — good",
            caption = "AirNow · EPA",
            chip = PlaceChipModel(PlaceChipTone.SUCCESS, "Good", PantopusIcon.Check),
        )
        PlaceSectionCard(
            title = "Your home",
            icon = PantopusIcon.Home,
            state = PlaceSectionCardState.LOADED,
            value = "Built 1979 · 1,840 sqft · ~\$612k",
            sparkline = true,
        )
        PlaceSectionCard(
            title = "Air quality",
            icon = PantopusIcon.Wind,
            state = PlaceSectionCardState.LOADING,
        )
        PlaceSectionCard(
            title = "Water",
            icon = PantopusIcon.Droplets,
            state = PlaceSectionCardState.EMPTY,
        )
        PlaceSectionCard(
            title = "Civic",
            icon = PantopusIcon.Landmark,
            state = PlaceSectionCardState.UNAVAILABLE,
        )
        PlaceSectionCard(
            title = "Air quality",
            icon = PantopusIcon.Wind,
            asOf = "2h ago",
            state = PlaceSectionCardState.STALE,
            value = "AQI 41 — good",
        )
        PlaceSectionCard(
            title = "Air quality",
            icon = PantopusIcon.Wind,
            state = PlaceSectionCardState.ERROR,
        )
    }
}

@Composable
private fun InlineCardsGallery() {
    Gallery {
        PlaceGroupLabel(text = "Today")
        PlaceSectionCard(
            title = "Weather",
            icon = PantopusIcon.Sun,
            state = PlaceSectionCardState.LOADED,
            value = "62° and clear",
            inline = true,
        )
        PlaceSectionCard(
            title = "Alerts",
            icon = PantopusIcon.Bell,
            state = PlaceSectionCardState.LOADED,
            chip = PlaceChipModel(PlaceChipTone.WARNING, "Wind advisory", PantopusIcon.Wind),
            inline = true,
        )
        PlaceSectionCard(
            title = "Emergency plan",
            icon = PantopusIcon.ShieldCheck,
            state = PlaceSectionCardState.LOADED,
            actionLabel = "Set up your plan",
            inline = true,
        )
    }
}

@Composable
private fun CompositeCardsGallery() {
    Gallery {
        PlaceLockedCard(
            title = "Daily conditions",
            reason = "Create a free account to see weather, air quality, and alerts for this address every day.",
            cta = "Create account",
            icon = PantopusIcon.Sun,
        )
        PlaceDensityCard(bucket = PlaceDensityBucket.FEW)
        PlaceDensityCard(bucket = PlaceDensityBucket.NONE)
    }
}

@Composable
private fun HeroGallery() {
    Gallery {
        PlaceHeroCard(
            variant = PlaceHeroVariant.ALL_CLEAR,
            chip = PlaceChipModel(PlaceChipTone.SUCCESS, "All clear", PantopusIcon.Check),
            heroIcon = PantopusIcon.ShieldCheck,
            headline = "All clear on your block today. Air is good and there are no active alerts.",
            nudgeIcon = PantopusIcon.Lightbulb,
            nudgeText = "A heat-pump rebate may apply to your home. Worth a look.",
        )
        PlaceHeroCard(
            variant = PlaceHeroVariant.ALERT,
            chip = PlaceChipModel(PlaceChipTone.WARNING, "Air quality", PantopusIcon.Wind),
            heroIcon = PantopusIcon.Wind,
            headline = "Air quality is unhealthy for sensitive groups right now (112).",
            nudgeIcon = PantopusIcon.Clock,
            nudgeText = "Limit time outdoors this afternoon. It should clear by evening.",
        )
    }
}

@file:Suppress("MagicNumber", "LongMethod", "UnusedPrivateMember", "PackageNaming")

package app.pantopus.android.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

/**
 * B1.5 — Paparazzi snapshots for the business-profile + earn primitives that
 * unblock A10.6 / A10.7 / A10.11. Mirrors
 * `PantopusTests/Core/Design/Components/BusinessEarnPrimitivesSnapshotTests.swift`.
 * Each named test produces one baseline PNG under `app/src/test/snapshots/images/`.
 *
 *   - `biz_banner_header_*` — open / closed status + personal-identity reuse.
 *   - `gallery_strip_*` — populated rail (incl. "+N" tile) + dashed empty.
 *   - `rating_distribution_*` — high / mixed / no-reviews.
 *   - `map_preview_*` — pin only / service-area ring / personal identity.
 *   - `progress_ring_*` — 0 / partial / full.
 */
class BusinessEarnPrimitivesSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 1600,
                    softButtons = false,
                ),
        )

    // ── BizBannerHeader ────────────────────────────────────────────

    @Test
    fun biz_banner_header_open() {
        paparazzi.snapshot {
            EdgeFrame {
                BizBannerHeader(
                    name = "Marlow & Co. Cleaning",
                    handle = "@marlowco",
                    locality = "Elm Park",
                    logoIcon = PantopusIcon.Sparkles,
                    status = BizStatusBadge.open("Open now"),
                )
            }
        }
    }

    @Test
    fun biz_banner_header_closed() {
        paparazzi.snapshot {
            EdgeFrame {
                BizBannerHeader(
                    name = "Tide Pool Pet Care",
                    handle = "@tidepoolpets",
                    locality = "Cedar Heights",
                    logoIcon = PantopusIcon.PawPrint,
                    status = BizStatusBadge.closed("Closed · opens 8 AM"),
                )
            }
        }
    }

    @Test
    fun biz_banner_header_personal_identity() {
        paparazzi.snapshot {
            EdgeFrame {
                BizBannerHeader(
                    identity = IdentityPillar.Personal,
                    name = "Jamie Rivera",
                    handle = "@jamier",
                    locality = "Riverside",
                    logoInitials = "JR",
                    verified = false,
                )
            }
        }
    }

    // ── GalleryStrip ───────────────────────────────────────────────

    @Test
    fun gallery_strip_populated() {
        paparazzi.snapshot {
            Frame {
                GalleryStrip(
                    tiles =
                        listOf(
                            GalleryTile(id = "kitchen", label = "Kitchen", tint = PantopusColors.primary600),
                            GalleryTile(id = "bath", label = "Bathroom", tint = PantopusColors.success),
                            GalleryTile(id = "living", label = "Living room", tint = PantopusColors.slate),
                            GalleryTile(id = "more", tint = PantopusColors.primary800, icon = null, moreCount = 9),
                        ),
                )
            }
        }
    }

    @Test
    fun gallery_strip_empty() {
        paparazzi.snapshot {
            Frame { GalleryStrip(tiles = emptyList()) }
        }
    }

    // ── RatingDistribution ─────────────────────────────────────────

    @Test
    fun rating_distribution_high() {
        paparazzi.snapshot {
            Frame {
                RatingDistribution(average = 4.9, count = 128, distribution = listOf(0.92f, 0.06f, 0.02f, 0f, 0f))
            }
        }
    }

    @Test
    fun rating_distribution_mixed() {
        paparazzi.snapshot {
            Frame {
                RatingDistribution(average = 4.2, count = 36, distribution = listOf(0.52f, 0.28f, 0.12f, 0.05f, 0.03f))
            }
        }
    }

    @Test
    fun rating_distribution_no_reviews() {
        paparazzi.snapshot {
            Frame {
                RatingDistribution(average = 0.0, count = 0, distribution = emptyList())
            }
        }
    }

    // ── MapPreview ─────────────────────────────────────────────────

    @Test
    fun map_preview_pin_only() {
        paparazzi.snapshot {
            Frame { MapPreview(identity = IdentityPillar.Business) }
        }
    }

    @Test
    fun map_preview_service_area() {
        paparazzi.snapshot {
            Frame { MapPreview(identity = IdentityPillar.Business, serviceAreaRadius = 56.dp) }
        }
    }

    @Test
    fun map_preview_personal_identity() {
        paparazzi.snapshot {
            Frame { MapPreview(identity = IdentityPillar.Personal, serviceAreaRadius = 40.dp) }
        }
    }

    // ── ProgressRing ───────────────────────────────────────────────

    @Test
    fun progress_ring_zero() {
        paparazzi.snapshot {
            Frame { ProgressRing(progress = 0f, label = "0%", sublabel = "to goal") }
        }
    }

    @Test
    fun progress_ring_partial() {
        paparazzi.snapshot {
            Frame { ProgressRing(progress = 0.66f, tint = PantopusColors.success, label = "66%", sublabel = "to goal") }
        }
    }

    @Test
    fun progress_ring_full() {
        paparazzi.snapshot {
            Frame { ProgressRing(progress = 1f, tint = PantopusColors.success, label = "Done", sublabel = "this week") }
        }
    }
}

@Composable
private fun Frame(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(Spacing.s4),
    ) {
        content()
    }
}

@Composable
private fun EdgeFrame(content: @Composable () -> Unit) {
    Column(
        modifier =
            Modifier
                .background(PantopusColors.appBg)
                .padding(vertical = Spacing.s4),
    ) {
        content()
    }
}

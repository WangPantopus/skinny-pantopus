@file:Suppress("PackageNaming", "MatchingDeclarationName")

package app.pantopus.android.ui.screens.scheduling._shared

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.scheduling.SchedulingOwner
import app.pantopus.android.ui.screens.shared.wizard.WizardIdentity
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusIconImage
import app.pantopus.android.ui.theme.PantopusTextStyle
import app.pantopus.android.ui.theme.Radii
import app.pantopus.android.ui.theme.Spacing

/**
 * The three Calendarly identity pillars and their accent. Sky (Personal),
 * green (Home), violet (Business) — the single source of truth scheduling
 * screens tint headers, today/selected slot chrome, and CTAs with.
 */
enum class SchedulingPillar {
    Personal,
    Home,
    Business,
    ;

    /**
     * Header/CTA/selected accent — Personal sky, Home green, Business violet
     * (the `--color-identity-*` tokens; [PantopusColors.personal] /
     * [PantopusColors.home] / [PantopusColors.business]).
     */
    val accent: Color
        get() =
            when (this) {
                Personal -> PantopusColors.personal
                Home -> PantopusColors.home
                Business -> PantopusColors.business
            }

    /**
     * Soft tint for chips / selected-slot / header backgrounds — the design's
     * `--color-identity-*-bg` tokens. Note Personal uses
     * [PantopusColors.personalBg] (blue-100), NOT `primary50` (blue-50) — the
     * design pillar bg is the deeper blue-100.
     */
    val accentBg: Color
        get() =
            when (this) {
                Personal -> PantopusColors.personalBg
                Home -> PantopusColors.homeBg
                Business -> PantopusColors.businessBg
            }

    /**
     * 1dp hairline ring tint for selected/accented cards & slot chips — a
     * mid-tone derived from the accent (alpha-blended) so the ring reads as
     * "this is the pillar accent" without the full-strength fill.
     */
    val accentRing: Color
        get() = accent.copy(alpha = ACCENT_RING_ALPHA)

    /** Maps to the shared [WizardShell] identity so wizards retint to the pillar. */
    val wizardIdentity: WizardIdentity
        get() =
            when (this) {
                Personal -> WizardIdentity.Personal
                Home -> WizardIdentity.Home
                Business -> WizardIdentity.Business
            }

    companion object {
        private const val ACCENT_RING_ALPHA = 0.35f

        /**
         * The FIXED operational primary blue ([PantopusColors.primary600]) for host-side action
         * chrome — Approve / primary dock / bookings-management FAB. These are
         * NOT pillar-tinted: an approve button on a Business booking is still
         * blue, never violet. Use [SchedulingPillar.accent] for invitee-facing
         * / identity chrome; use this for operational CTAs.
         */
        val operationalPrimary: Color get() = PantopusColors.primary600
    }
}

/** Resolve the pillar for an owner context. */
fun SchedulingOwner.pillar(): SchedulingPillar =
    when (this) {
        is SchedulingOwner.Personal -> SchedulingPillar.Personal
        is SchedulingOwner.Home -> SchedulingPillar.Home
        is SchedulingOwner.Business -> SchedulingPillar.Business
    }

private val ACCENT_BAR_HEIGHT = 3.dp
private val BACK_ICON_SIZE = 20.dp

/**
 * A lightweight pillar-accented header for scheduling screens that don't use a
 * full shell: a centered title with an optional back control and a thin pillar
 * accent bar beneath it. Screens that use `WizardShell`/`FormShell`/
 * `ListOfRowsScreen` retint those via [SchedulingPillar.wizardIdentity] /
 * [SchedulingPillar.accent] instead.
 */
@Composable
fun OwnerPillarHeader(
    title: String,
    pillar: SchedulingPillar,
    modifier: Modifier = Modifier,
    onBack: (() -> Unit)? = null,
) {
    Column(modifier = modifier.fillMaxWidth().background(PantopusColors.appSurface)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = Spacing.s2, vertical = Spacing.s3),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (onBack != null) {
                Box(
                    modifier =
                        Modifier
                            .size(34.dp)
                            .clip(RoundedCornerShape(Radii.md))
                            .clickable(onClickLabel = "Back", onClick = onBack),
                    contentAlignment = Alignment.Center,
                ) {
                    PantopusIconImage(
                        icon = PantopusIcon.ChevronLeft,
                        contentDescription = "Back",
                        size = BACK_ICON_SIZE,
                        tint = PantopusColors.appText,
                    )
                }
            }
            Text(
                text = title,
                style = PantopusTextStyle.h3,
                color = PantopusColors.appText,
                modifier = Modifier.padding(start = if (onBack != null) Spacing.s1 else Spacing.s2),
            )
        }
        Box(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .height(ACCENT_BAR_HEIGHT)
                    .background(pillar.accent),
        )
    }
}

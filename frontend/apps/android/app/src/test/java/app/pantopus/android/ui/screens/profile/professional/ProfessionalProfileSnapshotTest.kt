@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.profile.professional

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.components.EmptyState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

class ProfessionalProfileSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 3000,
                    softButtons = false,
                ),
        )

    @Test fun professionalProfileLoadingSkeleton() {
        paparazzi.snapshot {
            Frame { ProfessionalProfileSkeleton() }
        }
    }

    @Test fun professionalProfileVerifiedFrame() {
        paparazzi.snapshot {
            Frame {
                ProfessionalProfileLoaded(
                    content = ProfessionalProfileSampleData.published,
                    mode = ProStickyMode.Saved,
                    dirtyCount = 0,
                    pendingCount = 0,
                    isDisabling = false,
                    onDisable = {},
                    onBack = {},
                    onDiscard = {},
                    onSaveSubmit = {},
                    onTitleChange = {},
                    onYearsChange = {},
                    onAddSkill = {},
                    onRemoveSkill = {},
                    onAddCertification = {},
                    onRemoveCertification = {},
                    onAddPortfolioLink = {},
                    onVisibilityChange = { _, _ -> },
                    onToggleCategory = {},
                    onServiceCityChange = {},
                    onServiceStateChange = {},
                    onServiceRadiusChange = {},
                    onHourlyRateChange = {},
                    onStartVerification = {},
                )
            }
        }
    }

    @Test fun professionalProfilePendingFrame() {
        val content = ProfessionalProfileSampleData.pendingEdits
        paparazzi.snapshot {
            Frame {
                ProfessionalProfileLoaded(
                    content = content,
                    mode = ProStickyMode.PendingSave,
                    dirtyCount = content.dirtyCount,
                    pendingCount = content.pendingCount,
                    isDisabling = false,
                    onDisable = {},
                    onBack = {},
                    onDiscard = {},
                    onSaveSubmit = {},
                    onTitleChange = {},
                    onYearsChange = {},
                    onAddSkill = {},
                    onRemoveSkill = {},
                    onAddCertification = {},
                    onRemoveCertification = {},
                    onAddPortfolioLink = {},
                    onVisibilityChange = { _, _ -> },
                    onToggleCategory = {},
                    onServiceCityChange = {},
                    onServiceStateChange = {},
                    onServiceRadiusChange = {},
                    onHourlyRateChange = {},
                    onStartVerification = {},
                )
            }
        }
    }

    @Test fun professionalProfileCreateFrame() {
        paparazzi.snapshot {
            Frame {
                ProfessionalEnableForm(
                    draft = ProfessionalEnableDraft(),
                    onBack = {},
                    onEnable = {},
                    onHeadlineChange = {},
                    onBioChange = {},
                    onToggleCategory = {},
                    onCityChange = {},
                    onStateChange = {},
                    onRadiusChange = {},
                    onHourlyRateChange = {},
                    onPublicChange = {},
                )
            }
        }
    }

    @Test fun professionalProfileErrorFrame() {
        paparazzi.snapshot {
            Frame {
                EmptyState(
                    icon = PantopusIcon.AlertCircle,
                    headline = "Couldn't load professional profile",
                    subcopy = "We couldn't load your professional profile.",
                    ctaTitle = "Try again",
                    onCta = {},
                    tint = PantopusColors.businessBg,
                    accent = PantopusColors.business,
                )
            }
        }
    }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) {
                content()
            }
        }
    }
}

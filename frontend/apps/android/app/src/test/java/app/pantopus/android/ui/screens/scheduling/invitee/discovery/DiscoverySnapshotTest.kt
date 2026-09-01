@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.invitee.discovery

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.scheduling.SlotDto
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

class DiscoverySnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    private val introRow =
        EventTypeRowUi(
            slug = "intro",
            name = "Intro call",
            durationLabel = "30 min",
            locationLabel = "Video call",
            locationIcon = PantopusIcon.Video,
            durationMin = 30,
        )

    private fun slot(hour: Int) = SlotDto(start = "2026-06-17T%02d:00:00Z".format(hour), startLocal = "2026-06-17T%02d:00:00".format(hour))

    private fun pickerContent(
        pillar: SchedulingPillar = SchedulingPillar.Personal,
        available: Set<Int> = setOf(15, 16, 17, 18, 19),
        selectedDay: Int? = 17,
        slots: List<SlotDto> = listOf(slot(9), slot(10), slot(13), slot(14)),
        slotsLoading: Boolean = false,
    ) = SlotPickerUiState.Content(
        eventTypeName = "Intro call",
        subLabel = "30 min · with Maria Kessler",
        locationIcon = PantopusIcon.Video,
        pillar = pillar,
        tzId = "America/Los_Angeles",
        tzLabel = "PDT",
        detectedTimezone = "America/Los_Angeles",
        monthLabel = "June 2026",
        daysInMonth = 30,
        firstWeekdayIndex = 1,
        today = 13,
        availableDays = available,
        selectedDay = selectedDay,
        selectedDayHeading = selectedDay?.let { "Wednesday, Jun $it" },
        daySlots = if (selectedDay == null) emptyList() else slots,
        selectedSlotStart = null,
        monthHasAvailability = available.isNotEmpty(),
        nextMonthLabel = "July",
        canGoPreviousMonth = false,
        slotsLoading = slotsLoading,
    )

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }

    @Test
    fun landing_header_personal() =
        paparazzi.snapshot {
            Frame {
                Column {
                    PillarBanner(pillar = SchedulingPillar.Personal)
                    LandingHeaderCard(
                        pillar = SchedulingPillar.Personal,
                        hostName = "Maria Kessler",
                        initials = "MA",
                        headline = "Brand strategy & coaching",
                        blurb = "Pick a time that works for you and I'll send a calendar invite with the details.",
                        onShare = {},
                    )
                }
            }
        }

    @Test
    fun landing_event_rows() =
        paparazzi.snapshot {
            Frame {
                Column(Modifier.padding(Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                    OpenInAppBanner(onOpen = {})
                    SectionOverline("Book a time")
                    EventTypeRow(row = introRow, onClick = {})
                    EventTypeRow(
                        row =
                            introRow.copy(
                                name = "Strategy session",
                                durationLabel = "60 min",
                                locationLabel = "In person",
                                locationIcon = PantopusIcon.MapPin,
                            ),
                        onClick = {},
                    )
                }
            }
        }

    @Test
    fun landing_paused_and_empty() =
        paparazzi.snapshot {
            Frame {
                Column(Modifier.padding(Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    LandingPausedCard(hostName = "Maria")
                    LandingEmptyCard(hostName = "Maria")
                }
            }
        }

    @Test
    fun picker_day_with_slots() =
        paparazzi.snapshot {
            Frame {
                SlotPickerContent(
                    state = pickerContent(),
                    onBack = {},
                    onSelectDay = {},
                    onSelectSlot = {},
                    onPrevMonth = {},
                    onNextMonth = {},
                    onSeeNextAvailable = {},
                    onTimezoneClick = {},
                    onRetry = {},
                    onContinue = {},
                )
            }
        }

    @Test
    fun picker_no_availability() =
        paparazzi.snapshot {
            Frame {
                SlotPickerContent(
                    state = pickerContent(available = emptySet(), selectedDay = null),
                    onBack = {},
                    onSelectDay = {},
                    onSelectSlot = {},
                    onPrevMonth = {},
                    onNextMonth = {},
                    onSeeNextAvailable = {},
                    onTimezoneClick = {},
                    onRetry = {},
                    onContinue = {},
                )
            }
        }

    @Test
    fun no_availability_card_and_day_full() =
        paparazzi.snapshot {
            Frame {
                Column(Modifier.padding(Spacing.s3), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    NoAvailabilityState(
                        icon = PantopusIcon.CalendarX,
                        title = "No open times in June",
                        body = "Availability changes often. Try a later month.",
                        primaryLabel = "See July",
                        primaryIcon = PantopusIcon.ArrowRight,
                        onPrimary = {},
                        accent = PantopusColors.primary600,
                    )
                    DayFullyBookedNotice(onSeeNextAvailable = {}, accent = PantopusColors.primary600)
                }
            }
        }
}

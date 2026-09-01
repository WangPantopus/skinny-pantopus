@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingPillar
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon
import app.pantopus.android.ui.theme.PantopusTheme
import app.pantopus.android.ui.theme.Spacing
import org.junit.Rule
import org.junit.Test

class EventTypesSnapshotTest {
    @get:Rule
    val paparazzi: Paparazzi =
        Paparazzi(deviceConfig = DeviceConfig.PIXEL_5.copy(screenHeight = 2400, softButtons = false))

    private fun row(
        id: String,
        name: String,
        meta: String = "30 min · Video",
        price: String? = null,
        active: Boolean = true,
        secret: Boolean = false,
    ) = EventTypeRowUi(
        id = id,
        name = name,
        meta = meta,
        colorHex = null,
        isActive = active,
        isSecret = secret,
        priceLabel = price,
        slug = name,
    )

    private fun content(
        pillar: SchedulingPillar,
        rows: List<EventTypeRowUi>,
        tab: EventTypeTab = EventTypeTab.Active,
        activeCount: Int = rows.size,
        hiddenCount: Int = 0,
    ) = EventTypeListUiState.Content(
        pillar = pillar,
        tab = tab,
        rows = rows,
        activeCount = activeCount,
        hiddenCount = hiddenCount,
        canEdit = true,
    )

    private val noop: (String) -> Unit = {}
    private val noopToggle: (String, Boolean) -> Unit = { _, _ -> }
    private val noopInt: (Int) -> Unit = {}

    @Composable
    private fun list(state: EventTypeListUiState.Content) {
        ContentBody(
            state = state,
            onOpen = noop, onCreate = {}, onTemplate = noopInt, onToggle = noopToggle,
            onCopy = noop, onShare = noop, onDuplicate = noop, onDelete = noop, onViewHidden = {},
        )
    }

    @Test
    fun list_personal_populated() =
        paparazzi.snapshot {
            Frame {
                list(
                    content(
                        SchedulingPillar.Personal,
                        listOf(
                            row("1", "Intro call", "30 min · Video"),
                            row("2", "Coffee chat", "45 min · In person"),
                            row("3", "Strategy session", "60 min · Video", active = false),
                        ),
                        activeCount = 2,
                        hiddenCount = 1,
                    ),
                )
            }
        }

    @Test
    fun list_business_priced() =
        paparazzi.snapshot {
            Frame {
                list(
                    content(
                        SchedulingPillar.Business,
                        listOf(
                            row("1", "Consultation", "30 min · Video", price = "$120.00"),
                            row("2", "Quote visit", "45 min · On-site", price = "Free"),
                            row("3", "Site survey", "60 min · On-site", price = "$200.00", secret = true),
                        ),
                    ),
                )
            }
        }

    @Test
    fun list_empty_templates() =
        paparazzi.snapshot {
            Frame { list(content(SchedulingPillar.Personal, emptyList(), activeCount = 0, hiddenCount = 0)) }
        }

    @Test
    fun list_all_hidden() =
        paparazzi.snapshot {
            Frame { list(content(SchedulingPillar.Personal, emptyList(), activeCount = 0, hiddenCount = 2)) }
        }

    @Test
    fun connected_coming_soon() =
        paparazzi.snapshot {
            Frame { ComingSoon() }
        }

    @Test
    fun editor_kit_cards() =
        paparazzi.snapshot {
            Frame {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(Spacing.s3)) {
                    EtIdentityPill(pillar = SchedulingPillar.Business)
                    EtCard(overline = "Basics", accent = SchedulingPillar.Business.accent) {
                        EtTextField(value = "Consultation", onValueChange = {}, label = "Name")
                        EtSegmented(options = listOf("Single", "Multiple"), selected = "Single", onSelect = {})
                        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.s2)) {
                            EtStepper(value = "30", unit = "min", onDecrement = {}, onIncrement = {})
                            EtQuickChip(label = "15", onClick = {})
                            EtQuickChip(label = "45", onClick = {})
                        }
                    }
                    EtCard(accent = SchedulingPillar.Business.accent) {
                        EtToggleRow(
                            icon = PantopusIcon.UserCheck,
                            label = "Require approval",
                            sub = "Approve each booking",
                            checked = false,
                            onToggle = {},
                        )
                        EtToggleRow(
                            icon = PantopusIcon.CheckCircle,
                            label = "Active",
                            sub = "People can book this",
                            checked = true,
                            onToggle = {},
                            last = true,
                        )
                    }
                    EtCard(accent = SchedulingPillar.Business.accent) {
                        EtLinkRow(
                            icon = PantopusIcon.ListChecks,
                            label = "Intake questions",
                            value = "2 questions",
                            onClick = {},
                            last = true,
                        )
                    }
                }
            }
        }

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(Modifier.fillMaxSize().background(PantopusColors.appBg)) { content() }
        }
    }
}

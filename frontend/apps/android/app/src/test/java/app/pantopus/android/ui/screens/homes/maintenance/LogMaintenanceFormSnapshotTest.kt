@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.homes.maintenance

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.homes.MaintenanceTaskDto
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test
import java.math.BigDecimal
import java.time.Instant

/**
 * P2.9 — Paparazzi baselines for the Log-maintenance form and the
 * Maintenance detail surface. Covers the four state-permutations the
 * design pack calls out (minimal / full / with-photos / with-next-due)
 * plus the detail screen's loading / loaded / error states.
 */
class LogMaintenanceFormSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 3200,
                    softButtons = false,
                ),
        )

    // MARK: - Form states

    @Test
    fun log_maintenance_form_minimal() {
        paparazzi.snapshot {
            Frame {
                LogMaintenanceFormContent(
                    form = LogMaintenanceFormState(),
                    isDirty = false,
                    screenTitle = "Log maintenance",
                    submitLabel = "Log",
                    callbacks = LogMaintenanceFormCallbacks(),
                )
            }
        }
    }

    @Test
    fun log_maintenance_form_full() {
        paparazzi.snapshot {
            Frame {
                LogMaintenanceFormContent(
                    form = fullState(),
                    isDirty = true,
                    screenTitle = "Log maintenance",
                    submitLabel = "Log",
                    callbacks = LogMaintenanceFormCallbacks(),
                )
            }
        }
    }

    @Test
    fun log_maintenance_form_with_photos() {
        paparazzi.snapshot {
            Frame {
                LogMaintenanceFormContent(
                    form = withPhotosState(),
                    isDirty = true,
                    screenTitle = "Log maintenance",
                    submitLabel = "Log",
                    callbacks = LogMaintenanceFormCallbacks(),
                )
            }
        }
    }

    @Test
    fun log_maintenance_form_with_next_due() {
        paparazzi.snapshot {
            Frame {
                LogMaintenanceFormContent(
                    form = withNextDueState(),
                    isDirty = true,
                    screenTitle = "Log maintenance",
                    submitLabel = "Log",
                    callbacks = LogMaintenanceFormCallbacks(),
                )
            }
        }
    }

    // MARK: - Detail states

    @Test
    fun maintenance_detail_loading() {
        paparazzi.snapshot {
            Frame {
                MaintenanceDetailContent(
                    state = MaintenanceDetailUiState.Loading,
                    isMutating = false,
                    actionError = null,
                    onBack = {},
                    onEdit = {},
                    onRetry = {},
                    onDelete = {},
                )
            }
        }
    }

    @Test
    fun maintenance_detail_loaded_minimal() {
        paparazzi.snapshot {
            Frame {
                MaintenanceDetailContent(
                    state =
                        MaintenanceDetailUiState.Loaded(
                            task = minimalTask(),
                            draft = null,
                        ),
                    isMutating = false,
                    actionError = null,
                    onBack = {},
                    onEdit = {},
                    onRetry = {},
                    onDelete = {},
                )
            }
        }
    }

    @Test
    fun maintenance_detail_loaded_with_photos() {
        paparazzi.snapshot {
            Frame {
                MaintenanceDetailContent(
                    state =
                        MaintenanceDetailUiState.Loaded(
                            task = fullTask(),
                            draft = fullDraft(),
                        ),
                    isMutating = false,
                    actionError = null,
                    onBack = {},
                    onEdit = {},
                    onRetry = {},
                    onDelete = {},
                )
            }
        }
    }

    @Test
    fun maintenance_detail_error() {
        paparazzi.snapshot {
            Frame {
                MaintenanceDetailContent(
                    state = MaintenanceDetailUiState.Error("Couldn't reach the server."),
                    isMutating = false,
                    actionError = null,
                    onBack = {},
                    onEdit = {},
                    onRetry = {},
                    onDelete = {},
                )
            }
        }
    }

    // MARK: - Fixtures

    private fun fullState(): LogMaintenanceFormState =
        LogMaintenanceFormState(
            category = MaintenanceCategory.Hvac,
            title = "Fall HVAC tune-up",
            dateCompleted = Instant.parse("2026-05-15T12:00:00Z"),
            performedBy = MaintenancePerformedBy.Contractor,
            performerName = "Riverside HVAC",
            performerContact = "(555) 555-0142",
            costText = "185",
            notes = "Replaced filter, topped off coolant.",
        )

    private fun withPhotosState(): LogMaintenanceFormState =
        fullState().copy(
            photos =
                listOf(
                    MaintenanceDraftFile(id = "p1", filename = "p1.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(0)),
                    MaintenanceDraftFile(id = "p2", filename = "p2.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(1)),
                    MaintenanceDraftFile(id = "p3", filename = "p3.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(2)),
                ),
            receipt =
                MaintenanceDraftFile(
                    id = "r1",
                    filename = "receipt-1025.pdf",
                    mimeType = "application/pdf",
                    bytes = byteArrayOf(0x25, 0x50, 0x44, 0x46),
                ),
        )

    private fun withNextDueState(): LogMaintenanceFormState =
        fullState().copy(
            nextDueEnabled = true,
            nextDueDate = Instant.parse("2026-11-01T00:00:00Z"),
            recurrence = MaintenanceRecurrence.Yearly,
        )

    private fun minimalTask(): MaintenanceTaskDto =
        MaintenanceTaskDto(
            id = "task-1",
            homeId = "home-1",
            task = "Filter swap",
            recurrence = "one_time",
            status = "completed",
        )

    private fun fullTask(): MaintenanceTaskDto =
        MaintenanceTaskDto(
            id = "task-2",
            homeId = "home-1",
            task = "Fall HVAC tune-up",
            vendor = "Riverside HVAC",
            cost = BigDecimal("185"),
            recurrence = "yearly",
            dueDate = "2026-11-01",
            status = "completed",
        )

    private fun fullDraft(): MaintenanceDraft =
        MaintenanceDraft(
            category = MaintenanceCategory.Hvac,
            performedBy = MaintenancePerformedBy.Contractor,
            performerName = "Riverside HVAC",
            performerContact = "(555) 555-0142",
            notes = "Replaced filter, topped off coolant. Next visit booked.",
            photos =
                listOf(
                    MaintenanceDraftFile(id = "p1", filename = "p1.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(0)),
                    MaintenanceDraftFile(id = "p2", filename = "p2.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(1)),
                    MaintenanceDraftFile(id = "p3", filename = "p3.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(2)),
                    MaintenanceDraftFile(id = "p4", filename = "p4.jpg", mimeType = "image/jpeg", bytes = byteArrayOf(3)),
                ),
            receipt =
                MaintenanceDraftFile(
                    id = "r1",
                    filename = "receipt-1025.pdf",
                    mimeType = "application/pdf",
                    bytes = byteArrayOf(0x25, 0x50, 0x44, 0x46),
                ),
        )

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}

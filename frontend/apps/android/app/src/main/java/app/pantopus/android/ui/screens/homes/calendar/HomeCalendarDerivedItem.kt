@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.calendar

import androidx.compose.ui.graphics.Color
import app.pantopus.android.data.api.models.homes.BillDto
import app.pantopus.android.data.api.models.homes.HomeTaskDto
import app.pantopus.android.data.api.models.homes.PackageDto
import app.pantopus.android.ui.screens.homes.HomeDashboardProjection
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * Which feed a derived calendar row came from. The tone matches the Home
 * dashboard's own per-feature accents (tasks = warning, bills = error,
 * deliveries = business) so the colour-coding reads the same across the
 * pillar.
 *
 * Parity contract — mirrored in iOS `HomeCalendarDerivedKind`.
 */
enum class HomeCalendarDerivedKind(
    val label: String,
    val icon: PantopusIcon,
    val background: Color,
    val foreground: Color,
) {
    Task("Task", PantopusIcon.ListChecks, PantopusColors.warningBg, PantopusColors.warning),
    Bill("Bill", PantopusIcon.Receipt, PantopusColors.errorBg, PantopusColors.error),
    Package("Delivery", PantopusIcon.Package, PantopusColors.businessBg, PantopusColors.business),
}

/**
 * One derived, dated row for the Home calendar — a task due-date, a bill
 * due-date, or a package's expected delivery.
 *
 * RN's month grid plots exactly these alongside the home's own events
 * (`src/app/homes/[id]/calendar.tsx:48-74`): it fans out to
 * `getHomeTasks` / `getHomeBills` / `getHomePackages`, keeps only rows
 * that carry a date, and colour-codes each by type. Without it a
 * household sees an empty-looking month even when three bills are due
 * that week.
 */
data class HomeCalendarDerivedItem(
    val id: String,
    val kind: HomeCalendarDerivedKind,
    val title: String,
    /** Short status / amount line rendered under the title. */
    val detail: String?,
    /**
     * The date this item lands on — `due_at` (task), `due_date` (bill)
     * or `expected_at` / `delivered_at` (package).
     */
    val dateIso: String,
) {
    companion object {
        /**
         * Fan-in from the three feeds. Rows without a date are dropped —
         * they have nothing to plot. Mirrors RN's `if (t.due_date)` /
         * `if (b.due_date)` / `p.expected_date || p.delivered_at` guards.
         */
        fun build(
            tasks: List<HomeTaskDto>,
            bills: List<BillDto>,
            packages: List<PackageDto>,
        ): List<HomeCalendarDerivedItem> =
            buildList {
                tasks.forEach { task ->
                    val due = task.dueAt
                    if (!due.isNullOrEmpty()) {
                        add(
                            HomeCalendarDerivedItem(
                                id = "task-${task.id}",
                                kind = HomeCalendarDerivedKind.Task,
                                title = task.title,
                                detail = statusDetail(task.status),
                                dateIso = due,
                            ),
                        )
                    }
                }
                bills.forEach { bill ->
                    val due = bill.dueDate
                    if (!due.isNullOrEmpty()) {
                        add(
                            HomeCalendarDerivedItem(
                                id = "bill-${bill.id}",
                                kind = HomeCalendarDerivedKind.Bill,
                                title = "${HomeDashboardProjection.billLabel(bill)} bill due",
                                detail = HomeDashboardProjection.currency(bill.displayAmount, bill.currency),
                                dateIso = due,
                            ),
                        )
                    }
                }
                packages.forEach { parcel ->
                    val date =
                        listOfNotNull(parcel.expectedAt, parcel.deliveredAt)
                            .firstOrNull { it.isNotEmpty() }
                    if (date != null) {
                        val name =
                            listOfNotNull(parcel.description, parcel.vendorName, parcel.carrier)
                                .firstOrNull { it.isNotEmpty() } ?: "Package"
                        add(
                            HomeCalendarDerivedItem(
                                id = "package-${parcel.id}",
                                kind = HomeCalendarDerivedKind.Package,
                                title = name,
                                detail = statusDetail(parcel.status),
                                dateIso = date,
                            ),
                        )
                    }
                }
            }

        /**
         * `in_progress` → "In progress". Null for empty statuses so the
         * row falls back to its type label.
         */
        fun statusDetail(raw: String?): String? {
            if (raw.isNullOrEmpty()) return null
            return raw.replace('_', ' ').replaceFirstChar { it.uppercase() }
        }
    }
}

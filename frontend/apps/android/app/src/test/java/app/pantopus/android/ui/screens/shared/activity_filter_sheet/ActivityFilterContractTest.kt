@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.shared.activity_filter_sheet

import app.pantopus.android.ui.screens.shared.filter_sheet.FilterControl
import app.pantopus.android.ui.screens.shared.filter_sheet.FilterOption
import app.pantopus.android.ui.screens.shared.filter_sheet.cleared
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/**
 * P5.4 — Contract tests for the generic activity filter. Asserts the
 * ActivityFilter ↔ List<FilterSection> mapping round-trips and the
 * apply() projection narrows + sorts correctly. Mirrors the iOS
 * `ActivityFilterSheetTests`.
 */
class ActivityFilterContractTest {
    private data class Item(
        val id: String,
        val status: String? = null,
        val date: Instant? = null,
        val value: Double? = null,
    )

    private val now: Instant = Instant.parse("2026-05-20T12:00:00Z")

    private fun item(
        id: String,
        status: String? = null,
        ageDays: Long? = null,
        value: Double? = null,
    ): Item = Item(id, status, ageDays?.let { now.minusSeconds(it * 86_400) }, value)

    private val statusOptions =
        listOf(
            FilterOption("pending", "Pending"),
            FilterOption("accepted", "Accepted"),
            FilterOption("declined", "Declined"),
        )

    // ─── Section building ──────────────────────────────

    @Test
    fun `sections build status sort and date`() {
        val sections =
            activityFilterSections(
                statusTitle = "Status",
                statusOptions = statusOptions,
                sortOptions = ActivitySortOrder.ALL,
                filter = ActivityFilter(setOf("pending"), ActivitySortOrder.Newest, ActivityDateRange.Week),
            )
        assertEquals(
            listOf(
                ActivityFilterSectionId.STATUS,
                ActivityFilterSectionId.SORT,
                ActivityFilterSectionId.DATE_RANGE,
            ),
            sections.map { it.id },
        )
        assertTrue(sections[0].control is FilterControl.ChipGroup)
        assertTrue(sections[1].control is FilterControl.Radio)
        assertTrue(sections[2].control is FilterControl.SingleChip)
    }

    @Test
    fun `sections omit status when no options`() {
        val sections =
            activityFilterSections(
                statusTitle = "Status",
                statusOptions = emptyList(),
                sortOptions = ActivitySortOrder.TIME_ONLY,
                filter = ActivityFilter(),
            )
        assertEquals(
            listOf(ActivityFilterSectionId.SORT, ActivityFilterSectionId.DATE_RANGE),
            sections.map { it.id },
        )
    }

    // ─── Round-trip mapping ────────────────────────────

    @Test
    fun `filter round-trips through sections`() {
        val filter =
            ActivityFilter(
                statusIds = setOf("pending", "accepted"),
                sort = ActivitySortOrder.ValueHighToLow,
                dateRange = ActivityDateRange.Month,
            )
        val sections =
            activityFilterSections(
                statusTitle = "Status",
                statusOptions = statusOptions,
                sortOptions = ActivitySortOrder.ALL,
                filter = filter,
            )
        assertEquals(filter, activityFilterFrom(sections))
    }

    @Test
    fun `cleared sections parse to inactive filter`() {
        val sections =
            activityFilterSections(
                statusTitle = "Status",
                statusOptions = statusOptions,
                sortOptions = ActivitySortOrder.ALL,
                filter = ActivityFilter(setOf("pending"), ActivitySortOrder.Oldest, ActivityDateRange.Today),
            ).cleared()
        val parsed = activityFilterFrom(sections)
        assertFalse(parsed.isActive)
        assertEquals(ActivityFilter(), parsed)
    }

    @Test
    fun `single chip cleared drops selection`() {
        val control = FilterControl.SingleChip(options = statusOptions, selectedId = "pending")
        val cleared = control.cleared()
        assertTrue(cleared is FilterControl.SingleChip)
        assertNull((cleared as FilterControl.SingleChip).selectedId)
    }

    // ─── Apply ─────────────────────────────────────────

    @Test
    fun `apply inactive returns items unchanged`() {
        val items = listOf(item("a", ageDays = 1), item("b", ageDays = 5))
        val result =
            ActivityFilter().apply(items, now, statusId = { it.status }, date = { it.date }, value = { it.value })
        assertEquals(items, result)
    }

    @Test
    fun `apply status keeps matching chips`() {
        val items =
            listOf(
                item("a", status = "pending"),
                item("b", status = "accepted"),
                item("c", status = "declined"),
            )
        val result =
            ActivityFilter(statusIds = setOf("pending", "declined"))
                .apply(items, now, statusId = { it.status }, date = { it.date }, value = { it.value })
        assertEquals(listOf("a", "c"), result.map { it.id })
    }

    @Test
    fun `apply date range today and week and month`() {
        val items = listOf(item("d0", ageDays = 0), item("d3", ageDays = 3), item("d40", ageDays = 40))
        val today =
            ActivityFilter(dateRange = ActivityDateRange.Today)
                .apply(items, now, statusId = { it.status }, date = { it.date }, value = { it.value })
        assertEquals(listOf("d0"), today.map { it.id })
        val week =
            ActivityFilter(dateRange = ActivityDateRange.Week)
                .apply(items, now, statusId = { it.status }, date = { it.date }, value = { it.value })
        assertEquals(listOf("d0", "d3"), week.map { it.id })
        val month =
            ActivityFilter(dateRange = ActivityDateRange.Month)
                .apply(items, now, statusId = { it.status }, date = { it.date }, value = { it.value })
        assertEquals(listOf("d0", "d3"), month.map { it.id })
    }

    @Test
    fun `apply sort newest oldest and value`() {
        val byDate = listOf(item("old", ageDays = 10), item("mid", ageDays = 5), item("new", ageDays = 1))
        assertEquals(
            listOf("new", "mid", "old"),
            ActivityFilter(sort = ActivitySortOrder.Newest)
                .apply(byDate, now, statusId = { it.status }, date = { it.date }, value = { it.value })
                .map { it.id },
        )
        assertEquals(
            listOf("old", "mid", "new"),
            ActivityFilter(sort = ActivitySortOrder.Oldest)
                .apply(byDate, now, statusId = { it.status }, date = { it.date }, value = { it.value })
                .map { it.id },
        )
        val byValue = listOf(item("lo", value = 10.0), item("hi", value = 99.0), item("mid", value = 50.0))
        assertEquals(
            listOf("hi", "mid", "lo"),
            ActivityFilter(sort = ActivitySortOrder.ValueHighToLow)
                .apply(byValue, now, statusId = { it.status }, date = { it.date }, value = { it.value })
                .map { it.id },
        )
        assertEquals(
            listOf("lo", "mid", "hi"),
            ActivityFilter(sort = ActivitySortOrder.ValueLowToHigh)
                .apply(byValue, now, statusId = { it.status }, date = { it.date }, value = { it.value })
                .map { it.id },
        )
    }

    @Test
    fun `is active reflects any narrowing`() {
        assertFalse(ActivityFilter().isActive)
        assertTrue(ActivityFilter(statusIds = setOf("pending")).isActive)
        assertTrue(ActivityFilter(sort = ActivitySortOrder.Newest).isActive)
        assertTrue(ActivityFilter(dateRange = ActivityDateRange.Today).isActive)
    }
}

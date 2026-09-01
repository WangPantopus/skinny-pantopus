@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling._shared

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class TimezoneSearchTest {
    private val now: Instant = Instant.parse("2026-08-11T12:00:00Z")

    @Test
    fun `blank query returns the curated list unchanged`() {
        val curated = defaultTimezoneOptions(now)
        assertEquals(curated, searchTimezoneOptions("", curated, now = now))
        assertEquals(curated, searchTimezoneOptions("   ", curated, now = now))
    }

    @Test
    fun `query finds zones outside the curated nine`() {
        val curated = defaultTimezoneOptions(now)
        val results = searchTimezoneOptions("Karachi", curated, now = now)
        assertTrue(results.any { it.id == "Asia/Karachi" })
    }

    @Test
    fun `city-name matching handles underscores`() {
        val curated = defaultTimezoneOptions(now)
        val results = searchTimezoneOptions("Sao Paulo", curated, now = now)
        assertTrue(results.any { it.id == "America/Sao_Paulo" })
    }

    @Test
    fun `curated matches lead and results are capped`() {
        val curated = defaultTimezoneOptions(now)
        val results = searchTimezoneOptions("a", curated, now = now)
        assertTrue(results.size <= 60)
        // Curated rows that match keep their position ahead of database fills.
        val curatedMatchIds = curated.filter { it.name.contains("a", true) || it.id.contains("a", true) }.map { it.id }
        assertEquals(curatedMatchIds, results.take(curatedMatchIds.size).map { it.id })
    }

    @Test
    fun `no-match query returns empty`() {
        val curated = defaultTimezoneOptions(now)
        assertTrue(searchTimezoneOptions("zzzznotazone", curated, now = now).isEmpty())
    }
}

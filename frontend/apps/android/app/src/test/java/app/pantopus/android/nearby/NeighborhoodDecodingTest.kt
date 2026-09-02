package app.pantopus.android.nearby

import app.pantopus.android.data.api.models.neighborhood.NeighborhoodCells
import app.pantopus.android.data.api.models.neighborhood.NeighborhoodMeter
import app.pantopus.android.ui.screens.nearby.CELL_LEGEND_ORDER
import app.pantopus.android.ui.screens.nearby.cellFillAlpha
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The Nearby window: cells carry a bucket and a box, never a count or a point. */
class NeighborhoodDecodingTest {
    private val moshi: Moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()

    @Test
    fun `cells decode with bounds, buckets, the home flag, and the legend`() {
        val json =
            """
            {"state":"ready","home_cell":"c22zqm","center":{"lat":45.587,"lng":-122.403},"k_anon_min":10,
             "buckets":{"none":"No verified homes yet","forming":"Forming (under 10)","few":"A few (10–24)","growing":"Growing (25+)"},
             "cells":[{"geohash":"c22zqm","bounds":[[45.5845,-122.4085],[45.5900,-122.3975]],"bucket":"growing","is_home":true},
                      {"geohash":"c22zqj","bounds":[[45.5790,-122.4085],[45.5845,-122.3975]],"bucket":"none","is_home":false}]}
            """.trimIndent()
        val cells = moshi.adapter(NeighborhoodCells::class.java).fromJson(json)!!
        assertEquals("ready", cells.state)
        assertEquals(2, cells.cells.size)
        val home = cells.cells.first { it.isHome }
        assertEquals("growing", home.bucket)
        assertEquals(listOf(45.5845, -122.4085), home.bounds[0])
        assertEquals("Growing (25+)", cells.buckets["growing"])
        assertTrue(json.contains("verified_users_count").not())
    }

    @Test
    fun `the meter withholds the count below the floor`() {
        val meter =
            moshi.adapter(NeighborhoodMeter::class.java).fromJson(
                """
                {"state":"forming","verified_count":null,"k_anon_min":10,"threshold":25,"unlocked":false,
                 "area":{"city":"Camas","state":"WA"}}
                """.trimIndent(),
            )!!
        assertNull(meter.verifiedCount)
        assertEquals("Camas", meter.area?.city)
        assertEquals(false, meter.unlocked)
    }

    @Test
    fun `cell fills shade by bucket and unknown buckets stay transparent`() {
        assertEquals(0f, cellFillAlpha("none"))
        assertTrue(cellFillAlpha("forming") < cellFillAlpha("few"))
        assertTrue(cellFillAlpha("few") < cellFillAlpha("growing"))
        assertEquals(0f, cellFillAlpha("purple"))
        assertEquals(listOf("none", "forming", "few", "growing"), CELL_LEGEND_ORDER)
    }
}

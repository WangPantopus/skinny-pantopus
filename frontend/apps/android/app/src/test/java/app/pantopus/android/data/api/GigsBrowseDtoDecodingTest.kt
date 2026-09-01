package app.pantopus.android.data.api

import app.pantopus.android.data.api.models.gigs.GigsBrowseResponse
import app.pantopus.android.data.api.models.gigs.PriceBenchmarkResponse
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * P1.F / P1.G — decode fixtures for `GET /api/gigs/browse` (route
 * `backend/routes/gigs.js:3190`) and `GET /api/gigs/price-benchmark`
 * (`gigs.js:2985`). Locks the section envelope, the spatial-RPC row
 * enrichments (`distance_meters`, `first_image`), the cluster shape,
 * and the benchmark percentiles in place.
 */
class GigsBrowseDtoDecodingTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private inline fun <reified T> decode(json: String): T = checkNotNull(moshi.adapter(T::class.java).fromJson(json))

    @Test fun browse_response() {
        val json = """
            {"sections":{
               "best_matches":[{"id":"g1","title":"Hang shelves","category":"handyman","price":60,
                                "pay_type":"fixed","is_urgent":true,"created_at":"2026-06-09T12:00:00Z",
                                "user_id":"u1","bid_count":2,"distance_meters":804.5,
                                "first_image":"https://cdn.example/img1.jpg"}],
               "urgent":[{"id":"g2","title":"Emergency leak","category":"handyman","price":120,
                          "is_urgent":true,"distance_meters":1200.0}],
               "clusters":[{"category":"cleaning","count":4,"price_min":40,"price_max":180,
                            "price_avg":92.5,"nearest_distance":640.2,
                            "newest_at":"2026-06-10T01:00:00Z","representative_title":"Deep clean 2BR"}],
               "high_paying":[],
               "new_today":[{"id":"g3","title":"Dog walk","category":"petcare","price":22}],
               "quick_jobs":[]},
             "total_active":27,
             "radius_used":160934}
        """
        val response = decode<GigsBrowseResponse>(json)
        assertEquals(27, response.totalActive)
        assertEquals(160_934, response.radiusUsed)
        val best = response.sections.bestMatches.single()
        assertEquals("g1", best.id)
        assertEquals(true, best.isUrgent)
        assertEquals(804.5, best.distanceMeters!!, 0.0)
        assertEquals("https://cdn.example/img1.jpg", best.firstImage)
        assertEquals(2, best.bidCount)
        assertEquals("g2", response.sections.urgent.single().id)
        assertEquals("g3", response.sections.newToday.single().id)
        assertTrue(response.sections.highPaying.isEmpty())
        assertTrue(response.sections.quickJobs.isEmpty())
        val cluster = response.sections.clusters.single()
        assertEquals("cleaning", cluster.category)
        assertEquals(4, cluster.count)
        assertEquals(40.0, cluster.priceMin!!, 0.0)
        assertEquals(180.0, cluster.priceMax!!, 0.0)
        assertEquals("Deep clean 2BR", cluster.representativeTitle)
    }

    @Test fun browse_response_tolerates_missing_sections() {
        val response = decode<GigsBrowseResponse>("""{"sections":{}}""")
        assertTrue(response.sections.bestMatches.isEmpty())
        assertTrue(response.sections.clusters.isEmpty())
        assertNull(response.totalActive)
    }

    @Test fun price_benchmark_response() {
        val json = """
            {"benchmark":{"low":40,"median":75,"high":120,
                          "basis":"completed_tasks","comparable_count":12,"category":"handyman"}}
        """
        val benchmark = decode<PriceBenchmarkResponse>(json).benchmark!!
        assertEquals(40.0, benchmark.low!!, 0.0)
        assertEquals(75.0, benchmark.median!!, 0.0)
        assertEquals(120.0, benchmark.high!!, 0.0)
        assertEquals("completed_tasks", benchmark.basis)
        assertEquals(12, benchmark.comparableCount)
    }

    @Test fun price_benchmark_response_with_null_benchmark() {
        assertNull(decode<PriceBenchmarkResponse>("""{"benchmark":null}""").benchmark)
    }
}

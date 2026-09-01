package app.pantopus.android.data.api.models.businesses

import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class BusinessServiceAreaDtoTest {
    private val moshi: Moshi =
        Moshi
            .Builder()
            .add(BusinessServiceAreaJsonAdapter())
            .addLast(KotlinJsonAdapterFactory())
            .build()

    private inline fun <reified T> decode(json: String): T = checkNotNull(moshi.adapter(T::class.java).fromJson(json))

    @Test
    fun decodes_legacy_string() {
        val dto = decode<BusinessServiceAreaDto>("\"Serves Cambridge & Somerville\"")
        assertEquals("Serves Cambridge & Somerville", dto.formattedLabel())
    }

    @Test
    fun decodes_structured_object() {
        val dto =
            decode<BusinessServiceAreaDto>(
                """{"city":"Cambridge","state":"MA","radius_miles":25,"center_lat":42.37,"center_lng":-71.11}""",
            )
        assertEquals("Cambridge, MA — within 25 mi", dto.formattedLabel())
        assertEquals(42.37, dto.centerLat)
    }

    @Test
    fun decodes_empty_object_as_null_label() {
        val dto = decode<BusinessServiceAreaDto>("{}")
        assertNull(dto.formattedLabel())
    }

    @Test
    fun business_detail_response_decodes_object_service_area() {
        val json =
            """
            {
              "business": {
                "id": "biz-1",
                "username": "test-biz",
                "name": "Test Biz",
                "account_type": "business"
              },
              "profile": {
                "business_user_id": "biz-1",
                "service_area": {
                  "radius_miles": 25,
                  "center_lat": 42.37,
                  "center_lng": -71.11
                }
              },
              "locations": [
                {
                  "id": "loc-1",
                  "is_primary": true,
                  "city": "Cambridge",
                  "state": "MA",
                  "location": { "lat": 42.37, "lng": -71.11 }
                }
              ]
            }
            """.trimIndent()
        val response = decode<BusinessDetailResponse>(json)
        assertNotNull(response.profile?.serviceArea)
        assertEquals("within 25 mi", response.profile?.serviceArea?.formattedLabel())
    }
}

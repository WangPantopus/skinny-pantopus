package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.auth.LoginRequest
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.Rfc3339DateJsonAdapter
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.time.Instant

/**
 * Exercises AuthApi / HubApi against a MockWebServer to verify URL paths,
 * query parameters, error taxonomy, and safeApiCall mapping.
 */
class ApiServiceTest {
    private lateinit var server: MockWebServer
    private lateinit var retrofit: Retrofit

    @Before
    fun setUp() {
        server = MockWebServer().also { it.start() }
        val moshi =
            Moshi
                .Builder()
                .add(Instant::class.java, Rfc3339DateJsonAdapter().nullSafe())
                .addLast(KotlinJsonAdapterFactory())
                .build()
        retrofit =
            Retrofit
                .Builder()
                .baseUrl(server.url("/"))
                .client(OkHttpClient.Builder().build())
                .addConverterFactory(MoshiConverterFactory.create(moshi))
                .build()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun authApi_login_hits_correct_path() =
        runTest {
            server.enqueue(
                MockResponse().setResponseCode(200).setBody(
                    """
                {"message":"ok","accessToken":"at","refreshToken":"rt","expiresIn":3600,"expiresAt":1,
                 "user":{"id":"u","email":"a@b","username":"a","name":"A B","firstName":"A",
                         "middleName":null,"lastName":"B","phoneNumber":null,"address":null,
                         "city":null,"state":null,"zipcode":null,"accountType":"personal",
                         "role":"member","verified":true,"createdAt":"2025-01-01T00:00:00Z"}}
                """,
                ),
            )
            val api = retrofit.create(AuthApi::class.java)
            val response = safeApiCall { api.login(LoginRequest("a@b", "pw")) }

            val recorded = server.takeRequest()
            assertEquals("POST", recorded.method)
            assertEquals("/api/users/login", recorded.path)
            assertTrue(response is NetworkResult.Success)
        }

    @Test
    fun safeApiCall_maps_401_to_Unauthorized() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(401).setBody("{\"error\":\"no\"}"))
            val api = retrofit.create(AuthApi::class.java)
            val response = safeApiCall { api.login(LoginRequest("a", "b")) }
            val failure = response as NetworkResult.Failure
            assertTrue(failure.error is NetworkError.Unauthorized)
        }

    @Test
    fun safeApiCall_maps_404_to_NotFound() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(404).setBody("{}"))
            val api = retrofit.create(HomesApi::class.java)
            val response = safeApiCall { api.detail("missing") }
            val failure = response as NetworkResult.Failure
            assertTrue(failure.error is NetworkError.NotFound)
        }

    @Test
    fun safeApiCall_maps_503_to_Server() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(503).setBody("{}"))
            val api = retrofit.create(HubApi::class.java)
            val response = safeApiCall { api.overview() }
            val failure = response as NetworkResult.Failure
            val error = failure.error
            assertTrue(error is NetworkError.Server)
            assertEquals(503, (error as NetworkError.Server).code)
        }

    @Test
    fun hubApi_discovery_appends_query_params() =
        runTest {
            server.enqueue(MockResponse().setResponseCode(200).setBody("""{"items":[]}"""))
            val api = retrofit.create(HubApi::class.java)
            safeApiCall { api.discovery(filter = "gigs", lat = 37.7, lng = -122.4, limit = 5) }
            val recorded = server.takeRequest()
            val path = recorded.path.orEmpty()
            assertTrue("filter=gigs missing in $path", path.contains("filter=gigs"))
            assertTrue("lat missing in $path", path.contains("lat=37.7"))
            assertTrue("lng missing in $path", path.contains("lng=-122.4"))
            assertTrue("limit missing in $path", path.contains("limit=5"))
        }
}

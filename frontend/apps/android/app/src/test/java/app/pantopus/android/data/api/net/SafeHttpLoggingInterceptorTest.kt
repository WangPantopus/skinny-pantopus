package app.pantopus.android.data.api.net

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SafeHttpLoggingInterceptorTest {
    @Test fun `debug diagnostics exclude credentials proofs URLs and private response bytes`() {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("private-document-bytes"))
            val logs = mutableListOf<String>()
            val client = OkHttpClient.Builder().addInterceptor(SafeHttpLoggingInterceptor(true, logs::add)).build()
            val request =
                Request.Builder()
                    .url(server.url("/private-invite-secret?token=query-secret"))
                    .header("Authorization", "Bearer access-secret")
                    .header("DPoP", "device-proof-secret")
                    .header("Cookie", "session=cookie-secret")
                    .post("password=password-secret".toRequestBody()).build()
            client.newCall(request).execute().use { response ->
                assertEquals("private-document-bytes", response.body?.string())
            }
            val output = logs.joinToString()
            assertTrue(output.startsWith("HTTP POST -> 200"))
            for (secret in listOf(
                "private-invite",
                "query-secret",
                "access-secret",
                "device-proof",
                "cookie-secret",
                "password-secret",
                "private-document",
            )) {
                assertFalse(output.contains(secret))
            }
            assertEquals("password=password-secret", server.takeRequest().body.readUtf8())
        }
    }

    @Test fun `release diagnostics stay disabled`() {
        MockWebServer().use { server ->
            server.enqueue(MockResponse().setBody("ok"))
            val logs = mutableListOf<String>()
            val client = OkHttpClient.Builder().addInterceptor(SafeHttpLoggingInterceptor(false, logs::add)).build()
            client.newCall(Request.Builder().url(server.url("/")).build()).execute().close()
            assertTrue(logs.isEmpty())
        }
    }
}

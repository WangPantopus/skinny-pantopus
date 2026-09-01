package app.pantopus.android.ui.screens.inbox.conversation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatMediaUrlTest {
    @Test
    fun resolve_absolute_chat_file_includes_token() {
        val resolved =
            ChatMediaUrl.resolve(
                raw = "/api/chat/files/abc-123",
                accessToken = "tok",
                apiBaseUrl = "http://192.168.0.176:8000",
            )
        assertEquals(
            "http://192.168.0.176:8000/api/chat/files/abc-123?token=tok",
            resolved,
        )
    }

    @Test
    fun resolve_https_passthrough_without_token() {
        val resolved =
            ChatMediaUrl.resolve(
                raw = "https://cdn.example.com/photo.jpg",
                accessToken = "tok",
                apiBaseUrl = "http://192.168.0.176:8000",
            )
        assertEquals("https://cdn.example.com/photo.jpg", resolved)
    }

    @Test
    fun resolve_blank_returns_null() {
        assertNull(ChatMediaUrl.resolve("   ", accessToken = "tok"))
    }

    @Test
    fun resolve_preserves_existing_query() {
        val resolved =
            ChatMediaUrl.resolve(
                raw = "/api/chat/files/x?download=1",
                accessToken = "tok",
                apiBaseUrl = "http://10.0.0.1:8000",
            )
        assertTrue(resolved!!.contains("download=1"))
        assertTrue(resolved.contains("token=tok"))
    }
}

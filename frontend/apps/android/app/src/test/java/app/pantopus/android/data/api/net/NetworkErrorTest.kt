package app.pantopus.android.data.api.net

import org.junit.Assert.assertEquals
import org.junit.Test

class NetworkErrorTest {
    @Test
    fun clientError_parsesValidationDetails() {
        val raw =
            """
            {"error":"Validation failed","message":"Please correct the highlighted fields.",
            "details":[{"field":"safetyAlertKind","message":"Safety Alert Kind is required.",
            "code":"any.required"}]}
            """.trimIndent().replace("\n", "")
        val error = NetworkError.ClientError(400, raw)
        assertEquals("Safety Alert Kind is required.", error.message)
    }
}

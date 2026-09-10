package app.pantopus.android.data.api.models.payments

import com.squareup.moshi.JsonDataException
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PaymentSheetSaveDtosTest {
    private val moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()

    @Test
    fun setup_identifier_is_required_and_uses_camel_case() {
        val dto =
            checkNotNull(
                moshi.adapter(AddCardSheetParamsDto::class.java).fromJson(
                    """
                    {"setupIntent":"seti_saved_secret_test","setupIntentId":"seti_saved",
                     "setupStatus":"requires_payment_method","ephemeralKey":"ek_test","customer":"cus_test"}
                    """.trimIndent(),
                ),
            )
        assertEquals("seti_saved", dto.setupIntentId)
        assertEquals("requires_payment_method", dto.setupStatus)
        assertEquals(
            """{"setupIntentId":"seti_saved"}""",
            moshi.adapter(ConfirmAddCardRequest::class.java).toJson(ConfirmAddCardRequest(dto.setupIntentId)),
        )
    }

    @Test(expected = JsonDataException::class)
    fun missing_identifier_is_rejected() {
        moshi.adapter(AddCardSheetParamsDto::class.java).fromJson(
            """{"setupIntent":"seti_saved_secret_test","ephemeralKey":"ek_test","customer":"cus_test"}""",
        )
    }

    @Test
    fun recovery_request_sends_only_same_identifier_and_new_request_omits_it() {
        val adapter = moshi.adapter(AddCardSheetRequest::class.java)
        assertEquals("{}", adapter.toJson(AddCardSheetRequest()))
        assertEquals("""{"setupIntentId":"seti_saved"}""", adapter.toJson(AddCardSheetRequest("seti_saved")))
    }

    @Test(expected = JsonDataException::class)
    fun missing_status_is_rejected() {
        moshi.adapter(AddCardSheetParamsDto::class.java).fromJson(
            """
            {"setupIntent":"seti_saved_secret_test","setupIntentId":"seti_saved", "ephemeralKey":"ek_test","customer":"cus_test"}
            """.trimIndent(),
        )
    }

    @Test
    fun durable_receipt_maps_nested_card_columns() {
        val dto =
            checkNotNull(
                moshi.adapter(ConfirmAddCardResponse::class.java).fromJson(
                    """
                    {"confirmed":true,"paymentMethod":{"id":"pm_saved","payment_method_type":"card",
                     "card_brand":"visa","card_last4":"4242","is_default":true}}
                    """.trimIndent(),
                ),
            )
        assertTrue(dto.confirmed)
        assertEquals("4242", dto.paymentMethod.cardLast4)
        assertTrue(dto.paymentMethod.isDefault)
    }
}

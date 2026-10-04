@file:Suppress("PackageNaming", "MagicNumber")

package app.pantopus.android.data.analytics

import android.os.SystemClock
import app.pantopus.android.data.api.services.HubApi
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.auth.AuthenticatedDispatchGuard
import app.pantopus.android.data.auth.TokenStorage
import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okio.BufferedSink
import javax.inject.Inject
import javax.inject.Singleton

/** Process state survives Activity rotation; only real background intervals count. */
internal class PilotSessionWindow {
    var opened = false
        private set
    var foreground = false
        private set
    private var backgroundAt: Long? = null

    fun enterForeground(now: Long): Boolean {
        if (foreground) return false
        foreground = true
        val shouldOpen = !opened || backgroundAt?.let { now - it >= 30 * 60 * 1000L } == true
        opened = true
        backgroundAt = null
        return shouldOpen
    }

    fun enterBackground(now: Long) {
        if (!foreground) return
        foreground = false
        backgroundAt = now
    }
}

@JsonClass(generateAdapter = true)
data class PilotEventBody(
    @Json(name = "event_type") val eventType: String,
    val meta: Map<String, String>,
)

/** Existing authenticated Hub transport; no disk queue or event retry. */
@Singleton
class PilotEvents
    @Inject
    constructor(
        private val api: HubApi,
        private val auth: AuthRepository,
        private val tokens: TokenStorage,
        private val moshi: Moshi,
    ) {
        enum class Event(val wire: String) {
            SessionOpen("session_open"),
            ReminderAction("reminder_action"),
            SuggestionDecision("suggestion_decision"),
        }

        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        private val window = PilotSessionWindow()
        private var pendingOpen = false
        private var pendingActor: String? = null
        private var pushType: String? = null
        private var flush: Job? = null
        private val actor: String? get() = (auth.state.value as? AuthRepository.State.SignedIn)?.user?.id

        fun enterForeground(now: Long = SystemClock.elapsedRealtime()) {
            if (window.enterForeground(now)) {
                pendingOpen = true
                pendingActor = actor
            } else if (!pendingOpen) {
                pushType = null
            }
            scheduleOpen()
        }

        fun enterBackground(now: Long = SystemClock.elapsedRealtime()) {
            window.enterBackground(now)
            flush?.cancel()
            flush = null
            pendingOpen = false
            pendingActor = null
            pushType = null
        }

        /** Activity PendingIntent only; an FCM delivery does not call this. */
        fun notificationOpened(type: String?) {
            if (window.opened && window.foreground && !pendingOpen) return
            pushType = identifier(type) ?: "unknown"
            scheduleOpen()
        }

        fun authChanged() {
            if (pendingActor != null && actor != pendingActor) {
                pendingOpen = false
                pushType = null
            }
            scheduleOpen()
        }

        fun record(
            event: Event,
            meta: Map<String, String>,
        ) {
            val expectedActor = actor ?: return
            scope.launch { send(event, meta, expectedActor) }
        }

        suspend fun send(
            event: Event,
            meta: Map<String, String>,
            expectedActor: String? = actor,
        ) {
            if (expectedActor == null || actor != expectedActor) return
            try {
                val credentials = tokens.sessionCredentials() ?: return
                if (credentials.sessionId.isNullOrBlank() || credentials.userId != expectedActor || actor != expectedActor) return
                val json = moshi.adapter(PilotEventBody::class.java).toJson(payload(event, meta))
                val body = json.toRequestBody("application/json".toMediaType())
                // A lost response must not cause OkHttp to resend an event with no
                // server dedup key. Existing preflight auth still runs normally.
                api.funnelEvent(
                    object : RequestBody() {
                        override fun contentType() = body.contentType()

                        override fun contentLength() = body.contentLength()

                        override fun writeTo(sink: BufferedSink) = body.writeTo(sink)

                        override fun isOneShot() = true
                    },
                    AuthenticatedDispatchGuard { current ->
                        check(current != null && current.userId == credentials.userId && current.sessionId == credentials.sessionId)
                        check(actor == expectedActor)
                    },
                )
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (_: Exception) {
                // Measurement is best effort; never log payloads or retry an uncertain POST.
            }
        }

        private fun scheduleOpen() {
            if (!pendingOpen || !window.foreground || actor == null) return
            flush?.cancel()
            flush =
                scope.launch {
                    delay(1_000)
                    val openingActor = actor ?: return@launch
                    if (!pendingOpen || !window.foreground) return@launch
                    if (pendingActor != null && pendingActor != openingActor) return@launch
                    pendingOpen = false
                    pendingActor = null
                    val meta = mutableMapOf("trigger" to if (pushType == null) "organic" else "push")
                    pushType?.let { meta["push_type"] = it }
                    pushType = null
                    send(Event.SessionOpen, meta, openingActor)
                }
        }

        companion object {
            internal fun payload(
                event: Event,
                meta: Map<String, String>,
            ): PilotEventBody {
                val safe =
                    meta.filter { (key, value) ->
                        value.length <= 40 &&
                            when (key) {
                                "platform" -> value in setOf("ios", "android")
                                "trigger" -> value in setOf("push", "organic")
                                "push_type" -> identifier(value) != null
                                "kind" -> value in setOf("pickup", "task")
                                "action" -> value in setOf("bins_out", "done", "not_now")
                                "date" -> value.matches(Regex("^\\d{4}-\\d{2}-\\d{2}$"))
                                "suggestion" -> value == "radon_test"
                                "decision" -> value in setOf("already_tested", "reminder_added", "not_now")
                                else -> false
                            }
                    }.toMutableMap()
                safe["platform"] = "android"
                return PilotEventBody(event.wire, safe)
            }

            private fun identifier(value: String?): String? = value?.takeIf { it.length <= 40 && it.matches(Regex("^[a-z][a-z0-9_]*$")) }
        }
    }

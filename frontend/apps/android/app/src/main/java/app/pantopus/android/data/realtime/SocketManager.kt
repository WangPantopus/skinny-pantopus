package app.pantopus.android.data.realtime

import app.pantopus.android.BuildConfig
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONObject
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

/**
 * Socket.IO client wrapper.
 *
 * - [connect] / [disconnect] manage lifecycle.
 * - [connectionState] is a StateFlow so the UI can react.
 * - [eventsOf] exposes a given event as a cold Flow of JSON payloads.
 */
@Singleton
class SocketManager
    @Inject
    constructor() {
        enum class ConnectionState { Disconnected, Connecting, Connected }

        private val _connectionState = MutableStateFlow(ConnectionState.Disconnected)
        val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

        private var socket: Socket? = null
        private var authToken: String? = null

        fun connect(token: String) {
            if (authToken == token && socket != null) {
                if (socket?.connected() != true) {
                    _connectionState.value = ConnectionState.Connecting
                    socket?.connect()
                }
                return
            }
            if (socket != null) disconnect()
            authToken = token
            _connectionState.value = ConnectionState.Connecting
            val options =
                IO.Options
                    .builder()
                    .setAuth(mapOf("token" to token))
                    .setReconnection(true)
                    .setReconnectionDelay(2_000)
                    .setReconnectionAttempts(Integer.MAX_VALUE)
                    .setExtraHeaders(mapOf("Authorization" to listOf("Bearer $token")))
                    .build()

            val s = IO.socket(BuildConfig.PANTOPUS_SOCKET_URL, options)
            s.on(Socket.EVENT_CONNECT) {
                _connectionState.value = ConnectionState.Connected
                Timber.i("Socket connected")
            }
            s.on(Socket.EVENT_DISCONNECT) {
                _connectionState.value = ConnectionState.Disconnected
                Timber.i("Socket disconnected")
            }
            s.on(Socket.EVENT_CONNECT_ERROR) { args ->
                Timber.w("Socket connect error: ${args.joinToString()}")
            }
            s.connect()
            socket = s
        }

        fun disconnect() {
            socket?.disconnect()
            socket?.off()
            socket = null
            authToken = null
            _connectionState.value = ConnectionState.Disconnected
        }

        /**
         * Listen to [event] as a cold Flow of JSONObject payloads.
         * Collectors are responsible for parsing the JSON into their own types.
         */
        fun eventsOf(event: String): Flow<JSONObject> =
            callbackFlow {
                val s =
                    socket ?: run {
                        close()
                        return@callbackFlow
                    }
                val listener =
                    io.socket.emitter.Emitter.Listener { args ->
                        (args.firstOrNull() as? JSONObject)?.let { trySend(it) }
                    }
                s.on(event, listener)
                awaitClose { s.off(event, listener) }
            }

        fun emit(
            event: String,
            payload: JSONObject,
        ) {
            socket?.emit(event, payload)
        }

        suspend fun emitWithAck(
            event: String,
            payload: JSONObject,
            timeoutMs: Long = 5_000,
        ): JSONObject? {
            val s = socket ?: return null
            return withTimeoutOrNull(timeoutMs) {
                suspendCancellableCoroutine { continuation ->
                    s.emit(
                        event,
                        payload,
                        Ack { args ->
                            val response = args.firstOrNull() as? JSONObject
                            if (continuation.isActive) continuation.resume(response)
                        },
                    )
                }
            }
        }
    }

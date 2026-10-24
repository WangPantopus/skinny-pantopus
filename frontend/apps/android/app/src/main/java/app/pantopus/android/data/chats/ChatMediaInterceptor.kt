package app.pantopus.android.data.chats

import app.pantopus.android.data.api.net.ApiOrigin
import app.pantopus.android.data.store.CHAT_MEDIA_FILE_MAX_BYTES
import app.pantopus.android.data.store.SavedCopies
import app.pantopus.android.data.store.ScreenStore
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import okio.ForwardingSource
import okio.buffer
import java.io.IOException
import java.net.HttpURLConnection.HTTP_OK
import javax.inject.Inject
import javax.inject.Provider

/** Online access is always checked; only transport/server failure may reuse bounded encrypted received media. */
class ChatMediaInterceptor
    @Inject
    constructor(
        private val store: Provider<ScreenStore>,
        private val origin: ApiOrigin,
    ) : Interceptor {
        @Suppress("ReturnCount") // Origin, refusal and transport guards must precede any saved-copy fallback.
        override fun intercept(chain: Interceptor.Chain): Response {
            val request = chain.request()
            if (request.method != "GET" || !origin.matches(request.url) || !FILE_PATH.matches(request.url.encodedPath)) {
                return chain.proceed(request)
            }
            // Credentials and unrelated query parameters never become persistent keys or system metadata.
            val key = request.url.encodedPath + if (request.url.queryParameter("variant") == "thumbnail") "?thumbnail" else ""
            val access = store.get().chatMediaAccess(key) ?: return chain.proceed(request)
            val response =
                try {
                    chain.proceed(request.newBuilder().header("Cache-Control", "no-store").build())
                } catch (error: IOException) {
                    if (chain.call().isCanceled()) throw error
                    return cached(request, access) ?: throw error
                }
            if (response.code in REFUSALS) {
                access.refuse()
                return response
            }
            if (response.code == HTTP_GONE) {
                // A deleted message's file: its saved copy can never answer a later offline read.
                access.forget()
                return response
            }
            if (response.code in SERVER_FAILURES) {
                cached(request, access)?.let {
                    response.close()
                    return it
                }
            }
            if (!response.isSuccessful) return response
            return try {
                receive(response, access)
            } catch (error: IOException) {
                response.close()
                if (chain.call().isCanceled()) throw error
                cached(request, access) ?: throw error
            }
        }

        private fun receive(
            response: Response,
            access: ScreenStore.ChatMediaAccess,
        ): Response {
            val body = response.body ?: return response
            val source = body.source()
            // Read at most this bounded prefix. Larger originals stream without entering the offline store.
            if (!source.request(CHAT_MEDIA_FILE_MAX_BYTES + 1)) {
                val bytes = source.readByteArray()
                val contentType = body.contentType()
                body.close()
                requireCurrent(access)
                access.write(SavedCopies.MediaCopy(bytes, contentType?.toString().orEmpty()))
                return guard(response.newBuilder().body(bytes.toResponseBody(contentType)).build(), access)
            }
            return guard(response, access)
        }

        private fun guard(
            response: Response,
            access: ScreenStore.ChatMediaAccess,
        ): Response {
            val body = response.body ?: return response
            val source = body.source()
            val guarded =
                object : ResponseBody() {
                    private val input =
                        object : ForwardingSource(source) {
                            override fun read(
                                sink: Buffer,
                                byteCount: Long,
                            ): Long {
                                requireCurrent(access)
                                val read = super.read(sink, byteCount)
                                requireCurrent(access)
                                return read
                            }
                        }.buffer()

                    override fun contentType() = body.contentType()

                    override fun contentLength() = body.contentLength()

                    override fun source() = input
                }
            return response.newBuilder().body(guarded).build()
        }

        private fun cached(
            request: Request,
            access: ScreenStore.ChatMediaAccess,
        ): Response? {
            val copy = access.read() ?: return null
            requireCurrent(access)
            val response =
                Response.Builder()
                    .request(request)
                    .protocol(Protocol.HTTP_1_1)
                    .code(HTTP_OK)
                    .message("Saved chat file")
                    .header("Cache-Control", "no-store")
                    .body(copy.bytes.toResponseBody(copy.contentType.toMediaTypeOrNull()))
                    .build()
            return guard(response, access)
        }

        private fun requireCurrent(access: ScreenStore.ChatMediaAccess) {
            if (!access.isCurrent()) throw IOException("Chat file access changed.")
        }

        private companion object {
            val FILE_PATH = Regex("/api/chat/files/[^/]+")
            val REFUSALS = setOf(401, 403, 404)
            const val HTTP_GONE = 410
            val SERVER_FAILURES = 500..599
        }
    }

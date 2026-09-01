package app.pantopus.android.data.auth

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp interceptor that attaches `Authorization: Bearer <token>` and the
 * `X-Client-Platform` header on every request.
 *
 * Recovery from a 401 (silent token refresh + replay) is handled by
 * [TokenAuthenticator], which OkHttp invokes automatically — keeping this
 * interceptor a pure header-stamping step.
 *
 * Using runBlocking here is pragmatic: OkHttp interceptors are synchronous.
 * Reads from EncryptedSharedPreferences are fast (cached) and bounded to the
 * OkHttp dispatcher thread.
 */
@Singleton
class AuthInterceptor
    @Inject
    constructor(
        private val tokenStorage: TokenStorage,
    ) : Interceptor {
        override fun intercept(chain: Interceptor.Chain): Response {
            val request =
                chain
                    .request()
                    .newBuilder()
                    .apply {
                        val token = runBlocking { tokenStorage.accessToken() }
                        if (!token.isNullOrBlank()) {
                            header("Authorization", "Bearer $token")
                        }
                        header("X-Client-Platform", "android")
                    }.build()

            return chain.proceed(request)
        }
    }

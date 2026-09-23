@file:Suppress("MagicNumber")

package app.pantopus.android.data.api.net

import com.squareup.moshi.JsonDataException
import retrofit2.HttpException
import java.io.IOException

/**
 * Invoke [block] and map any thrown exception onto a typed [NetworkResult].
 *
 * Retrofit's suspend functions throw [HttpException] on non-2xx and
 * [IOException] on transport failures; Moshi throws [JsonDataException] on
 * decode errors. Everything else surfaces as [NetworkError.Transport] so
 * call sites can handle a single sealed hierarchy.
 *
 * Usage: `val result = safeApiCall { authApi.login(body) }`.
 *
 * A 403 maps to [NetworkError.Forbidden], which every existing call site
 * already switches on; its message is the server's sentence when the body
 * carries a readable one, else the generic copy.
 * [surfaceForbiddenBody] is OPT-IN: pass `true` only where the caller must
 * read the raw 403 body — e.g. the Real Rent contribution's
 * `VERIFICATION_REQUIRED`, whose whole message ("verify your address…")
 * IS the next step. With the flag on, a 403 that carries a body arrives as
 * [NetworkError.ClientError] (code 403), exactly as 400 already does; a
 * bodiless 403 still maps to [NetworkError.Forbidden].
 */
suspend inline fun <T> safeApiCall(
    surfaceForbiddenBody: Boolean = false,
    crossinline block: suspend () -> T,
): NetworkResult<T> =
    try {
        NetworkResult.Success(block())
    } catch (error: HttpException) {
        val body = runCatching { error.response()?.errorBody()?.string() }.getOrNull()
        val mapped =
            when (error.code()) {
                401 -> NetworkError.Unauthorized
                403 ->
                    if (surfaceForbiddenBody && !body.isNullOrBlank()) {
                        NetworkError.ClientError(403, body)
                    } else {
                        NetworkError.Forbidden(body)
                    }
                404 -> NetworkError.NotFound
                in 400..499 -> NetworkError.ClientError(error.code(), body)
                in 500..599 -> NetworkError.Server(error.code(), body)
                else -> NetworkError.ClientError(error.code(), body)
            }
        NetworkResult.Failure(mapped)
    } catch (error: JsonDataException) {
        // The user only sees "Received an unexpected response."; keep the cause in the log.
        timber.log.Timber.tag("HTTP").w(error, "decoding failure")
        NetworkResult.Failure(NetworkError.Decoding(error))
    } catch (error: IOException) {
        NetworkResult.Failure(NetworkError.Transport(error))
    }

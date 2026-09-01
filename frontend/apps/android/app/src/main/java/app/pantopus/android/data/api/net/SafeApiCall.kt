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
 * [surfaceForbiddenBody] is OPT-IN and defaults to the historical
 * behaviour, so every existing call site keeps mapping 403 to the canned
 * [NetworkError.Forbidden] object it already switches on. Pass `true`
 * only where the route writes a 403 sentence the resident must actually
 * read — e.g. the Real Rent contribution's `VERIFICATION_REQUIRED`,
 * whose whole message ("verify your address…") IS the next step. With
 * the flag on, a 403 that carries a body arrives as
 * [NetworkError.ClientError] (code 403) so the server's copy survives,
 * exactly as 400 already does; a bodiless 403 still maps to
 * [NetworkError.Forbidden].
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
                        NetworkError.Forbidden
                    }
                404 -> NetworkError.NotFound
                in 400..499 -> NetworkError.ClientError(error.code(), body)
                in 500..599 -> NetworkError.Server(error.code(), body)
                else -> NetworkError.ClientError(error.code(), body)
            }
        NetworkResult.Failure(mapped)
    } catch (error: JsonDataException) {
        NetworkResult.Failure(NetworkError.Decoding(error))
    } catch (error: IOException) {
        NetworkResult.Failure(NetworkError.Transport(error))
    }

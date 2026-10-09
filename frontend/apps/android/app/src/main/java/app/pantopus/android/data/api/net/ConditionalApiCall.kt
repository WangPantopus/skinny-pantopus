package app.pantopus.android.data.api.net

import com.squareup.moshi.JsonDataException
import retrofit2.HttpException
import retrofit2.Response

@PublishedApi
internal const val HTTP_NOT_MODIFIED = 304

/** A store read's reply (Instant Screens contract §6): new data with its ETag, or "the copy you hold is current". */
sealed interface Conditional<out T> {
    data class Fresh<T>(
        val data: T,
        val etag: String?,
    ) : Conditional<T>

    /** 304: keep the stored copy and count it as checked now. */
    data object NotModified : Conditional<Nothing>
}

/**
 * [safeApiCall] for an endpoint read through the store. [block] sends `If-None-Match` with the stored ETag (a
 * `@Header` parameter) and returns the raw [Response], so a 304 becomes [Conditional.NotModified] and a 200 carries
 * the reply's `ETag`. Other statuses map exactly as [safeApiCall] maps them.
 */
suspend inline fun <T> conditionalApiCall(crossinline block: suspend () -> Response<T>): NetworkResult<Conditional<T>> =
    safeApiCall {
        val response = block()
        when {
            response.code() == HTTP_NOT_MODIFIED -> Conditional.NotModified
            response.isSuccessful -> Conditional.Fresh(response.body() ?: throw JsonDataException("Empty reply"), response.headers()["ETag"])
            else -> throw HttpException(response)
        }
    }

/** Maps the data of a [Conditional.Fresh] reply (a 304 and failures pass through unchanged). */
inline fun <A, B> NetworkResult<Conditional<A>>.mapFresh(transform: (A) -> B): NetworkResult<Conditional<B>> =
    when (this) {
        is NetworkResult.Success ->
            when (val reply = data) {
                is Conditional.Fresh -> NetworkResult.Success(Conditional.Fresh(transform(reply.data), reply.etag))
                Conditional.NotModified -> NetworkResult.Success(Conditional.NotModified)
            }
        is NetworkResult.Failure -> this
    }

package app.pantopus.android.data.api.net

import okhttp3.Interceptor
import okhttp3.Response

/**
 * Plans with businesses (the build contract's section 5.1): `biz=1` tells the server this app can draw a business's
 * plan. Without it a business's plan does not exist for the request, for guests and for the business's own team, which
 * is what keeps one from reaching an older app that would draw it as a neighbor's.
 *
 * Added here, once, to every request under `/api/plans` (reads and writes), to `GET /api/posts/map` when it asks for the
 * Plans layer, and to `GET /api/businesses/:id/plans`. Nothing else changes for a person without the server's
 * `plans_business` switch: the server answers them exactly as before.
 */
class PlansBizInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val url = request.url
        if (url.queryParameter(PARAM) != null || !wantsBiz(url.encodedPath, url.queryParameter("layers"))) {
            return chain.proceed(request)
        }
        return chain.proceed(request.newBuilder().url(url.newBuilder().addQueryParameter(PARAM, "1").build()).build())
    }

    companion object {
        const val PARAM = "biz"

        /** True for the routes that read `biz=1`: Plans, the map's Plans layer and a business's plans. */
        fun wantsBiz(
            path: String,
            layers: String?,
        ): Boolean {
            val segments = path.trim('/').split('/')
            if (segments.size < 2 || segments[0] != "api") return false
            return when (segments[1]) {
                "plans" -> true
                "posts" -> segments.getOrNull(2) == "map" && segments.size == 3 && layers?.split(',')?.contains("plans") == true
                "businesses" -> segments.size == 4 && segments[3] == "plans"
                else -> false
            }
        }
    }
}

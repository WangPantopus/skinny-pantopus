package app.pantopus.android.data.homes

import java.net.URI

/** A local or staging invitation capability must never be shared under the production origin. */
fun homeInvitationSenderLink(
    original: PendingHomeInvitationSender,
    webBaseUrl: String,
    completed: Boolean,
): String? =
    runCatching {
        if (!completed || original.request.intent.action == "withdraw" ||
            !HomeResidencyReviewCodec.reviewHash(original.request.token)
        ) {
            return null
        }
        val api = URI(original.scope.origin)
        val web = URI(webBaseUrl)
        val cleanWeb = web.userInfo == null && web.query == null && web.fragment == null && web.path in listOf("", "/")
        if (!cleanWeb || api.userInfo != null) return null
        val matches = senderWebMatches(api, web)
        if (!matches) return null
        webBaseUrl.trimEnd('/') + "/invite/" + original.request.token
    }.getOrNull()

private fun senderWebMatches(
    api: URI,
    web: URI,
): Boolean =
    when (api.host) {
        "api.pantopus.com", "api.pantopus.app" -> secureSenderApi(api) && publicSenderWeb(web, "pantopus.com")
        "staging-api.pantopus.com", "staging.api.pantopus.app" -> secureSenderApi(api) && publicSenderWeb(web, "staging.pantopus.com")
        in LOCAL_HOSTS -> api.scheme in setOf("http", "https") && web.scheme in setOf("http", "https") && web.host in LOCAL_HOSTS
        else -> false
    }

private fun secureSenderApi(api: URI): Boolean = api.scheme == "https" && api.port in setOf(-1, HTTPS_PORT)

private fun publicSenderWeb(
    web: URI,
    host: String,
): Boolean = web.scheme == "https" && web.host == host && web.port in setOf(-1, HTTPS_PORT)

private const val HTTPS_PORT = 443

private val LOCAL_HOSTS = setOf("localhost", "127.0.0.1", "10.0.2.2", "::1", "[::1]")

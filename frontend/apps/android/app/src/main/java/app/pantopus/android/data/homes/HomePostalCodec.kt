package app.pantopus.android.data.homes

import com.squareup.moshi.Moshi

class HomePostalCodec(moshi: Moshi) {
    private val mail = moshi.adapter(HomePostalMailRequest::class.java).failOnUnknown()
    private val code = moshi.adapter(HomePostalCodeRequest::class.java).failOnUnknown()
    private val outcomes = moshi.adapter(HomePostalOutcome::class.java)
    private val currentStatus = moshi.adapter(HomePostalStatus::class.java)
    private val objects = moshi.adapter(Map::class.java)

    fun encode(request: HomePostalMailRequest): String = mail.toJson(request)

    fun encode(request: HomePostalCodeRequest): String = code.toJson(request)

    fun mailing(draft: PendingHomePostalCommand): HomePostalMailRequest = checkNotNull(mail.fromJson(draft.requestJson))

    fun outcome(json: String): HomePostalOutcome {
        val fields = checkNotNull(objects.fromJson(json))
        check(fields.keys.containsAll(setOf("state", "home_id", "command", "postcard_id")))
        return checkNotNull(outcomes.fromJson(json)).also {
            if (it.state == "completed" && it.verificationStatus != null) check(fields.containsKey("challenge_window_ends_at"))
        }
    }

    fun status(
        json: String,
        scope: HomePostalScope,
    ): HomePostalStatus {
        val fields = checkNotNull(objects.fromJson(json))
        check(fields.keys.containsAll(setOf("restriction", "restriction_message", "postcard", "request")))
        return checkNotNull(currentStatus.fromJson(json)).also { check(it.matches(scope)) }
    }

    fun valid(
        draft: PendingHomePostalCommand,
        scope: HomePostalScope,
    ): Boolean =
        runCatching {
            if (draft.scope != scope || !scope.isValid() || !homeTaskUUID(draft.requestId)) return false
            val bodyMatches =
                when (draft.kind) {
                    HomePostalKind.Mail -> {
                        val request = mailing(draft)
                        draft.postcardId == null && request.requestId == draft.requestId && request.address.isValid()
                    }
                    HomePostalKind.Code -> {
                        val request = checkNotNull(code.fromJson(draft.requestJson))
                        val codeValid = request.code.matches(Regex("^[a-zA-Z0-9]{6,8}$"))
                        homeTaskUUID(draft.postcardId) && request.requestId == draft.requestId && codeValid
                    }
                }
            bodyMatches && (draft.outcome == null || draft.outcome.matches(draft))
        }.getOrDefault(false)
}

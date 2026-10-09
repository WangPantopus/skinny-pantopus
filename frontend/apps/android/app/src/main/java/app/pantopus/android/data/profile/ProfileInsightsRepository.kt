package app.pantopus.android.data.profile

import app.pantopus.android.data.api.models.users.InviteCodeDto
import app.pantopus.android.data.api.models.users.InviteProgressDto
import app.pantopus.android.data.api.models.users.MonthlyReceiptDto
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ProfileInsightsApi
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.Stored
import javax.inject.Inject
import javax.inject.Singleton

/** Wraps [ProfileInsightsApi] in the [NetworkResult] taxonomy. */
@Singleton
class ProfileInsightsRepository
    @Inject
    constructor(
        private val api: ProfileInsightsApi,
        private val store: ScreenStore,
    ) {
        /** `GET /api/users/me/monthly-receipt?year=&month=` (`month` is 1-based). */
        suspend fun monthlyReceipt(
            year: Int,
            month: Int,
        ): NetworkResult<MonthlyReceiptDto> = safeApiCall { api.monthlyReceipt(year, month) }

        /** `GET /api/users/me/invite-progress`. */
        suspend fun inviteProgress(): NetworkResult<InviteProgressDto> = safeApiCall { api.inviteProgress() }

        /** `GET /api/users/me/invite-code`. */
        suspend fun inviteCode(): NetworkResult<InviteCodeDto> = safeApiCall { api.inviteCode() }

        /** Invite progress through the screens' store. The monthly receipt holds earnings: it is never stored. */
        suspend fun inviteProgressStored(force: Boolean = false): Stored<InviteProgressDto> =
            store.read(StoreKeys.inviteProgress, force) { etag -> conditionalApiCall { api.inviteProgressConditional(etag) } }

        /** The invite code through the screens' store. */
        suspend fun inviteCodeStored(force: Boolean = false): Stored<InviteCodeDto> =
            store.read(StoreKeys.inviteCode, force) { etag -> conditionalApiCall { api.inviteCodeConditional(etag) } }
    }

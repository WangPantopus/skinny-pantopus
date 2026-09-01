package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mailbox.p3.ApplyMailboxThemeRequest
import app.pantopus.android.data.api.models.mailbox.p3.ApplyMailboxThemeResponse
import app.pantopus.android.data.api.models.mailbox.p3.DismissMailMemoryRequest
import app.pantopus.android.data.api.models.mailbox.p3.DismissMailMemoryResponse
import app.pantopus.android.data.api.models.mailbox.p3.MailDaySettingsDto
import app.pantopus.android.data.api.models.mailbox.p3.MailDaySettingsPatch
import app.pantopus.android.data.api.models.mailbox.p3.MailDaySettingsPatchResponse
import app.pantopus.android.data.api.models.mailbox.p3.MailMemoriesResponse
import app.pantopus.android.data.api.models.mailbox.p3.MailboxStampsResponse
import app.pantopus.android.data.api.models.mailbox.p3.SeasonalThemesResponse
import app.pantopus.android.data.api.models.mailbox.p3.ShareYearInMailResponse
import app.pantopus.android.data.api.models.mailbox.p3.YearInMailResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailboxKeepsakeApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Phase-3 keepsake surfaces — stamp collection, seasonal themes, Mail
 * Memory and the Mail Day preference row. Wraps [MailboxKeepsakeApi] in
 * the [NetworkResult] taxonomy.
 */
@Singleton
open class MailboxKeepsakeRepository
    @Inject
    constructor(
        private val api: MailboxKeepsakeApi,
    ) {
        /** `GET api/mailbox/v2/p3/stamps`. */
        open suspend fun stamps(): NetworkResult<MailboxStampsResponse> = safeApiCall { api.stamps() }

        /** `GET api/mailbox/v2/p3/themes`. */
        open suspend fun themes(): NetworkResult<SeasonalThemesResponse> = safeApiCall { api.themes() }

        /** `POST api/mailbox/v2/p3/themes/apply`. */
        open suspend fun applyTheme(themeId: String): NetworkResult<ApplyMailboxThemeResponse> =
            safeApiCall { api.applyTheme(ApplyMailboxThemeRequest(themeId = themeId)) }

        /** `GET api/mailbox/v2/p3/memory/on-this-day`. */
        open suspend fun onThisDay(): NetworkResult<MailMemoriesResponse> = safeApiCall { api.onThisDay() }

        /** `GET api/mailbox/v2/p3/memory/year/:year`. */
        open suspend fun yearInMail(year: Int): NetworkResult<YearInMailResponse> = safeApiCall { api.yearInMail(year) }

        /** `POST api/mailbox/v2/p3/memory/dismiss`. */
        open suspend fun dismissMemory(memoryId: String): NetworkResult<DismissMailMemoryResponse> =
            safeApiCall { api.dismissMemory(DismissMailMemoryRequest(memoryId = memoryId)) }

        /** `POST api/mailbox/v2/p3/memory/year/:year/share`. */
        open suspend fun shareYearInMail(year: Int): NetworkResult<ShareYearInMailResponse> = safeApiCall { api.shareYearInMail(year) }

        /** `GET api/mailbox/v2/p3/mailday/settings`. */
        open suspend fun mailDaySettings(): NetworkResult<MailDaySettingsDto> = safeApiCall { api.mailDaySettings() }

        /** `PATCH api/mailbox/v2/p3/mailday/settings`. */
        open suspend fun updateMailDaySettings(patch: MailDaySettingsPatch): NetworkResult<MailDaySettingsPatchResponse> =
            safeApiCall { api.updateMailDaySettings(patch) }
    }

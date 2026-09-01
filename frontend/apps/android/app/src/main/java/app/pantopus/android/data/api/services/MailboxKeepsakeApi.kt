package app.pantopus.android.data.api.services

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
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * The Phase-3 "keepsake" mailbox routes — stamp collection, seasonal
 * themes, Mail Memory and the Mail Day preference row. All live on
 * `backend/routes/mailboxV2Phase3.js`, mounted at `api/mailbox/v2/p3`
 * (`backend/app.js:317`).
 *
 * Kept in one interface (rather than piled into the heavily-shared
 * `MailboxV2Api`) so the parity wiring doesn't contend with siblings.
 * Mirrors the iOS `MailboxStampsEndpoints` / `MailboxMemoryEndpoints` /
 * `MailDaySettingsEndpoints` trio.
 */
interface MailboxKeepsakeApi {
    /**
     * `GET api/mailbox/v2/p3/stamps` — route
     * `backend/routes/mailboxV2Phase3.js:1204`. The caller's stamp
     * gallery: `earned` rows newest-first plus the `locked` catalogue
     * entries they haven't unlocked, with the collected / available totals.
     */
    @GET("api/mailbox/v2/p3/stamps")
    suspend fun stamps(): MailboxStampsResponse

    /**
     * `GET api/mailbox/v2/p3/themes` — route
     * `backend/routes/mailboxV2Phase3.js:1249`. Every seasonal theme with
     * a server-computed `unlocked` flag, plus the caller's `active` theme
     * id (from `MailDaySettings.current_theme`).
     */
    @GET("api/mailbox/v2/p3/themes")
    suspend fun themes(): SeasonalThemesResponse

    /**
     * `POST api/mailbox/v2/p3/themes/apply` — route
     * `backend/routes/mailboxV2Phase3.js:1285`. Upserts
     * `MailDaySettings.current_theme`; the validator (`:107`) requires a
     * UUID `themeId`.
     */
    @POST("api/mailbox/v2/p3/themes/apply")
    suspend fun applyTheme(
        @Body body: ApplyMailboxThemeRequest,
    ): ApplyMailboxThemeResponse

    /**
     * `GET api/mailbox/v2/p3/memory/on-this-day` — route
     * `backend/routes/mailboxV2Phase3.js:1321`. Keepsake-category mail
     * received on this calendar day in each of the last five years, with
     * a per-memory `dismissed` flag folded in from `MailMemory`.
     */
    @GET("api/mailbox/v2/p3/memory/on-this-day")
    suspend fun onThisDay(): MailMemoriesResponse

    /**
     * `GET api/mailbox/v2/p3/memory/year/:year` — route
     * `backend/routes/mailboxV2Phase3.js:1376`. Year roll-up: totals,
     * per-drawer + per-category breakdowns, top senders, package count
     * and the first-mail date.
     */
    @GET("api/mailbox/v2/p3/memory/year/{year}")
    suspend fun yearInMail(
        @Path("year") year: Int,
    ): YearInMailResponse

    /**
     * `POST api/mailbox/v2/p3/memory/dismiss` — route
     * `backend/routes/mailboxV2Phase3.js:1480`. Upserts a dismissed
     * `MailMemory` row for the supplied memory id.
     */
    @POST("api/mailbox/v2/p3/memory/dismiss")
    suspend fun dismissMemory(
        @Body body: DismissMailMemoryRequest,
    ): DismissMailMemoryResponse

    /**
     * `POST api/mailbox/v2/p3/memory/year/:year/share` — route
     * `backend/routes/mailboxV2Phase3.js:1502`. Returns the share-card
     * URL for the year summary.
     */
    @POST("api/mailbox/v2/p3/memory/year/{year}/share")
    suspend fun shareYearInMail(
        @Path("year") year: Int,
    ): ShareYearInMailResponse

    /**
     * `GET api/mailbox/v2/p3/mailday/settings` — route
     * `backend/routes/mailboxV2Phase3.js:1121`. Returns the caller's row
     * or, when they have none, the server's default settings object.
     */
    @GET("api/mailbox/v2/p3/mailday/settings")
    suspend fun mailDaySettings(): MailDaySettingsDto

    /**
     * `PATCH api/mailbox/v2/p3/mailday/settings` — route
     * `backend/routes/mailboxV2Phase3.js:1160`. Partial upsert; every
     * field on the validator (`:88`) is optional, so only the toggled key
     * is sent. Responds `{ settings }`.
     */
    @PATCH("api/mailbox/v2/p3/mailday/settings")
    suspend fun updateMailDaySettings(
        @Body body: MailDaySettingsPatch,
    ): MailDaySettingsPatchResponse
}

package app.pantopus.android.di

import android.content.Context
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.api.ApiService
import app.pantopus.android.data.api.models.homes.UploadEvidenceRequestJsonAdapter
import app.pantopus.android.data.api.net.RetryInterceptor
import app.pantopus.android.data.api.services.AIApi
import app.pantopus.android.data.api.services.AccountDeletionApi
import app.pantopus.android.data.api.services.AdminApi
import app.pantopus.android.data.api.services.AudienceProfileApi
import app.pantopus.android.data.api.services.AuthApi
import app.pantopus.android.data.api.services.BeaconProfileApi
import app.pantopus.android.data.api.services.BlocksApi
import app.pantopus.android.data.api.services.BroadcastReadApi
import app.pantopus.android.data.api.services.BusinessCatalogApi
import app.pantopus.android.data.api.services.BusinessDiscoveryApi
import app.pantopus.android.data.api.services.BusinessFinanceApi
import app.pantopus.android.data.api.services.BusinessFoundingApi
import app.pantopus.android.data.api.services.BusinessInboxApi
import app.pantopus.android.data.api.services.BusinessInvoicesApi
import app.pantopus.android.data.api.services.BusinessPagesApi
import app.pantopus.android.data.api.services.BusinessPostsApi
import app.pantopus.android.data.api.services.BusinessTeamApi
import app.pantopus.android.data.api.services.BusinessesApi
import app.pantopus.android.data.api.services.ChatApi
import app.pantopus.android.data.api.services.ConnectApi
import app.pantopus.android.data.api.services.ConnectionsApi
import app.pantopus.android.data.api.services.EarnOffersApi
import app.pantopus.android.data.api.services.FeedActionsApi
import app.pantopus.android.data.api.services.FilesApi
import app.pantopus.android.data.api.services.FollowingApi
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.api.services.GigReassignmentApi
import app.pantopus.android.data.api.services.GigSavedSearchesApi
import app.pantopus.android.data.api.services.GigViewerBidApi
import app.pantopus.android.data.api.services.GigsApi
import app.pantopus.android.data.api.services.HomeAdminApi
import app.pantopus.android.data.api.services.HomeClaimReviewApi
import app.pantopus.android.data.api.services.HomeDashboardApi
import app.pantopus.android.data.api.services.HomeDiscoveryApi
import app.pantopus.android.data.api.services.HomeGuestPassesApi
import app.pantopus.android.data.api.services.HomeIssuesApi
import app.pantopus.android.data.api.services.HomeMembersApi
import app.pantopus.android.data.api.services.HomeOwnershipClaimApi
import app.pantopus.android.data.api.services.HomeOwnershipSecurityApi
import app.pantopus.android.data.api.services.HomePetsApi
import app.pantopus.android.data.api.services.HomePrivacyApi
import app.pantopus.android.data.api.services.HomeSettingsApi
import app.pantopus.android.data.api.services.HomeTasksApi
import app.pantopus.android.data.api.services.HomeVerificationApi
import app.pantopus.android.data.api.services.HomesApi
import app.pantopus.android.data.api.services.HubApi
import app.pantopus.android.data.api.services.HubExtrasApi
import app.pantopus.android.data.api.services.IdentityCenterApi
import app.pantopus.android.data.api.services.ListingOffersApi
import app.pantopus.android.data.api.services.ListingsMutationApi
import app.pantopus.android.data.api.services.ListingsReadApi
import app.pantopus.android.data.api.services.MailComposeApi
import app.pantopus.android.data.api.services.MailDayApi
import app.pantopus.android.data.api.services.MailboxApi
import app.pantopus.android.data.api.services.MailboxCommunityApi
import app.pantopus.android.data.api.services.MailboxDocumentApi
import app.pantopus.android.data.api.services.MailboxKeepsakeApi
import app.pantopus.android.data.api.services.MailboxPackageApi
import app.pantopus.android.data.api.services.MailboxPartyApi
import app.pantopus.android.data.api.services.MailboxRecordsApi
import app.pantopus.android.data.api.services.MailboxTasksApi
import app.pantopus.android.data.api.services.MailboxV2Api
import app.pantopus.android.data.api.services.MailboxVaultApi
import app.pantopus.android.data.api.services.MatchedBusinessesApi
import app.pantopus.android.data.api.services.MembershipApi
import app.pantopus.android.data.api.services.NeighborMessagesApi
import app.pantopus.android.data.api.services.NotificationPreferencesApi
import app.pantopus.android.data.api.services.NotificationsApi
import app.pantopus.android.data.api.services.OffersApi
import app.pantopus.android.data.api.services.PaymentHistoryApi
import app.pantopus.android.data.api.services.PaymentsApi
import app.pantopus.android.data.api.services.PersonaDmApi
import app.pantopus.android.data.api.services.PersonaEditApi
import app.pantopus.android.data.api.services.PlaceApi
import app.pantopus.android.data.api.services.PostPrecheckApi
import app.pantopus.android.data.api.services.PostsApi
import app.pantopus.android.data.api.services.PostsMapApi
import app.pantopus.android.data.api.services.PrivacyApi
import app.pantopus.android.data.api.services.PrivacyHandshakeApi
import app.pantopus.android.data.api.services.ProfessionalApi
import app.pantopus.android.data.api.services.ProfileInsightsApi
import app.pantopus.android.data.api.services.RelationshipsApi
import app.pantopus.android.data.api.services.ResidencyLettersApi
import app.pantopus.android.data.api.services.ReviewsApi
import app.pantopus.android.data.api.services.SavedPlacesApi
import app.pantopus.android.data.api.services.SchedulingApi
import app.pantopus.android.data.api.services.SchedulingPublicApi
import app.pantopus.android.data.api.services.SportsApi
import app.pantopus.android.data.api.services.SupportTrainActionsApi
import app.pantopus.android.data.api.services.SupportTrainsApi
import app.pantopus.android.data.api.services.TenantApi
import app.pantopus.android.data.api.services.TokenAcceptApi
import app.pantopus.android.data.api.services.TransactionReviewsApi
import app.pantopus.android.data.api.services.UniversalSearchApi
import app.pantopus.android.data.api.services.UploadApi
import app.pantopus.android.data.api.services.UserReportsApi
import app.pantopus.android.data.api.services.UserSocialApi
import app.pantopus.android.data.api.services.UsersApi
import app.pantopus.android.data.api.services.ViewingLocationApi
import app.pantopus.android.data.api.services.WalletApi
import app.pantopus.android.data.auth.AuthInterceptor
import app.pantopus.android.data.auth.TokenAuthenticator
import com.squareup.moshi.Moshi
import com.squareup.moshi.adapters.Rfc3339DateJsonAdapter
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.sentry.android.okhttp.SentryOkHttpInterceptor
import okhttp3.Cache
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.io.File
import java.time.Instant
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton

private const val HTTP_CACHE_DIR = "pantopus-http"
private const val HTTP_CACHE_SIZE_BYTES = 10L * 1024 * 1024
private const val CONNECT_TIMEOUT_SECONDS = 15L
private const val READ_WRITE_TIMEOUT_SECONDS = 30L

/** Qualifier for the unauthenticated client serving Calendarly `/api/public/…`. */
private const val PUBLIC_SCHEDULING = "publicScheduling"

@Module
@InstallIn(SingletonComponent::class)
@Suppress("TooManyFunctions")
object NetworkModule {
    @Provides
    @Singleton
    fun provideMoshi(): Moshi =
        Moshi
            .Builder()
            // Custom serializers must be registered ahead of the
            // generic Kotlin factory so they win the lookup. The
            // UploadEvidenceRequest one omits optional fields when
            // null instead of writing JSON `null`.
            .add(UploadEvidenceRequestJsonAdapter())
            // T2 hub preferences: partial PUT body that must emit the
            // changed keys only, plus explicit JSON null when quiet
            // hours are cleared.
            .add(app.pantopus.android.data.api.models.hub.NotificationPreferencesPatchJsonAdapter())
            .add(app.pantopus.android.data.api.models.businesses.BusinessServiceAreaJsonAdapter())
            // C2 catalog item write: a full-form editor body whose cleared
            // fields must reach the backend as explicit JSON null.
            .add(app.pantopus.android.data.api.models.businesses.BusinessCatalogItemRequestJsonAdapter())
            .add(app.pantopus.android.data.api.models.homes.BillDecimalAdapter())
            .add(app.pantopus.android.data.api.models.homes.PollOptionAdapter())
            // Payments earnings/spending: the summary arrives both nested and
            // spread at the envelope root, in snake_case and camelCase.
            .add(app.pantopus.android.data.api.models.payments.PaymentsEarningsJsonAdapter())
            // Place Intelligence: the envelope's payload type depends on
            // the sibling `id` field (hand-written adapter), and the Place
            // display vocabularies decode unknown values to UNKNOWN.
            .add(app.pantopus.android.data.api.models.place.PlaceSectionEnvelopeAdapterFactory())
            .add(app.pantopus.android.data.api.models.place.PlaceEnumAdapterFactory)
            .add(Instant::class.java, Rfc3339DateJsonAdapter().nullSafe())
            .addLast(KotlinJsonAdapterFactory())
            .build()

    /**
     * 10 MB on-disk HTTP cache. OkHttp honours `Cache-Control`, `ETag`, and
     * `If-None-Match` automatically — backend endpoints that emit those
     * headers get conditional revalidation for free.
     */
    @Provides
    @Singleton
    fun provideOkHttpCache(
        @ApplicationContext context: Context,
    ): Cache = Cache(File(context.cacheDir, HTTP_CACHE_DIR), HTTP_CACHE_SIZE_BYTES)

    @Provides
    @Singleton
    fun provideRetryInterceptor(): RetryInterceptor = RetryInterceptor()

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        tokenAuthenticator: TokenAuthenticator,
        retryInterceptor: RetryInterceptor,
        cache: Cache,
    ): OkHttpClient {
        val logging =
            HttpLoggingInterceptor().apply {
                level =
                    if (BuildConfig.DEBUG) {
                        HttpLoggingInterceptor.Level.BODY
                    } else {
                        HttpLoggingInterceptor.Level.NONE
                    }
            }
        return OkHttpClient
            .Builder()
            .cache(cache)
            .addInterceptor(authInterceptor)
            // Silent token refresh + replay on 401 (OkHttp-driven retry).
            .authenticator(tokenAuthenticator)
            .addInterceptor(retryInterceptor)
            .addInterceptor(logging)
            .addInterceptor(SentryOkHttpInterceptor())
            .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(READ_WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(READ_WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(
        client: OkHttpClient,
        moshi: Moshi,
    ): Retrofit =
        Retrofit
            .Builder()
            .baseUrl(BuildConfig.PANTOPUS_API_BASE_URL.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

    // Dedicated refresh stack — a separate OkHttp client (its own dispatcher,
    // NO AuthInterceptor / TokenAuthenticator). TokenAuthenticator runs the
    // refresh from inside an OkHttp dispatcher thread; routing it through the
    // main client risks a deadlock when a burst of concurrent 401s pins every
    // per-host slot. A separate dispatcher always has a free slot, and omitting
    // the authenticator guarantees no refresh-of-the-refresh recursion.
    @Provides
    @Singleton
    @Named("authRefresh")
    fun provideRefreshOkHttpClient(): OkHttpClient =
        OkHttpClient
            .Builder()
            .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(READ_WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(READ_WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()

    /**
     * Dedicated **unauthenticated** client for Calendarly's public booking
     * surface (`/api/public/…`). The default [provideOkHttpClient] always
     * installs [app.pantopus.android.data.auth.AuthInterceptor], which would
     * attach a stale/absent `Authorization` header (and trigger sign-out on a
     * 401) on the signed-out invitee flow. This client omits it entirely while
     * keeping retry/logging/Sentry; a platform header is added for parity.
     */
    @Provides
    @Singleton
    @Named(PUBLIC_SCHEDULING)
    fun providePublicSchedulingOkHttpClient(
        retryInterceptor: RetryInterceptor,
        cache: Cache,
    ): OkHttpClient {
        val logging =
            HttpLoggingInterceptor().apply {
                level =
                    if (BuildConfig.DEBUG) {
                        HttpLoggingInterceptor.Level.BODY
                    } else {
                        HttpLoggingInterceptor.Level.NONE
                    }
            }
        val platformHeader =
            Interceptor { chain ->
                chain.proceed(
                    chain.request().newBuilder().header("X-Client-Platform", "android").build(),
                )
            }
        return OkHttpClient
            .Builder()
            .cache(cache)
            .addInterceptor(platformHeader)
            .addInterceptor(retryInterceptor)
            .addInterceptor(logging)
            .addInterceptor(SentryOkHttpInterceptor())
            .connectTimeout(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .readTimeout(READ_WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .writeTimeout(READ_WRITE_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    @Named("authRefresh")
    fun provideRefreshRetrofit(
        @Named("authRefresh") client: OkHttpClient,
        moshi: Moshi,
    ): Retrofit =
        Retrofit
            .Builder()
            .baseUrl(BuildConfig.PANTOPUS_API_BASE_URL.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

    /**
     * Retrofit for the public client. Same backend origin as the authed one
     * (the `/api/public/…` paths live on `PANTOPUS_API_BASE_URL`) but a
     * SEPARATE, auth-free client.
     */
    @Provides
    @Singleton
    @Named(PUBLIC_SCHEDULING)
    fun providePublicSchedulingRetrofit(
        @Named(PUBLIC_SCHEDULING) client: OkHttpClient,
        moshi: Moshi,
    ): Retrofit =
        Retrofit
            .Builder()
            .baseUrl(BuildConfig.PANTOPUS_API_BASE_URL.trimEnd('/') + "/")
            .client(client)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()

    @Provides
    @Singleton
    @Named("authRefresh")
    fun provideRefreshAuthApi(
        @Named("authRefresh") retrofit: Retrofit,
    ): AuthApi = retrofit.create(AuthApi::class.java)

    // Per-feature interfaces — new code should depend on these directly.

    @Provides @Singleton
    fun provideSchedulingApi(retrofit: Retrofit): SchedulingApi = retrofit.create(SchedulingApi::class.java)

    @Provides @Singleton
    fun provideSchedulingPublicApi(
        @Named(PUBLIC_SCHEDULING) retrofit: Retrofit,
    ): SchedulingPublicApi = retrofit.create(SchedulingPublicApi::class.java)

    @Provides @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)

    @Provides @Singleton
    fun provideUsersApi(retrofit: Retrofit): UsersApi = retrofit.create(UsersApi::class.java)

    @Provides @Singleton
    fun provideUserSocialApi(retrofit: Retrofit): UserSocialApi = retrofit.create(UserSocialApi::class.java)

    @Provides @Singleton
    fun provideHubApi(retrofit: Retrofit): HubApi = retrofit.create(HubApi::class.java)

    @Provides @Singleton
    fun provideHubExtrasApi(retrofit: Retrofit): HubExtrasApi = retrofit.create(HubExtrasApi::class.java)

    @Provides @Singleton
    fun provideNotificationPreferencesApi(retrofit: Retrofit): NotificationPreferencesApi =
        retrofit.create(NotificationPreferencesApi::class.java)

    @Provides @Singleton
    fun provideWalletApi(retrofit: Retrofit): WalletApi = retrofit.create(WalletApi::class.java)

    @Provides @Singleton
    fun providePaymentsApi(retrofit: Retrofit): PaymentsApi = retrofit.create(PaymentsApi::class.java)

    @Provides @Singleton
    fun providePaymentHistoryApi(retrofit: Retrofit): PaymentHistoryApi = retrofit.create(PaymentHistoryApi::class.java)

    @Provides @Singleton
    fun provideConnectApi(retrofit: Retrofit): ConnectApi = retrofit.create(ConnectApi::class.java)

    @Provides @Singleton
    fun provideBusinessDiscoveryApi(retrofit: Retrofit): BusinessDiscoveryApi = retrofit.create(BusinessDiscoveryApi::class.java)

    @Provides @Singleton
    fun provideBusinessesApi(retrofit: Retrofit): BusinessesApi = retrofit.create(BusinessesApi::class.java)

    /** Business-side inbox — rooms addressed to the business + matched posts. */
    @Provides @Singleton
    fun provideBusinessInboxApi(retrofit: Retrofit): BusinessInboxApi = retrofit.create(BusinessInboxApi::class.java)

    /** First-50 founding-business offer (status + claim). */
    @Provides @Singleton
    fun provideBusinessFoundingApi(retrofit: Retrofit): BusinessFoundingApi = retrofit.create(BusinessFoundingApi::class.java)

    /** Broadcast read receipts fired from the public Beacon profile. */
    @Provides @Singleton
    fun provideBroadcastReadApi(retrofit: Retrofit): BroadcastReadApi = retrofit.create(BroadcastReadApi::class.java)

    @Provides @Singleton
    fun provideBusinessInvoicesApi(retrofit: Retrofit): BusinessInvoicesApi = retrofit.create(BusinessInvoicesApi::class.java)

    @Provides @Singleton
    fun provideBusinessFinanceApi(retrofit: Retrofit): BusinessFinanceApi = retrofit.create(BusinessFinanceApi::class.java)

    @Provides @Singleton
    fun provideBusinessTeamApi(retrofit: Retrofit): BusinessTeamApi = retrofit.create(BusinessTeamApi::class.java)

    /** C2 — owner catalog CRUD (categories + items + reorder). */
    @Provides @Singleton
    fun provideBusinessCatalogApi(retrofit: Retrofit): BusinessCatalogApi = retrofit.create(BusinessCatalogApi::class.java)

    /** C2 — "post as this business" from the owner dashboard. */
    @Provides @Singleton
    fun provideBusinessPostsApi(retrofit: Retrofit): BusinessPostsApi = retrofit.create(BusinessPostsApi::class.java)

    @Provides @Singleton
    fun provideBusinessPagesApi(retrofit: Retrofit): BusinessPagesApi = retrofit.create(BusinessPagesApi::class.java)

    @Provides @Singleton
    fun provideHomesApi(retrofit: Retrofit): HomesApi = retrofit.create(HomesApi::class.java)

    /** H6 — per-home owner claim review (ownership + residency claims). */
    @Provides @Singleton
    fun provideHomeClaimReviewApi(retrofit: Retrofit): HomeClaimReviewApi = retrofit.create(HomeClaimReviewApi::class.java)

    /** H1 — dashboard aggregate + Home Intelligence reads. */
    @Provides @Singleton
    fun provideHomeDashboardApi(retrofit: Retrofit): HomeDashboardApi = retrofit.create(HomeDashboardApi::class.java)

    @Provides @Singleton
    fun provideHomePetsApi(retrofit: Retrofit): HomePetsApi = retrofit.create(HomePetsApi::class.java)

    @Provides @Singleton
    fun provideHomeTasksApi(retrofit: Retrofit): HomeTasksApi = retrofit.create(HomeTasksApi::class.java)

    @Provides @Singleton
    fun provideHomeIssuesApi(retrofit: Retrofit): HomeIssuesApi = retrofit.create(HomeIssuesApi::class.java)

    @Provides @Singleton
    fun provideHomeMembersApi(retrofit: Retrofit): HomeMembersApi = retrofit.create(HomeMembersApi::class.java)

    @Provides @Singleton
    fun provideHomeAdminApi(retrofit: Retrofit): HomeAdminApi = retrofit.create(HomeAdminApi::class.java)

    @Provides @Singleton
    fun provideHomeOwnershipClaimApi(retrofit: Retrofit): HomeOwnershipClaimApi = retrofit.create(HomeOwnershipClaimApi::class.java)

    @Provides @Singleton
    fun provideHomeGuestPassesApi(retrofit: Retrofit): HomeGuestPassesApi = retrofit.create(HomeGuestPassesApi::class.java)

    @Provides @Singleton
    fun provideHomeVerificationApi(retrofit: Retrofit): HomeVerificationApi = retrofit.create(HomeVerificationApi::class.java)

    @Provides @Singleton
    fun provideHomePrivacyApi(retrofit: Retrofit): HomePrivacyApi = retrofit.create(HomePrivacyApi::class.java)

    /** A14.1 per-home settings mutations (inline rename). */
    @Provides @Singleton
    fun provideHomeSettingsApi(retrofit: Retrofit): HomeSettingsApi = retrofit.create(HomeSettingsApi::class.java)

    /** A12.1 Find-or-Add-Home discovery + join-an-existing-home routes. */
    @Provides @Singleton
    fun provideHomeDiscoveryApi(retrofit: Retrofit): HomeDiscoveryApi = retrofit.create(HomeDiscoveryApi::class.java)

    @Provides @Singleton
    fun provideHomeOwnershipSecurityApi(retrofit: Retrofit): HomeOwnershipSecurityApi =
        retrofit.create(HomeOwnershipSecurityApi::class.java)

    @Provides @Singleton
    fun provideTenantApi(retrofit: Retrofit): TenantApi = retrofit.create(TenantApi::class.java)

    @Provides @Singleton
    fun provideFilesApi(retrofit: Retrofit): FilesApi = retrofit.create(FilesApi::class.java)

    @Provides @Singleton
    fun provideMailboxApi(retrofit: Retrofit): MailboxApi = retrofit.create(MailboxApi::class.java)

    @Provides @Singleton
    fun provideMailboxV2Api(retrofit: Retrofit): MailboxV2Api = retrofit.create(MailboxV2Api::class.java)

    @Provides @Singleton
    fun provideMailboxTasksApi(retrofit: Retrofit): MailboxTasksApi = retrofit.create(MailboxTasksApi::class.java)

    @Provides @Singleton
    fun provideMailboxPackageApi(retrofit: Retrofit): MailboxPackageApi = retrofit.create(MailboxPackageApi::class.java)

    @Provides @Singleton
    fun provideMailboxCommunityApi(retrofit: Retrofit): MailboxCommunityApi = retrofit.create(MailboxCommunityApi::class.java)

    @Provides @Singleton
    fun provideMailboxRecordsApi(retrofit: Retrofit): MailboxRecordsApi = retrofit.create(MailboxRecordsApi::class.java)

    @Provides @Singleton
    fun provideMailboxKeepsakeApi(retrofit: Retrofit): MailboxKeepsakeApi = retrofit.create(MailboxKeepsakeApi::class.java)

    @Provides @Singleton
    fun provideMailboxPartyApi(retrofit: Retrofit): MailboxPartyApi = retrofit.create(MailboxPartyApi::class.java)

    @Provides @Singleton
    fun provideMailboxVaultApi(retrofit: Retrofit): MailboxVaultApi = retrofit.create(MailboxVaultApi::class.java)

    @Provides @Singleton
    fun provideMailboxDocumentApi(retrofit: Retrofit): MailboxDocumentApi = retrofit.create(MailboxDocumentApi::class.java)

    @Provides @Singleton
    fun provideMailDayApi(retrofit: Retrofit): MailDayApi = retrofit.create(MailDayApi::class.java)

    @Provides @Singleton
    fun provideEarnOffersApi(retrofit: Retrofit): EarnOffersApi = retrofit.create(EarnOffersApi::class.java)

    @Provides @Singleton
    fun providePostsApi(retrofit: Retrofit): PostsApi = retrofit.create(PostsApi::class.java)

    @Provides @Singleton
    fun providePostPrecheckApi(retrofit: Retrofit): PostPrecheckApi = retrofit.create(PostPrecheckApi::class.java)

    @Provides @Singleton
    fun provideSportsApi(retrofit: Retrofit): SportsApi = retrofit.create(SportsApi::class.java)

    @Provides @Singleton
    fun provideViewingLocationApi(retrofit: Retrofit): ViewingLocationApi = retrofit.create(ViewingLocationApi::class.java)

    @Provides @Singleton
    fun provideFeedActionsApi(retrofit: Retrofit): FeedActionsApi = retrofit.create(FeedActionsApi::class.java)

    @Provides
    @Singleton
    fun providePostsMapApi(retrofit: Retrofit): PostsMapApi = retrofit.create(PostsMapApi::class.java)

    @Provides @Singleton
    fun provideUploadApi(retrofit: Retrofit): UploadApi = retrofit.create(UploadApi::class.java)

    @Provides @Singleton
    fun provideRelationshipsApi(retrofit: Retrofit): RelationshipsApi = retrofit.create(RelationshipsApi::class.java)

    /** S5 — Connections Sent / Blocked / disconnect / unblock routes. */
    @Provides @Singleton
    fun provideConnectionsApi(retrofit: Retrofit): ConnectionsApi = retrofit.create(ConnectionsApi::class.java)

    @Provides @Singleton
    fun provideFollowingApi(retrofit: Retrofit): FollowingApi = retrofit.create(FollowingApi::class.java)

    @Provides @Singleton
    fun provideMatchedBusinessesApi(retrofit: Retrofit): MatchedBusinessesApi = retrofit.create(MatchedBusinessesApi::class.java)

    @Provides @Singleton
    fun provideProfileInsightsApi(retrofit: Retrofit): ProfileInsightsApi = retrofit.create(ProfileInsightsApi::class.java)

    @Provides @Singleton
    fun provideSavedPlacesApi(retrofit: Retrofit): SavedPlacesApi = retrofit.create(SavedPlacesApi::class.java)

    @Provides @Singleton
    fun provideBlocksApi(retrofit: Retrofit): BlocksApi = retrofit.create(BlocksApi::class.java)

    @Provides @Singleton
    fun provideUserReportsApi(retrofit: Retrofit): UserReportsApi = retrofit.create(UserReportsApi::class.java)

    @Provides @Singleton
    fun provideChatApi(retrofit: Retrofit): ChatApi = retrofit.create(ChatApi::class.java)

    @Provides @Singleton
    fun provideAIApi(retrofit: Retrofit): AIApi = retrofit.create(AIApi::class.java)

    @Provides
    @Singleton
    fun provideGeoApi(retrofit: Retrofit): GeoApi = retrofit.create(GeoApi::class.java)

    @Provides
    @Singleton
    fun providePlaceApi(retrofit: Retrofit): PlaceApi = retrofit.create(PlaceApi::class.java)

    @Provides
    @Singleton
    fun provideNeighborMessagesApi(retrofit: Retrofit): NeighborMessagesApi = retrofit.create(NeighborMessagesApi::class.java)

    @Provides
    @Singleton
    fun provideResidencyLettersApi(retrofit: Retrofit): ResidencyLettersApi = retrofit.create(ResidencyLettersApi::class.java)

    @Provides
    @Singleton
    fun provideGigsApi(retrofit: Retrofit): GigsApi = retrofit.create(GigsApi::class.java)

    @Provides
    @Singleton
    fun provideGigExtrasApi(retrofit: Retrofit): app.pantopus.android.data.api.services.GigExtrasApi =
        retrofit.create(app.pantopus.android.data.api.services.GigExtrasApi::class.java)

    @Provides
    @Singleton
    fun provideGigSavedSearchesApi(retrofit: Retrofit): GigSavedSearchesApi = retrofit.create(GigSavedSearchesApi::class.java)

    @Provides
    @Singleton
    fun provideGigViewerBidApi(retrofit: Retrofit): GigViewerBidApi = retrofit.create(GigViewerBidApi::class.java)

    @Provides
    @Singleton
    fun provideGigsV2Api(retrofit: Retrofit): app.pantopus.android.data.api.services.GigsV2Api =
        retrofit.create(app.pantopus.android.data.api.services.GigsV2Api::class.java)

    @Provides
    @Singleton
    fun provideGigOwnerActionsApi(retrofit: Retrofit): app.pantopus.android.data.api.services.GigOwnerActionsApi =
        retrofit.create(app.pantopus.android.data.api.services.GigOwnerActionsApi::class.java)

    @Provides
    @Singleton
    fun provideGigReassignmentApi(retrofit: Retrofit): GigReassignmentApi = retrofit.create(GigReassignmentApi::class.java)

    @Provides
    @Singleton
    fun provideListingsReadApi(retrofit: Retrofit): ListingsReadApi = retrofit.create(ListingsReadApi::class.java)

    @Provides
    @Singleton
    fun provideListingsMutationApi(retrofit: Retrofit): ListingsMutationApi = retrofit.create(ListingsMutationApi::class.java)

    @Provides
    @Singleton
    fun provideListingOffersApi(retrofit: Retrofit): ListingOffersApi = retrofit.create(ListingOffersApi::class.java)

    @Provides
    @Singleton
    fun providePrivacyApi(retrofit: Retrofit): PrivacyApi = retrofit.create(PrivacyApi::class.java)

    @Provides
    @Singleton
    fun provideAccountDeletionApi(retrofit: Retrofit): AccountDeletionApi = retrofit.create(AccountDeletionApi::class.java)

    @Provides
    @Singleton
    fun provideIdentityCenterApi(retrofit: Retrofit): IdentityCenterApi = retrofit.create(IdentityCenterApi::class.java)

    @Provides
    @Singleton
    fun provideAudienceProfileApi(retrofit: Retrofit): AudienceProfileApi = retrofit.create(AudienceProfileApi::class.java)

    @Provides
    @Singleton
    fun providePersonaEditApi(retrofit: Retrofit): PersonaEditApi = retrofit.create(PersonaEditApi::class.java)

    @Provides
    @Singleton
    fun provideBeaconProfileApi(retrofit: Retrofit): BeaconProfileApi = retrofit.create(BeaconProfileApi::class.java)

    @Provides
    @Singleton
    fun provideMembershipApi(retrofit: Retrofit): MembershipApi = retrofit.create(MembershipApi::class.java)

    @Provides
    @Singleton
    fun providePersonaDmApi(retrofit: Retrofit): PersonaDmApi = retrofit.create(PersonaDmApi::class.java)

    @Provides
    @Singleton
    fun providePrivacyHandshakeApi(retrofit: Retrofit): PrivacyHandshakeApi = retrofit.create(PrivacyHandshakeApi::class.java)

    @Provides @Singleton
    fun provideProfessionalApi(retrofit: Retrofit): ProfessionalApi = retrofit.create(ProfessionalApi::class.java)

    @Provides
    @Singleton
    fun provideTokenAcceptApi(retrofit: Retrofit): TokenAcceptApi = retrofit.create(TokenAcceptApi::class.java)

    @Provides
    @Singleton
    fun provideMailComposeApi(retrofit: Retrofit): MailComposeApi = retrofit.create(MailComposeApi::class.java)

    @Provides
    @Singleton
    fun provideNotificationsApi(retrofit: Retrofit): NotificationsApi = retrofit.create(NotificationsApi::class.java)

    @Provides
    @Singleton
    fun provideOffersApi(retrofit: Retrofit): OffersApi = retrofit.create(OffersApi::class.java)

    @Provides
    @Singleton
    fun provideReviewsApi(retrofit: Retrofit): ReviewsApi = retrofit.create(ReviewsApi::class.java)

    @Provides
    @Singleton
    fun provideTransactionReviewsApi(retrofit: Retrofit): TransactionReviewsApi = retrofit.create(TransactionReviewsApi::class.java)

    @Provides
    @Singleton
    fun provideSupportTrainsApi(retrofit: Retrofit): SupportTrainsApi = retrofit.create(SupportTrainsApi::class.java)

    /** S1 — Support Train write routes (reserve / cancel / organizer management). */
    @Provides
    @Singleton
    fun provideSupportTrainActionsApi(retrofit: Retrofit): SupportTrainActionsApi = retrofit.create(SupportTrainActionsApi::class.java)

    /** S2 — universal search fan-out across the five search surfaces. */
    @Provides
    @Singleton
    fun provideUniversalSearchApi(retrofit: Retrofit): UniversalSearchApi = retrofit.create(UniversalSearchApi::class.java)

    @Provides
    @Singleton
    fun provideAdminApi(retrofit: Retrofit): AdminApi = retrofit.create(AdminApi::class.java)

    // Legacy aggregate — retained for existing AuthRepository / FeedScreen.
    @Provides @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService = retrofit.create(ApiService::class.java)
}

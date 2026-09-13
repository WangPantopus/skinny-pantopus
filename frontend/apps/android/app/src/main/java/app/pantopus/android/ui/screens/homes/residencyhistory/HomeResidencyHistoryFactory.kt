package app.pantopus.android.ui.screens.homes.residencyhistory

import app.pantopus.android.data.api.services.HomeResidencyReviewHistoryApi
import app.pantopus.android.data.homes.APIHomeResidencyReviewHistoryTransport
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeResidencyReviewHistoryCodec
import app.pantopus.android.data.homes.HomeResidencyReviewHistoryTransport
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CoroutineScope
import retrofit2.Retrofit
import javax.inject.Inject

class HomeResidencyHistoryFactory @Inject constructor(
    private val retrofit: Retrofit,
    private val sessions: HomeClaimSessionScopeFactory,
    moshi: Moshi,
) {
    val transport: HomeResidencyReviewHistoryTransport = APIHomeResidencyReviewHistoryTransport(
        retrofit.create(HomeResidencyReviewHistoryApi::class.java), HomeResidencyReviewHistoryCodec(moshi),
    )

    fun session(scope: CoroutineScope): HomeClaimSessionScope = sessions.create(scope)

    fun identity(session: HomeClaimSessionScope): HomeCreationScope = HomeCreationScope(retrofit.baseUrl().toString(), session.actorId.orEmpty().lowercase())
}

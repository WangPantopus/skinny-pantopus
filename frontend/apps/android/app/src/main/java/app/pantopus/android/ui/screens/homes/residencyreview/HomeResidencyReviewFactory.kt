package app.pantopus.android.ui.screens.homes.residencyreview

import app.pantopus.android.data.api.services.HomeResidencyReviewApi
import app.pantopus.android.data.api.services.UsersApi
import app.pantopus.android.data.homes.APIHomeResidencyReviewTransport
import app.pantopus.android.data.homes.HomeResidencyReviewCodec
import app.pantopus.android.data.homes.HomeResidencyReviewScope
import app.pantopus.android.data.homes.PersistentPendingHomeResidencyReviewStore
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import com.squareup.moshi.Moshi
import retrofit2.Retrofit
import javax.inject.Inject

class HomeResidencyReviewFactory
    @Inject
    constructor(
        private val store: PersistentPendingHomeResidencyReviewStore,
        private val retrofit: Retrofit,
        moshi: Moshi,
    ) {
        val codec = HomeResidencyReviewCodec(moshi)
        private val transport = APIHomeResidencyReviewTransport(retrofit.create(HomeResidencyReviewApi::class.java), codec)
        private val users = retrofit.create(UsersApi::class.java)

        fun create(
            session: HomeClaimSessionScope,
            homeId: String,
        ): HomeResidencyReviewCoordinator =
            HomeResidencyReviewCoordinator(
                HomeResidencyReviewScope(retrofit.baseUrl().toString(), session.actorId.orEmpty(), homeId),
                store,
                codec,
                transport,
                session::requireCurrent,
            )

        suspend fun publicName(applicant: String): String? = users.publicProfile(applicant).takeIf { it.id == applicant }?.displayName
    }

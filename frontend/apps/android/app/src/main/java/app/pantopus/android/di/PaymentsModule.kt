package app.pantopus.android.di

import android.content.SharedPreferences
import app.pantopus.android.BuildConfig
import app.pantopus.android.data.auth.TokenStorage
import app.pantopus.android.data.payments.PendingCardSetupStore
import app.pantopus.android.data.payments.PersistentPendingCardSetupStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object PaymentsModule {
    @Provides
    @Singleton
    fun providePendingCardSetupStore(
        preferences: SharedPreferences,
        tokens: TokenStorage,
    ): PendingCardSetupStore = PersistentPendingCardSetupStore(preferences, tokens, BuildConfig.PANTOPUS_API_BASE_URL)
}

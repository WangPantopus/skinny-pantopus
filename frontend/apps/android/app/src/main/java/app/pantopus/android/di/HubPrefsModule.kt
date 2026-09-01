package app.pantopus.android.di

import android.content.Context
import android.content.SharedPreferences
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/** Provides app-wide [SharedPreferences] for dismissible-UI flags. */
@Module
@InstallIn(SingletonComponent::class)
object HubPrefsModule {
    @Provides
    @Singleton
    fun provideSharedPreferences(
        @ApplicationContext context: Context,
    ): SharedPreferences = context.getSharedPreferences("pantopus.prefs", Context.MODE_PRIVATE)
}

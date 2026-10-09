package app.pantopus.android.data.store

import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/** Reaches the screens' store where nothing can inject it (a composable's change signal). */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface ScreenStoreEntryPoint {
    fun screenStore(): ScreenStore
}

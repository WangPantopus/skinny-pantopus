@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.translation

import android.content.Context
import android.speech.tts.TextToSpeech
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.displayMessage
import app.pantopus.android.data.mailbox.MailboxRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

/** Utterance id for the read-aloud job. */
private const val TTS_UTTERANCE_ID = "mail-translation"

/** Error copy when either leg of the translation fetch fails. */
private const val TRANSLATION_ERROR_FALLBACK =
    "We couldn't translate this letter. Check your connection and try again."

/**
 * A17.13 — Translation view-model. Mirror of iOS `MailTranslationViewModel`.
 * Fetches a real machine translation and drives the four DoD states off it,
 * owns the machine → confirmed transition (optimistic, rolls back on
 * failure), the view-toggle selection, and the read-aloud affordance.
 *
 * [load] reads both halves of the screen:
 *  - `GET api/mailbox/:id` — the original letter + sender
 *  - `POST api/mailbox/v2/p3/translate` — the translated text, the
 *    detected source language, the target, and whether it was cached
 *
 * A failure on either leg lands in [MailTranslationUiState.Error], which
 * the screen renders with a Retry wired to [refresh].
 */
@HiltViewModel
class MailTranslationViewModel
    @Inject
    constructor(
        @ApplicationContext private val appContext: Context,
        private val repo: MailboxRepository,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val mailId: String = savedStateHandle.get<String>(TRANSLATION_MAIL_ID_KEY).orEmpty()

        /**
         * Test/preview seam — seed the confirmed frame. Mirrors iOS's
         * `seedConfirmed`. Not read from nav today; the screen always lands
         * in the machine state and transitions on confirm.
         */
        private var seedConfirmed: Boolean = false

        private val _state = MutableStateFlow<MailTranslationUiState>(MailTranslationUiState.Loading)
        val state: StateFlow<MailTranslationUiState> = _state.asStateFlow()

        private val _toast = MutableStateFlow<String?>(null)
        val toast: StateFlow<String?> = _toast.asStateFlow()

        private val _confirmInFlight = MutableStateFlow(false)
        val confirmInFlight: StateFlow<Boolean> = _confirmInFlight.asStateFlow()

        /**
         * One TTS engine for the lifetime of the screen. `onInit` fires on a
         * binder thread, hence the volatile flags.
         */
        @Volatile private var tts: TextToSpeech? = null

        @Volatile private var ttsReady: Boolean = false

        @Volatile private var pendingUtterance: Pair<String, Locale>? = null

        /**
         * Fetch the mail item and its machine translation, then project them
         * into the screen content. Both legs are awaited — the side-by-side
         * view needs the original as much as the translation — so either
         * failing lands in [MailTranslationUiState.Error] with a Retry.
         */
        fun load() {
            _state.value = MailTranslationUiState.Loading
            viewModelScope.launch {
                val detail = repo.detail(mailId)
                if (detail !is NetworkResult.Success) {
                    _state.value = MailTranslationUiState.Error(errorMessage(detail))
                    return@launch
                }
                val translation = repo.translate(mailId)
                if (translation !is NetworkResult.Success) {
                    _state.value = MailTranslationUiState.Error(errorMessage(translation))
                    return@launch
                }
                var content =
                    MailTranslationProjection.project(
                        mailId = mailId,
                        detail = detail.data.mail,
                        translation = translation.data,
                    )
                if (seedConfirmed) {
                    content = content.copy(confirmed = true, viewMode = TranslationViewMode.Translated)
                }
                _state.value = MailTranslationUiState.Loaded(content)
            }
        }

        private fun errorMessage(result: NetworkResult<*>): String =
            (result as? NetworkResult.Failure)
                ?.error
                ?.displayMessage(TRANSLATION_ERROR_FALLBACK)
                ?: TRANSLATION_ERROR_FALLBACK

        fun refresh() = load()

        fun consumeToast() {
            _toast.value = null
        }

        /** Test/preview seam — set the confirmed seed before [load]. */
        fun setSeedConfirmed(value: Boolean) {
            seedConfirmed = value
        }

        /** Switch the body the toggle renders. */
        fun selectViewMode(mode: TranslationViewMode) {
            val current = _state.value
            if (current is MailTranslationUiState.Loaded && current.content.viewMode != mode) {
                _state.value = MailTranslationUiState.Loaded(current.content.copy(viewMode = mode))
            }
        }

        /**
         * Confirm the machine translation. Optimistically flips to the
         * confirmed state (banner + reading view + reply CTA); rolls back
         * and toasts on failure.
         */
        fun confirmTranslation() {
            val current = _state.value
            if (current !is MailTranslationUiState.Loaded) return
            if (current.content.confirmed || _confirmInFlight.value) return
            val previous = current.content
            _confirmInFlight.value = true
            _state.value =
                MailTranslationUiState.Loaded(
                    previous.copy(
                        confirmed = true,
                        viewMode = TranslationViewMode.Translated,
                        confirmedStamp = MailTranslationProjection.confirmedStamp(),
                    ),
                )
            viewModelScope.launch {
                // The translate endpoint doubles as the "confirm/trust" write
                // until a dedicated confirm route ships. The optimistic
                // projection is the source of truth for the UI.
                when (repo.translate(mailId)) {
                    is NetworkResult.Success -> _toast.value = "Translation confirmed"
                    is NetworkResult.Failure -> {
                        _state.value = MailTranslationUiState.Loaded(previous)
                        _toast.value = "Couldn't confirm — try again"
                    }
                }
                _confirmInFlight.value = false
            }
        }

        /** Read the selected column aloud via platform TTS. */
        fun listen(which: TranslationListenColumn) {
            val current = _state.value as? MailTranslationUiState.Loaded ?: return
            val text =
                when (which) {
                    TranslationListenColumn.Original ->
                        current.content.paragraphs.joinToString("\n") { it.original }
                    TranslationListenColumn.Translated ->
                        current.content.paragraphs.joinToString("\n") { it.english }
                }
            if (text.isBlank()) {
                _toast.value = "Nothing to read aloud yet."
                return
            }
            val languageCode =
                when (which) {
                    TranslationListenColumn.Original -> current.content.languages.sourceCode
                    TranslationListenColumn.Translated -> current.content.languages.targetCode
                }
            speak(text, localeFor(languageCode))
            _toast.value =
                when (which) {
                    TranslationListenColumn.Original -> "Playing the original aloud…"
                    TranslationListenColumn.Translated -> "Playing the translation aloud…"
                }
        }

        /**
         * Speak through a single engine owned by the view-model. The previous
         * shape built a second [TextToSpeech] *inside* the first one's `onInit`
         * and spoke through it before it had initialised, so nothing ever
         * played; utterances now queue until the one engine reports ready.
         */
        private fun speak(
            text: String,
            locale: Locale,
        ) {
            val engine = tts
            if (engine != null && ttsReady) {
                engine.applyLanguage(locale)
                engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, TTS_UTTERANCE_ID)
                return
            }
            pendingUtterance = text to locale
            // An engine already exists but is still initialising — the pending
            // utterance above will be picked up by its onInit callback.
            if (engine != null) return
            tts =
                TextToSpeech(appContext) { status ->
                    if (status == TextToSpeech.SUCCESS) {
                        ttsReady = true
                        val pending = pendingUtterance
                        pendingUtterance = null
                        if (pending != null) {
                            tts?.applyLanguage(pending.second)
                            tts?.speak(pending.first, TextToSpeech.QUEUE_FLUSH, null, TTS_UTTERANCE_ID)
                        }
                    } else {
                        ttsReady = false
                        pendingUtterance = null
                        _toast.value = "Couldn't play audio on this device."
                    }
                }
        }

        /**
         * Resolve the locale for the column's language, falling back to the
         * device default when the engine carries no voice for it. Mirrors the
         * iOS voice lookup.
         */
        private fun localeFor(code: String): Locale {
            val trimmed = code.trim()
            if (trimmed.isEmpty()) return Locale.getDefault()
            return runCatching { Locale.forLanguageTag(trimmed) }
                .getOrNull()
                ?.takeIf { it.language.isNotEmpty() }
                ?: Locale.getDefault()
        }

        private fun TextToSpeech.applyLanguage(locale: Locale) {
            val availability = runCatching { isLanguageAvailable(locale) }.getOrDefault(TextToSpeech.LANG_MISSING_DATA)
            setLanguage(if (availability >= TextToSpeech.LANG_AVAILABLE) locale else Locale.getDefault())
        }

        override fun onCleared() {
            tts?.stop()
            tts?.shutdown()
            tts = null
            ttsReady = false
            pendingUtterance = null
            super.onCleared()
        }

        /** One-off toast for the stubbed overflow / chip affordances. */
        fun showToast(message: String) {
            _toast.value = message
        }
    }

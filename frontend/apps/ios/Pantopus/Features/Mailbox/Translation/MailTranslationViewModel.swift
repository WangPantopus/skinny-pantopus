//
//  MailTranslationViewModel.swift
//  Pantopus
//
//  A17.13 — Translation view-model. Fetches a real machine translation
//  and drives the four DoD states off it, owns the machine → confirmed
//  transition (optimistic, rolls back on failure), the `ViewToggle`
//  selection, and the read-aloud affordance.
//
//  `load()` reads both halves of the screen:
//   · `GET /api/mailbox/:id`              — the original letter + sender
//   · `POST /api/mailbox/v2/p3/translate` — the translated text, the
//     detected source language, the target, and whether it was cached
//
//  A failure on either leg lands in `.error(message:)`, which the view
//  renders with a Retry wired to `refresh()`.
//

import AVFoundation
import Foundation
import Observation

@Observable
@MainActor
public final class MailTranslationViewModel {
    public private(set) var state: MailTranslationState = .loading
    /// One-shot toast surfaced on confirm / listen / rollback.
    public var toast: String?
    /// True while the confirm round-trip is in flight (disables the CTA).
    public private(set) var confirmInFlight = false

    private let mailId: String
    private let api: APIClient
    private let seedConfirmed: Bool
    private let now: @Sendable () -> Date
    /// Retained for the lifetime of the screen — a synthesizer created as a
    /// local temporary deallocates the moment `listen` returns, which cancels
    /// (or never starts) playback.
    private let synthesizer = AVSpeechSynthesizer()

    init(
        mailId: String,
        api: APIClient = .shared,
        seedConfirmed: Bool = false,
        now: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.mailId = mailId
        self.api = api
        self.seedConfirmed = seedConfirmed
        self.now = now
    }

    /// Fetch the mail item and its machine translation, then project them
    /// into the screen content. Both legs are awaited — the side-by-side
    /// view needs the original as much as the translation — so either
    /// failing lands in `.error(message:)` with a Retry.
    public func load() async {
        state = .loading
        do {
            let detail: MailDetailResponse = try await api.request(
                MailboxEndpoints.detail(mailId: mailId)
            )
            let translation: TranslationResultDTO = try await api.request(
                MailboxV2Endpoints.translate(mailId: mailId)
            )
            if Task.isCancelled { return }
            var content = MailTranslationProjection.project(
                mailId: mailId,
                detail: detail.mail,
                translation: translation,
                now: now()
            )
            if seedConfirmed {
                content.confirmed = true
                content.viewMode = .translated
            }
            state = .loaded(content)
        } catch {
            if Task.isCancelled { return }
            state = .error(
                message: (error as? APIError)?.errorDescription
                    ?? "We couldn't translate this letter. Check your connection and try again."
            )
        }
    }

    public func refresh() async {
        await load()
    }

    /// Switch the body the toggle renders.
    public func selectViewMode(_ mode: TranslationViewMode) {
        guard case var .loaded(content) = state, content.viewMode != mode else { return }
        content.viewMode = mode
        state = .loaded(content)
    }

    /// Confirm the machine translation. Optimistically flips to the
    /// confirmed state (banner + reading view + reply CTA); rolls back and
    /// toasts on failure.
    public func confirmTranslation() async {
        guard case var .loaded(content) = state, !content.confirmed, !confirmInFlight else { return }
        confirmInFlight = true
        defer { confirmInFlight = false }
        let previous = content
        content.confirmed = true
        content.viewMode = .translated
        content.confirmedStamp = MailTranslationProjection.confirmedStamp(now: now())
        state = .loaded(content)
        do {
            // The translate endpoint doubles as the "confirm/trust" write
            // until a dedicated confirm route ships. Discard the body — the
            // optimistic projection is the source of truth for the UI.
            _ = try await api.request(
                MailboxV2Endpoints.translate(mailId: mailId),
                as: TranslationResultDTO.self
            )
            toast = "Translation confirmed"
        } catch {
            state = .loaded(previous)
            toast = "Couldn't confirm — try again"
        }
    }

    /// Read the selected column aloud via `AVSpeechSynthesizer`.
    public func listen(_ which: TranslationListenColumn) {
        guard case let .loaded(content) = state else { return }
        let text: String
        let languageCode: String
        switch which {
        case .original:
            text = content.paragraphs.map(\.original).joined(separator: "\n")
            languageCode = content.languages.sourceCode
        case .translated:
            text = content.paragraphs.map(\.english).joined(separator: "\n")
            languageCode = content.languages.targetCode
        }
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            toast = "Nothing to read aloud yet."
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
            try session.setActive(true)
        } catch {
            toast = "Couldn't play audio on this device."
            return
        }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = Self.voice(forLanguageCode: languageCode)
        // Replace whatever is already playing rather than queueing behind it.
        synthesizer.stopSpeaking(at: .immediate)
        synthesizer.speak(utterance)
        switch which {
        case .original:
            toast = "Playing the original aloud…"
        case .translated:
            toast = "Playing the translation aloud…"
        }
    }

    /// Resolve the voice for the column's language, falling back to en-US when
    /// the device carries no voice for it. Mirrors the Android locale lookup.
    private static func voice(forLanguageCode code: String) -> AVSpeechSynthesisVoice? {
        let normalized = code.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !normalized.isEmpty else { return AVSpeechSynthesisVoice(language: "en-US") }
        return AVSpeechSynthesisVoice(language: normalized)
            ?? AVSpeechSynthesisVoice(language: "en-US")
    }
}

/// Which column the "Listen" stub reads.
public enum TranslationListenColumn: Sendable {
    case original
    case translated
}

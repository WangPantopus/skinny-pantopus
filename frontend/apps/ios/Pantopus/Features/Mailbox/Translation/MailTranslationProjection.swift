//
//  MailTranslationProjection.swift
//  Pantopus
//
//  A17.13 — pure projection from the two real payloads the Translation
//  screen reads:
//
//   · `GET /api/mailbox/:id`            (`backend/routes/mailbox.js:1466`)
//     → the original letter, its sender, and its timestamp
//   · `POST /api/mailbox/v2/p3/translate` (`backend/routes/mailboxV2Phase3.js:1644`)
//     → `{ translated_text, from_language, to_language, cached }`
//
//  Everything the screen renders comes from those two bodies. The
//  backend carries no translator-notes glossary and no detection
//  confidence, so the glossary is empty and the confidence is `nil`
//  rather than invented — the badge and the elf strip both degrade.
//
//  Kept as a static projector so tests can exercise it without standing
//  the network stack up. Mirrors `MailTranslationProjection.kt`.
//

import Foundation

public enum MailTranslationProjection {
    /// Build the screen content from the mail detail + the machine
    /// translation result.
    public static func project(
        mailId: String,
        detail: MailDetailResponse.MailDetail,
        translation: TranslationResultDTO,
        now: Date = Date()
    ) -> MailTranslationContent {
        let languages = makeLanguages(translation: translation)
        let originalText = originalText(from: detail)
        let paragraphs = alignParagraphs(
            original: originalText,
            translated: translation.translatedText ?? ""
        )
        return MailTranslationContent(
            mailId: mailId,
            confirmed: false,
            viewMode: .side,
            categoryLabel: "Translation",
            timeLabel: relativeTimeLabel(detail.item.createdAt, now: now),
            languages: languages,
            paragraphs: paragraphs,
            highlightTerm: nil,
            // The translate route returns no glossary; the notes card
            // hides itself when this is empty.
            glossary: [],
            sender: makeSender(detail: detail),
            confirmedStamp: confirmedStamp(now: now),
            elfMachine: machineElf(languages: languages, cached: translation.cached == true),
            elfConfirmed: confirmedElf(languages: languages, now: now)
        )
    }

    /// "Marked trusted by you · May 28 · 2:40 PM".
    public static func confirmedStamp(now: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d · h:mm a"
        return "Marked trusted by you · \(formatter.string(from: now))"
    }

    // MARK: - Languages

    static func makeLanguages(translation: TranslationResultDTO) -> TranslationLanguages {
        let fromRaw = (translation.fromLanguage ?? "auto").trimmingCharacters(in: .whitespaces)
        let toRaw = (translation.toLanguage ?? "en").trimmingCharacters(in: .whitespaces)
        return TranslationLanguages(
            sourceCode: displayCode(fromRaw),
            sourceName: displayName(fromRaw),
            confidence: nil,
            targetCode: displayCode(toRaw),
            targetName: displayName(toRaw)
        )
    }

    /// The two-letter pill. `auto` has no code of its own, so the pill
    /// shows the magnifier-ish "AUTO" the badge already reads out.
    static func displayCode(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return "AUTO" }
        if trimmed.caseInsensitiveCompare("auto") == .orderedSame { return "AUTO" }
        return String(trimmed.prefix(2)).uppercased()
    }

    /// Long name for the badge line. Falls back to the raw tag so an
    /// unmapped language still reads sensibly.
    static func displayName(_ raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return "Auto-detected" }
        if trimmed.caseInsensitiveCompare("auto") == .orderedSame { return "Auto-detected" }
        let base = String(trimmed.split(separator: "-").first ?? "").lowercased()
        if let localized = Locale(identifier: "en_US").localizedString(forLanguageCode: base),
           !localized.isEmpty {
            return localized.capitalized
        }
        return trimmed.uppercased()
    }

    // MARK: - Text

    /// The letter as stored on the mail row. `content` is the body;
    /// `preview_text` / `subject` are the fallbacks for rows that only
    /// carry a summary.
    static func originalText(from detail: MailDetailResponse.MailDetail) -> String {
        let candidates = [detail.item.content, detail.item.previewText, detail.item.subject]
        for candidate in candidates {
            if let candidate, !candidate.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return candidate
            }
        }
        return ""
    }

    /// Split both sides into paragraphs and pair them by index so the
    /// side-by-side view can align them. Unequal counts pad with empty
    /// strings rather than dropping content.
    static func alignParagraphs(original: String, translated: String) -> [TranslationParagraph] {
        let left = paragraphs(from: original)
        let right = paragraphs(from: translated)
        let count = max(left.count, right.count)
        guard count > 0 else { return [] }
        return (0..<count).map { index in
            TranslationParagraph(
                id: index,
                original: index < left.count ? left[index] : "",
                english: index < right.count ? right[index] : "",
                isHeading: index == 0 && count > 1,
                isSignoff: index == count - 1 && count > 2
            )
        }
    }

    static func paragraphs(from text: String) -> [String] {
        text
            .components(separatedBy: "\n")
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
    }

    // MARK: - Sender

    static func makeSender(detail: MailDetailResponse.MailDetail) -> TranslationSender {
        let name = detail.sender?.name
            ?? detail.item.senderBusinessName
            ?? detail.item.senderAddress
            ?? "Unknown sender"
        let meta: String = if let username = detail.sender?.username, !username.isEmpty {
            "@\(username)"
        } else {
            detail.item.senderAddress ?? ""
        }
        return TranslationSender(
            initials: initials(for: name),
            name: name,
            meta: meta,
            kind: trustLabel(detail.item.senderTrust),
            proof: proofLabel(detail.item.senderTrust)
        )
    }

    static func initials(for name: String) -> String {
        let parts = name
            .split(separator: " ")
            .compactMap { $0.first.map(String.init) }
        guard !parts.isEmpty else { return "?" }
        return parts.prefix(2).joined().uppercased()
    }

    /// `Mail.sender_trust` (`backend/database/schema.sql:7207`).
    static func trustLabel(_ raw: String?) -> String {
        switch (raw ?? "").lowercased() {
        case "verified_gov": "Verified government"
        case "verified_utility": "Verified utility"
        case "verified_business": "Verified business"
        case "pantopus_user": "Verified neighbor"
        default: "Unverified sender"
        }
    }

    static func proofLabel(_ raw: String?) -> String {
        switch (raw ?? "").lowercased() {
        case "verified_gov", "verified_utility", "verified_business": "Sender domain checked"
        case "pantopus_user": "Address verified"
        default: "No proof on file"
        }
    }

    // MARK: - Time

    static func relativeTimeLabel(_ iso: String, now: Date) -> String {
        let isoFull = ISO8601DateFormatter()
        isoFull.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = isoFull.date(from: iso) ?? plain.date(from: iso) else { return "" }
        let seconds = Int(now.timeIntervalSince(date))
        if seconds < 60 { return "just now" }
        let minutes = seconds / 60
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = minutes / 60
        if hours < 24 { return "\(hours)h ago" }
        let days = hours / 24
        if days < 7 { return "\(days)d ago" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    // MARK: - Elf strips

    static func machineElf(languages: TranslationLanguages, cached: Bool) -> TranslationElf {
        TranslationElf(
            headline: "Pantopus translated this letter",
            summary: "I read the original in \(languages.sourceName) and rendered it in "
                + "\(languages.targetName). Compare the two sides below and confirm when it "
                + "reads right — I\u{2019}ll mark the translation trusted.",
            bullets: [
                TranslationElfBullet(
                    id: 0,
                    icon: .languages,
                    label: "\(languages.sourceName) → \(languages.targetName)",
                    text: cached ? "served from cache" : "fresh machine translation"
                ),
                TranslationElfBullet(
                    id: 1,
                    icon: .listen,
                    label: "Listen in either language",
                    text: "tap play on a column"
                )
            ]
        )
    }

    static func confirmedElf(languages: TranslationLanguages, now: Date) -> TranslationElf {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "MMM d · h:mm a"
        return TranslationElf(
            headline: "Translation confirmed",
            summary: "You confirmed this \(languages.targetName) translation. Pantopus keeps both "
                + "versions in your Vault, so the original is never lost.",
            bullets: [
                TranslationElfBullet(
                    id: 0,
                    icon: .confirmed,
                    label: "Confirmed by you",
                    text: formatter.string(from: now)
                ),
                TranslationElfBullet(
                    id: 1,
                    icon: .archive,
                    label: "Both versions saved",
                    text: "original + \(languages.targetName) in Vault"
                ),
                TranslationElfBullet(
                    id: 2,
                    icon: .reply,
                    label: "Reply in \(languages.targetName)",
                    text: "we translate back on send"
                )
            ]
        )
    }
}

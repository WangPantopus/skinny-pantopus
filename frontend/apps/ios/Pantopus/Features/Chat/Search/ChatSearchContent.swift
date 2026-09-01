//
//  ChatSearchContent.swift
//  Pantopus
//
//  P4.3 — Render models + text helpers for the Chat Search surface.
//  A `ChatSearchResult` is one matched conversation: the row shows the
//  conversation identity plus a snippet (the matched message body, or the
//  last-message preview when only the name matched) with the query term
//  highlighted. `matchedMessageId` is set only for body matches — it rides
//  the navigation hop so the conversation opens scrolled to that message.
//

import Foundation
import SwiftUI

/// One Chat Search result row — a single matched conversation.
public struct ChatSearchResult: Identifiable, Hashable, Sendable {
    /// Which conversation endpoint backs the thread, so the router can
    /// rebuild the typed destination (`.person` vs `.room`).
    public enum Kind: Sendable, Hashable {
        case dm
        case group
    }

    /// Stable id for the conversation — other-user id for `.dm`, room id
    /// for `.group`. Drives the navigation destination.
    public let conversationId: String
    public let kind: Kind
    public let displayName: String
    public let initials: String
    public let identityChip: ConversationIdentityChip?
    public let verified: Bool
    /// The snippet to render under the name. For a body match this is a
    /// window around the matched message text; for a name-only match it
    /// is the conversation's last-message preview.
    public let snippet: String
    /// Set when the match came from a message body — the id of that
    /// message, used to scroll the conversation to it. `nil` for
    /// name-only matches (the conversation opens at the latest message).
    public let matchedMessageId: String?
    /// The active query, carried so the row can highlight occurrences
    /// without the shell having to thread it through separately.
    public let query: String

    public var id: String {
        "\(conversationId)|\(matchedMessageId ?? "name")"
    }

    public init(
        conversationId: String,
        kind: Kind,
        displayName: String,
        initials: String,
        identityChip: ConversationIdentityChip?,
        verified: Bool,
        snippet: String,
        matchedMessageId: String?,
        query: String
    ) {
        self.conversationId = conversationId
        self.kind = kind
        self.displayName = displayName
        self.initials = initials
        self.identityChip = identityChip
        self.verified = verified
        self.snippet = snippet
        self.matchedMessageId = matchedMessageId
        self.query = query
    }
}

/// Pure text helpers for matching, snippet-windowing, and highlight
/// rendering. Kept free of view state so the matching rules are unit
/// testable and mirror 1:1 with the Android `ChatSearchText` helper.
public enum ChatSearchText {
    /// Case/diacritic-insensitive containment — the single matching rule
    /// used everywhere (names + bodies + the highlight scan) so search and
    /// highlight never disagree about what counts as a hit.
    public static func matches(_ haystack: String, query: String) -> Bool {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return false }
        return haystack.range(of: q, options: [.caseInsensitive, .diacriticInsensitive]) != nil
    }

    /// Build a snippet centred on the first match. Short bodies are
    /// returned whole; long bodies are windowed with leading/trailing
    /// ellipses so the matched term stays visible in the row's two lines.
    public static func snippet(from body: String, matching query: String, maxLength: Int = 90) -> String {
        let collapsed = body
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\n", with: " ")
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard collapsed.count > maxLength, !q.isEmpty,
              let match = collapsed.range(of: q, options: [.caseInsensitive, .diacriticInsensitive])
        else {
            return collapsed.count > maxLength ? String(collapsed.prefix(maxLength)) + "…" : collapsed
        }
        let lead = 24
        let matchStart = collapsed.distance(from: collapsed.startIndex, to: match.lowerBound)
        let startOffset = max(0, matchStart - lead)
        let start = collapsed.index(collapsed.startIndex, offsetBy: startOffset)
        let window = collapsed[start...]
        let truncated = window.prefix(maxLength)
        let prefix = startOffset > 0 ? "…" : ""
        let suffix = truncated.endIndex < window.endIndex ? "…" : ""
        return prefix + String(truncated) + suffix
    }

    /// Render `text` as an `AttributedString` with every case-insensitive
    /// occurrence of `query` emphasized. Built as escaped inline Markdown
    /// so Swift 6 strict concurrency does not emit key-path Sendable
    /// warnings for direct `AttributedString` attribute writes.
    public static func highlighted(_ text: String, query: String) -> AttributedString {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return AttributedString(text) }

        var markdown = ""
        var remainder = Substring(text)
        while let range = remainder.range(of: q, options: [.caseInsensitive, .diacriticInsensitive]) {
            markdown += escapedMarkdown(String(remainder[remainder.startIndex..<range.lowerBound]))
            markdown += "**\(escapedMarkdown(String(remainder[range])))**"
            remainder = remainder[range.upperBound...]
        }
        markdown += escapedMarkdown(String(remainder))
        return (try? AttributedString(
            markdown: markdown,
            options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
        )) ?? AttributedString(text)
    }

    private static func escapedMarkdown(_ text: String) -> String {
        let special = "\\`*_{}[]<>()#+-.!|"
        return text.reduce(into: "") { result, character in
            if special.contains(character) {
                result.append("\\")
            }
            result.append(character)
        }
    }
}

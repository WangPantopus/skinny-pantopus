//
//  PulsePageContent.swift
//  Pantopus
//
//  The Pulse page as it is drawn (Pulse S6; build spec §3, contract §2.1 and
//  §2.3): cards, groups, the end of the page and the quiet state, projected
//  from `GET /api/pulse/feed`. Copy is the build spec's appendix and the
//  rules are Android's (PA's `PulsePageContent.kt`), so both apps read the
//  same. A type, label, action or resolution this build doesn't know reads
//  as a plain card or no word, never a crash (Pulse S2).
//

import Foundation

/// An author's label (build spec §10). The chip always carries the words;
/// its tint only repeats them.
public enum PulseAuthorLabel: String, Sendable, Hashable, CaseIterable {
    case resident
    case newHere = "new_here"
    case nearby
    case visitor
    case official
    case business
    case pantopus

    /// The words on the chip (appendix "Labels").
    public var text: String {
        switch self {
        case .resident: "Resident"
        case .newHere: "New here"
        case .nearby: "Nearby"
        case .visitor: "Visitor"
        case .official: "Official"
        case .business: "Business"
        case .pantopus: "Pantopus"
        }
    }
}

/// One card, ready to draw.
public struct PulsePageCard: Sendable, Hashable, Identifiable {
    public let id: String
    /// Null on public responses; "Mute {name}" needs it.
    public let authorId: String?
    public let authorName: String
    /// Nil when the label is missing or one this build doesn't know.
    public let label: PulseAuthorLabel?
    /// "0.1 mi · 1h": the distance (when the reader has one) and the time.
    public let meta: String
    /// "OFFER", "SHARE", "ASK", "HEADS-UP", "EVENT", "LOST", "FOUND"; "POST"
    /// for a type this build doesn't know.
    public let typeName: String
    public let text: String
    public let photoURL: URL?
    public let photoCount: Int
    /// "NW 23rd Ave · Gardening", with "Ends Wed 4pm" on a heads-up that
    /// names a time.
    public let aboutLine: String?
    /// `answer`, `reply`, `claim`, `seen_it`, `going` or `its_mine`.
    public let actionKind: String?
    public let actionLabel: String?
    public var actionDone: Bool
    /// "2 replies"; nil with none.
    public let repliesText: String?
    /// An event's going count.
    public var goingCount: Int?
    /// "✓ Answered", "Gone", "Reunited", "Happened · 14 went" (Pulse S7).
    public let status: PulsePostStatus?
    /// The post's topic, for "Mute this topic".
    public let topic: PulseTopic?
    public let isAuthor: Bool
    /// The stored type.
    public let type: String?
    /// The asker's own open Ask: "Close" is offered (Pulse S7).
    public let isOpenAsk: Bool
    /// "Keep open 7 more days" is offered (`viewer.can_keep_open`); turned
    /// off here after it succeeds or the server says it was already used.
    public var canKeepOpen: Bool
    /// The reader saved it; nil when the server doesn't say (no Save entry).
    public var saved: Bool?

    /// "14 going", on an event.
    public var goingText: String? {
        goingCount.map { "\($0) going" }
    }

    /// The card for VoiceOver, one stop: everything but the action button,
    /// which is a control of its own.
    public var accessibilityLabel: String {
        let header = [authorName, label?.text, meta.isEmpty ? nil : meta].compactMap(\.self).joined(separator: ", ")
        let typeWords = typeName.prefix(1) + typeName.dropFirst().lowercased()
        return [header, String(typeWords), text.isEmpty ? nil : text, aboutLine, repliesText, goingText, status?.text]
            .compactMap(\.self)
            .joined(separator: ". ")
    }
}

/// One group under its header ("AROUND CAMAS").
public struct PulsePageGroup: Sendable, Hashable, Identifiable {
    public let key: String
    public let title: String
    public var cards: [PulsePageCard]

    public var id: String {
        key
    }
}

/// The end of the page: "You're caught up", since when, and "Show earlier".
public struct PulsePageEnd: Sendable, Hashable {
    public let caughtUp: Bool
    /// "That's everything new around Camas since this morning."
    public let sentence: String
    public let canShowEarlier: Bool
    public let earlierCursor: String?
}

/// The page as the server returned it.
public struct PulsePageContent: Sendable, Hashable {
    public let areaName: String
    public var groups: [PulsePageGroup]
    public let end: PulsePageEnd
    /// `meter` or `set_up_home`: the quiet-state card shows; nil: no card.
    public let quietCard: String?
    /// When this read was made: `after` for the new-conversations count and
    /// `through` for the seen marker.
    public let readAt: Date

    public var isEmpty: Bool {
        groups.allSatisfy(\.cards.isEmpty)
    }
}

/// How the page words things.
public enum PulsePageWords {
    /// "ASK", "HEADS-UP", …; "POST" for anything this build doesn't know.
    public static func typeName(type: String?, lostFoundKind: String?) -> String {
        switch type {
        case "ask_local": "ASK"
        case "share": "SHARE"
        case "offer": "OFFER"
        case "alert": "HEADS-UP"
        case "event": "EVENT"
        case "lost_found":
            switch lostFoundKind {
            case "lost": "LOST"
            case "found": "FOUND"
            default: "LOST & FOUND"
            }
        default: "POST"
        }
    }

    /// The words for the type's action when the server sent none.
    public static func defaultActionLabel(_ kind: String?) -> String? {
        switch kind {
        case "answer": "Answer"
        case "reply": "Reply"
        case "claim": "I'd like it"
        case "seen_it": "Seen it"
        case "going": "Going"
        case "its_mine": "It's mine"
        default: nil
        }
    }

    /// "Just now", "5m", "1h", "Yesterday", "Tue", "Sep 26", "Sep 26, 2025"
    /// in the viewer's time zone.
    public static func relativeTime(_ date: Date?, now: Date = Date(), timeZone: TimeZone = .current) -> String {
        guard let date else { return "" }
        let minutes = Int(now.timeIntervalSince(date) / 60)
        if minutes < 1 { return "Just now" }
        if minutes < 60 { return "\(minutes)m" }
        if minutes < 24 * 60 { return "\(minutes / 60)h" }
        let calendar = calendar(in: timeZone)
        let days = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: date),
            to: calendar.startOfDay(for: now)
        ).day ?? 0
        if days <= 1 { return "Yesterday" }
        if days < 7 { return shortWeekdays[calendar.component(.weekday, from: date) - 1] }
        let sameYear = calendar.component(.year, from: date) == calendar.component(.year, from: now)
        return format(date, sameYear ? "MMM d" : "MMM d, yyyy", timeZone)
    }

    /// "this morning", "earlier today", "yesterday", "Tuesday", "Oct 3": how
    /// long the page has had nothing newer, in the viewer's time zone.
    public static func since(_ date: Date?, now: Date = Date(), timeZone: TimeZone = .current) -> String {
        guard let date else { return "this morning" }
        let calendar = calendar(in: timeZone)
        let days = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: date),
            to: calendar.startOfDay(for: now)
        ).day ?? 0
        if days <= 0 { return calendar.component(.hour, from: date) < 12 ? "this morning" : "earlier today" }
        if days == 1 { return "yesterday" }
        if days < 7 { return fullWeekdays[calendar.component(.weekday, from: date) - 1] }
        return format(date, "MMM d", timeZone)
    }

    static func parseDate(_ text: String?) -> Date? {
        guard let text else { return nil }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return fractional.date(from: text) ?? ISO8601DateFormatter().date(from: text)
    }

    private static let shortWeekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    private static let fullWeekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    private static func calendar(in timeZone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar
    }

    private static func format(_ date: Date, _ pattern: String, _ timeZone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }
}

public extension PulsePostDTO {
    /// The post as one card.
    func pageCard(now: Date = Date(), timeZone: TimeZone = .current) -> PulsePageCard {
        let name = author?.displayName.flatMap { $0.isEmpty ? nil : $0 } ?? "A neighbor"
        let topicValue = topic.flatMap(PulseTopic.init(stored:))
        let endsAt = PulsePageWords.parseDate(status?.endsAt)
        let ends: String? = if type == "alert", let endsAt, endsAt > now {
            "Ends \(PulsePostStatus.endsFormat(endsAt, timeZone: timeZone))"
        } else {
            nil
        }
        let aboutParts = [about?.label.flatMap { $0.isEmpty ? nil : $0 }, topicValue?.label, ends]
        let aboutLine = aboutParts.compactMap(\.self).joined(separator: " · ")
        let time = PulsePageWords.relativeTime(PulsePageWords.parseDate(createdAt), now: now, timeZone: timeZone)
        let meta = [author?.distanceText.flatMap { $0.isEmpty ? nil : $0 }, time.isEmpty ? nil : time]
            .compactMap(\.self)
            .joined(separator: " · ")
        let replies = counts?.replies ?? 0
        let going = type == "event" ? counts?.going : nil
        let photos = media.filter { $0.type == "image" && !($0.url ?? "").isEmpty }
        let photo = photos.first.flatMap { item in
            (item.thumbnailUrl.flatMap { $0.isEmpty ? nil : $0 } ?? item.url).flatMap(URL.init(string:))
        }
        let body = (text ?? "").isEmpty ? (title ?? "") : (text ?? "")
        let isAuthor = viewer?.isAuthor ?? false
        let openAsk = isAuthor && type == "ask_local" && status?.resolution == nil
            && (status?.state == nil || status?.state == "open")
            && (endsAt.map { $0 > now } ?? true)
        let knownType = ["ask_local", "share", "offer", "alert", "event", "lost_found", "legacy"].contains(type ?? "")
        let genericAction = !knownType || (action != nil && PulsePageWords.defaultActionLabel(action?.kind) == nil)
        return PulsePageCard(
            id: id,
            authorId: author?.id,
            authorName: name,
            label: author?.label.flatMap(PulseAuthorLabel.init(rawValue:)),
            meta: meta,
            typeName: PulsePageWords.typeName(type: type, lostFoundKind: lostFound?.kind),
            text: body,
            photoURL: photo,
            photoCount: photos.count,
            aboutLine: aboutLine.isEmpty ? nil : aboutLine,
            actionKind: genericAction ? "reply" : action?.kind,
            actionLabel: genericAction ? "Reply"
                : action?.label.flatMap { $0.isEmpty ? nil : $0 } ?? PulsePageWords.defaultActionLabel(action?.kind),
            actionDone: !genericAction && action?.done == true,
            repliesText: replies == 1 ? "1 reply" : (replies > 1 ? "\(replies) replies" : nil),
            goingCount: going,
            // The words of how it ended; a heads-up's end reads in the line above.
            status: PulsePostStatus.from(
                resolution: status?.resolution,
                state: nil,
                postType: type,
                goingCount: counts?.going ?? 0,
                expiresAt: nil,
                now: now
            ),
            topic: topicValue,
            isAuthor: isAuthor,
            type: type,
            isOpenAsk: openAsk,
            canKeepOpen: viewer?.canKeepOpen ?? false,
            saved: viewer?.saved
        )
    }
}

public extension PulseFeedResponse {
    /// The response as the page: groups only as the response has them (an
    /// empty one is dropped), the end and the quiet-state card.
    func pageContent(readAt: Date, now: Date = Date(), timeZone: TimeZone = .current) -> PulsePageContent {
        let town = area?.name.flatMap { $0.isEmpty ? nil : $0 } ?? "your area"
        var ids = Set<String>()
        let pageGroups = groups.enumerated().compactMap { index, group -> PulsePageGroup? in
            let cards = group.items.filter { ids.insert($0.id).inserted }.map { $0.pageCard(now: now, timeZone: timeZone) }
            guard !cards.isEmpty else { return nil }
            return PulsePageGroup(key: group.key ?? "group-\(index)", title: group.title ?? "", cards: cards)
        }
        let since = PulsePageWords.since(PulsePageWords.parseDate(end?.since), now: now, timeZone: timeZone)
        let cursor = end?.earlierCursor.flatMap { $0.isEmpty ? nil : $0 }
        return PulsePageContent(
            areaName: town,
            groups: pageGroups,
            end: PulsePageEnd(
                caughtUp: end?.caughtUp ?? false,
                sentence: "That's everything new around \(town) since \(since).",
                canShowEarlier: (end?.canShowEarlier ?? false) && cursor != nil,
                earlierCursor: cursor
            ),
            quietCard: quiet?.card,
            readAt: readAt
        )
    }
}

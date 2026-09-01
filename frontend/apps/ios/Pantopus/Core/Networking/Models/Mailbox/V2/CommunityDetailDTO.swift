//
//  CommunityDetailDTO.swift
//  Pantopus
//
//  T6.5d (P22) — Community (A17.4) sub-payload decoded from
//  `mail.object_payload` when `mail_type == "community"`. Backend
//  stores this as untyped JSON shaped by the `CommunityMailItem`
//  table (schema at `backend/database/schema.sql:5350`). The
//  RSVP-going state flows back from the existing
//  `POST /api/mailbox/v2/community/rsvp` route
//  (`backend/routes/mailboxV2Phase3.js:746`) — the decoder is
//  defensive and `decode(from:)` returns nil when the payload
//  doesn't carry a community item id.
//

import Foundation

/// HOA/neighborhood-group seal rendered in the badge card.
public struct CommunityGroupInfo: Sendable, Hashable {
    public let name: String
    public let tagline: String?
    public let founded: String?
    public let role: String?
    public let membershipSince: String?
    public let memberCount: Int?
    public let isVerified: Bool

    public init(
        name: String,
        tagline: String?,
        founded: String?,
        role: String?,
        membershipSince: String?,
        memberCount: Int?,
        isVerified: Bool
    ) {
        self.name = name
        self.tagline = tagline
        self.founded = founded
        self.role = role
        self.membershipSince = membershipSince
        self.memberCount = memberCount
        self.isVerified = isVerified
    }
}

/// When/where/bring chunk per the A17.4 design's Event details card.
public struct CommunityEventInfo: Sendable, Hashable {
    public let dayLabel: String?
    public let dateLabel: String?
    public let timeRange: String?
    public let location: String?
    public let locationNote: String?
    public let distanceLabel: String?
    public let bringItems: [String]
    public let weatherSummary: String?
    public let weatherTemperatureF: Int?

    public init(
        dayLabel: String?,
        dateLabel: String?,
        timeRange: String?,
        location: String?,
        locationNote: String?,
        distanceLabel: String?,
        bringItems: [String],
        weatherSummary: String?,
        weatherTemperatureF: Int?
    ) {
        self.dayLabel = dayLabel
        self.dateLabel = dateLabel
        self.timeRange = timeRange
        self.location = location
        self.locationNote = locationNote
        self.distanceLabel = distanceLabel
        self.bringItems = bringItems
        self.weatherSummary = weatherSummary
        self.weatherTemperatureF = weatherTemperatureF
    }
}

/// One attendee rendered in the strip. Backend wire shape is loose;
/// `displayName` is always present, the rest are best-effort.
public struct CommunityAttendee: Sendable, Hashable, Identifiable {
    public let id: String
    public let displayName: String
    public let initials: String
    public let blockLabel: String?
    public let isVerified: Bool

    public init(id: String, displayName: String, initials: String, blockLabel: String?, isVerified: Bool) {
        self.id = id
        self.displayName = displayName
        self.initials = initials
        self.blockLabel = blockLabel
        self.isVerified = isVerified
    }
}

/// Cross-link card pointing at the related Pulse thread.
public struct CommunityPulseThread: Sendable, Hashable {
    public let threadId: String
    public let title: String
    public let replyCount: Int
    public let lastReplyAuthor: String?
    public let lastReplyPreview: String?
    public let lastReplyAge: String?

    public init(
        threadId: String,
        title: String,
        replyCount: Int,
        lastReplyAuthor: String?,
        lastReplyPreview: String?,
        lastReplyAge: String?
    ) {
        self.threadId = threadId
        self.title = title
        self.replyCount = replyCount
        self.lastReplyAuthor = lastReplyAuthor
        self.lastReplyPreview = lastReplyPreview
        self.lastReplyAge = lastReplyAge
    }
}

/// Tri-state RSVP — mirrors the design's Going / Maybe / Can't make it
/// chip row. Wire string is lowercase per the backend convention.
public enum CommunityRsvpStatus: String, Sendable, Hashable {
    case going
    case maybe
    case notGoing = "not_going"
    case undecided

    public init(wire: String?) {
        switch wire?.lowercased() {
        case "going", "will_attend": self = .going
        case "maybe": self = .maybe
        case "not_going", "declined": self = .notGoing
        default: self = .undecided
        }
    }
}

/// Content variation rendered in the Community body card.
public enum CommunityMailSubtype: String, Sendable, Hashable {
    case event
    case poll
    case neighborhoodUpdate = "neighborhood_update"

    public init(wire: String?) {
        switch wire?.lowercased() {
        case "poll", "vote": self = .poll
        case "neighborhood_update", "neighborhood-update", "update", "announcement":
            self = .neighborhoodUpdate
        default:
            self = .event
        }
    }
}

/// One option in a community poll.
public struct CommunityPollOption: Sendable, Hashable, Identifiable {
    public let id: String
    public let label: String
    public let voteCount: Int
    public let isSelected: Bool

    public init(id: String, label: String, voteCount: Int, isSelected: Bool = false) {
        self.id = id
        self.label = label
        self.voteCount = voteCount
        self.isSelected = isSelected
    }
}

/// Poll card payload for community mail.
public struct CommunityPollInfo: Sendable, Hashable {
    public let question: String
    public let options: [CommunityPollOption]
    public let totalVotes: Int
    public let closesAtLabel: String?
    public let statusLabel: String?

    public init(
        question: String,
        options: [CommunityPollOption],
        totalVotes: Int,
        closesAtLabel: String?,
        statusLabel: String?
    ) {
        self.question = question
        self.options = options
        self.totalVotes = totalVotes
        self.closesAtLabel = closesAtLabel
        self.statusLabel = statusLabel
    }
}

/// Neighborhood-update card payload for community mail.
public struct CommunityUpdateInfo: Sendable, Hashable {
    public let headline: String
    public let summary: String?
    public let items: [String]
    public let statusLabel: String?
    public let footerLabel: String?

    public init(
        headline: String,
        summary: String?,
        items: [String],
        statusLabel: String?,
        footerLabel: String?
    ) {
        self.headline = headline
        self.summary = summary
        self.items = items
        self.statusLabel = statusLabel
        self.footerLabel = footerLabel
    }
}

/// Community detail payload — drives the A17.4 variant body.
public struct CommunityDetailDTO: Sendable, Hashable {
    /// PK of the `CommunityMailItem` row. Required so the RSVP mutation
    /// can find the right item.
    public let communityItemId: String
    public let subtype: CommunityMailSubtype
    public let group: CommunityGroupInfo
    public let event: CommunityEventInfo?
    public let poll: CommunityPollInfo?
    public let update: CommunityUpdateInfo?
    public let attendees: [CommunityAttendee]
    public let attendeeCount: Int
    public let attendeesFromBlock: Int?
    public let pulseThread: CommunityPulseThread?
    public let rsvp: CommunityRsvpStatus

    public init(
        communityItemId: String,
        subtype: CommunityMailSubtype = .event,
        group: CommunityGroupInfo,
        event: CommunityEventInfo?,
        poll: CommunityPollInfo? = nil,
        update: CommunityUpdateInfo? = nil,
        attendees: [CommunityAttendee],
        attendeeCount: Int,
        attendeesFromBlock: Int?,
        pulseThread: CommunityPulseThread?,
        rsvp: CommunityRsvpStatus
    ) {
        self.communityItemId = communityItemId
        self.subtype = subtype
        self.group = group
        self.event = event
        self.poll = poll
        self.update = update
        self.attendees = attendees
        self.attendeeCount = attendeeCount
        self.attendeesFromBlock = attendeesFromBlock
        self.pulseThread = pulseThread
        self.rsvp = rsvp
    }

    public static func decode(from value: JSONValue?) -> CommunityDetailDTO? {
        guard let dict = value?.dictValue else { return nil }
        guard let itemId = dict["community_item_id"]?.stringValue
            ?? dict["id"]?.stringValue, !itemId.isEmpty else {
            return nil
        }
        let group = decodeGroup(from: dict)
        let event = decodeEvent(from: dict["event"]?.dictValue)
        let poll = decodePoll(from: dict)
        let update = decodeUpdate(from: dict)
        let explicitSubtype = CommunityMailSubtype(
            wire: dict["community_kind"]?.stringValue
                ?? dict["kind"]?.stringValue
                ?? dict["subtype"]?.stringValue
                ?? dict["variant"]?.stringValue
        )
        let subtype: CommunityMailSubtype = if poll != nil && explicitSubtype == .event {
            .poll
        } else if update != nil && event == nil && poll == nil && explicitSubtype == .event {
            .neighborhoodUpdate
        } else {
            explicitSubtype
        }
        let attendees = decodeAttendees(from: dict["attendees"]?.arrayValue)
        let attendeeCount = dict["attendee_count"]?.numberValue.map { Int($0) }
            ?? dict["rsvp_count"]?.numberValue.map { Int($0) }
            ?? attendees.count
        let attendeesFromBlock = dict["attendees_from_block"]?.numberValue.map { Int($0) }
        let pulseThread = decodePulseThread(from: dict["pulse_thread"]?.dictValue)
        return CommunityDetailDTO(
            communityItemId: itemId,
            subtype: subtype,
            group: group,
            event: event,
            poll: poll,
            update: update,
            attendees: attendees,
            attendeeCount: attendeeCount,
            attendeesFromBlock: attendeesFromBlock,
            pulseThread: pulseThread,
            rsvp: CommunityRsvpStatus(wire: dict["rsvp_status"]?.stringValue)
        )
    }

    private static func decodeGroup(from dict: [String: JSONValue]) -> CommunityGroupInfo {
        let groupDict = dict["group"]?.dictValue ?? dict["community"]?.dictValue ?? [:]
        return CommunityGroupInfo(
            name: groupDict["name"]?.stringValue ?? "Neighborhood group",
            tagline: groupDict["tagline"]?.stringValue,
            founded: groupDict["founded"]?.stringValue,
            role: groupDict["role"]?.stringValue ?? groupDict["membership_role"]?.stringValue,
            membershipSince: groupDict["membership_since"]?.stringValue
                ?? groupDict["since"]?.stringValue,
            memberCount: groupDict["member_count"]?.numberValue.map { Int($0) },
            isVerified: groupDict["verified"]?.boolValue ?? false
        )
    }

    private static func decodeEvent(from eventDict: [String: JSONValue]?) -> CommunityEventInfo? {
        guard let evt = eventDict else { return nil }
        let weatherDict = evt["weather"]?.dictValue
        let bring = (evt["bring"]?.arrayValue ?? []).compactMap(\.stringValue)
        return CommunityEventInfo(
            dayLabel: evt["day_label"]?.stringValue
                ?? evt["when"]?.dictValue?["day"]?.stringValue,
            dateLabel: evt["date_label"]?.stringValue
                ?? evt["when"]?.dictValue?["date"]?.stringValue,
            timeRange: evt["time_range"]?.stringValue
                ?? evt["when"]?.dictValue?["range"]?.stringValue,
            location: evt["location"]?.stringValue ?? evt["where"]?.stringValue,
            locationNote: evt["location_note"]?.stringValue
                ?? evt["where_note"]?.stringValue,
            distanceLabel: evt["distance_label"]?.stringValue,
            bringItems: bring,
            weatherSummary: weatherDict?["summary"]?.stringValue,
            weatherTemperatureF: weatherDict?["temperature_f"]?.numberValue.map { Int($0) }
                ?? weatherDict?["temp"]?.numberValue.map { Int($0) }
        )
    }

    private static func decodeAttendees(from values: [JSONValue]?) -> [CommunityAttendee] {
        (values ?? []).compactMap { attn -> CommunityAttendee? in
            guard let a = attn.dictValue,
                  let name = a["display_name"]?.stringValue ?? a["name"]?.stringValue,
                  !name.isEmpty else { return nil }
            let id = a["id"]?.stringValue ?? UUID().uuidString
            let initials = a["initials"]?.stringValue ?? Self.makeInitials(from: name)
            return CommunityAttendee(
                id: id,
                displayName: name,
                initials: initials,
                blockLabel: a["block_label"]?.stringValue ?? a["block"]?.stringValue,
                isVerified: a["verified"]?.boolValue ?? true
            )
        }
    }

    private static func decodePulseThread(from threadDict: [String: JSONValue]?) -> CommunityPulseThread? {
        guard let td = threadDict,
              let threadId = td["thread_id"]?.stringValue ?? td["id"]?.stringValue,
              let title = td["title"]?.stringValue else { return nil }
        let lastReply = td["last_reply"]?.dictValue
        return CommunityPulseThread(
            threadId: threadId,
            title: title,
            replyCount: td["reply_count"]?.numberValue.map { Int($0) }
                ?? td["count"]?.numberValue.map { Int($0) }
                ?? 0,
            lastReplyAuthor: lastReply?["author"]?.stringValue
                ?? lastReply?["who"]?.stringValue,
            lastReplyPreview: lastReply?["preview"]?.stringValue,
            lastReplyAge: lastReply?["age"]?.stringValue
                ?? lastReply?["when"]?.stringValue
        )
    }

    private static func decodePoll(from dict: [String: JSONValue]) -> CommunityPollInfo? {
        let pollDict = dict["poll"]?.dictValue ?? dict
        let rawOptions = pollDict["options"]?.arrayValue ?? []
        let options: [CommunityPollOption] = rawOptions.enumerated().compactMap { index, raw -> CommunityPollOption? in
            if let label = raw.stringValue, !label.isEmpty {
                return CommunityPollOption(id: "option-\(index)", label: label, voteCount: 0)
            }
            guard let option = raw.dictValue,
                  let label = option["label"]?.stringValue
                  ?? option["title"]?.stringValue
                  ?? option["value"]?.stringValue,
                  !label.isEmpty else { return nil }
            return CommunityPollOption(
                id: option["id"]?.stringValue ?? "option-\(index)",
                label: label,
                voteCount: option["vote_count"]?.numberValue.map { Int($0) }
                    ?? option["votes"]?.numberValue.map { Int($0) }
                    ?? 0,
                isSelected: option["selected"]?.boolValue
                    ?? option["is_selected"]?.boolValue
                    ?? false
            )
        }
        guard let question = pollDict["question"]?.stringValue
            ?? pollDict["title"]?.stringValue,
            !question.isEmpty,
            !options.isEmpty else { return nil }
        let voteSum = options.reduce(0) { $0 + $1.voteCount }
        return CommunityPollInfo(
            question: question,
            options: options,
            totalVotes: pollDict["total_votes"]?.numberValue.map { Int($0) }
                ?? pollDict["vote_count"]?.numberValue.map { Int($0) }
                ?? voteSum,
            closesAtLabel: pollDict["closes_at"]?.stringValue
                ?? pollDict["closes_at_label"]?.stringValue,
            statusLabel: pollDict["status"]?.stringValue
                ?? pollDict["status_label"]?.stringValue
        )
    }

    private static func decodeUpdate(from dict: [String: JSONValue]) -> CommunityUpdateInfo? {
        let updateDict = dict["update"]?.dictValue
            ?? dict["neighborhood_update"]?.dictValue
            ?? dict["announcement"]?.dictValue
            ?? dict
        let items = (
            updateDict["items"]?.arrayValue
                ?? updateDict["bullets"]?.arrayValue
                ?? updateDict["updates"]?.arrayValue
                ?? []
        ).compactMap(\.stringValue)
        guard let headline = updateDict["headline"]?.stringValue
            ?? updateDict["title"]?.stringValue,
            !headline.isEmpty,
            updateDict["event"] == nil,
            updateDict["poll"] == nil else { return nil }
        return CommunityUpdateInfo(
            headline: headline,
            summary: updateDict["summary"]?.stringValue
                ?? updateDict["body"]?.stringValue,
            items: items,
            statusLabel: updateDict["status"]?.stringValue
                ?? updateDict["status_label"]?.stringValue,
            footerLabel: updateDict["footer"]?.stringValue
                ?? updateDict["footer_label"]?.stringValue
        )
    }

    private static func makeInitials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let result = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return result.isEmpty ? "·" : result
    }
}

//
//  CommunitySampleData.swift
//  Pantopus
//
//  Deterministic A17.4 community mail fixtures for previews and snapshots.
//

import Foundation

public extension MailItemSampleData {
    static let communityGroup = CommunityGroupInfo(
        name: "Elm Park HOA",
        tagline: "40 households on Elm, Maple & 14th",
        founded: "Est. 2014",
        role: "Resident",
        membershipSince: "Mar 2024",
        memberCount: 87,
        isVerified: true
    )

    static let communityAttendees: [CommunityAttendee] = [
        .init(id: "jt", displayName: "Jamal T.", initials: "JT", blockLabel: "Your block", isVerified: true),
        .init(id: "mk", displayName: "Maria K.", initials: "MK", blockLabel: "Your block", isVerified: true),
        .init(id: "aw", displayName: "Aliyah W.", initials: "AW", blockLabel: "Organizer", isVerified: true),
        .init(id: "dr", displayName: "Derek R.", initials: "DR", blockLabel: "Maple St", isVerified: true),
        .init(id: "ls", displayName: "Lin S.", initials: "LS", blockLabel: "14th Ave", isVerified: true),
        .init(id: "pc", displayName: "Paul C.", initials: "PC", blockLabel: "Maple St", isVerified: true)
    ]

    static let communityPulseThread = CommunityPulseThread(
        threadId: "pulse-cleanup",
        title: "Talk about Saturday cleanup",
        replyCount: 12,
        lastReplyAuthor: "Jamal T.",
        lastReplyPreview: "I can bring the leaf blower if anyone needs it.",
        lastReplyAge: "12m"
    )

    /// A17.4 event subtype - playground cleanup.
    static let communityEvent = CommunityDetailDTO(
        communityItemId: "community-cleanup",
        subtype: .event,
        group: communityGroup,
        event: CommunityEventInfo(
            dayLabel: "Sat",
            dateLabel: "May 24",
            timeRange: "9:00 - 11:00 AM",
            location: "Elm Park playground",
            locationNote: "Gather at the gazebo - 8:55 AM",
            distanceLabel: "0.3 mi - 6 min walk",
            bringItems: ["Work gloves (we have spares)", "A reusable mug", "Bug spray if you like"],
            weatherSummary: "Partly sunny - gentle breeze",
            weatherTemperatureF: 64
        ),
        attendees: communityAttendees,
        attendeeCount: 12,
        attendeesFromBlock: 3,
        pulseThread: communityPulseThread,
        rsvp: .undecided
    )

    /// A17.4 poll subtype - verified resident vote.
    static let communityPoll = CommunityDetailDTO(
        communityItemId: "community-poll",
        subtype: .poll,
        group: communityGroup,
        event: nil,
        poll: CommunityPollInfo(
            question: "Which weekend should we reserve for the block-party permit?",
            options: [
                .init(id: "june-7", label: "Saturday, June 7", voteCount: 19, isSelected: true),
                .init(id: "june-14", label: "Saturday, June 14", voteCount: 11),
                .init(id: "june-21", label: "Saturday, June 21", voteCount: 7)
            ],
            totalVotes: 37,
            closesAtLabel: "Fri 5 PM",
            statusLabel: "Residents only"
        ),
        attendees: communityAttendees,
        attendeeCount: 37,
        attendeesFromBlock: 9,
        pulseThread: CommunityPulseThread(
            threadId: "pulse-block-party",
            title: "Block-party date poll",
            replyCount: 8,
            lastReplyAuthor: "Maria K.",
            lastReplyPreview: "June 7 works best before school gets out.",
            lastReplyAge: "24m"
        ),
        rsvp: .undecided
    )

    /// A17.4 neighborhood-update subtype.
    static let communityUpdate = CommunityDetailDTO(
        communityItemId: "community-update",
        subtype: .neighborhoodUpdate,
        group: communityGroup,
        event: nil,
        update: CommunityUpdateInfo(
            headline: "Oak branch pickup starts Monday",
            summary: "City crews added Elm Park to the first sweep after Friday's wind storm.",
            items: [
                "Move branches to the curb by Sunday evening.",
                "Do not bag limbs or mix yard waste.",
                "Call the HOA desk if your alley is blocked."
            ],
            statusLabel: "City pickup confirmed",
            footerLabel: "Next update Monday 10 AM"
        ),
        attendees: communityAttendees,
        attendeeCount: 18,
        attendeesFromBlock: 4,
        pulseThread: nil,
        rsvp: .undecided
    )
}

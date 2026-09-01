//
//  MailDetailContent+Mutations.swift
//  Pantopus
//
//  Local copy helpers for optimistic mail-detail state changes.
//

extension MailDetailContent {
    /// Return a copy of `content` with `isAcknowledged` flipped to the
    /// supplied value. Used by the optimistic acknowledge mutation.
    static func replacingAck(_ content: MailDetailContent, with value: Bool) -> MailDetailContent {
        rebuild(content, readStatusLabel: value ? "Read" : content.readStatusLabel, isAcknowledged: value)
    }

    /// Return a copy of `content` with the community detail's RSVP
    /// status flipped. Used by the optimistic `setRsvp` mutation.
    static func replacingRsvp(
        _ content: MailDetailContent,
        with status: CommunityRsvpStatus
    ) -> MailDetailContent {
        guard let community = content.communityDetail else { return content }
        let updatedCommunity = CommunityDetailDTO(
            communityItemId: community.communityItemId,
            subtype: community.subtype,
            group: community.group,
            event: community.event,
            poll: community.poll,
            update: community.update,
            attendees: community.attendees,
            attendeeCount: status == .going && community.rsvp != .going
                ? community.attendeeCount + 1
                : (status != .going && community.rsvp == .going
                    ? max(0, community.attendeeCount - 1)
                    : community.attendeeCount),
            attendeesFromBlock: community.attendeesFromBlock,
            pulseThread: community.pulseThread,
            rsvp: status
        )
        return rebuild(content, communityDetail: updatedCommunity)
    }

    /// Return a copy of `content` with the gig detail flipped to its
    /// accepted state. Used by the optimistic `acceptGigBid` mutation.
    static func replacingGigAccepted(
        _ content: MailDetailContent,
        with gig: GigDetailDTO
    ) -> MailDetailContent {
        rebuild(content, gigDetail: gig)
    }

    /// Return a copy of `content` with the memory detail's `isSaved`
    /// flag flipped. Used by the optimistic `saveMemoryToVault` flow.
    static func replacingMemorySaved(
        _ content: MailDetailContent,
        with value: Bool
    ) -> MailDetailContent {
        guard let memory = content.memoryDetail else { return content }
        return rebuild(content, memoryDetail: memory.withSaved(value))
    }

    /// Return a copy of `content` with the party detail's `rsvp` flipped.
    /// `confirmedAtLabel` is stamped into the going-state confirmation banner.
    static func replacingPartyRsvp(
        _ content: MailDetailContent,
        with status: PartyRsvpStatus,
        confirmedAtLabel: String? = nil
    ) -> MailDetailContent {
        guard let party = content.partyDetail else { return content }
        return rebuild(content, partyDetail: party.withRsvp(status, confirmedAtLabel: confirmedAtLabel))
    }

    /// Return a copy of `content` with the party plus-one count clamped to
    /// the supplied value. Used by the stepper in the going state.
    static func replacingPartyPlusOneCount(
        _ content: MailDetailContent,
        with count: Int
    ) -> MailDetailContent {
        guard let party = content.partyDetail else { return content }
        return rebuild(content, partyDetail: party.withPlusOneCount(count))
    }

    /// Return a copy of `content` with the party bring-list item at `index`
    /// claimed/unclaimed. Used by the potluck "I'll bring it" affordance.
    static func replacingPartyBringClaim(
        _ content: MailDetailContent,
        at index: Int,
        by name: String?
    ) -> MailDetailContent {
        guard let party = content.partyDetail else { return content }
        return rebuild(content, partyDetail: party.withBringClaim(at: index, by: name))
    }

    /// Return a copy of `content` with the records detail's `isFiled`
    /// flag flipped. Used by the optimistic `fileRecordToVault` flow.
    static func replacingRecordsFiled(
        _ content: MailDetailContent,
        with value: Bool,
        filedAtLabel: String? = nil
    ) -> MailDetailContent {
        guard let records = content.recordsDetail else { return content }
        return rebuild(
            content,
            recordsDetail: records.withFiled(value, filedAtLabel: filedAtLabel)
        )
    }

    /// Shared rebuilder so the per-field mutations stay one line each.
    /// Every parameter defaults to "keep the existing field"; pass only
    /// the field(s) you intend to flip.
    private static func rebuild(
        _ content: MailDetailContent,
        readStatusLabel: String? = nil,
        isAcknowledged: Bool? = nil,
        bookletDetail: BookletDetailDTO?? = nil,
        certifiedDetail: CertifiedDetailDTO?? = nil,
        communityDetail: CommunityDetailDTO?? = nil,
        couponDetail: CouponDetailDTO?? = nil,
        gigDetail: GigDetailDTO?? = nil,
        memoryDetail: MemoryDetailDTO?? = nil,
        packageDetail: PackageBodyContent?? = nil,
        partyDetail: PartyDetailDTO?? = nil,
        recordsDetail: RecordsDetailDTO?? = nil
    ) -> MailDetailContent {
        MailDetailContent(
            mailId: content.mailId,
            category: content.category,
            mailCategoryKey: content.mailCategoryKey,
            isSenderUnknown: content.isSenderUnknown,
            trust: content.trust,
            detailTrust: content.detailTrust,
            senderDisplayName: content.senderDisplayName,
            senderMeta: content.senderMeta,
            senderTypeLabel: content.senderTypeLabel,
            carrierLine: content.carrierLine,
            senderInitials: content.senderInitials,
            senderUserId: content.senderUserId,
            title: content.title,
            excerpt: content.excerpt,
            referenceLabel: content.referenceLabel,
            createdAtLabel: content.createdAtLabel,
            expiresAtLabel: content.expiresAtLabel,
            readStatusLabel: readStatusLabel ?? content.readStatusLabel,
            bodyParagraphs: content.bodyParagraphs,
            attachments: content.attachments,
            aiSummary: content.aiSummary,
            aiBullets: content.aiBullets,
            ackRequired: content.ackRequired,
            isAcknowledged: isAcknowledged ?? content.isAcknowledged,
            isArchived: content.isArchived,
            bookletDetail: bookletDetail ?? content.bookletDetail,
            certifiedDetail: certifiedDetail ?? content.certifiedDetail,
            communityDetail: communityDetail ?? content.communityDetail,
            couponDetail: couponDetail ?? content.couponDetail,
            gigDetail: gigDetail ?? content.gigDetail,
            memoryDetail: memoryDetail ?? content.memoryDetail,
            packageDetail: packageDetail ?? content.packageDetail,
            partyDetail: partyDetail ?? content.partyDetail,
            recordsDetail: recordsDetail ?? content.recordsDetail
        )
    }
}

//
//  MailDetailProjection.swift
//  Pantopus
//

import Foundation

extension MailDetailViewModel {
    /// Map the backend envelope to the generic A17.1 content.
    public static func project(
        detail: MailDetailResponse.MailDetail,
        now _: Date = Date()
    ) -> MailDetailContent {
        let item = detail.item
        // `Mail.certified` is what makes a live letter certified mail
        // (`Mail_mail_type_check` has no 'certified' mail type).
        let category = item.certified ? MailItemCategory.certified : MailItemCategory.fromRaw(item.mailType ?? item.type)
        // The hero pill reads the letter's stored sender_trust, like the Mailbox list does.
        let trust = MailTrust.fromRaw(item.senderTrust)
        let senderDisplayName = detail.sender?.name
            ?? item.senderBusinessName
            ?? item.senderAddress
            ?? "Unknown sender"
        let senderMeta = detail.sender.map { "@\($0.username)" } ?? item.senderAddress
        let senderTypeLabel = senderTypeLabel(
            category: category,
            sender: detail.sender,
            businessName: item.senderBusinessName,
            senderTrust: item.senderTrust
        )
        let carrierLine = "via \(carrierLabel(from: detail.object))"
        let referenceLabel = referenceLabel(from: detail.object, itemId: item.id)
        let createdAtLabel = formatLongDate(item.createdAt)
        let expiresAtLabel = formatLongDate(item.expiresAt)
        let ackRequired = item.ackRequired ?? false
        let isAcknowledged = (item.ackStatus ?? "").lowercased() == "acknowledged" || item.acknowledgedAt != nil
        let variants = decodeVariantDetails(category: category, object: detail.object)
        let certifiedDetail = variants.certified ?? (item.certified ? CertifiedDetailDTO.pantopus(
            reference: "Ref \(item.id.prefix(8).uppercased())",
            receivedAt: item.createdAt,
            readAt: item.openedAt ?? item.viewedAt,
            signedAt: item.acknowledgedAt
        ) : nil)
        let resolvedAck = isAcknowledged || (certifiedDetail?.isAcknowledged ?? false)
        let detailTrust: MailDetailTrust = switch category {
        case .certified, .community, .legal, .tax, .records: .verified
        case .party: .celebration
        default: trust.detailTrust
        }
        return MailDetailContent(
            mailId: item.id,
            category: category,
            mailCategoryKey: item.category,
            isSenderUnknown: resolveSenderTrust(item: item, sender: detail.sender) == "unknown",
            trust: trust,
            detailTrust: detailTrust,
            senderDisplayName: senderDisplayName,
            senderMeta: senderMeta,
            senderTypeLabel: senderTypeLabel,
            carrierLine: carrierLine,
            senderInitials: makeInitials(from: senderDisplayName),
            senderUserId: detail.sender?.id,
            title: item.displayTitle ?? item.subject ?? "Mail",
            excerpt: item.previewText,
            referenceLabel: referenceLabel,
            createdAtLabel: createdAtLabel,
            expiresAtLabel: expiresAtLabel,
            readStatusLabel: item.viewed || item.openedAt != nil || resolvedAck ? "Read" : "Unread",
            bodyParagraphs: bodyParagraphs(from: item.content),
            attachments: item.attachments ?? [],
            aiSummary: nil,
            ackRequired: ackRequired,
            isAcknowledged: resolvedAck,
            isArchived: item.archived,
            bookletDetail: variants.booklet,
            certifiedDetail: certifiedDetail,
            communityDetail: variants.community,
            couponDetail: variants.coupon,
            gigDetail: variants.gig,
            memoryDetail: variants.memory,
            packageDetail: variants.package,
            partyDetail: variants.party,
            recordsDetail: variants.records
        )
    }

    /// RN `getSenderTrust` (`src/components/mailbox/sender.ts:39-58`) — the
    /// same fallback ladder the backend's `resolveSenderTrust`
    /// (`backend/routes/mailboxV2.js:198`) uses. Returns one of
    /// `verified_gov` / `verified_utility` / `verified_business` /
    /// `pantopus_user` / `unknown`. Only the `unknown` bucket matters to
    /// the detail's ACTIONS row (it suppresses Pay / Sign).
    static func resolveSenderTrust(
        item: MailItem,
        sender: MailDetailResponse.MailDetail.Sender?
    ) -> String {
        let known = [
            "verified_gov",
            "verified_utility",
            "verified_business",
            "pantopus_user",
            "unknown"
        ]
        let raw = item.senderTrust?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if known.contains(raw) { return raw }
        let business = item.senderBusinessName?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !business.isEmpty { return "verified_business" }
        if item.senderUserId != nil || sender != nil { return "pantopus_user" }
        return "unknown"
    }

    static func makeInitials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        let result = parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
        return result.isEmpty ? "M" : result
    }

    static func formatLongDate(_ iso: String?) -> String? {
        guard let iso, !iso.isEmpty else { return nil }
        let isoFull = ISO8601DateFormatter()
        isoFull.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        guard let date = isoFull.date(from: iso) ?? plain.date(from: iso) else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE MMM d, yyyy"
        return formatter.string(from: date)
    }

    static func referenceLabel(from object: JSONValue?, itemId: String) -> String {
        let dict = object?.dictValue
        let candidates = [
            "reference",
            "reference_number",
            "case_number",
            "tracking_number",
            "document_id"
        ]
        for key in candidates {
            let value = dict?[key]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let value, !value.isEmpty { return value }
        }
        return "Ref \(itemId.uppercased())"
    }

    static func carrierLabel(from object: JSONValue?) -> String {
        let dict = object?.dictValue
        let candidates = ["carrier", "service", "delivery_service", "mail_service"]
        for key in candidates {
            let value = dict?[key]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let value, !value.isEmpty { return value }
        }
        return "Pantopus Mail"
    }

    /// "Verified sender" only when the letter's stored `sender_trust` says so;
    /// the category or a business name alone proves nothing.
    static func senderTypeLabel(
        category: MailItemCategory,
        sender: MailDetailResponse.MailDetail.Sender?,
        businessName: String?,
        senderTrust: String?
    ) -> String {
        if sender != nil { return "Pantopus user" }
        if businessName != nil {
            let verified = ["verified_gov", "verified_utility", "verified_business"].contains(senderTrust ?? "")
            return verified ? "Verified sender" : "Business"
        }
        return category.detailTrust == .warning ? "Action notice" : "Mail sender"
    }
}

private struct MailVariantDetails {
    let booklet: BookletDetailDTO?
    let certified: CertifiedDetailDTO?
    let community: CommunityDetailDTO?
    let coupon: CouponDetailDTO?
    let gig: GigDetailDTO?
    let memory: MemoryDetailDTO?
    let package: PackageBodyContent?
    let party: PartyDetailDTO?
    let records: RecordsDetailDTO?
}

private func bodyParagraphs(from content: String?) -> [String] {
    guard let content, !content.isEmpty else { return [] }
    return content
        .components(separatedBy: "\n\n")
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
}

private func decodeVariantDetails(
    category: MailItemCategory,
    object: JSONValue?
) -> MailVariantDetails {
    MailVariantDetails(
        booklet: category == .booklet ? BookletDetailDTO.decode(from: object) : nil,
        certified: category == .certified ? CertifiedDetailDTO.decode(from: object) : nil,
        community: category == .community ? CommunityDetailDTO.decode(from: object) : nil,
        coupon: category == .coupon ? CouponDetailDTO.decode(from: object) : nil,
        gig: category == .gig ? GigDetailDTO.decode(from: object) : nil,
        memory: category == .memory ? MemoryDetailDTO.decode(from: object) : nil,
        package: category == .package ? PackageBodyContent.decode(from: object) : nil,
        // No sample invite: a party letter without an invite payload opens in
        // the generic layout rather than showing someone else's party.
        party: category == .party ? PartyDetailDTO.decode(from: object) : nil,
        records: category == .records ? RecordsDetailDTO.decode(from: object) : nil
    )
}

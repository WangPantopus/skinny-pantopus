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
        let category = MailItemCategory.fromRaw(item.mailType ?? item.type)
        let trust = MailTrust.fromRaw(nil)
        let senderDisplayName = detail.sender?.name
            ?? item.senderBusinessName
            ?? item.senderAddress
            ?? "Unknown sender"
        let senderMeta = detail.sender.map { "@\($0.username)" } ?? item.senderAddress
        let senderTypeLabel = senderTypeLabel(
            category: category,
            sender: detail.sender,
            businessName: item.senderBusinessName
        )
        let carrierLine = "via \(carrierLabel(from: detail.object))"
        let referenceLabel = referenceLabel(from: detail.object, itemId: item.id)
        let createdAtLabel = formatLongDate(item.createdAt)
        let expiresAtLabel = formatLongDate(item.expiresAt)
        let ackRequired = item.ackRequired ?? false
        let isAcknowledged = (item.ackStatus ?? "").lowercased() == "acknowledged"
        let variants = decodeVariantDetails(category: category, object: detail.object)
        let resolvedAck = isAcknowledged || (variants.certified?.isAcknowledged ?? false)
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
            readStatusLabel: item.viewed || resolvedAck ? "Read" : "Unread",
            bodyParagraphs: bodyParagraphs(from: item.content),
            attachments: item.attachments ?? [],
            aiSummary: nil,
            ackRequired: ackRequired,
            isAcknowledged: resolvedAck,
            isArchived: item.archived,
            bookletDetail: variants.booklet,
            certifiedDetail: variants.certified,
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

    static func senderTypeLabel(
        category: MailItemCategory,
        sender: MailDetailResponse.MailDetail.Sender?,
        businessName: String?
    ) -> String {
        if sender != nil { return "Pantopus user" }
        if businessName != nil { return category.detailTrust == .verified ? "Verified sender" : "Business" }
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
        // Backend ingestion for personal invites is not yet wired; fall back
        // to the deterministic fixture so the A17.9 variant lights up the
        // moment a user opens a party-categorised mail. Once the wire schema
        // ships, `PartyDetailDTO.decode(from:)` returns the real payload and
        // this fallback becomes dead code we can drop.
        party: category == .party
            ? (PartyDetailDTO.decode(from: object) ?? MailItemSampleData.partyInvite)
            : nil,
        records: category == .records ? RecordsDetailDTO.decode(from: object) : nil
    )
}

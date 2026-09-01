//
//  MailboxCategoryPayload.swift
//  Pantopus
//
//  Discriminated union of category-specific sub-payloads decoded from
//  `mail.object_payload`. The view-model resolves this once per item
//  load; bodies switch on it to render the right surface.
//

import Foundation

/// Category-tagged payload for a mailbox item.
public enum MailboxCategoryPayload: Sendable, Hashable {
    case coupon(CouponDetailDTO)
    case booklet(BookletDetailDTO)
    case certified(CertifiedDetailDTO)
    case community(CommunityDetailDTO)
    case gig(GigDetailDTO)
    case memory(MemoryDetailDTO)
    /// No category-specific decoder applies (Package, Bill, Notice, …).
    /// Bodies fall back to the generic placeholder layout.
    case other

    /// Resolve a payload from a category + raw object_payload JSON. Falls
    /// back to `.other` when the category doesn't have a dedicated body
    /// decoder or when decoding fails.
    public static func resolve(
        category: MailItemCategory,
        objectPayload: JSONValue?
    ) -> MailboxCategoryPayload {
        switch category {
        case .coupon:
            resolveCoupon(from: objectPayload)
        case .booklet:
            resolveBooklet(from: objectPayload)
        case .certified:
            resolveCertified(from: objectPayload)
        case .community:
            resolveCommunity(from: objectPayload)
        case .gig:
            resolveGig(from: objectPayload)
        case .memory:
            resolveMemory(from: objectPayload)
        default:
            .other
        }
    }

    private static func resolveCoupon(from objectPayload: JSONValue?) -> MailboxCategoryPayload {
        CouponDetailDTO.decode(from: objectPayload).map(MailboxCategoryPayload.coupon) ?? .other
    }

    private static func resolveBooklet(from objectPayload: JSONValue?) -> MailboxCategoryPayload {
        BookletDetailDTO.decode(from: objectPayload).map(MailboxCategoryPayload.booklet) ?? .other
    }

    private static func resolveCertified(from objectPayload: JSONValue?) -> MailboxCategoryPayload {
        CertifiedDetailDTO.decode(from: objectPayload).map(MailboxCategoryPayload.certified) ?? .other
    }

    private static func resolveCommunity(from objectPayload: JSONValue?) -> MailboxCategoryPayload {
        CommunityDetailDTO.decode(from: objectPayload).map(MailboxCategoryPayload.community) ?? .other
    }

    private static func resolveGig(from objectPayload: JSONValue?) -> MailboxCategoryPayload {
        GigDetailDTO.decode(from: objectPayload).map(MailboxCategoryPayload.gig) ?? .other
    }

    private static func resolveMemory(from objectPayload: JSONValue?) -> MailboxCategoryPayload {
        MemoryDetailDTO.decode(from: objectPayload).map(MailboxCategoryPayload.memory) ?? .other
    }
}

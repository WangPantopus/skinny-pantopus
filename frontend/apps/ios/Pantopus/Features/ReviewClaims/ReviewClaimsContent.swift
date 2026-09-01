//
//  ReviewClaimsContent.swift
//  Pantopus
//
//  Helper types + projections shared by `ReviewClaimsViewModel` and
//  `ReviewClaimDetailViewModel`. Mirrors the web client's per-bucket
//  chip / method / evidence-label lookup tables so the same vocabulary
//  reads identically across iOS, Android, and web.
//

import Foundation
import SwiftUI

/// Reviewer-facing label for a claim's `method` field. Mirrors the
/// `METHOD_LABELS` map in the web review-claims page.
public enum AdminClaimMethodLabel {
    public static func display(for method: String?) -> String {
        switch method {
        case "doc_upload": "Document Upload"
        case "escrow_agent": "Escrow/Title Agent"
        case "property_data_match": "ID Verification"
        case "invite": "Invited"
        case "vouch": "Vouched"
        case "landlord_portal": "Landlord Portal"
        case let other?: humanize(other)
        case nil: "Unknown method"
        }
    }

    private static func humanize(_ snake: String) -> String {
        snake
            .replacingOccurrences(of: "_", with: " ")
            .capitalized
    }
}

/// Reviewer-facing label for a piece of `HomeVerificationEvidence`.
/// Mirrors the `EVIDENCE_LABELS` map in the web review-claims page.
public enum AdminClaimEvidenceLabel {
    public static func display(for type: String) -> String {
        switch type {
        case "deed": "Deed"
        case "closing_disclosure": "Closing Disclosure"
        case "tax_bill": "Tax Bill"
        case "utility_bill": "Utility Bill"
        case "lease": "Lease Agreement"
        case "escrow_attestation": "Escrow Attestation"
        case "title_match": "Title Match"
        case "idv": "ID Verification"
        default:
            type
                .replacingOccurrences(of: "_", with: " ")
                .capitalized
        }
    }
}

/// Six-stop avatar gradient palette keyed by a stable hash of the
/// claimant id. Drawn from `Theme.Color` tokens — no hex literals here
/// (the underlying colour values live in `Theme.Color`).
public enum AdminClaimAvatarGradient {
    public static func gradient(for seed: String) -> GradientPair {
        let palette: [GradientPair] = [
            GradientPair(start: Theme.Color.primary500, end: Theme.Color.primary700),
            GradientPair(start: Theme.Color.error, end: Theme.Color.business),
            GradientPair(start: Theme.Color.warning, end: Theme.Color.handyman),
            GradientPair(start: Theme.Color.success, end: Theme.Color.home),
            GradientPair(start: Theme.Color.business, end: Theme.Color.primary700),
            GradientPair(start: Theme.Color.primary600, end: Theme.Color.primary500)
        ]
        let hash = seed.unicodeScalars.reduce(0) { $0 &+ Int($1.value) }
        return palette[abs(hash) % palette.count]
    }
}

/// Triage chip rendered on a row inside the Pending tab. The Approved /
/// Rejected buckets get a terminal-state chip instead.
public struct AdminClaimChipDescriptor {
    public let text: String
    public let icon: PantopusIcon
    public let variant: StatusChipVariant
}

public enum AdminClaimChip {
    /// Build the trailing status chip for a row given its bucket + state.
    public static func descriptor(
        for claim: AdminClaimDTO,
        bucket: AdminClaimBucket,
        referenceDate: Date = Date()
    ) -> AdminClaimChipDescriptor {
        switch bucket {
        case .approved:
            return AdminClaimChipDescriptor(text: "Approved", icon: .checkCircle, variant: .success)
        case .rejected:
            return AdminClaimChipDescriptor(text: "Rejected", icon: .circleSlash, variant: .error)
        case .pending:
            break
        }

        if claim.state == "disputed" {
            return AdminClaimChipDescriptor(text: "Conflict", icon: .alertTriangle, variant: .error)
        }
        if claim.state == "needs_more_info" {
            return AdminClaimChipDescriptor(text: "Awaiting docs", icon: .hourglass, variant: .neutral)
        }

        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: claim.createdAt)
            ?? ISO8601DateFormatter().date(from: claim.createdAt)
        let ageSeconds = date.map { referenceDate.timeIntervalSince($0) } ?? 0
        let ageDays = Int(ageSeconds / 86400)
        if ageDays >= 7 {
            return AdminClaimChipDescriptor(
                text: "Aging · \(ageDays)d",
                icon: .clock,
                variant: .warning
            )
        }
        return AdminClaimChipDescriptor(text: "New", icon: .sparkles, variant: .info)
    }
}

/// Human-readable "Submitted x ago" — short units to match the web row.
public enum AdminClaimTimeFormat {
    public static func submittedAgo(
        _ iso: String,
        referenceDate: Date = Date()
    ) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return ""
        }
        let seconds = max(0, Int(referenceDate.timeIntervalSince(date)))
        switch seconds {
        case ..<60: return "filed just now"
        case ..<3600: return "filed \(seconds / 60)m ago"
        case ..<86400: return "filed \(seconds / 3600)h ago"
        default: return "filed \(seconds / 86400)d ago"
        }
    }

    /// Format the banner's oldest-in-queue subtitle (e.g. "Oldest in
    /// queue: 5h").
    public static func oldestAge(_ seconds: Int?) -> String {
        guard let s = seconds else { return "no claims" }
        if s < 60 { return "\(s)s" }
        if s < 3600 { return "\(s / 60) min" }
        if s < 86400 { return "\(s / 3600)h" }
        return "\(s / 86400)d"
    }

    /// Format a posix date as "Mar 4, 2026" — used in the detail summary.
    public static func longDate(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return iso
        }
        return Self.longFormatter.string(from: date)
    }

    private static let longFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d, yyyy"
        return f
    }()
}

/// Static formatting helpers for the row subtitle (address) and meta tail.
public enum AdminClaimAddressFormat {
    public static func full(_ home: AdminClaimHomeDTO?) -> String {
        guard let home else { return "Unknown address" }
        let head = home.name?.isEmpty == false ? home.name : home.address
        let parts = [head, home.city, home.state].compactMap { $0?.isEmpty == false ? $0 : nil }
        return parts.isEmpty ? "Unknown address" : parts.joined(separator: ", ")
    }
}

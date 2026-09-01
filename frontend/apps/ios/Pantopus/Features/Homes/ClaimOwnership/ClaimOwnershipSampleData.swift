//
//  ClaimOwnershipSampleData.swift
//  Pantopus
//
//  Deterministic fixture data for the Claim Ownership wizard start step.
//

import Foundation

struct ClaimOwnershipStartContent: Equatable {
    let homeLabel: String
    let contestedClaim: ClaimOwnershipContestedClaim?

    var isContested: Bool {
        contestedClaim != nil
    }
}

struct ClaimOwnershipContestedClaim: Equatable {
    let title: String
    let body: String
    let claimantInitials: String
    let claimantName: String
    let filedLabel: String
    let statusLabel: String
}

/// Verdict of the per-file address check surfaced on each populated upload
/// slot. `detail` is the supporting copy shown after the bold lead.
enum ClaimAddressMatch: Equatable {
    case matches(detail: String)
    case differs(detail: String)
}

enum ClaimOwnershipSampleData {
    static func startContent(for homeId: String) -> ClaimOwnershipStartContent {
        if homeId.localizedCaseInsensitiveContains("contested") {
            return contestedStart
        }
        return canonicalStart
    }

    static let canonicalStart = ClaimOwnershipStartContent(
        homeLabel: "412 Elm St",
        contestedClaim: nil
    )

    static let contestedStart = ClaimOwnershipStartContent(
        homeLabel: "412 Elm St",
        contestedClaim: ClaimOwnershipContestedClaim(
            title: "Another claim is already in review",
            body: "A verified resident at this address filed an ownership claim 3 days ago. " +
                "You can still claim; both claims will be reviewed together.",
            claimantInitials: "JR",
            claimantName: "J. R.",
            filedLabel: "Filed Oct 9",
            statusLabel: "Under review"
        )
    )

    /// Sample-data heuristic standing in for real server-side OCR address
    /// extraction. A document "matches" when its filename carries the home's
    /// street number; otherwise we surface a soft, non-blocking mismatch the
    /// reviewer resolves at review time. Swap for the OCR result once the
    /// evidence pipeline returns a parsed address.
    static func addressMatch(forFilename filename: String, homeLabel: String) -> ClaimAddressMatch {
        let streetNumber = String(homeLabel.prefix { $0.isNumber })
        let haystack = filename.lowercased()
        if !streetNumber.isEmpty, haystack.contains(streetNumber) {
            return .matches(detail: "\"\(homeLabel)\" matches the address on your account.")
        }
        return .differs(
            detail: "We couldn't confirm \(homeLabel) on this document. " +
                "You can still submit — the reviewer will resolve it."
        )
    }
}

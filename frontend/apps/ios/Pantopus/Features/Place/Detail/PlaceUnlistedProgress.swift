//
//  PlaceUnlistedProgress.swift
//  Pantopus
//
//  The two progress surfaces for Unlisted, split out of
//  PlaceUnlistedSection when it passed SwiftLint's 500-line cap.
//
//  They are mutually exclusive on purpose, and the distinction is the
//  point of both: a SUCCESSFUL read gets a count of how far through the
//  list this person is, and a FAILED read gets a card saying the list
//  below is not a checklist of anything. Rendering a "0 of 19 started"
//  line when we could not read the rows would be a confident claim about
//  work someone may well have already done.
//
//  Parity: Android `PlaceUnlistedContent.kt` —
//  `place.unlisted.progress` and `place.unlisted.progress.unavailable`.
//

import SwiftUI

// MARK: - How far through the list

/// "3 of 19 started · 1 confirmed by the site." Mirrors Android's
/// `place.unlisted.progress`.
///
/// "confirmed BY THE SITE" is doing work: Pantopus removes nothing, and
/// a count phrased as ours would imply we did. Only rendered when the
/// progress read SUCCEEDED — the failed case is the card below, which
/// says the list is not a checklist of anything.
struct UnlistedProgressLine: View {
    let profile: UnlistedExposureProfile
    let vm: PlaceUnlistedViewModel

    private var rows: [UnlistedRemoval] { profile.removals.rows ?? [] }

    private var summary: String {
        guard !rows.isEmpty else {
            return "Nothing recorded yet — \(profile.brokerCount) sites to work through."
        }
        let started = rows.filter { $0.status != .todo && $0.status != .unknown }.count
        let confirmed = rows.filter { $0.status == .confirmed }.count
        return "\(started) of \(profile.brokerCount) started · \(confirmed) confirmed by the site."
    }

    var body: some View {
        Text(summary)
            .font(.system(size: 12.5, weight: .medium))
            .foregroundStyle(Theme.Color.appTextMuted)
            .padding(.horizontal, 2)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityIdentifier("place.unlisted.progress")
    }
}

// MARK: - The progress read failed

struct UnlistedProgressUnavailableCard: View {
    let vm: PlaceUnlistedViewModel

    var body: some View {
        PlaceDetailCard(padding: 14) {
            HStack(alignment: .top, spacing: 9) {
                Icon(.triangleAlert, size: 16, strokeWidth: 2.25, color: Theme.Color.warning)
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: 5) {
                    Text("We couldn't load what you've already done")
                        .font(.system(size: 13.5, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                    Text(
                        "The list below is the removal paths, not a checklist of your progress — "
                            + "steps you have already taken may not be showing."
                    )
                    .font(.system(size: 12.5))
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    Button {
                        Task { await vm.refresh() }
                    } label: {
                        Text("Try again")
                            .font(.system(size: 12.5, weight: .semibold))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Theme.Color.primary600)
                }
            }
        }
        .accessibilityIdentifier("place.unlisted.progress.unavailable")
    }
}

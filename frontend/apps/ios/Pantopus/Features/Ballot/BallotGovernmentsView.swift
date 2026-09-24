//
//  BallotGovernmentsView.swift
//  Pantopus
//
//  The still governments view (proposed board "P0: still governments
//  view": the Peel board's finished frame, which is also what Reduce
//  Motion shows). The full progress bar, the address with Close, the
//  stack at the peel's geometry, "Your address" over the serif count,
//  the names, then Done over the boundary source.
//
//  The animated story (1.2 s a step) waits for P1, when every government
//  has a true caption.
//

import SwiftUI

struct BallotGovernmentsView: View {
    let governments: BallotGovernments
    let address: String
    let onClose: () -> Void

    /// The design system's serif ("ceremonial letter") face, 30/34 bold.
    private static let titleFont = Font.system(size: 30, weight: .bold, design: .serif)

    private var countText: String {
        governments.countIsMinimum ? "at least \(governments.count)" : "\(governments.count)"
    }

    var body: some View {
        VStack(spacing: Spacing.s0) {
            VStack(spacing: Spacing.s3) {
                Capsule()
                    .fill(Theme.Color.appText)
                    .frame(height: 4)
                HStack {
                    Text(address)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .lineLimit(1)
                    Spacer(minLength: Spacing.s2)
                    Button(action: onClose) {
                        Text("Close")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Theme.Color.primary700)
                            .padding(.vertical, 10)
                            .padding(.leading, Spacing.s3)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("ballot.governments.close")
                }
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)

            BallotStackView(count: governments.count, size: .peel)

            VStack(alignment: .leading, spacing: 6) {
                Text("Your address")
                    .textCase(.uppercase)
                    .font(.system(size: 11, weight: .semibold))
                    .kerning(0.77)
                    .foregroundStyle(Theme.Color.home)
                Text("You are standing in \(countText) governments.")
                    .font(Self.titleFont)
                    .kerning(-0.45)
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("\(governments.summary) \(governments.caveat)")
                    .font(.system(size: 15))
                    .lineSpacing(4)
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, Spacing.s4)

            Spacer(minLength: Spacing.s6)

            VStack(spacing: Spacing.s2) {
                BallotPrimaryButton(label: "Done", height: 50, fontSize: 16, action: onClose)
                    .accessibilityIdentifier("ballot.governments.done")
                Text(governments.sourceLine)
                    .font(Theme.Font.caption)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s6)
        }
        .background(Theme.Color.appSurface)
    }
}

//
//  Postcard.swift
//  Pantopus
//
//  Postcard hero used in the A12.7 Postcard verification flow. A
//  320×196pt cream-stock card showing the recipient's address in a
//  handwriting-flavoured serif italic, with three small postage marks
//  in the top-right and a divider down the middle. When
//  `delivered == true` a rotated red "DELIVERED" cancellation stamp is
//  applied at 60% opacity over the right half.
//
//  Design reference: `docs/designs/A12/verify-postcard-frames.jsx`
//  (Postcard) and `docs/new-design-parity.md` § A12.7.
//

import SwiftUI

/// Postcard hero with optional delivered cancellation stamp.
@MainActor
public struct Postcard: View {
    private let recipientName: String
    private let street: String
    private let cityZip: String
    private let delivered: Bool

    public init(
        recipientName: String,
        street: String,
        cityZip: String,
        delivered: Bool = false
    ) {
        self.recipientName = recipientName
        self.street = street
        self.cityZip = cityZip
        self.delivered = delivered
    }

    public var body: some View {
        ZStack {
            cardBody

            if delivered {
                deliveredStamp
                    .rotationEffect(.degrees(-8))
                    .opacity(0.6)
                    .offset(x: 56, y: -32)
            }
        }
        .frame(width: 320, height: 196)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.10), radius: 14, x: 0, y: 8)
        .accessibilityElement()
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        let status = delivered ? "delivered postcard" : "postcard"
        return "\(status) to \(recipientName), \(street), \(cityZip)"
    }

    private var cardBody: some View {
        Theme.Color.paperCream
            .overlay(alignment: .topTrailing) { postageMarks.padding(Spacing.s3) }
            .overlay { centerDivider }
            .overlay(alignment: .bottomTrailing) { recipientBlock.padding(Spacing.s4) }
    }

    /// Three faded "stamp" rectangles in the top-right.
    private var postageMarks: some View {
        HStack(spacing: Spacing.s1) {
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 2, style: .continuous)
                    .stroke(Theme.Color.appTextMuted, lineWidth: 0.5)
                    .background(Theme.Color.warningBg.opacity(0.6))
                    .frame(width: 18, height: 24)
                    .clipShape(RoundedRectangle(cornerRadius: 2, style: .continuous))
            }
        }
    }

    /// 1pt vertical divider down the middle of the postcard separating
    /// the message half from the address half.
    private var centerDivider: some View {
        HStack {
            Spacer()
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(width: 1)
                .padding(.vertical, Spacing.s3)
            Spacer()
        }
    }

    /// Recipient address block in a handwriting-flavour serif italic,
    /// pinned to the bottom-right of the address half.
    private var recipientBlock: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(recipientName)
                .font(.system(size: 14, weight: .semibold, design: .serif).italic())
                .foregroundStyle(Theme.Color.appText)
            Text(street)
                .font(.system(size: 13, design: .serif).italic())
                .foregroundStyle(Theme.Color.appTextStrong)
            Text(cityZip)
                .font(.system(size: 13, design: .serif).italic())
                .foregroundStyle(Theme.Color.appTextStrong)
        }
        .frame(width: 140, alignment: .leading)
    }

    /// Cancellation stamp — red 3-stroke border around block letters.
    /// Rotation + opacity are applied at the call site so the static
    /// shape can be snapshot-tested directly.
    private var deliveredStamp: some View {
        Text("DELIVERED")
            .font(.system(size: 18, weight: .heavy, design: .serif))
            .tracking(2)
            .foregroundStyle(Theme.Color.error)
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, 6)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.xs, style: .continuous)
                    .stroke(Theme.Color.error, lineWidth: 3)
            )
    }
}

#Preview("Postcard variants") {
    VStack(spacing: Spacing.s4) {
        Postcard(
            recipientName: "Mira Patel",
            street: "412 Elm St, Apt 3B",
            cityZip: "San Francisco, CA 94114"
        )
        Postcard(
            recipientName: "Mira Patel",
            street: "412 Elm St, Apt 3B",
            cityZip: "San Francisco, CA 94114",
            delivered: true
        )
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}

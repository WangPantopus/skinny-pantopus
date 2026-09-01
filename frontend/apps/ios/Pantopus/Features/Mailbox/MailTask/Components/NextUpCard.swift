//
//  NextUpCard.swift
//  Pantopus
//
//  A17.12 — "Next up from your mail" suggestion card (done frame). A
//  section overline over a card with a green credit-card disc, the
//  suggested item's title + due/from line, and an "Open" pill. The whole
//  card taps through to that mail item.
//

import SwiftUI

struct NextUpCard: View {
    let nextUp: MailTaskNextUp
    let onOpen: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("NEXT UP FROM YOUR MAIL")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .padding(.leading, Spacing.s1)
            Button(action: onOpen) {
                card
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("mailTask_nextUp")
            .accessibilityLabel("Next up: \(nextUp.title), \(nextUp.due). Open.")
        }
        .accessibilityElement(children: .contain)
    }

    private var card: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.creditCard, size: 18, color: Theme.Color.home)
                .frame(width: 38, height: 38)
                .background(Theme.Color.homeBg)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            VStack(alignment: .leading, spacing: 2) {
                Text(nextUp.title)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: Spacing.s1) {
                    Text(nextUp.due)
                        .font(.system(size: 11.5, weight: .bold))
                        .foregroundStyle(Theme.Color.warmAmber)
                    Text("· \(nextUp.from)")
                        .font(.system(size: 11.5))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                }
            }
            Spacer(minLength: Spacing.s0)
            Text("Open")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Color.appTextInverse)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(Theme.Color.categoryTask)
                .clipShape(Capsule())
        }
        .padding(.vertical, Spacing.s3)
        .padding(.leading, Spacing.s4 + 2)
        .padding(.trailing, Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .leading) {
            Rectangle().fill(Theme.Color.home).frame(width: 4)
        }
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }
}

#if DEBUG
#Preview {
    Group {
        if let nextUp = MailTaskSampleData.task().nextUp {
            NextUpCard(nextUp: nextUp) {}
        }
    }
    .padding()
    .background(Theme.Color.appBg)
}
#endif

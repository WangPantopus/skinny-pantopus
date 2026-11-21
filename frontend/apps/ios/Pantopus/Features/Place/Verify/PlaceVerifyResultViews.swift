//
//  PlaceVerifyResultViews.swift
//  Pantopus
//
//  B3 and B4 with FASTVERIFY's words (drawings V4 and F1): "You're verified"
//  after a fast check, with what opens now and what still needs the mailed
//  code, and "We couldn't match that number" with the other ways. Shown by
//  the fast-check screens in place of their form.
//

import SwiftUI

/// The fast check that passed, as B3 says it.
enum FastCheckKind: String {
    case phone, location, bill

    @MainActor var matchSentence: (lead: String, tail: String) {
        switch self {
        case .phone: ("Your phone number matches ", ".")
        case .location: ("Your \(DeviceWords.plainName) was at ", ".")
        case .bill: ("Your bill matches ", ".")
        }
    }
}

// MARK: - B3, verified by a fast check

struct FastCheckVerifiedView: View {
    let kind: FastCheckKind
    let address: String
    /// "What others near you pay in rent" is for renters only.
    let isRenter: Bool
    let onMailCode: () -> Void
    let onGoToPlace: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: Spacing.s5) {
                    seal
                    VStack(spacing: Spacing.s2) {
                        Text("You're verified")
                            .scaledFont(28, weight: .bold)
                            .foregroundStyle(Theme.Color.appText)
                            .multilineTextAlignment(.center)
                            .accessibilityAddTraits(.isHeader)
                        let sentence = kind.matchSentence
                        (Text(sentence.lead) + Text(address).bold() + Text(sentence.tail))
                            .scaledFont(16)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    openNow
                    needsMail
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s10)
                .padding(.bottom, Spacing.s5)
            }
            FastCheckDock {
                PrimaryButton(title: "Go to your Place") { onGoToPlace() }
                    .accessibilityIdentifier("fastCheck.goToPlace")
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("fastCheck.verified")
    }

    private var seal: some View {
        ZStack {
            Circle().fill(Theme.Color.successBg).frame(width: 76, height: 76)
            Icon(.badgeCheck, size: 34, strokeWidth: 2, color: Theme.Color.success)
        }
        .accessibilityHidden(true)
    }

    private var openNow: some View {
        FastCheckCard {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("Open now", style: .overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                checkRow("Message homes near you")
                checkRow("The Verified mark on your home and profile")
                checkRow("Your home's details from the county record")
                if isRenter { checkRow("What others near you pay in rent") }
            }
        }
    }

    private func checkRow(_ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s3) {
            Icon(.check, size: 15, strokeWidth: 2.5, color: Theme.Color.success)
                .accessibilityHidden(true)
            Text(text)
                .scaledFont(16)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var needsMail: some View {
        FastCheckCard {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Needs a mailed code", style: .overline)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                HStack(alignment: .top, spacing: Spacing.s3) {
                    Icon(.lock, size: 16, color: Theme.Color.appTextSecondary)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Residency letters and home Mail")
                            .scaledFont(16)
                            .foregroundStyle(Theme.Color.appText)
                        Text("Ask for the postcard whenever you need them.")
                            .scaledFont(13)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                PlaceTextButton(title: "Mail me a code", minHeight: 44, action: onMailCode)
                    .accessibilityIdentifier("fastCheck.mailCode")
            }
        }
    }
}

// MARK: - B4, the phone number didn't match

struct PhoneCheckNoMatchView: View {
    let address: String
    let number: String
    let rows: [PlaceVerifySheet.FastRow]
    let onStart: (PlaceVerifyMethod) -> Void
    let onNotNow: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    Text("We couldn't match that number")
                        .scaledFont(28, weight: .bold)
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                        .accessibilityAddTraits(.isHeader)
                    (Text("The phone company's records don't show ") + Text(address).bold()
                        + Text(" for \(number). That's common with family plans, prepaid phones and a recent move."))
                        .scaledFont(16)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                    if !rows.isEmpty {
                        Text("Try another way", style: .overline)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                        FastCheckRowList(rows: rows, onStart: onStart)
                    }
                    HStack(alignment: .firstTextBaseline, spacing: Spacing.s2) {
                        Icon(.info, size: 14, color: Theme.Color.appTextSecondary)
                            .accessibilityHidden(true)
                        Text("Nothing changed. Your home tools still work.")
                            .scaledFont(14)
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s3)
                .padding(.bottom, Spacing.s5)
            }
            FastCheckDock {
                Button(action: onNotNow) {
                    Text("Not now")
                        .scaledFont(16, weight: .semibold)
                        .foregroundStyle(Theme.Color.primaryInk)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("fastCheck.notNow")
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("fastCheck.noMatch")
    }
}

// MARK: - Shared pieces

/// "Try another way": the other ways the server offers, with the drawing's short words.
struct FastCheckRowList: View {
    let rows: [PlaceVerifySheet.FastRow]
    let onStart: (PlaceVerifyMethod) -> Void

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Array(rows.enumerated()), id: \.element.id) { index, row in
                if case let .start(method) = row.kind {
                    Button { onStart(method) } label: {
                        HStack(spacing: Spacing.s3) {
                            PlaceIconTile(icon: row.icon, tone: row.tone, size: 34)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(row.label)
                                    .scaledFont(15, weight: .semibold)
                                    .foregroundStyle(Theme.Color.appText)
                                Text(row.sub)
                                    .scaledFont(13)
                                    .foregroundStyle(Theme.Color.appTextMuted)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            Spacer(minLength: 0)
                            PlaceChevron()
                        }
                        .padding(14)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("fastCheck.other.\(method.rawValue)")
                }
                if index < rows.count - 1 {
                    Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, 60)
                }
            }
        }
        .placeCard()
    }
}

/// A white card with a hairline, as the drawings' cards.
struct FastCheckCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(Spacing.s4)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurface)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                    .strokeBorder(Theme.Color.appBorder, lineWidth: 1)
            )
    }
}

/// The bottom bar of a fast-check screen.
struct FastCheckDock<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(spacing: Spacing.s2) { content }
            // At the largest text sizes the bar would take half the screen; the page above it scrolls instead.
            .dynamicTypeSize(...DynamicTypeSize.accessibility1)
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s3)
            .padding(.bottom, Spacing.s4)
            .background(Theme.Color.appSurface)
            .overlay(alignment: .top) {
                Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            }
    }
}

extension PlaceVerifySheet {
    /// B4's "Try another way" rows: the other ways the server offers now, with the drawing's short words.
    static func otherWays(_ options: HomeVerifyOptions?, excluding: PlaceVerifyMethod) -> [FastRow] {
        guard let options else { return [] }
        var rows: [FastRow] = []
        if excluding != .location, options.offers(.location) {
            rows.append(FastRow(kind: .start(.location), icon: .mapPin, label: "I'm at home now", sub: "One tap.", tone: .sky))
        }
        if excluding != .phone, options.offers(.phone) {
            rows.append(FastRow(kind: .start(.phone), icon: .smartphone, label: "Use my phone number", sub: "About a minute.", tone: .sky))
        }
        if excluding != .document, options.offers(.document), options.option(.document)?.fast != false {
            rows.append(FastRow(
                kind: .start(.document),
                icon: .camera,
                label: "Take a photo of a bill",
                sub: "About a minute.",
                tone: .sky
            ))
        }
        if excluding != .mail, options.offers(.mail) {
            rows.append(FastRow(kind: .start(.mail), icon: .mail, label: "Mail me a code", sub: "Arrives in about a week.", tone: .muted))
        }
        return rows
    }
}

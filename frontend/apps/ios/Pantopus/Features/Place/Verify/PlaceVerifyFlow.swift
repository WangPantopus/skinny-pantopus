//
//  PlaceVerifyFlow.swift
//  Pantopus
//
//  B1–B4 — the address-verification flow. B1 is a bottom sheet (the
//  "what this unlocks" benefits + a method picker); choosing a method
//  pushes the status screen, which shows B2 (pending, per method), then
//  B3 (verified success, staged reveal) or B4 (couldn't verify, with
//  the other methods). Ported from place-verify*.jsx. Verification is
//  multi-day async server-side, so the status screen models the states.
//

import SwiftUI

// MARK: - Method model

public enum PlaceVerifyMethod: String, CaseIterable, Hashable, Sendable {
    case mail
    case records
    case document

    var icon: PantopusIcon {
        switch self {
        case .mail: .send
        case .records: .fileSearch
        case .document: .upload
        }
    }

    var label: String {
        switch self {
        case .mail: "Mail a code to my address"
        case .records: "Match property records"
        case .document: "Upload a document"
        }
    }

    var sub: String {
        switch self {
        case .mail: "We send a postcard with a code. Most common."
        case .records: "Instant if your name is on the deed or lease"
        case .document: "A utility bill, lease, or bank statement"
        }
    }
}

struct PlaceVerifyBenefit: Identifiable {
    let icon: PantopusIcon
    let label: String
    let sub: String
    var id: String {
        label
    }
}

let placeVerifyBenefits: [PlaceVerifyBenefit] = [
    .init(icon: .messageCircle, label: "Message your verified neighbors", sub: "Direct messages with the people on your block"),
    .init(icon: .badgeCheck, label: "Your verified badge", sub: "The address-proven check on your profile"),
    .init(icon: .mailbox, label: "Your digital mailbox", sub: "Packages, civic notices, and permits in one place")
]

// MARK: - B1 — the verify sheet

struct PlaceVerifySheet: View {
    let address: String
    var onStart: (PlaceVerifyMethod) -> Void
    var onClose: () -> Void

    @State private var selected: PlaceVerifyMethod = .mail

    var body: some View {
        VStack(spacing: 0) {
            Capsule().fill(Theme.Color.appBorderStrong).frame(width: 40, height: 5).padding(.top, 8).padding(.bottom, 12)
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    benefits
                    methods
                    calmNote
                }
                .padding(.bottom, 16)
            }
            PrimaryButton(title: "Start verification") { onStart(selected) }
                .padding(.top, 4)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 30)
        .background(Theme.Color.appSurface)
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 11, style: .continuous).fill(Theme.Color.homeBg)
                RoundedRectangle(cornerRadius: 11, style: .continuous).strokeBorder(Theme.Color.successLight, lineWidth: 1)
                Icon(.shieldCheck, size: 20, strokeWidth: 2, color: Theme.Color.home)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 2) {
                Text("Verify your address")
                    .font(.system(size: 18, weight: .bold))
                    .kerning(-0.36)
                    .foregroundStyle(Theme.Color.appText)
                Text(address)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            Button(action: onClose) {
                Icon(.x, size: 16, strokeWidth: 2.5, color: Theme.Color.appTextSecondary)
                    .frame(width: 30, height: 30).background(Theme.Color.appSurfaceSunken).clipShape(Circle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
        }
        .padding(.bottom, 18)
    }

    private var benefits: some View {
        VStack(alignment: .leading, spacing: 9) {
            overline("What this unlocks")
            VStack(spacing: 0) {
                ForEach(Array(placeVerifyBenefits.enumerated()), id: \.offset) { index, b in
                    row(icon: b.icon, label: b.label, sub: b.sub, tone: .home, trailing: nil)
                    if index < placeVerifyBenefits.count - 1 { divider }
                }
            }
            .placeCard()
        }
    }

    private var methods: some View {
        VStack(alignment: .leading, spacing: 9) {
            overline("Choose how")
            VStack(spacing: 0) {
                ForEach(Array(PlaceVerifyMethod.allCases.enumerated()), id: \.offset) { index, m in
                    Button { selected = m } label: {
                        row(
                            icon: m.icon,
                            label: m.label,
                            sub: m.sub,
                            tone: .sky,
                            trailing: AnyView(radio(selected: selected == m))
                        )
                    }
                    .buttonStyle(.plain)
                    if index < PlaceVerifyMethod.allCases.count - 1 { divider }
                }
            }
            .placeCard()
        }
    }

    private var calmNote: some View {
        HStack(alignment: .top, spacing: 9) {
            Icon(.clock, size: 15, strokeWidth: 2, color: Theme.Color.appTextMuted).padding(.top, 1)
            Text("This can take a few days. Everything you have now stays available while you wait.")
                .font(.system(size: 12.5))
                .lineSpacing(2)
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, 2)
    }

    private func row(icon: PantopusIcon, label: String, sub: String, tone: PlaceIconTile.Tone, trailing: AnyView?) -> some View {
        HStack(spacing: 12) {
            PlaceIconTile(icon: icon, tone: tone, size: 34)
            VStack(alignment: .leading, spacing: 1) {
                Text(label).font(.system(size: 14.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                Text(sub).font(.system(size: 12.5)).foregroundStyle(Theme.Color.appTextMuted)
            }
            Spacer(minLength: 0)
            if let trailing { trailing }
        }
        .padding(14)
    }

    private func radio(selected: Bool) -> some View {
        ZStack {
            Circle().strokeBorder(selected ? Theme.Color.primary600 : Theme.Color.appBorder, lineWidth: 2).frame(width: 22, height: 22)
            if selected { Circle().fill(Theme.Color.primary600).frame(width: 12, height: 12) }
        }
    }

    private var divider: some View {
        Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1).padding(.leading, 60)
    }

    private func overline(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .kerning(0.6)
            .foregroundStyle(Theme.Color.appTextMuted)
            .padding(.horizontal, 2)
    }
}

// MARK: - B2/B3/B4 — the status screen

struct PlaceVerifyStatusView: View {
    let address: String
    let method: PlaceVerifyMethod
    var onBack: () -> Void
    var onDone: () -> Void

    private enum Stage { case pending, success, failed }
    @State private var stage: Stage = .pending
    @State private var revealed = false

    var body: some View {
        VStack(spacing: 0) {
            PlaceDetailHeader(title: "Verification", address: address, onBack: onBack)
            ScrollView {
                VStack(spacing: 18) {
                    switch stage {
                    case .pending: pending
                    case .success: success
                    case .failed: failed
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 18)
                .padding(.bottom, Spacing.s10)
            }
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
    }

    /// B2
    private var pending: some View {
        VStack(spacing: 16) {
            statusMark(icon: method == .mail ? .clock : .refreshCw, tone: .home)
            VStack(spacing: 6) {
                Text(method == .mail ? "Your code is on the way" : "Checking property records…")
                    .font(.system(size: 22, weight: .bold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Color.appText)
                Text(pendingCopy)
                    .pantopusTextStyle(.small)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            reassurance
            // Self-contained flow: the real result lands async (postcard /
            // records). These let the resident continue or preview the
            // terminal states.
            PrimaryButton(title: "Go to your dashboard") { onDone() }
            HStack(spacing: 12) {
                Button("Simulate verified") { withAnimation { stage = .success } }
                Button("Simulate failed") { stage = .failed }
            }
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(Theme.Color.appTextMuted)
        }
    }

    /// B3
    private var success: some View {
        VStack(spacing: 18) {
            seal
            VStack(spacing: 6) {
                Text("Your address is verified.")
                    .font(.system(size: 24, weight: .bold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Color.appText)
                Text("You're now an address-proven neighbor at \(address).")
                    .pantopusTextStyle(.small)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            VStack(alignment: .leading, spacing: 9) {
                PlaceDetailSectionLabel(text: "Now available")
                VStack(spacing: 8) {
                    ForEach(Array(placeVerifyBenefits.enumerated()), id: \.offset) { index, b in
                        availableRow(b)
                            .opacity(revealed ? 1 : 0)
                            .offset(y: revealed ? 0 : 8)
                            .animation(.spring(response: 0.4, dampingFraction: 0.8).delay(Double(index) * 0.08), value: revealed)
                    }
                }
            }
            PrimaryButton(title: "Go to your place") { onDone() }
        }
        .onAppear { revealed = true }
    }

    /// B4
    private var failed: some View {
        VStack(spacing: 16) {
            statusMark(icon: .triangleAlert, tone: .muted)
            VStack(spacing: 8) {
                Text("We couldn't verify that yet.")
                    .font(.system(size: 22, weight: .bold))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Color.appText)
                PlaceChip(model: PlaceChipModel(tone: .warning, text: method == .mail ? "Code expired" : "No record match"))
                Text("This happens to plenty of people. Try one of the other ways below — nothing on your dashboard changed.")
                    .pantopusTextStyle(.small)
                    .multilineTextAlignment(.center)
                    .lineSpacing(2)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            VStack(alignment: .leading, spacing: 9) {
                PlaceDetailSectionLabel(text: "Other ways to verify")
                VStack(spacing: 8) {
                    ForEach(PlaceVerifyMethod.allCases.filter { $0 != method }, id: \.self) { m in
                        Button { stage = .pending } label: { methodRetryRow(m) }.buttonStyle(.plain)
                    }
                }
            }
            reassurance
        }
    }

    // MARK: - Pieces

    private func statusMark(icon: PantopusIcon, tone: PlaceIconTile.Tone) -> some View {
        ZStack {
            Circle().fill(tone == .home ? Theme.Color.homeBg : Theme.Color.appSurfaceSunken).frame(width: 84, height: 84)
            Icon(icon, size: 36, strokeWidth: 2, color: tone == .home ? Theme.Color.home : Theme.Color.warning)
        }
        .padding(.top, 12)
    }

    private var seal: some View {
        ZStack {
            Circle().fill(Theme.Color.homeBg).frame(width: 96, height: 96)
            Circle().fill(Theme.Color.home).frame(width: 64, height: 64)
            Icon(.check, size: 34, strokeWidth: 3, color: Theme.Color.appTextInverse)
        }
        .padding(.top, 12)
    }

    private func availableRow(_ b: PlaceVerifyBenefit) -> some View {
        PlaceDetailCard(padding: 14) {
            HStack(spacing: 11) {
                PlaceIconTile(icon: b.icon, tone: .home, size: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(b.label).font(.system(size: 14.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                    Text(b.sub).font(.system(size: 12.5)).foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer(minLength: 0)
                Icon(.check, size: 16, strokeWidth: 2.5, color: Theme.Color.home)
            }
        }
    }

    private func methodRetryRow(_ m: PlaceVerifyMethod) -> some View {
        PlaceDetailCard(padding: 14) {
            HStack(spacing: 11) {
                PlaceIconTile(icon: m.icon, tone: .sky, size: 32)
                VStack(alignment: .leading, spacing: 1) {
                    Text(m.label).font(.system(size: 14.5, weight: .semibold)).foregroundStyle(Theme.Color.appText)
                    Text(m.sub).font(.system(size: 12.5)).foregroundStyle(Theme.Color.appTextMuted)
                }
                Spacer(minLength: 0)
                PlaceChevron()
            }
        }
    }

    private var reassurance: some View {
        PlaceDetailCard(padding: 14) {
            HStack(spacing: 10) {
                Icon(.shieldCheck, size: 18, strokeWidth: 2, color: Theme.Color.home)
                Text("Nothing on your dashboard changed. You can keep using everything you have.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
        }
    }

    private var pendingCopy: String {
        switch method {
        case .mail: "We've mailed a postcard to your address. Enter the code when it arrives — usually within a few days."
        case .records: "We're matching your name against the deed and lease records on file. This is usually instant."
        case .document: "We're reviewing the document you uploaded. We'll let you know shortly."
        }
    }
}

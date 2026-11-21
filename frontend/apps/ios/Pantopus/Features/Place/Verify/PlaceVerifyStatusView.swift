//
//  PlaceVerifyStatusView.swift
//  Pantopus
//
//  B2–B4, the status screen after a way to verify is chosen (moved out of
//  PlaceVerifyFlow.swift unchanged).
//

import SwiftUI

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
                Text("You're now an address-proven resident at \(address).")
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
                    ForEach(PlaceVerifyMethod.todayDoors.filter { $0 != method }, id: \.self) { m in
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
            Circle().fill(Theme.Color.homeSolid).frame(width: 64, height: 64)
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
        case .document: "A person will review your document. You'll get a notification the moment it's decided."
        case .mail: "We've mailed a postcard to your address. Enter the code when it arrives — 3–7 days. Keep the card."
        case .landlord: "We've asked your landlord to confirm that you live here. This usually takes 1–3 business days."
        case .phone: "We're checking your phone number against this address."
        case .location: "We're checking your \(DeviceWords.plainName)'s location against this address."
        }
    }
}

//
//  FirstRunWizardScreen.swift
//  Pantopus
//
//  A2 "Set up booking" first-run wizard screen. Wraps `WizardShell` with the
//  owner's identity and switches on `model.step` to render the StepRail + step
//  body (claim handle · pick type · weekly hours · success hero). Success share
//  presents a `UIActivityViewController` via `.sheet(item:)`; dismissing it
//  finishes the wizard. Matches `scheduling-setup-frames.jsx`.
//

import SwiftUI
import UIKit

struct FirstRunWizardScreen: View {
    @State private var model: FirstRunWizardModel
    @Environment(\.dismiss) private var dismiss

    /// - Parameters:
    ///   - owner: The scheduling owner pillar.
    ///   - resuming: Pass `true` when re-entering with steps 1–2 already done;
    ///     wizard opens at step 3 and shows the design Frame 6 resume banner.
    init(owner: SchedulingOwner, resuming: Bool = false) {
        _model = State(wrappedValue: FirstRunWizardModel(owner: owner, resuming: resuming))
    }

    var body: some View {
        WizardShell(model: model, identity: model.theme.identity) {
            content
        }
        .navigationBarBackButtonHidden(true)
        .onChange(of: model.isFinished) { _, finished in
            if finished { dismiss() }
        }
        .sheet(item: shareBinding) { item in
            WizardShareSheet(items: [item.url])
        }
    }

    private var shareBinding: Binding<ShareItem?> {
        Binding(
            get: { model.pendingShareURL.map(ShareItem.init) },
            set: { newValue in
                if newValue == nil {
                    model.pendingShareURL = nil
                    model.finishAfterShare()
                }
            }
        )
    }

    private var steps: [(Int, String)] {
        [(1, "Link"), (2, "Type"), (3, "Hours"), (4, "Share")]
    }

    @ViewBuilder
    private var content: some View {
        WizardStepRail(
            steps: steps,
            current: model.step.rawValue,
            accent: model.theme.accent,
            accentBg: model.theme.accentBg,
            allComplete: model.step == .success
        )
        switch model.step {
        case .link:
            WizardHeadline(
                title: "Claim your booking link",
                sub: "This is the link you'll share. People book you at it — pick something short and memorable."
            )
            WizardHandleField(
                slug: $model.slug,
                state: model.slugState,
                accent: model.theme.accent,
                accentBg: model.theme.accentBg
            ) { model.pickSuggestion($0) }
        case .type:
            WizardHeadline(
                title: "Pick a meeting type",
                sub: "Start with one — how you meet and how long it runs. You can add more from settings."
            )
            WizardTypePicker(
                locationMode: $model.locationMode,
                duration: $model.duration,
                accent: model.theme.accent,
                accentBg: model.theme.accentBg
            )
        case .hours:
            if model.isResuming {
                WizardResumeBanner()
                WizardHeadline(
                    title: "Set your weekly hours",
                    sub: "Last step. Set your hours, then share your link."
                )
            } else {
                WizardHeadline(
                    title: "Set your weekly hours",
                    sub: "People can only book inside these windows. You can fine-tune any day, or just use the defaults."
                )
            }
            WizardTimezoneChip(identifier: model.timezoneIdentifier, accent: model.theme.accent, accentBg: model.theme.accentBg)
            WizardHoursGrid(enabled: $model.hoursEnabled, accent: model.theme.accent, rangeLabel: model.rangeLabel)
        case .success:
            WizardSuccessHero(
                accent: model.theme.accent,
                accentBg: model.theme.accentBg,
                shadow: model.theme.ctaShadow,
                title: "You're all set",
                sub: "Your booking link is live. Share it and people can book a \(model.duration)-minute meeting during your weekly hours.",
                link: model.shareLink,
                onCopy: copyLink
            )
        }
    }

    private func copyLink() {
        UIPasteboard.general.string = "https://\(model.shareLink)"
    }
}

// MARK: - Resume banner (design Frame 6)

/// Shown at the top of step 3 when the wizard is re-entered with steps 1–2
/// already done. Icon: rotate-ccw 17 × 17 in a 34 × 34 surface square with
/// primary100 border; title "Pick up where you left off" (13 semibold); subtitle
/// "Steps 1–2 are done. Set your hours to finish." (11.5 appTextSecondary).
/// Background: primary50 with primary100 border, 12pt radius.
private struct WizardResumeBanner: View {
    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            // Icon container — 34 × 34 surface square, 9 pt radius, primary100 border
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(Theme.Color.appSurface)
                    .overlay(
                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                            .stroke(Theme.Color.primary100, lineWidth: 1)
                    )
                Icon(.rotateCcw, size: 17, color: Theme.Color.primary600)
            }
            .frame(width: 34, height: 34)

            VStack(alignment: .leading, spacing: 1) {
                Text("Pick up where you left off")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextStrong)
                    .tracking(-0.1)
                Text("Steps 1–2 are done. Set your hours to finish.")
                    .font(.system(size: 11.5, weight: .regular))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Theme.Color.primary50)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.primary100, lineWidth: 1)
        )
    }
}

// MARK: - Share sheet plumbing

private struct ShareItem: Identifiable {
    let url: URL
    var id: String {
        url.absoluteString
    }
}

private struct WizardShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context _: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_: UIActivityViewController, context _: Context) {}
}

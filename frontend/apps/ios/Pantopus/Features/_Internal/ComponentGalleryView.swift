//
//  ComponentGalleryView.swift
//  Pantopus
//
//  Debug-only screen showing every shared component in every designed
//  state. Reachable from the TokenGalleryView.
//

#if DEBUG

import SwiftUI

/// Scrollable gallery of every `Core/Design/Components/` surface.
public struct ComponentGalleryView: View {
    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s5) {
                section("Shimmer") {
                    Shimmer(width: 220, height: 18)
                    Shimmer(height: 56, cornerRadius: Radii.md)
                }
                section("EmptyState") {
                    EmptyState(
                        icon: .inbox,
                        headline: "No mail yet",
                        subcopy: "When a neighbor sends you something, it'll land here."
                    )
                    .frame(height: 260)
                }
                section("SectionHeader") {
                    SectionHeader("Bills due")
                    SectionHeader("Neighbors", action: .init(title: "See all") {})
                }
                section("Buttons") {
                    PrimaryButton(title: "Continue") {}
                    PrimaryButton(title: "Signing in…", isLoading: true) {}
                    GhostButton(title: "Skip") {}
                    DestructiveButton(title: "Delete home") {}
                    PrimaryButton(title: "Disabled", isEnabled: false) {}
                }
                section("ActionChip") {
                    HStack {
                        ActionChip(icon: .plusCircle, label: "Post gig", isActive: true)
                        ActionChip(icon: .search, label: "Search")
                    }
                }
                section("Avatar + ring") {
                    HStack(spacing: Spacing.s4) {
                        AvatarWithIdentityRing(name: "Alice Doe", identity: .personal, ringProgress: 0.25)
                        AvatarWithIdentityRing(name: "Bob Roy", identity: .home, ringProgress: 0.65)
                        AvatarWithIdentityRing(name: "Carmen Lee", identity: .business, ringProgress: 1.0, size: 56)
                    }
                }
                section("Verified badge") {
                    HStack(spacing: Spacing.s3) {
                        VerifiedBadge()
                        VerifiedBadge(size: 20)
                        VerifiedBadge(size: 28)
                    }
                }
                section("Status chips") {
                    VStack(alignment: .leading, spacing: Spacing.s2) {
                        HStack {
                            StatusChip("Paid", variant: .success, icon: .check)
                            StatusChip("Due", variant: .warning)
                            StatusChip("Overdue", variant: .error, icon: .alertCircle)
                            StatusChip("FYI", variant: .info)
                        }
                        HStack {
                            StatusChip("Personal", variant: .personal)
                            StatusChip("Home", variant: .home)
                            StatusChip("Business", variant: .business)
                            StatusChip("Neutral")
                        }
                    }
                }
                section("Key facts") {
                    KeyFactsPanel(rows: [
                        KeyFactRow(label: "Order ID", value: "PAN-48291", isCode: true),
                        KeyFactRow(label: "Placed", value: "Mar 18"),
                        KeyFactRow(label: "Status", value: "Out for delivery")
                    ])
                }
                section("Timeline stepper") {
                    TimelineStepper(steps: [
                        .init(title: "Order placed", subtitle: "Mar 17", state: .done),
                        .init(title: "In transit", subtitle: "Mar 18", state: .done),
                        .init(title: "Out for delivery", subtitle: "Today", state: .current),
                        .init(title: "Delivered", state: .upcoming)
                    ])
                }
                section("Text field") {
                    TextFieldShowcase()
                }
                section("Progress bar") {
                    VStack(spacing: Spacing.s2) {
                        SegmentedProgressBar(currentStep: 0, totalSteps: 4)
                        SegmentedProgressBar(currentStep: 2, totalSteps: 4)
                        SegmentedProgressBar(currentStep: 4, totalSteps: 4)
                    }
                }
            }
            .padding(Spacing.s4)
        }
        .background(Theme.Color.appBg)
        .navigationTitle("Components")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func section(_ title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            SectionHeader(title)
            content()
        }
    }
}

/// Small sub-view so the gallery can host stateful text fields.
private struct TextFieldShowcase: View {
    @State private var plain = ""
    @State private var valid = "alice@pantopus.app"
    @State private var errored = "not-an-email"

    var body: some View {
        VStack(spacing: Spacing.s3) {
            PantopusTextField("Email", text: $plain, placeholder: "you@pantopus.app")
            PantopusTextField("Email", text: $valid, state: .valid)
            PantopusTextField(
                "Email",
                text: $errored,
                state: .error("Please enter a valid email address")
            )
        }
    }
}

#Preview {
    NavigationStack { ComponentGalleryView() }
}

#endif

//
//  PackageGigView.swift
//  Pantopus
//
//  A17.8 → "Ask a Neighbor". Two frames, matching RN
//  `src/app/mailbox/gig.tsx`:
//
//  · form    — pre-fill context card, the "WHAT DO YOU NEED?" selector
//    (Hold Package / Put Inside / Sign for Me / Help Assemble / Custom),
//    optional title + instructions + offer, the Verified-Neighbor safety
//    note, and the "Post Task Request" CTA.
//  · created — "Task Posted!" confirmation with the gig title, the
//    pre-fill/visibility summary, and the two RN CTAs (Back to Package ·
//    View Task Listing).
//
//  The designs folder has no frame for this screen (A17.6 is the *inbound*
//  gig-mail detail), so the chrome follows the A17 nav + section-card
//  archetype already used by `MailTaskListView`.
//
//  Mirrors `PackageGigScreen.kt` on Android.
//

// swiftlint:disable type_body_length

import SwiftUI

public struct PackageGigView: View {
    @State private var viewModel: PackageGigViewModel

    public init(viewModel: PackageGigViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    public var body: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            if let created = viewModel.created {
                successFrame(created)
            } else {
                formFrame
            }
        }
        .background(Theme.Color.appBg)
        .accessibilityIdentifier("packageGig")
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .alert(
            viewModel.alert?.title ?? "",
            isPresented: Binding(
                get: { viewModel.alert != nil },
                set: { if !$0 { viewModel.alert = nil } }
            ),
            presenting: viewModel.alert
        ) { _ in
            Button("OK", role: .cancel) { viewModel.alert = nil }
        } message: { alert in
            Text(alert.message)
        }
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: Spacing.s1) {
            Button(action: { viewModel.tapBack() }, label: {
                HStack(spacing: Spacing.s0) {
                    Icon(.chevronLeft, size: 22, color: Theme.Color.primary600)
                    Text("Mailbox")
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.Color.primary600)
                }
                .frame(minHeight: 44)
            })
            .buttonStyle(.plain)
            .accessibilityIdentifier("packageGig_back")
            .accessibilityLabel("Back to Mailbox")
            Spacer(minLength: Spacing.s0)
            HStack(spacing: Spacing.s1 + 2) {
                Circle().fill(Theme.Color.business).frame(width: 8, height: 8)
                Text(viewModel.eyebrow)
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.5)
                    .foregroundStyle(Theme.Color.appTextStrong)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Ask a neighbor")
            .accessibilityIdentifier("packageGig_eyebrow")
            Spacer(minLength: Spacing.s0)
            Color.clear.frame(width: 72, height: 1)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }

    // MARK: - Form frame

    private var formFrame: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s3) {
                Text("Ask a Neighbor")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)

                contextCard

                section(label: "WHAT DO YOU NEED?") {
                    VStack(spacing: Spacing.s2) {
                        ForEach(viewModel.options) { option in
                            optionCard(option)
                        }
                    }
                }

                if viewModel.selectedType != nil {
                    section(label: "DETAILS (OPTIONAL)") {
                        VStack(spacing: Spacing.s2) {
                            TextField("Custom title", text: Binding(
                                get: { viewModel.draftTitle },
                                set: { viewModel.draftTitle = $0 }
                            ))
                            .textFieldStyle(.plain)
                            .font(.system(size: 13))
                            .padding(Spacing.s3)
                            .background(Theme.Color.appSurfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                            .accessibilityIdentifier("packageGig_field_title")

                            TextEditor(text: Binding(
                                get: { viewModel.draftDescription },
                                set: { viewModel.draftDescription = $0 }
                            ))
                            .font(.system(size: 13))
                            .frame(height: 76)
                            .scrollContentBackground(.hidden)
                            .padding(Spacing.s2)
                            .background(Theme.Color.appSurfaceSunken)
                            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                            .accessibilityIdentifier("packageGig_field_description")
                            .accessibilityLabel("Additional instructions for the neighbor")

                            compensationRow
                        }
                    }
                }

                safetyNote

                submitButton
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s4)
            .padding(.bottom, Spacing.s10)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var contextCard: some View {
        HStack(spacing: Spacing.s3) {
            Icon(.package, size: 20, color: Theme.Color.business)
            VStack(alignment: .leading, spacing: 2) {
                Text("Package details pre-filled")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.business)
                Text(viewModel.contextSubcopy)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.business)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.businessBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("packageGig_context")
    }

    private func optionCard(_ option: PackageGigOption) -> some View {
        let selected = viewModel.selectedType == option.type
        return Button(action: { viewModel.select(option.type) }, label: {
            HStack(spacing: Spacing.s3) {
                Icon(
                    option.icon,
                    size: 22,
                    color: selected ? Theme.Color.business : Theme.Color.appTextSecondary
                )
                VStack(alignment: .leading, spacing: 1) {
                    Text(option.title)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(selected ? Theme.Color.business : Theme.Color.appText)
                        .multilineTextAlignment(.leading)
                    Text(option.subtitle)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: Spacing.s0)
                Icon(
                    selected ? .circleDot : .circle,
                    size: 20,
                    color: selected ? Theme.Color.business : Theme.Color.appTextSecondary
                )
            }
            .padding(Spacing.s3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(selected ? Theme.Color.businessBg : Theme.Color.appSurfaceSunken)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(selected ? Theme.Color.business : Color.clear, lineWidth: 2)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        })
        .buttonStyle(.plain)
        .accessibilityIdentifier("packageGig_option_\(option.type.rawValue)")
        .accessibilityLabel("\(option.title). \(option.subtitle)")
        .accessibilityAddTraits(selected ? [.isSelected] : [])
    }

    private var compensationRow: some View {
        HStack(spacing: Spacing.s2) {
            Text("Offer (optional)")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
            Spacer(minLength: Spacing.s0)
            HStack(spacing: Spacing.s1) {
                Text("$")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                TextField("0", text: Binding(
                    get: { viewModel.draftCompensation },
                    set: { viewModel.draftCompensation = $0 }
                ))
                .textFieldStyle(.plain)
                .keyboardType(.decimalPad)
                .font(.system(size: 14, weight: .bold))
                .accessibilityIdentifier("packageGig_field_compensation")
                .accessibilityLabel("Offer amount in dollars")
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s2)
            .frame(width: 110)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        }
    }

    private var safetyNote: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.shieldCheck, size: 16, color: Theme.Color.success)
            Text("Only Verified Neighbors with trust scores can see and accept package gigs")
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.success)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: Spacing.s0)
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.successBg)
        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
        .accessibilityIdentifier("packageGig_safetyNote")
    }

    private var submitButton: some View {
        Button(action: { Task { await viewModel.create() } }, label: {
            HStack(spacing: Spacing.s2) {
                if viewModel.isCreating {
                    ProgressView().controlSize(.small).tint(Theme.Color.appTextInverse)
                } else {
                    Icon(.usersRound, size: 16, color: Theme.Color.appTextInverse)
                }
                Text("Post Task Request")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Theme.Color.business)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .opacity(viewModel.canSubmit ? 1 : 0.5)
        })
        .buttonStyle(.plain)
        .disabled(!viewModel.canSubmit)
        .accessibilityIdentifier("packageGig_submit")
    }

    // MARK: - Success frame

    private func successFrame(_ created: PackageGigCreated) -> some View {
        ScrollView {
            VStack(spacing: Spacing.s3) {
                VStack(spacing: Spacing.s2) {
                    Icon(.checkCircle, size: 40, color: Theme.Color.success)
                    Text("Task Posted!")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                    Text("\u{201C}\(created.title)\u{201D} has been posted. Verified Neighbors nearby will be notified.")
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    VStack(spacing: Spacing.s1) {
                        successRow(
                            label: "Package",
                            value: created.isPreDelivery
                                ? "Pre-filled from your mailbox"
                                : "Pre-filled from your delivery"
                        )
                        successRow(label: "Visibility", value: "Verified Neighbors within 0.5 mi")
                    }
                    .padding(Spacing.s3)
                    .frame(maxWidth: .infinity)
                    .background(Theme.Color.businessBg)
                    .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                    .padding(.top, Spacing.s2)
                }
                .padding(Spacing.s5)
                .frame(maxWidth: .infinity)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))

                Button(action: { viewModel.backToPackage() }, label: {
                    Text("Back to Package")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(Theme.Color.business)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                })
                .buttonStyle(.plain)
                .accessibilityIdentifier("packageGig_backToPackage")

                Button(action: { viewModel.openCreatedGig() }, label: {
                    Text("View Task Listing")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.Color.appTextStrong)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 11)
                        .background(Theme.Color.appSurfaceSunken)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                })
                .buttonStyle(.plain)
                .accessibilityIdentifier("packageGig_viewListing")
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.top, Spacing.s10)
            .padding(.bottom, Spacing.s10)
        }
        .accessibilityIdentifier("packageGig_success")
    }

    private func successRow(label: String, value: String) -> some View {
        HStack(spacing: Spacing.s2) {
            Text(label)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.business)
            Spacer(minLength: Spacing.s0)
            Text(value)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Theme.Color.business)
                .multilineTextAlignment(.trailing)
        }
        .padding(.vertical, 5)
    }

    // MARK: - Section shell

    private func section(
        label: String,
        @ViewBuilder body: () -> some View
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2 + 2) {
            Text(label)
                .font(.system(size: 11, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Theme.Color.appTextSecondary)
            body()
        }
        .padding(Spacing.s3 + 2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.xl, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
    }
}

//
//  NavigationDrawerView.swift
//  Pantopus
//
//  §1C-b — Context-aware navigation drawer (LAUNCHER variant / Option A).
//  Design: docs/design/new/Navigation Drawer - Launcher.html
//
//  A left side panel (82% width) sliding over a dimmed scrim, opened from the
//  Hub top-bar menu button. The context pill opens the existing Identity
//  Center; body rows dispatch semantic destinations the host maps to routes.
//

import SwiftUI

struct NavigationDrawerView: View {
    let viewModel: NavigationDrawerViewModel
    @Binding var isPresented: Bool
    let onSelect: @MainActor (NavigationDrawerDestination) -> Void
    let onOpenIdentityCenter: @MainActor () -> Void
    let onBackToHub: @MainActor () -> Void

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                if isPresented {
                    scrim
                    panel
                        .frame(width: geo.size.width * 0.82)
                        .frame(maxHeight: .infinity, alignment: .top)
                        .transition(.move(edge: .leading))
                }
            }
            .animation(.easeOut(duration: 0.22), value: isPresented)
        }
        .allowsHitTesting(isPresented)
        // When closed the overlay must be inert for both touch and
        // accessibility — otherwise the full-bleed GeometryReader occludes the
        // Hub's scroll view and breaks XCUITest's scroll-to-visible actions.
        .accessibilityHidden(!isPresented)
        .accessibilityIdentifier("navDrawer")
    }

    // MARK: Scrim

    private var scrim: some View {
        Color.black.opacity(0.45)
            .ignoresSafeArea()
            .transition(.opacity)
            .onTapGesture { dismiss() }
            .accessibilityIdentifier("navDrawer.scrim")
            .accessibilityLabel("Close menu")
    }

    // MARK: Panel

    private var panel: some View {
        VStack(spacing: Spacing.s0) {
            contextPill
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s0) {
                    ForEach(viewModel.sections) { section in
                        sectionView(section)
                    }
                    if viewModel.showsBackToHub {
                        backToHub
                    }
                    // Bottom inset so the last row clears the home indicator —
                    // otherwise it renders flush against the screen edge where
                    // XCUITest's scroll-to-visible can't settle.
                    Spacer(minLength: Spacing.s10)
                }
            }
            .accessibilityIdentifier("navDrawer.scroll")
        }
        .background(Theme.Color.appSurface)
        .clipShape(
            UnevenRoundedRectangle(
                topLeadingRadius: 0,
                bottomLeadingRadius: 0,
                bottomTrailingRadius: Radii.xl2,
                topTrailingRadius: Radii.xl2
            )
        )
        .shadow(color: Color.black.opacity(0.28), radius: 20, x: 8, y: 0)
        .ignoresSafeArea(edges: .bottom)
    }

    // MARK: Context pill

    private var contextPill: some View {
        let pillar = viewModel.pillar
        return Button {
            dismiss()
            onOpenIdentityCenter()
        } label: {
            HStack(spacing: Spacing.s3) {
                Circle()
                    .fill(pillar.tint)
                    .frame(width: 38, height: 38)
                    .overlay {
                        Icon(pillar.icon, size: 19, strokeWidth: 2.2, color: Theme.Color.appTextInverse)
                    }
                VStack(alignment: .leading, spacing: 1) {
                    Text(viewModel.headerTitle)
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .lineLimit(1)
                    Text(viewModel.headerSubtitle)
                        .font(.system(size: 11.5, weight: .semibold))
                        .foregroundStyle(pillar.tint)
                        .lineLimit(1)
                }
                Spacer(minLength: Spacing.s2)
                switchChip(pillar: pillar)
            }
            .padding(.horizontal, Spacing.s3)
            .padding(.vertical, Spacing.s2)
            .background(pillar.tintBackground)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s12)
        .padding(.bottom, Spacing.s3)
        .accessibilityIdentifier("navDrawer.contextPill")
        .accessibilityLabel("Switch context")
        .accessibilityHint("Opens the Identity Center")
    }

    private func switchChip(pillar: NavigationDrawerPillar) -> some View {
        HStack(spacing: 3) {
            Text("Switch")
                .font(.system(size: 11, weight: .bold))
            Icon(.chevronRight, size: 13, strokeWidth: 2.8, color: pillar.tint)
        }
        .foregroundStyle(pillar.tint)
        .padding(.leading, Spacing.s3)
        .padding(.trailing, Spacing.s2)
        .padding(.vertical, 4)
        .background(Theme.Color.appSurface)
        .clipShape(Capsule())
        .overlay {
            Capsule().stroke(pillar.tint, lineWidth: 1)
        }
    }

    // MARK: Sections

    private func sectionView(_ section: NavigationDrawerSection) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            if let overline = section.overline {
                Text(overline.uppercased())
                    .font(.system(size: 11, weight: .bold))
                    .kerning(0.9)
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.top, Spacing.s4)
                    .padding(.bottom, Spacing.s2)
                    .accessibilityAddTraits(.isHeader)
            } else {
                Spacer().frame(height: Spacing.s2)
            }
            ForEach(section.items) { item in
                rowView(item)
            }
        }
    }

    private func rowView(_ item: NavigationDrawerItem) -> some View {
        Button {
            dismiss()
            onSelect(item.destination)
        } label: {
            HStack(spacing: Spacing.s3) {
                Icon(
                    item.icon,
                    size: 20,
                    strokeWidth: 2,
                    color: item.isActive ? Theme.Color.primary600 : Theme.Color.appTextSecondary
                )
                Text(item.label)
                    .font(.system(size: 14.5, weight: item.isActive ? .bold : .medium))
                    .foregroundStyle(item.isActive ? Theme.Color.primary700 : Theme.Color.appText)
                Spacer(minLength: Spacing.s2)
                if item.isActive {
                    Circle()
                        .fill(Theme.Color.primary600)
                        .frame(width: 6, height: 6)
                }
            }
            .padding(.horizontal, Spacing.s3)
            .frame(minHeight: 46)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(item.isActive ? Theme.Color.primary50 : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: Radii.md))
            .padding(.horizontal, Spacing.s2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("navDrawer.item.\(item.slug)")
    }

    // MARK: Back to Hub

    private var backToHub: some View {
        VStack(spacing: Spacing.s0) {
            Rectangle()
                .fill(Theme.Color.appBorderSubtle)
                .frame(height: 1)
                .padding(.top, Spacing.s2)
            Button {
                dismiss()
                onBackToHub()
            } label: {
                HStack(spacing: Spacing.s3) {
                    Circle()
                        .fill(Theme.Color.appSurface)
                        .frame(width: 32, height: 32)
                        .overlay {
                            Icon(.arrowLeft, size: 17, strokeWidth: 2.4, color: Theme.Color.primary600)
                        }
                        .overlay {
                            Circle().stroke(Theme.Color.primary100, lineWidth: 1)
                        }
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Back to Hub")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(Theme.Color.primary700)
                        Text("Return to your personal hub")
                            .font(.system(size: 11.5))
                            .foregroundStyle(Theme.Color.appTextSecondary)
                    }
                    Spacer(minLength: Spacing.s2)
                    Icon(.undo2, size: 16, strokeWidth: 2.2, color: Theme.Color.primary600)
                }
                .padding(Spacing.s3)
                .background(Theme.Color.primary50)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("navDrawer.backToHub")
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.top, Spacing.s2)
    }

    // MARK: Actions

    private func dismiss() {
        isPresented = false
    }
}

#Preview("Personal") {
    NavigationDrawerView(
        viewModel: NavigationDrawerViewModel(context: .personal(name: "Maria Lopez")),
        isPresented: .constant(true),
        onSelect: { _ in },
        onOpenIdentityCenter: {},
        onBackToHub: {}
    )
}

#Preview("Home") {
    NavigationDrawerView(
        viewModel: NavigationDrawerViewModel(
            context: .home(id: "h1", title: "Maple Street", subtitle: "123 Maple St")
        ),
        isPresented: .constant(true),
        onSelect: { _ in },
        onOpenIdentityCenter: {},
        onBackToHub: {}
    )
}

#Preview("Business") {
    NavigationDrawerView(
        viewModel: NavigationDrawerViewModel(
            context: .business(id: "b1", title: "Cortado Coffee", subtitle: "Coffee shop · Downtown")
        ),
        isPresented: .constant(true),
        onSelect: { _ in },
        onOpenIdentityCenter: {},
        onBackToHub: {}
    )
}

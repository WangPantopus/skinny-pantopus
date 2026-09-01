//
//  RsvpCluster.swift
//  Pantopus
//
//  A17.9 — RSVP action shelf. Two state shapes:
//    • Open invite: three-way Going / Maybe / Can't (rose-filled Going
//      pill takes 1.4× the column width) + plus-one stepper card +
//      "Add to calendar" secondary CTA + tertiary chip row.
//    • Going state: rose "Get directions" primary CTA + 2-up
//      Drop-+1 / Can't-make-it chip row + 3-up Message / Share /
//      "In calendar" muted-success status chip.
//
//  Tap targets are stubs that hand back to the layout's @MainActor
//  closures; calendar wiring + native pickers are out of scope per
//  the P6.5 brief.
//

import SwiftUI

@MainActor
struct RsvpCluster: View {
    let party: PartyDetailDTO
    let inFlight: Bool
    let onSetRsvp: @MainActor (PartyRsvpStatus) -> Void
    let onAdjustPlusOne: @MainActor (Int) -> Void
    let onAddToCalendar: @MainActor () -> Void
    let onGetDirections: @MainActor () -> Void
    let onMessageHost: @MainActor () -> Void
    let onShareInvite: @MainActor () -> Void
    let onMute: @MainActor () -> Void

    var body: some View {
        if party.rsvp == .going {
            goingShelf
        } else {
            openShelf
        }
    }

    // MARK: - Open invite shelf

    private var openShelf: some View {
        VStack(spacing: Spacing.s2 + 2) {
            HStack(spacing: Spacing.s2) {
                rsvpButton(.going, icon: .partyPopper, label: "Going", primary: true, weight: 1.4)
                rsvpButton(.maybe, icon: .helpCircle, label: "Maybe", primary: false, weight: 1.0)
                rsvpButton(.notGoing, icon: .x, label: "Can't", primary: false, weight: 1.0)
            }
            PlusOneStepper(plusOneCount: party.plusOneCount, onAdjust: onAdjustPlusOne)
            calendarHold
            HStack(spacing: Spacing.s2) {
                tertiary(icon: .messageSquare, label: "Ask Priya", action: onMessageHost)
                tertiary(icon: .userPlus, label: "Forward", action: onShareInvite)
                tertiary(icon: .bellOff, label: "Mute", action: onMute)
            }
        }
    }

    // MARK: - Going shelf

    private var goingShelf: some View {
        VStack(spacing: Spacing.s2 + 2) {
            Button(action: { onGetDirections() }, label: {
                HStack(spacing: Spacing.s2) {
                    Icon(.navigation, size: 16, color: Theme.Color.appTextInverse)
                    Text("Get directions · party in 2 days")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Theme.Color.categoryParty)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(color: Theme.Color.categoryParty.opacity(0.28), radius: 12, x: 0, y: 6)
            })
            .buttonStyle(.plain)
            .accessibilityIdentifier("partyRsvpCluster_directions")

            HStack(spacing: Spacing.s2) {
                tertiary(icon: .userMinus, label: "Drop +1") {
                    onAdjustPlusOne(max(0, party.plusOneCount - 1))
                }
                tertiary(icon: .xCircle, label: "Can't make it", warn: true) {
                    onSetRsvp(.notGoing)
                }
            }
            HStack(spacing: Spacing.s2) {
                tertiary(icon: .messageSquare, label: "Message Priya", action: onMessageHost)
                tertiary(icon: .share, label: "Share invite", action: onShareInvite)
                tertiary(icon: .calendarCheck, label: "In calendar", muted: true, action: onAddToCalendar)
            }
        }
    }

    // MARK: - RSVP button

    private func rsvpButton(
        _ status: PartyRsvpStatus,
        icon: PantopusIcon,
        label: String,
        primary: Bool,
        weight: CGFloat
    ) -> some View {
        Button(action: { onSetRsvp(status) }, label: {
            HStack(spacing: 6) {
                Icon(icon, size: 15, color: primary ? Theme.Color.appTextInverse : Theme.Color.appText)
                Text(label)
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(primary ? Theme.Color.appTextInverse : Theme.Color.appText)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(primary ? Theme.Color.categoryParty : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(primary ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
            .shadow(
                color: primary ? Theme.Color.categoryParty.opacity(0.28) : Color.clear,
                radius: primary ? 12 : 0,
                x: 0,
                y: primary ? 6 : 0
            )
            .opacity(inFlight ? 0.6 : 1)
        })
        .buttonStyle(.plain)
        .disabled(inFlight)
        .layoutPriority(weight)
        .frame(maxWidth: .infinity)
        .accessibilityIdentifier("partyRsvpCluster_\(status.rawValue)")
    }

    // MARK: - Calendar hold

    private var calendarHold: some View {
        Button(action: { onAddToCalendar() }, label: {
            HStack(spacing: 6) {
                Icon(.calendarPlus, size: 15, color: Theme.Color.primary700)
                Text("Add to calendar (hold the date)")
                    .font(.system(size: 13.5, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.s3)
            .background(Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(Theme.Color.primary200, lineWidth: 1.5)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        })
        .buttonStyle(.plain)
        .accessibilityIdentifier("partyRsvpCluster_addToCalendar")
    }

    // MARK: - Tertiary chip

    private func tertiary(
        icon: PantopusIcon,
        label: String,
        warn: Bool = false,
        muted: Bool = false,
        action: @escaping @MainActor () -> Void
    ) -> some View {
        let foreground: Color = warn
            ? Theme.Color.error
            : muted ? Theme.Color.success : Theme.Color.appTextStrong
        let background: Color = muted ? Theme.Color.successBg : Theme.Color.appSurface
        let border: Color = muted ? Theme.Color.successLight : Theme.Color.appBorder
        return Button(action: { action() }, label: {
            VStack(spacing: Spacing.s1) {
                Icon(icon, size: 16, color: foreground)
                Text(label)
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(foreground)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(background)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.lg)
                    .stroke(border, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        })
        .buttonStyle(.plain)
    }
}

// MARK: - Plus-one stepper

private struct PlusOneStepper: View {
    let plusOneCount: Int
    let onAdjust: @MainActor (Int) -> Void

    var body: some View {
        HStack(spacing: Spacing.s2 + 2) {
            ZStack {
                RoundedRectangle(cornerRadius: Radii.md).fill(Theme.Color.errorBg)
                Icon(.userPlus, size: 14, color: Theme.Color.categoryParty)
            }
            .frame(width: 28, height: 28)

            VStack(alignment: .leading, spacing: Spacing.s0 + 2) {
                Text("Bring a +1?")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text("Priya said plus-ones are welcome")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
            HStack(spacing: Spacing.s1) {
                StepperButton(icon: .minus, primary: false) {
                    onAdjust(max(0, plusOneCount - 1))
                }
                .accessibilityLabel("Remove a plus-one")
                Text("\(plusOneCount)")
                    .font(.system(size: 13, weight: .heavy))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(minWidth: 18)
                StepperButton(icon: .plus, primary: true) {
                    onAdjust(plusOneCount + 1)
                }
                .accessibilityLabel("Add a plus-one")
            }
            .padding(Spacing.s0 + 3)
            .background(Theme.Color.appSurfaceSunken)
            .clipShape(Capsule())
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2 + 2)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg))
        .accessibilityIdentifier("partyRsvpCluster_plusOneStepper")
    }
}

private struct StepperButton: View {
    let icon: PantopusIcon
    let primary: Bool
    let action: @MainActor () -> Void

    var body: some View {
        Button(action: { action() }, label: {
            Icon(icon, size: 12, color: primary ? Theme.Color.appTextInverse : Theme.Color.appTextSecondary)
                .frame(width: 24, height: 24)
                .background(primary ? Theme.Color.categoryParty : Theme.Color.appSurface)
                .overlay(
                    Circle().stroke(primary ? Color.clear : Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(Circle())
        })
        .buttonStyle(.plain)
    }
}

#Preview("Open") {
    RsvpCluster(
        party: MailItemSampleData.partyInvite,
        inFlight: false,
        onSetRsvp: { _ in },
        onAdjustPlusOne: { _ in },
        onAddToCalendar: {},
        onGetDirections: {},
        onMessageHost: {},
        onShareInvite: {},
        onMute: {}
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}

#Preview("Going") {
    RsvpCluster(
        party: MailItemSampleData.partyInviteGoing,
        inFlight: false,
        onSetRsvp: { _ in },
        onAdjustPlusOne: { _ in },
        onAddToCalendar: {},
        onGetDirections: {},
        onMessageHost: {},
        onShareInvite: {},
        onMute: {}
    )
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}

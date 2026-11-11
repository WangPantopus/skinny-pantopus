//
//  MomentsSeenBySheet.swift
//  Pantopus
//
//  Board V5, on your own Moment: "Seen by 12", the time it has left, Save
//  to Photos and Delete, and who watched, newest first, with the reaction
//  each chose or "Replied". Only the person who posted sees it. The Moment
//  waits paused behind it.
//

import SwiftUI

struct MomentsSeenBySheet: View {
    let model: MomentsViewerModel
    /// Above the title: the sheet's 26 pt, or the card beside your Moment on the open iPhone Duo (board O6).
    var topPadding: CGFloat = 26
    /// Closes it where it isn't a system sheet (the closed iPhone Duo's column, the card on the open Duo); a sheet
    /// dismisses itself.
    var onClose: (() -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var confirmsDelete = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text(count < 1 ? "No views yet" : "Seen by \(count)")
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                    .accessibilityIdentifier("moments.seenBy.title")
                Spacer(minLength: Spacing.s2)
                Text(MomentTime.left(model.moment?.expiresAtDate))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryTint)
                    .padding(.vertical, Spacing.s1)
                    .padding(.horizontal, 10)
                    .background(Capsule().fill(MomentsPalette.tint))
                    .accessibilityIdentifier("moments.seenBy.timeLeft")
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.top, topPadding)
            HStack(spacing: 10) {
                action(
                    model.isSaving ? "Saving…" : "Save to Photos",
                    icon: .download,
                    color: Theme.Color.appText,
                    id: "moments.seenBy.save"
                ) {
                    Task { await model.save(card: cardPicture) }
                }
                .disabled(model.isSaving)
                action("Delete", icon: .trash2, color: Theme.Color.error, id: "moments.seenBy.delete") {
                    confirmsDelete = true
                }
            }
            .padding(.horizontal, Spacing.s5)
            .padding(.top, Spacing.s4)
            if let toast = model.toast {
                // "Saved to Photos", or why it couldn't be: the viewer's own note sits behind this sheet.
                Text(toast.text)
                    .font(.system(size: 13.5, weight: .medium))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.top, 10)
                    .accessibilityIdentifier("moments.seenBy.note")
            }
            list
                .padding(.top, 14)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .task { await model.loadViewers() }
        .alert("Delete this Moment?", isPresented: $confirmsDelete) {
            Button("Delete", role: .destructive) {
                Task {
                    if await model.delete() {
                        if let onClose { onClose() } else { dismiss() }
                    }
                }
            }
            .accessibilityIdentifier("moments.seenBy.deleteConfirm")
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("It leaves the map for everyone.")
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.seenBy")
    }

    private var count: Int {
        model.viewers?.count ?? model.moment?.viewerCount ?? 0
    }

    /// The text card drawn as a picture, for Save to Photos.
    private var cardPicture: UIImage? {
        guard let moment = model.moment, moment.kind == .text else { return nil }
        return MomentsCardPicture.render(text: moment.text ?? "", background: moment.background)
    }

    @ViewBuilder
    private var list: some View {
        let viewers = model.viewers?.viewers ?? []
        VStack(spacing: 0) {
            Divider().overlay(Theme.Color.appBorder)
            if viewers.isEmpty {
                Text(model.viewers == nil ? "" : "People who watch it show up here.")
                    .font(.system(size: 15))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Spacing.s5)
                    .padding(.vertical, Spacing.s4)
                if model.viewers == nil { ProgressView().padding(.top, Spacing.s2) }
            } else {
                ScrollView {
                    LazyVStack(spacing: 0) {
                        ForEach(viewers) { viewer in row(viewer) }
                    }
                }
            }
        }
    }

    private func row(_ viewer: MomentViewerDTO) -> some View {
        HStack(spacing: Spacing.s3) {
            MomentAvatar(author: viewer.user, size: 40)
            VStack(alignment: .leading, spacing: 0) {
                Text(viewer.user.name)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .lineLimit(1)
                Text(MomentTime.ago(MomentTime.parse(viewer.viewedAt)))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let reaction = viewer.reaction, let emoji = PostReactionEmoji(wire: reaction) {
                Text(emoji.rawValue)
                    .font(.system(size: 22))
                    .accessibilityLabel(emoji.name)
            }
            if viewer.replied {
                Text("Replied")
                    .font(.system(size: 12.5, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryTint)
                    .padding(.vertical, Spacing.s1)
                    .padding(.horizontal, 10)
                    .background(Capsule().fill(MomentsPalette.tint))
            }
        }
        .padding(.horizontal, Spacing.s5)
        .frame(height: 58)
        .overlay(alignment: .bottom) { Divider().overlay(Theme.Color.appBorder) }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("moments.seenBy.row.\(viewer.user.id)")
    }

    private func action(_ title: String, icon: PantopusIcon, color: Color, id: String, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            HStack(spacing: Spacing.s2) {
                Icon(icon, size: 18, color: color)
                Text(title).font(.system(size: 15, weight: .semibold))
            }
            .foregroundStyle(color)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Theme.Color.appSurfaceSunken))
            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
    }
}

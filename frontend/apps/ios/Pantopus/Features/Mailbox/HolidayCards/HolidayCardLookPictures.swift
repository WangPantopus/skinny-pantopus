//
//  HolidayCardLookPictures.swift
//  Pantopus
//
//  What Look it over shows for a card sent to an email address
//  (`holiday_cards`): the email they get, drawn from its own words, and the
//  page its link opens, as someone not signed in sees it. Neither shows the
//  card: they open it in Pantopus once they join with that address.
//

import SwiftUI

/// The email an address gets, drawn from its own words: who it's from and
/// the subject, the wax-red heading, the two sentences, the button, the
/// footnote and the footer. It never shows the card.
struct HolidayCardEmailPicture: View {
    let email: HolidayCardPreview.Email
    /// The address typed on step 1.
    let to: String
    let senderName: String

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s0) {
            VStack(alignment: .leading, spacing: 2) {
                (Text("Pantopus").fontWeight(.semibold).foregroundColor(Theme.Color.appText) + Text(verbatim: " · to \(to)"))
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
                Text(email.subject)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
            VStack(spacing: 6) {
                Icon(.mail, size: 30, strokeWidth: 1.8, color: MailPaper.waxText)
                Text(email.heading)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(MailPaper.waxText)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.top, Spacing.s5)
            .padding(.bottom, Spacing.s4)
            .frame(maxWidth: .infinity)
            .background(MailPaper.wax)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(email.lines.enumerated()), id: \.offset) { index, line in
                    sentence(line, bold: index == 0 ? senderName : nil)
                }
                Text(email.button)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(MailPaper.waxText)
                    .padding(.horizontal, Spacing.s6)
                    .padding(.vertical, 11)
                    .background(MailPaper.wax, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .frame(maxWidth: .infinity)
                    .padding(.top, 6)
                Text(email.footnote)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.Color.appTextMuted)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity)
                    .padding(.top, Spacing.s1)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, Spacing.s4)
            VStack(spacing: 2) {
                ForEach(Array(email.footer.enumerated()), id: \.offset) { _, line in
                    Text(verbatim: line)
                }
            }
            .font(.system(size: 10))
            .foregroundStyle(Theme.Color.appTextMuted)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, Spacing.s4)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(Theme.Color.appSurfaceMuted)
            .overlay(alignment: .top) { Rectangle().fill(Theme.Color.appBorder).frame(height: 1) }
        }
        .background(Theme.Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .shadow(color: .black.opacity(0.06), radius: 3, x: 0, y: 1)
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("sendCardLookEmail")
    }

    /// A sentence of the email, the sender's name in bold where it starts it.
    private func sentence(_ line: String, bold name: String?) -> some View {
        let text: Text = if let name, !name.isEmpty, line.hasPrefix(name) {
            Text(verbatim: name).fontWeight(.semibold) + Text(verbatim: String(line.dropFirst(name.count)))
        } else {
            Text(verbatim: line)
        }
        return text
            .font(.system(size: 14))
            .foregroundStyle(Theme.Color.appTextStrong)
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The page the email's link opens, as someone not signed in sees it: who
/// it's from, a Christmas card waiting, and how to open it.
struct HolidayCardLinkPagePicture: View {
    let page: HolidayCardPreview.LinkPage

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            HStack(alignment: .top, spacing: 14) {
                Icon(.mail, size: 24, color: Theme.Color.appTextSecondary)
                    .frame(width: 48, height: 48)
                    .background(Theme.Color.appSurfaceSunken, in: RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text("A Christmas card for you")
                        .font(.system(size: 12, weight: .semibold))
                        .tracking(0.96)
                        .textCase(.uppercase)
                        .foregroundStyle(Theme.Color.appTextMuted)
                    Text(verbatim: "From \(page.senderName)")
                        .font(.system(size: 19, weight: .bold))
                        .foregroundStyle(Theme.Color.appText)
                        .fixedSize(horizontal: false, vertical: true)
                    if page.senderVerified {
                        HStack(spacing: 6) {
                            Icon(.shieldCheck, size: 14, strokeWidth: 2.25, color: Theme.Color.success)
                            Text("Verified neighbor")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Theme.Color.success)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, Spacing.s1)
                        .background(Theme.Color.successBg, in: Capsule())
                        .padding(.top, 6)
                    }
                }
            }
            VStack(alignment: .leading, spacing: Spacing.s1) {
                Text("A Christmas card")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                Text((page.sealed ? "It’s sealed until Christmas morning. " : "") + "You’ll see the card once it’s in your mailbox.")
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                if let sentOn = page.sentOn {
                    Text(verbatim: "Sent \(HolidayCardWords.dayWithYear(sentOn))")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.Color.appTextMuted)
                        .padding(.top, 6)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Color.appSurfaceMuted, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(Theme.Color.appBorderSubtle, lineWidth: 1))
            VStack(spacing: 10) {
                Text("Sign in to open it")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(Theme.Color.primary600, in: RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
                Text("Create a free account")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.appText)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .overlay(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
                Text(verbatim: "Use \(page.sentTo), the address this card was sent to.")
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, 18)
        .background(Theme.Color.appSurface, in: RoundedRectangle(cornerRadius: Radii.xl, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Radii.xl, style: .continuous).strokeBorder(Theme.Color.appBorder, lineWidth: 1))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("sendCardLookLinkPage")
    }
}

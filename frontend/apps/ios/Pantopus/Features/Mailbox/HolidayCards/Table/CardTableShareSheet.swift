//
//  CardTableShareSheet.swift
//  Pantopus
//
//  Share opens a sheet over the table (launch key `card_table`): a picture
//  preview, then the size, the switch, and the actions. Actions the phone can't do
//  are hidden. If a picture can't be drawn it says so and offers Copy link.
//

import Photos
import SwiftUI
import UIKit

/// What a card's share links say.
enum CardTableShareLinks {
    /// The card's public page, carrying the person's invite code so sign-ups credit them. A sealed card links to the
    /// page of all cards, so its picture stays a surprise.
    @MainActor
    static func cardPage(_ content: CardTableContent, inviteCode: String?) -> String {
        var path = "/cards"
        if !content.sealed, let slug = content.slug, !slug.isEmpty {
            path += "/\(slug)"
        }
        if let inviteCode, !inviteCode.isEmpty {
            path += "?ref=\(inviteCode.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? inviteCode)"
        }
        return InviteLinks.publicPageURLString(path: path)
    }

    /// Facebook reads the Link preview from the card's page.
    static func facebookSharer(_ page: String) -> URL? {
        let encoded = page.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? page
        return URL(string: "https://www.facebook.com/sharer/sharer.php?u=\(encoded)")
    }

    /// The free Meta app ID in this build, if there's one: it makes a Story one tap.
    static var metaAppID: String? {
        let id = Bundle.main.object(forInfoDictionaryKey: "PantopusMetaAppID") as? String
        guard let id, !id.isEmpty, !id.hasPrefix("$(") else { return nil }
        return id
    }
}

struct CardTableShareSheet: View {
    let content: CardTableContent
    let art: CardTableArt
    let picture: UIImage?
    /// The person sent this card: the words talk about their own note.
    var isSender = false

    @State private var format: CardShareFormat = .story
    @State private var showsNote = false
    @State private var drawn: [String: UIImage] = [:]
    @State private var failed = false
    @State private var say: String?
    @State private var request: SystemSheetRequest?
    @State private var contentHeight: CGFloat = 0
    @ScaledMetric(relativeTo: .title2) private var titleSize: CGFloat = 21
    @ScaledMetric(relativeTo: .footnote) private var sizeLabel: CGFloat = 13.5
    @ScaledMetric(relativeTo: .subheadline) private var noteTitle: CGFloat = 14.5
    @ScaledMetric(relativeTo: .caption) private var noteLine: CGFloat = 12.5
    @ScaledMetric(relativeTo: .caption2) private var actionLabel: CGFloat = 11.5
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    private var key: String {
        "\(format.rawValue)-\(content.sealed || format == .link ? false : showsNote)"
    }

    private var inviteCode: String? {
        PersonalInviteLink.shared.code
    }

    private var cardPage: String {
        CardTableShareLinks.cardPage(content, inviteCode: inviteCode)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                header
                preview
                sizes
                if !content.sealed, format != .link {
                    noteRow
                }
                actions
                if let say {
                    Text(say)
                        .font(.system(size: 13))
                        .lineSpacing(3)
                        .foregroundStyle(MailPaper.tableCreamSoft)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .accessibilityIdentifier("cardShareSay")
                }
            }
            .padding(.top, 12)
            .padding(.horizontal, 16)
            .padding(.bottom, 14)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { contentHeight = $0 }
        }
        .scrollBounceBehavior(.basedOnSize)
        .frame(maxWidth: 520)
        .frame(maxWidth: .infinity)
        .background(MailPaper.tableSheet.ignoresSafeArea())
        .presentationDetents(contentHeight > 0 ? [.height(contentHeight + 8), .large] : [.large])
        .presentationCornerRadius(22)
        .presentationBackground(MailPaper.tableSheet)
        .preferredColorScheme(.dark)
        .sheet(item: $request) { $0.makeView() }
        .task(id: key) { draw() }
        .accessibilityIdentifier("cardShareSheet")
    }

    // MARK: Parts

    private var header: some View {
        HStack(spacing: 8) {
            Text(content.sealed ? "Share the sealed card" : "Share this card")
                .font(.system(size: titleSize, design: .serif))
                .foregroundStyle(MailPaper.tableCream)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 0)
            CardTableRoundButton(icon: .x, label: "Close", identifier: "cardShareClose") { dismiss() }
        }
    }

    private var preview: some View {
        let height = min(UIScreen.main.bounds.height * 0.46, 430)
        return Group {
            if let image = drawn[key] {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .shadow(color: .black.opacity(0.5), radius: 13, x: 0, y: 8)
                    .accessibilityLabel(previewLabel)
                    .accessibilityIdentifier("cardSharePreview")
            } else if failed {
                Text("We couldn’t draw this picture. You can still copy the link.")
                    .font(.system(size: 14))
                    .multilineTextAlignment(.center)
                    .foregroundStyle(MailPaper.tableCreamSoft)
                    .padding(.horizontal, 24)
                    .accessibilityIdentifier("cardShareDrawFailed")
            } else {
                ProgressView()
                    .tint(MailPaper.tableCream)
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: height)
    }

    private var previewLabel: String {
        if content.sealed { return "The picture to share: the sealed envelope." }
        if showsNote, format != .link { return "The picture to share: the card and its note." }
        return "The picture to share: the card."
    }

    private var sizes: some View {
        HStack(spacing: 3) {
            ForEach(CardShareFormat.allCases) { size in
                Button {
                    format = size
                    say = nil
                } label: {
                    Text(size.title)
                        .font(.system(size: sizeLabel, weight: size == format ? .semibold : .regular))
                        .foregroundStyle(size == format ? MailPaper.tableCream : MailPaper.tableCreamSoft)
                        .frame(maxWidth: .infinity, minHeight: 36)
                        .background(
                            size == format ? MailPaper.tableCream.opacity(0.14) : .clear,
                            in: RoundedRectangle(cornerRadius: 9, style: .continuous)
                        )
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(size == format ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("cardShareSize.\(size.rawValue)")
            }
        }
        .padding(3)
        .background(MailPaper.tableCream.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private var noteRow: some View {
        Toggle(isOn: $showsNote) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Show the note")
                    .font(.system(size: noteTitle, weight: .semibold))
                    .foregroundStyle(MailPaper.tableCream)
                Text(noteWords)
                    .font(.system(size: noteLine))
                    .lineSpacing(2)
                    .foregroundStyle(MailPaper.tableCreamFaint)
            }
        }
        .tint(MailPaper.tableWax)
        .frame(minHeight: 44)
        .accessibilityIdentifier("cardShareShowNote")
    }

    private var noteWords: String {
        let first = content.firstName
        if isSender {
            return showsNote
                ? "This picture shows your words and first name."
                : "Your words and name stay private. Your address never shows."
        }
        return showsNote
            ? "This picture shows \(first)’s words and first name. Only share them if \(first) wouldn’t mind."
            : "\(first)’s words and name stay private. Your address never shows."
    }

    private var actions: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 6), spacing: 6) {
            action("Instagram", identifier: "instagram", glyph: AnyView(CardShareInstagramGlyph())) { shareInstagram() }
            action("Facebook", identifier: "facebook", glyph: AnyView(CardShareFacebookGlyph())) { shareFacebook() }
            action("Email", identifier: "email", glyph: icon(.mail)) { shareEmail() }
            action("Copy link", identifier: "link", glyph: icon(.link)) { copyLink() }
            action("Save", identifier: "save", glyph: icon(.download)) { save() }
            action("More", identifier: "more", glyph: icon(.moreHorizontal)) { shareSheet(kind: "more") }
        }
    }

    private func icon(_ name: PantopusIcon) -> AnyView {
        AnyView(Icon(name, size: 22, strokeWidth: 1.7, color: MailPaper.tableCream))
    }

    private func action(_ title: String, identifier: String, glyph: AnyView, perform: @escaping () -> Void) -> some View {
        Button(action: perform) {
            VStack(spacing: 6) {
                glyph
                    .frame(width: 44, height: 44)
                    .background(MailPaper.tableCream.opacity(0.1), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                Text(title)
                    .font(.system(size: actionLabel))
                    .foregroundStyle(MailPaper.tableCreamSoft)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8)
            }
            .frame(maxWidth: .infinity, minHeight: 64, alignment: .top)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("cardShareAction.\(identifier)")
    }

    // MARK: Drawing

    private func draw() {
        failed = false
        guard drawn[key] == nil else { return }
        let scene = CardTableShareScene(
            format: format,
            showsNote: showsNote && !content.sealed,
            content: content,
            art: art,
            picture: picture
        )
        if let image = CardTableSharePicture.draw(scene) {
            drawn[key] = image
        } else {
            failed = true
        }
    }

    // MARK: Actions

    private func count(_ kind: String) {
        let body = HolidayCardSharedBody(
            design: content.design,
            kind: kind,
            format: format.rawValue,
            withNote: showsNote && !content.sealed
        )
        Task { _ = try? await APIClient.shared.request(HolidayCardEndpoints.shared(body)) }
    }

    private var currentImage: UIImage? {
        drawn[key]
    }

    private func shareSheet(kind: String) {
        count(kind)
        var items: [Any] = []
        if let currentImage { items.append(currentImage) }
        items.append(cardPage)
        request = .share(items: items)
    }

    private func shareInstagram() {
        if format == .story, let image = currentImage, let url = CardShareStories.instagram(image, page: cardPage) {
            count("instagram")
            openURL(url)
            return
        }
        shareSheet(kind: "instagram")
    }

    private func shareFacebook() {
        if format == .link, let url = CardTableShareLinks.facebookSharer(cardPage) {
            count("facebook")
            openURL(url)
            return
        }
        if format == .story, let image = currentImage, let url = CardShareStories.facebook(image) {
            count("facebook")
            openURL(url)
            return
        }
        shareSheet(kind: "facebook")
    }

    private func shareEmail() {
        count("email")
        let body = "I got this Christmas card on Pantopus. You can send one too: \(cardPage)"
        let subject = "Look what came in the mail"
        guard MailDraft.canSendMail else {
            // No Mail account on this phone: the share sheet offers whichever mail app it has.
            var items: [Any] = []
            if let currentImage { items.append(currentImage) }
            items.append(body)
            request = .share(items: items)
            return
        }
        let attachment = currentImage?.jpegData(compressionQuality: 0.9).map {
            MailDraft.Attachment(data: $0, mimeType: "image/jpeg", fileName: "christmas-card.jpg")
        }
        request = .mail(MailDraft(subject: subject, body: body, attachments: attachment.map { [$0] } ?? []))
    }

    private func copyLink() {
        count("link")
        UIPasteboard.general.string = cardPage
        say = "Link copied."
    }

    private func save() {
        guard let image = currentImage else {
            say = "We couldn’t draw this picture to save it. You can still copy the link."
            return
        }
        count("save")
        Task { @MainActor in say = await CardShareStories.save(image) }
    }
}

/// One tap to a new Story, where the phone has the app and this build has a Meta app ID (a free, public number). The
/// picture goes on the pasteboard, which is how Meta takes it.
@MainActor
enum CardShareStories {
    static func instagram(_ image: UIImage, page: String) -> URL? {
        guard let id = CardTableShareLinks.metaAppID, let data = image.pngData(),
              let url = URL(string: "instagram-stories://share?source_application=\(id)"),
              UIApplication.shared.canOpenURL(url) else { return nil }
        let item: [String: Any] = [
            "com.instagram.sharedSticker.backgroundImage": data,
            "com.instagram.sharedSticker.contentURL": page,
            "public.utf8-plain-text": page
        ]
        UIPasteboard.general.setItems([item], options: [.expirationDate: Date().addingTimeInterval(300)])
        return url
    }

    static func facebook(_ image: UIImage) -> URL? {
        guard let id = CardTableShareLinks.metaAppID, let data = image.pngData(),
              let url = URL(string: "facebook-stories://share?source_application=\(id)"),
              UIApplication.shared.canOpenURL(url) else { return nil }
        let item: [String: Any] = [
            "com.facebook.sharedSticker.backgroundImage": data,
            "com.facebook.sharedSticker.appID": id
        ]
        UIPasteboard.general.setItems([item], options: [.expirationDate: Date().addingTimeInterval(300)])
        return url
    }

    /// Saves to Photos, and says how it went.
    static func save(_ image: UIImage) async -> String {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else {
            return "Pantopus can’t save to your photos. You can allow it in Settings, under Privacy & Security, Photos."
        }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }
            return "Saved to your photos."
        } catch {
            return "We couldn’t save it to your photos. Check that there’s room on your phone, then try again."
        }
    }
}

/// Instagram's camera outline.
struct CardShareInstagramGlyph: View {
    var body: some View {
        Canvas { context, size in
            let unit = size.width / 24
            let line = StrokeStyle(lineWidth: 1.7 * unit, lineCap: .round, lineJoin: .round)
            let ink = GraphicsContext.Shading.color(MailPaper.tableCream)
            context.stroke(
                Path(roundedRect: CGRect(x: 4 * unit, y: 4 * unit, width: 16 * unit, height: 16 * unit), cornerRadius: 4.5 * unit),
                with: ink,
                style: line
            )
            context.stroke(
                Path(ellipseIn: CGRect(x: 8.4 * unit, y: 8.4 * unit, width: 7.2 * unit, height: 7.2 * unit)),
                with: ink,
                style: line
            )
            context.fill(Path(ellipseIn: CGRect(x: 15.7 * unit, y: 6.1 * unit, width: 2.2 * unit, height: 2.2 * unit)), with: ink)
        }
        .frame(width: 22, height: 22)
        .accessibilityHidden(true)
    }
}

/// Facebook's f.
struct CardShareFacebookGlyph: View {
    var body: some View {
        Canvas { context, size in
            let unit = size.width / 24
            func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
                CGPoint(x: x * unit, y: y * unit)
            }
            var path = Path()
            path.move(to: point(14.5, 20))
            path.addLine(to: point(14.5, 13))
            path.addLine(to: point(16.9, 13))
            path.addLine(to: point(17.4, 10))
            path.addLine(to: point(14.5, 10))
            path.addLine(to: point(14.5, 8.4))
            path.addCurve(to: point(16, 7), control1: point(14.5, 7.5), control2: point(14.8, 7))
            path.addLine(to: point(17.5, 7))
            path.addLine(to: point(17.5, 4.3))
            path.addCurve(to: point(15.2, 4), control1: point(16.9, 4.2), control2: point(16.2, 4))
            path.addCurve(to: point(11.4, 7.9), control1: point(12.9, 4), control2: point(11.4, 5.4))
            path.addLine(to: point(11.4, 10))
            path.addLine(to: point(9, 10))
            path.addLine(to: point(9, 13))
            path.addLine(to: point(11.4, 13))
            path.addLine(to: point(11.4, 20))
            let line = StrokeStyle(lineWidth: 1.7 * unit, lineCap: .round, lineJoin: .round)
            context.stroke(path, with: .color(MailPaper.tableCream), style: line)
        }
        .frame(width: 22, height: 22)
        .accessibilityHidden(true)
    }
}

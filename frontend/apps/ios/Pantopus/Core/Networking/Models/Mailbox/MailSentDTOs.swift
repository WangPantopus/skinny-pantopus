//
//  MailSentDTOs.swift
//  Pantopus
//
//  Sent (launch key `mailbox`; the cards in it need `holiday_cards` to be
//  sent): what this person has sent, newest first, and one sent card with
//  its note and trail. Only what a sender may know: when it arrives, never
//  when it was opened, and never the other person's address or anything
//  they did with it.
//

import Foundation

/// `GET /api/mailbox/sent?before=&limit=` — route `backend/routes/mailbox.js`
/// (declared before `GET /:id`): 25 at a time, newest first.
public struct MailSentPage: Decodable, Sendable, Hashable {
    public let items: [MailSentPiece]
    /// The cursor for the next page; nil at the end.
    public let next: String?

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        items = try c.decode([MailSentPiece].self, forKey: .items)
        next = try? c.decodeIfPresent(String.self, forKey: .next)
    }

    private enum CodingKeys: String, CodingKey {
        case items, next
    }
}

/// `GET /api/mailbox/sent/:id` — route `backend/routes/mailbox.js`; 404
/// `SENT_NOT_FOUND` for anyone but its sender.
public struct MailSentDetail: Decodable, Sendable, Hashable {
    public let item: MailSentPiece
}

/// A card as its sender sees it in Sent.
public struct MailSentPiece: Decodable, Sendable, Hashable, Identifiable {
    /// Where a sent card is: `waiting` (to a person, before the 7 a.m.
    /// pickup), `picked_up` (picked up, arrives on Christmas morning),
    /// `delivered` (in their mailbox); by email `email_waiting`, `claimed`
    /// (they joined and have it) or `expired` (not opened in 90 days).
    public enum Status: String, Sendable, Hashable {
        case waiting
        case pickedUp = "picked_up"
        case delivered
        case emailWaiting = "email_waiting"
        case claimed
        case expired
    }

    public let id: String
    public let sentAt: String?
    /// The person's name as it was sent, or the address masked; by email the
    /// name of whoever claimed it once it's claimed.
    public let toName: String
    public let byEmail: Bool
    public let arrival: HolidayCardArrival?
    public let status: Status
    public let arrivesAt: String?
    /// The day it goes (or went) into their mailbox by their clock (`YYYY-MM-DD`).
    public let arrivesOn: String?
    /// The day a sealed card opens (`YYYY-MM-DD`).
    public let opensOn: String?
    public let sealed: Bool
    public let canTakeBack: Bool
    public let takeBackUntil: String?
    public let envelope: Envelope
    public let card: Card
    /// The sender's own words (the card's page only), also while it's sealed for them.
    public let note: String?
    /// The card's page only: where it has been, in order.
    public let trail: [TrailStep]

    /// The envelope as they got it: who it's from and the day it was
    /// postmarked by their clock (nil while it waits for the pickup).
    public struct Envelope: Decodable, Sendable, Hashable {
        public let from: String
        public let postmarkedOn: String?

        private enum CodingKeys: String, CodingKey {
            case from
            case postmarkedOn = "postmarked_on"
        }

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            from = (try? c.decodeIfPresent(String.self, forKey: .from)) ?? ""
            postmarkedOn = try? c.decodeIfPresent(String.self, forKey: .postmarkedOn)
        }
    }

    /// The picture sent, its caption, paper, height and year.
    public struct Card: Decodable, Sendable, Hashable {
        public let design: String
        public let number: Int?
        public let caption: String?
        public let paper: String?
        /// The picture's height at 960 wide: its shape while it loads.
        public let height: Int?
        public let year: Int

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            design = (try? c.decodeIfPresent(String.self, forKey: .design)) ?? ""
            number = try? c.decodeIfPresent(Int.self, forKey: .number)
            caption = try? c.decodeIfPresent(String.self, forKey: .caption)
            paper = try? c.decodeIfPresent(String.self, forKey: .paper)
            height = try? c.decodeIfPresent(Int.self, forKey: .height)
            year = (try? c.decodeIfPresent(Int.self, forKey: .year)) ?? 2026
        }

        private enum CodingKeys: String, CodingKey {
            case design, number, caption, paper, height, year
        }
    }

    /// One step of its trail: `sealed`, `delivered`, `opens`, `picked_up`,
    /// `emailed`, `joined` or `returned`, with its moment (`at`) or day
    /// (`on`), and whether it has happened.
    public struct TrailStep: Decodable, Sendable, Hashable {
        public let step: String
        public let at: String?
        public let on: String?
        public let done: Bool

        public init(from decoder: any Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            step = try c.decode(String.self, forKey: .step)
            at = try? c.decodeIfPresent(String.self, forKey: .at)
            on = try? c.decodeIfPresent(String.self, forKey: .on)
            done = (try? c.decodeIfPresent(Bool.self, forKey: .done)) ?? false
        }

        private enum CodingKeys: String, CodingKey {
            case step, at, on, done
        }
    }

    private enum CodingKeys: String, CodingKey {
        case id, arrival, status, sealed, envelope, card, note, trail
        case sentAt = "sent_at"
        case toName = "to_name"
        case byEmail = "by_email"
        case arrivesAt = "arrives_at"
        case arrivesOn = "arrives_on"
        case opensOn = "opens_on"
        case canTakeBack = "can_take_back"
        case takeBackUntil = "take_back_until"
    }

    public init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        sentAt = try? c.decodeIfPresent(String.self, forKey: .sentAt)
        toName = (try? c.decodeIfPresent(String.self, forKey: .toName)) ?? ""
        byEmail = (try? c.decodeIfPresent(Bool.self, forKey: .byEmail)) ?? false
        arrival = (try? c.decodeIfPresent(String.self, forKey: .arrival)).flatMap(HolidayCardArrival.init(rawValue:))
        let status = (try? c.decodeIfPresent(String.self, forKey: .status)).flatMap(Status.init(rawValue:))
        self.status = status ?? .delivered
        arrivesAt = try? c.decodeIfPresent(String.self, forKey: .arrivesAt)
        arrivesOn = try? c.decodeIfPresent(String.self, forKey: .arrivesOn)
        opensOn = try? c.decodeIfPresent(String.self, forKey: .opensOn)
        sealed = (try? c.decodeIfPresent(Bool.self, forKey: .sealed)) ?? false
        canTakeBack = (try? c.decodeIfPresent(Bool.self, forKey: .canTakeBack)) ?? false
        takeBackUntil = try? c.decodeIfPresent(String.self, forKey: .takeBackUntil)
        envelope = try c.decode(Envelope.self, forKey: .envelope)
        card = try c.decode(Card.self, forKey: .card)
        note = try? c.decodeIfPresent(String.self, forKey: .note)
        trail = (try? c.decodeIfPresent([TrailStep].self, forKey: .trail)) ?? []
    }
}

//
//  RecordsSampleData.swift
//  Pantopus
//
//  Deterministic A17.10 records fixture for previews and snapshot tests.
//  Mirrors the design's `records.jsx` data (Q1 2026 Meridian Wealth
//  Roth IRA statement + 3 quarterly siblings) so renders stay faithful
//  while the backend is absent.
//

import Foundation

public enum RecordsSampleData {
    public static let senderName = "Meridian Wealth Management"
    public static let senderMeta = "Retirement Services · 9h ago"
    public static let recordTitle = "Q1 2026 Investment Statement — Roth IRA"

    /// Fresh-arrival record — not yet filed in the vault.
    public static let record = RecordsDetailDTO(
        title: recordTitle,
        reference: "Statement MWM-2026-Q1-9981842 · 4 pages · PDF + structured data",
        docKind: "Financial · Statement",
        docClassLabel: "Quarterly Statement",
        retentionLine: "Pantopus keeps this 7 years (IRS §6501)",
        issuer: RecordsIssuer(
            initials: "MW",
            name: "Meridian Wealth Management",
            dept: "Retirement Services · Roth IRA division",
            identifier: "CRD# 814-2257 · FINRA member",
            trustNote: "Sender domain DKIM-verified · matches SEC registration"
        ),
        openingFacts: [
            RecordsFact(
                kind: .account,
                label: "Account",
                value: "Roth IRA ····4421",
                note: "Holder: you · individual",
                mono: true
            ),
            RecordsFact(
                kind: .period,
                label: "Period covered",
                value: "Jan 1 – Mar 31, 2026",
                note: "Q1 2026 · 90 days"
            ),
            RecordsFact(
                kind: .balance,
                label: "Ending balance",
                value: "$84,237.16",
                note: "As of Mar 31, 4:00 PM ET",
                emphasis: true
            ),
            RecordsFact(
                kind: .change,
                label: "Net change",
                value: "+$3,419.08",
                note: "+4.23% · contributions $1,500 · market $1,919",
                tone: .positive,
                emphasis: true
            ),
            RecordsFact(
                kind: .statementDate,
                label: "Statement date",
                value: "Apr 4, 2026",
                note: "Delivered to Pantopus Apr 4 · 9:12 AM"
            )
        ],
        bodyParagraphs: [
            "This statement reports activity in your Roth IRA for the quarter ended " +
                "March 31, 2026. It includes the account summary, positions, dividends, " +
                "contributions, and performance attribution required under FINRA Rule 2231.",
            "Two contributions totalling $1,500.00 were credited during the quarter. " +
                "No withdrawals were taken. Market appreciation accounted for the balance " +
                "of the $3,419.08 net change."
        ],
        coverPageHint: "p. 1 / 4",
        pageCount: 4,
        vaultTrail: [
            RecordsVaultCrumb(glyph: .inbox, label: "Mailbox", isCurrent: false),
            RecordsVaultCrumb(glyph: .archive, label: "Vault", isCurrent: false),
            RecordsVaultCrumb(glyph: .landmark, label: "Finance", isCurrent: false),
            RecordsVaultCrumb(glyph: .fileText, label: "Statements", isCurrent: false),
            RecordsVaultCrumb(glyph: .calendar, label: "2026", isCurrent: true)
        ],
        related: [
            RelatedRecord(id: "q4-2025", period: "Q4 2025", amount: "$80,818.08", filedWhen: "Filed Jan 7"),
            RelatedRecord(id: "q3-2025", period: "Q3 2025", amount: "$78,902.41", filedWhen: "Filed Oct 6"),
            RelatedRecord(id: "q2-2025", period: "Q2 2025", amount: "$76,118.66", filedWhen: "Filed Jul 8")
        ],
        elfOpen: RecordsElfContent(
            headline: "Pantopus opened this for you",
            summary: "Standard quarterly statement from Meridian. Balance is up 4.2% on the " +
                "quarter — that's in line with your other accounts. No action needed; just " +
                "file it for tax season.",
            bullets: [
                RecordsElfBullet(
                    glyph: .fileCheck,
                    label: "Authentic statement",
                    text: "DKIM + FINRA registry match"
                ),
                RecordsElfBullet(
                    glyph: .trendingUp,
                    label: "Up 4.2% on the quarter",
                    text: "matches your other accounts"
                ),
                RecordsElfBullet(
                    glyph: .archive,
                    label: "Suggested: Vault › Finance › Statements › 2026",
                    text: "where last 3 quarters live"
                )
            ]
        ),
        elfFiled: RecordsElfContent(
            headline: "Filed · here's where it lives",
            summary: "Stored in Vault › Finance › Statements › 2026 with the rest of your " +
                "Roth IRA quarterlies. Pantopus will keep it for 7 years per IRS §6501 and " +
                "surface it during tax prep.",
            bullets: [
                RecordsElfBullet(
                    glyph: .lock,
                    label: "Read-only copy locked",
                    text: "original PDF + structured JSON · checksummed"
                ),
                RecordsElfBullet(
                    glyph: .calendarClock,
                    label: "Retention: 7 years",
                    text: "auto-delete prompt Apr 2033"
                ),
                RecordsElfBullet(
                    glyph: .search,
                    label: "Indexed and searchable",
                    text: "find it by account, ticker, or amount"
                )
            ]
        ),
        filedAtLabel: nil,
        isFiled: false
    )

    /// Filed-to-vault variant of the same record.
    public static var filedRecord: RecordsDetailDTO {
        record.withFiled(true, filedAtLabel: "Today 2:14 PM · retention 7y")
    }
}

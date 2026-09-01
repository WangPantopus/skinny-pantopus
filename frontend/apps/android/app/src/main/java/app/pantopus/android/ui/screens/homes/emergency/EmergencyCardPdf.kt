@file:Suppress("MagicNumber", "PackageNaming")

package app.pantopus.android.ui.screens.homes.emergency

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.content.FileProvider
import app.pantopus.android.data.api.models.homes.HomeEmergencyDto
import java.io.File
import java.io.FileOutputStream
import java.text.DateFormat
import java.util.Date

/**
 * P6.6 — builds + renders the "Print emergency card" A4 PDF. Mirrors
 * `Core/Design/Components/EmergencyCardPDF.swift` pixel-for-pixel: same
 * A4 geometry (595 × 842 pt), same 48 pt margins, same green kicker +
 * heading paint, same heading / item title / item detail font sizes.
 *
 * [content] is a pure projection (unit-tested); [render] draws the page
 * and returns a shareable `content://` URI via the app FileProvider.
 * Geometry is in PDF points, not Compose dp.
 */
data class EmergencyCardContent(
    val homeLabel: String,
    val generatedLabel: String,
    val sections: List<Section>,
) {
    data class Item(val title: String, val detail: String)

    data class Section(val heading: String, val items: List<Item>)

    val isEmpty: Boolean get() = sections.all { it.items.isEmpty() }
}

object EmergencyCardPdf {
    private val categoryOrder =
        listOf(
            EmergencyCategory.Shutoff,
            EmergencyCategory.Contact,
            EmergencyCategory.Evac,
            EmergencyCategory.Medical,
        )

    fun content(
        emergencies: List<HomeEmergencyDto>,
        homeLabel: String,
        now: Long = System.currentTimeMillis(),
    ): EmergencyCardContent {
        fun item(dto: HomeEmergencyDto) = EmergencyCardContent.Item(dto.label, detailOf(dto))

        val sections = mutableListOf<EmergencyCardContent.Section>()

        val pinned = emergencies.filter { it.details?.get("pinned") == "1" }
        if (pinned.isNotEmpty()) {
            sections.add(EmergencyCardContent.Section("Pinned · Quick access", pinned.map(::item)))
        }

        for (category in categoryOrder) {
            val rows = emergencies.filter { EmergencyCategory.fromType(it.type) == category }
            if (rows.isEmpty()) continue
            sections.add(EmergencyCardContent.Section(category.label, rows.map(::item)))
        }

        val generated =
            DateFormat.getDateTimeInstance(DateFormat.LONG, DateFormat.SHORT).format(Date(now))
        return EmergencyCardContent(homeLabel, "Generated $generated", sections)
    }

    private fun detailOf(dto: HomeEmergencyDto): String {
        val details = dto.details
        val detail = details?.get("detail").orEmpty()
        if (detail.isNotEmpty()) return detail
        val phone = details?.get("phone").orEmpty()
        if (phone.isNotEmpty()) {
            val note = details?.get("note").orEmpty()
            return if (note.isNotEmpty()) "$phone · $note" else phone
        }
        return dto.location.orEmpty()
    }

    fun render(
        context: Context,
        content: EmergencyCardContent,
    ): Uri? {
        if (content.isEmpty) return null

        val pageWidth = 595
        val pageHeight = 842
        val margin = 48f
        val contentWidth = (pageWidth - margin * 2).toInt()

        val green = Color.rgb(22, 163, 74)

        fun paint(
            size: Float,
            color: Int,
            bold: Boolean,
        ) = TextPaint().apply {
            isAntiAlias = true
            textSize = size
            this.color = color
            typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        }

        val document = PdfDocument()
        var pageNumber = 1
        var page = document.startPage(PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create())
        var cursorY = margin

        fun block(
            text: String,
            textPaint: TextPaint,
            spacingAfter: Float,
        ) {
            val layout =
                StaticLayout.Builder
                    .obtain(text, 0, text.length, textPaint, contentWidth)
                    .build()
            if (cursorY + layout.height > pageHeight - margin) {
                document.finishPage(page)
                pageNumber += 1
                page =
                    document.startPage(
                        PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create(),
                    )
                cursorY = margin
            }
            val canvas = page.canvas
            canvas.save()
            canvas.translate(margin, cursorY)
            layout.draw(canvas)
            canvas.restore()
            cursorY += layout.height + spacingAfter
        }

        block("PANTOPUS · EMERGENCY CARD", paint(11f, green, true), 6f)
        block(content.homeLabel, paint(26f, Color.BLACK, true), 4f)
        block(content.generatedLabel, paint(11f, Color.GRAY, false), 22f)

        for (section in content.sections) {
            if (section.items.isEmpty()) continue
            block(section.heading.uppercase(), paint(14f, green, true), 8f)
            for (item in section.items) {
                block(item.title, paint(13f, Color.BLACK, true), 2f)
                if (item.detail.isNotEmpty()) {
                    block(item.detail, paint(12f, Color.DKGRAY, false), 10f)
                } else {
                    cursorY += 8f
                }
            }
            cursorY += 12f
        }

        document.finishPage(page)

        return try {
            val file = File(context.cacheDir, "emergency-card-${System.currentTimeMillis()}.pdf")
            FileOutputStream(file).use { document.writeTo(it) }
            document.close()
            FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        } catch (_: Exception) {
            document.close()
            null
        }
    }
}

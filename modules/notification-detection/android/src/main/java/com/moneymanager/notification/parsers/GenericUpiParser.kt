package com.moneymanager.notification.parsers

import com.moneymanager.notification.normalizer.NormalizedNotification
import android.os.Bundle
import java.util.regex.Pattern
import kotlin.math.min

/**
 * Generic UPI parser for other UPI apps or fallback parsing.
 * Uses common UPI notification patterns.
 */
class GenericUpiParser : UpiNotificationParser {
    override val name = "GenericUpiParser"
    override val version = "1.0"

    private val amountPatterns = listOf(
        Pattern.compile("""[₹Rs]\.?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)"""),
        Pattern.compile("""INR\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)"""),
        Pattern.compile("""(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:paid|debited|sent|transferred)"""),
        Pattern.compile("""(?:paid|debited|sent|transferred)\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)""")
    )

    private val merchantPatterns = listOf(
        Pattern.compile("""to\s+([^.]+?)(?:\s+at|\s+via|\s+on|\s*$)"""),
        Pattern.compile("""(?:paid|sent|transferred)\s+[₹Rs]\.?\s*\d+(?:,\d{3})*(?:\.\d{1,2})?\s+to\s+([^.]+)""")
    )

    private val refPatterns = listOf(
        Pattern.compile("""(?:Ref|Ref\.|Reference|Txn|Transaction|UPI)\s*(?:ID|No|Number|:)?\s*[:#]?\s*([A-Za-z0-9]+)""")
    )

    override fun tryParse(notification: NormalizedNotification): ParsedUpiTransaction? {
        val text = buildFullText(notification)
        if (text.isNullOrBlank()) return null

        // Must have UPI-related keywords
        val lower = text.lowercase()
        val upiKeywords = listOf("upi", "unified payment", "bharat", "npcI", "payment")
        val hasUpiKeyword = upiKeywords.any { lower.contains(it) }
        
        if (!hasUpiKeyword) return null

        // Must have payment indicators
        val paymentKeywords = listOf("paid", "debited", "sent", "transferred", "payment", "successful", "completed")
        val nonPaymentKeywords = listOf("promo", "offer", "cashback", "reward", "coupon", "advertisement")
        
        val hasPaymentKeyword = paymentKeywords.any { lower.contains(it) }
        val hasNonPaymentKeyword = nonPaymentKeywords.any { lower.contains(it) }
        
        if (!hasPaymentKeyword || hasNonPaymentKeyword) return null

        val amountPaise = extractAmount(text) ?: return null
        val merchant = extractMerchant(text)
        val reference = extractReference(text)

        // Lower confidence for generic parser
        return ParsedUpiTransaction(
            amountPaise = amountPaise,
            merchant = merchant,
            sourceApp = "OTHER_UPI",
            transactionTimestamp = notification.postTime,
            transactionReference = reference,
            parserName = name,
            parserVersion = version,
            confidence = calculateConfidence(text, amountPaise, merchant)
        )
    }

    private fun buildFullText(notification: NormalizedNotification): String {
        val parts = mutableListOf<String>()
        notification.title?.let { parts.add(it) }
        notification.text?.let { parts.add(it) }
        notification.bigText?.let { parts.add(it) }
        notification.subText?.let { parts.add(it) }
        return parts.joinToString(" ")
    }

    private fun extractAmount(text: String): Long? {
        for (pattern in amountPatterns) {
            val matcher = pattern.matcher(text)
            if (matcher.find()) {
                val amountStr = matcher.group(1).replace(",", "")
                return try {
                    (amountStr.toDouble() * 100).toLong()
                } catch (e: NumberFormatException) {
                    null
                }
            }
        }
        return null
    }

    private fun extractMerchant(text: String): String? {
        for (pattern in merchantPatterns) {
            val matcher = pattern.matcher(text)
            if (matcher.find()) {
                val merchant = matcher.group(1).trim()
                if (merchant.length > 1 && merchant.length < 100) {
                    return merchant
                }
            }
        }
        return null
    }

    private fun extractReference(text: String): String? {
        for (pattern in refPatterns) {
            val matcher = pattern.matcher(text)
            if (matcher.find()) {
                return matcher.group(1)
            }
        }
        return null
    }

    private fun calculateConfidence(text: String, amountPaise: Long, merchant: String?): Double {
        var confidence = 0.3 // Base confidence lower for generic
        if (amountPaise > 0) confidence += 0.2
        if (merchant != null && merchant.length > 2) confidence += 0.2
        if (text.lowercase().contains("upi")) confidence += 0.1
        return min(confidence, 0.8) // Cap at 0.8 for generic parser
    }
}
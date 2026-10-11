package com.moneymanager.notification.parsers

import com.moneymanager.notification.normalizer.NormalizedNotification
import android.os.Bundle
import java.util.regex.Pattern
import kotlin.math.min

/**
 * Parser for BHIM UPI notifications.
 */
class BhimParser : UpiNotificationParser {
    override val name = "BhimParser"
    override val version = "1.0"

    private val amountPatterns = listOf(
        Pattern.compile("""[₹Rs]\.?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)"""),
        Pattern.compile("""INR\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)"""),
        Pattern.compile("""debited\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)"""),
        Pattern.compile("""paid\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)""")
    )

    private val merchantPatterns = listOf(
        Pattern.compile("""(?:paid|debited)\s+[₹Rs]\.?\s*\d+(?:,\d{3})*(?:\.\d{1,2})?\s+to\s+([^.]+)"""),
        Pattern.compile("""to\s+([^.]+?)(?:\s+at|\s+via|\s+on|\s*$)""")
    )

    private val refPatterns = listOf(
        Pattern.compile("""(?:Ref|Ref\.|Reference|Txn|Transaction|UPI)\s*(?:ID|No|Number|:)?\s*[:#]?\s*([A-Za-z0-9]+)"""),
        Pattern.compile("""(?:BHIM\s*(?:Ref|Reference))\s*[:#]?\s*([A-Za-z0-9]+)""")
    )

    override fun tryParse(notification: NormalizedNotification): ParsedUpiTransaction? {
        val text = buildFullText(notification)
        if (text.isNullOrBlank()) return null

        if (!isPaymentNotification(text)) return null

        val amountPaise = extractAmount(text) ?: return null
        val merchant = extractMerchant(text)
        val reference = extractReference(text)

        return ParsedUpiTransaction(
            amountPaise = amountPaise,
            merchant = merchant,
            sourceApp = "BHIM",
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

    private fun isPaymentNotification(text: String): Boolean {
        val lower = text.lowercase()
        val paymentKeywords = listOf("paid", "debited", "payment", "upi", "successful")
        val nonPaymentKeywords = listOf("promo", "offer", "cashback", "reward", "advertisement")
        
        val hasPaymentKeyword = paymentKeywords.any { lower.contains(it) }
        val hasNonPaymentKeyword = nonPaymentKeywords.any { lower.contains(it) }
        
        return hasPaymentKeyword && !hasNonPaymentKeyword
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
        var confidence = 0.5
        if (amountPaise > 0) confidence += 0.2
        if (merchant != null && merchant.length > 2) confidence += 0.2
        if (text.lowercase().contains("upi")) confidence += 0.1
        if (text.lowercase().contains("bhim")) confidence += 0.1
        return min(confidence, 1.0)
    }
}
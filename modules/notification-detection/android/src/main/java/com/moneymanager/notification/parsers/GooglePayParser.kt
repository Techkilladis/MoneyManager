package com.moneymanager.notification.parsers

import com.moneymanager.notification.normalizer.NormalizedNotification
import android.os.Bundle
import java.util.regex.Pattern

/**
 * Parser for Google Pay (GPay) UPI notifications.
 * 
 * Example notification formats:
 * - "You paid ₹125.50 to Swiggy. Transaction ID: 1234567890"
 * - "₹125.50 paid to Swiggy via UPI. Ref: 1234567890"
 * - "Payment of ₹125.50 to Swiggy successful. UPI Ref: 1234567890"
 */
class GooglePayParser : UpiNotificationParser {
    override val name = "GooglePayParser"
    override val version = "1.0"

    // Patterns for amount extraction
    private val amountPatterns = listOf(
        // "₹125.50" or "Rs. 125.50" or "₹ 125.50"
        Pattern.compile("""[₹Rs]\.?\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)"""),
        // "INR 125.50"
        Pattern.compile("""INR\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)"""),
        // "125.50" in payment context
        Pattern.compile("""paid\s+(\d+(?:,\d{3})*(?:\.\d{1,2})?)"""),
        Pattern.compile("""payment\s+(?:of\s+)?(\d+(?:,\d{3})*(?:\.\d{1,2})?)""")
    )

    // Patterns for merchant extraction
    private val merchantPatterns = listOf(
        // "to Swiggy" or "to Merchant Name"
        Pattern.compile("""(?:paid|sent|transferred|payment\s+(?:of|to))\s+[₹Rs]\.?\s*\d+(?:,\d{3})*(?:\.\d{1,2})?\s+to\s+([^.]+)"""),
        // "to Merchant at"
        Pattern.compile("""to\s+([^.]+?)(?:\s+at|\s+via|\s+on|\s+\d|\s*$)"""),
        // "Merchant Name" after amount
        Pattern.compile("""\d+(?:,\d{3})*(?:\.\d{1,2})?\s+to\s+([^.]+)""")
    )

    // Patterns for transaction reference
    private val refPatterns = listOf(
        Pattern.compile("""(?:Ref|Ref\.|Reference|Txn|Transaction|UPI)\s*(?:ID|No|Number|:)?\s*[:#]?\s*([A-Za-z0-9]+)"""),
        Pattern.compile("""(?:UPI\s*(?:Ref|Reference))\s*[:#]?\s*([A-Za-z0-9]+)""")
    )

    override fun tryParse(notification: NormalizedNotification): ParsedUpiTransaction? {
        val text = buildFullText(notification)
        if (text.isNullOrBlank()) return null

        // Check if this looks like a payment notification
        if (!isPaymentNotification(text)) return null

        // Extract amount
        val amountPaise = extractAmount(text) ?: return null

        // Extract merchant
        val merchant = extractMerchant(text)

        // Extract reference
        val reference = extractReference(text)

        // Get timestamp
        val timestamp = notification.postTime

        return ParsedUpiTransaction(
            amountPaise = amountPaise,
            merchant = merchant,
            sourceApp = "GOOGLE_PAY",
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
        val paymentKeywords = listOf(
            "paid", "sent", "transferred", "payment", "debit", "debited",
            "upi", "transaction", "successful", "completed", "received"
        )
        val nonPaymentKeywords = listOf(
            "promo", "offer", "cashback", "reward", "coupon", "discount",
            "advertisement", "marketing", "newsletter", "kyc", "update"
        )
        
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
                    val amount = amountStr.toDouble()
                    (amount * 100).toLong()
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
        if (text.lowercase().contains("google pay") || text.lowercase().contains("gpay")) confidence += 0.1
        return min(confidence, 1.0)
    }

    companion object {
        fun parseAmountToPaise(amountStr: String): Long? {
            val clean = amountStr.replace(",", "")
            return try {
                (clean.toDouble() * 100).toLong()
            } catch (e: NumberFormatException) {
                null
            }
        }
    }
}
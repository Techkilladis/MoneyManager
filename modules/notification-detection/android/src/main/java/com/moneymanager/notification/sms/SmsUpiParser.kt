package com.moneymanager.notification.sms

import com.moneymanager.notification.parsers.UpiMessageParser
import com.moneymanager.notification.parsers.UpiMessageParser.Direction
import java.security.MessageDigest

/**
 * Pure-Kotlin parser for bank SMS. A message is only treated as a UPI
 * transaction when it carries a UPI marker ("UPI", "VPA", a UPI handle such
 * as name@ybl, or a 12-digit UPI reference number as in HDFC's "Sent Rs…" SMS) and reports a completed debit or credit. OTPs, failed or pending
 * payments, collect requests, mandates and promotions are rejected.
 *
 * It has no Android dependencies so it can be unit tested on the JVM.
 */
object SmsUpiParser {
    const val VERSION = "1.0"

    data class Result(
        val amountPaise: Long,
        val direction: Direction,
        val counterparty: String?,
        val reference: String?
    )

    private val I = RegexOption.IGNORE_CASE

    private val UPI_MARKER = Regex(
        """\bUPI\b|\bVPA\b|\b(?:RRN|Ref(?:erence)?\.?\s*(?:No\.?)?)\s*[:#\-]?\s*\d{12}\b|[\w.\-]+@(?:ok(?:axis|sbi|hdfcbank|icici)|ybl|ibl|axl|paytm|apl|upi|fbl|pthdfc|ptsbi|ptyes|axisb|sbi|icici|hdfcbank|idfcbank)\b""",
        I
    )

    private val IGNORE = Regex(
        """\b(fail(?:ed|ure)?|declined|unsuccessful|pending|not\s+(?:been\s+)?processed|otp|one[\s-]?time\s+password|request(?:ed|s)?|collect|reminder|will\s+be\s+debited|to\s+be\s+debited|scheduled|mandate|autopay|offers?|cashback|coupons?|kyc|blocked)\b""",
        I
    )

    // "debited by 500.0" (SBI) has no currency marker.
    private val BARE_AMOUNT = Regex(
        """\b(?:debited|credited)\s+(?:by|with|for)\s+(?:rs\.?|inr|₹)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)""",
        I
    )

    private val UPI_SLASH = Regex("""\bUPI/(DR|CR)/(\d{6,})(?:/([^/]+))?""", I)
    private val CREDIT = Regex("""\b(credited|received|deposited)\b""", I)
    private val DEBIT = Regex("""\b(debited|sent|paid|spent|withdrawn|transferred)\b""", I)

    private const val END =
        """(?=\s+(?:on|via|using|ref|refno|upi|from|at|bal|avl|if|not|date|for|is|has|was|credited|debited)\b|[.,;()\[\n]|\s*$)"""
    private const val NAME = """[A-Za-z][A-Za-z0-9 .&'\-]{1,40}?"""
    // "to Mr P N Megarajan" (Indian Bank): the title isn't part of the name.
    private const val HONORIFIC = """(?:(?:Mr|Mrs|Ms|Miss|Dr|Shri|Smt|Md|Mohd)\.?\s+)?"""

    private val VPA = Regex("""\b(?:to|from|by)\s+VPA\s+([\w.\-]{2,}@[A-Za-z]\w*)""", I)
    private val TO_PARTY = Regex("""\b(?:trf\s+to|transfer(?:red)?\s+to|to)\s+$HONORIFIC($NAME)$END""", I)
    private val FROM_PARTY = Regex("""\b(?:from|by)\s+$HONORIFIC($NAME)$END""", I)

    // ICICI dual-party format: "debited for Rs 625; TAMILAGA UNAVU credited"
    private val DUAL_PARTY_DEBIT = Regex(
        """[;.;]\s+([A-Za-z][A-Za-z0-9 .&'\-]{2,40}?)\s+credited""", I
    )

    // Indian Bank "Sent Rs..." with merchant immediately before .RRN — use lookahead
    // to stop at ".RRN", ".Avl", ".Not" etc. without consuming the delimiter.
    private val TO_PARTY_LOOKAHEAD = Regex(
        """\bto\s+$HONORIFIC([A-Za-z][A-Za-z0-9 .&'\-]+?)(?=\.?\s*(?:RRN|UTR|Ref|txn|UPI|avl|bal|not|sms|call)\b)""", I
    )

    private val NOT_A_NAME = Regex("""\b(a/?c|account|bank|your|you)\b""", I)
    private val LABEL_ONLY = Regex("""^(upi|vpa|ref|refno|xx\w*)$""", I)

    private val REFERENCES = listOf(
        Regex("""\bUPI/(?:DR|CR)/(\d{9,})""", I),
        Regex("""\bUPI\s*[:\-]?\s*(\d{9,})""", I),
        Regex("""\b(?:RRN|UTR|Ref(?:erence)?\.?\s*(?:ID|No\.?|Number)?|Txn\s*ID)\s*[:#\-]?\s*(\d{9,})""", I)
    )

    /** Bank SMS come from alphanumeric headers (e.g. AX-HDFCBK); skip plain phone numbers. */
    fun isCandidateSender(sender: String?): Boolean = sender != null && sender.any { it.isLetter() }

    fun parse(sender: String?, body: String?): Result? {
        if (!isCandidateSender(sender) || body.isNullOrBlank()) return null
        val text = body.replace(Regex("""\s+"""), " ").trim()
        if (!UPI_MARKER.containsMatchIn(text)) return null
        if (IGNORE.containsMatchIn(text)) return null

        val amountPaise = UpiMessageParser.amount(text)
            ?: BARE_AMOUNT.find(text)?.groupValues?.get(1)?.let(UpiMessageParser::toPaise)
            ?: return null
        if (amountPaise <= 0) return null

        val slash = UPI_SLASH.find(text)
        val direction = when (slash?.groupValues?.get(1)?.uppercase()) {
            "DR" -> Direction.DEBIT
            "CR" -> Direction.CREDIT
            else -> direction(text)
        } ?: return null

        return Result(amountPaise, direction, counterparty(text, direction, slash?.groupValues?.getOrNull(3)), reference(text))
    }

    /** Whichever of the credit/debit words appears first decides the direction. */
    fun direction(text: String): Direction? {
        val credit = CREDIT.find(text)
        val debit = DEBIT.find(text)
        return when {
            credit == null && debit == null -> null
            credit == null -> Direction.DEBIT
            debit == null -> Direction.CREDIT
            credit.range.first < debit.range.first -> Direction.CREDIT
            else -> Direction.DEBIT
        }
    }

    fun reference(text: String): String? =
        REFERENCES.firstNotNullOfOrNull { it.find(text)?.groupValues?.get(1) }

    private fun counterparty(text: String, direction: Direction, slashName: String?): String? {
        cleanParty(slashName)?.let { return it }
        VPA.find(text)?.groupValues?.get(1)?.let { return it.lowercase() }
        val raw = when (direction) {
            Direction.DEBIT -> TO_PARTY.find(text)?.groupValues?.get(1)
                ?: TO_PARTY_LOOKAHEAD.find(text)?.groupValues?.get(1)  // "to Radiance CINEMA.RRN"
                ?: DUAL_PARTY_DEBIT.find(text)?.groupValues?.get(1)     // "; TAMILAGA UNAVU credited"
            Direction.CREDIT -> FROM_PARTY.find(text)?.groupValues?.get(1)
        }
        return cleanParty(raw)
    }

    private fun cleanParty(raw: String?): String? {
        val s = raw?.trim()?.trimEnd('.', ',', ':', ';', '-')?.replace(Regex("""\s+"""), " ") ?: return null
        if (s.length < 2 || s.length > 60) return null
        if (s.all { it.isDigit() || it == ' ' }) return null
        if (NOT_A_NAME.containsMatchIn(s) || LABEL_ONLY.matches(s)) return null
        return s
    }

    /** Stable identity of one SMS, so re-scanning the inbox never creates a second event. */
    fun smsKey(sender: String?, timestamp: Long, body: String): String {
        val digest = MessageDigest.getInstance("SHA-256").digest("$sender|$timestamp|$body".toByteArray())
        return "sms:" + digest.joinToString("") { "%02x".format(it) }.take(32)
    }
}

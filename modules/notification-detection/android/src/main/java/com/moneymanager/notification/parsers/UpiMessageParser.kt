package com.moneymanager.notification.parsers

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Pure-Kotlin parser for UPI payment notification text. It has no Android
 * dependencies so it can be unit tested on the JVM.
 *
 * Extracts the amount (exactly, in paise), the direction (money out vs. money
 * in), the counterparty and the UPI reference. Returns null for anything that
 * is not a completed payment: failed/pending payments, collect requests,
 * reminders and promotions.
 */
object UpiMessageParser {
    const val VERSION = "2.0"

    enum class Direction { DEBIT, CREDIT }

    data class Result(
        val amountPaise: Long,
        val direction: Direction,
        val counterparty: String?,
        val reference: String?
    )

    private val I = RegexOption.IGNORE_CASE

    // ₹125.50, Rs. 1,25,000, INR 99 — the currency marker is required here.
    private val AMOUNT = Regex("""(?:₹|\bRs\.?|\bINR)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)""", I)

    // "paid 125.50 to …" with no currency marker.
    private val BARE_AMOUNT = Regex("""\b(?:paid|sent|debited|received|credited|payment of)\s+([0-9][0-9,]*(?:\.[0-9]{1,2})?)\b""", I)

    private val IGNORE = Regex(
        """\b(fail(?:ed|ure)?|declined|unsuccessful|pending|processing|expired|request(?:ed|s)?|collect|reminder|due|offers?|cashback|coupons?|rewards?|scratch|won|kyc|otp|autopay\s+(?:set\s*up|setup|mandate)|mandate|bill\s+(?:is\s+)?generated)\b""",
        I
    )

    private val CREDIT = Regex("""\b(received|credited|deposited|sent\s+you|paid\s+you|added\s+to\s+your)\b""", I)
    private val DEBIT = Regex(
        """\b(paid|sent|debited|transferred|spent|withdrawn|payment\s+(?:of|to|successful|done|completed|made))\b""",
        I
    )

    private const val END =
        """(?=\s+(?:via|on|at|using|from|for|with|through|successfully|is|has|was|ref|upi|txn|transaction|in|and)\b|[.,!;:](?:\s|$)|[\n|()]|\s*$)"""

    private val TO_PARTY = Regex("""\bto\s+(.+?)$END""", I)
    private val FROM_PARTY = Regex("""\bfrom\s+(.+?)$END""", I)
    private val SENT_YOU = Regex("""(?:^|[.!]\s+)([A-Za-z][\w '&-]{1,40}?)\s+(?:has\s+)?(?:sent|paid)\s+you\b""", I)

    private val REFERENCE = Regex(
        """\b(?:UPI\s*)?(?:Ref(?:erence)?|Txn|Transaction|UTR)\.?\s*(?:ID|No\.?|Number)?\s*[:#-]?\s*([A-Za-z0-9]*[0-9][A-Za-z0-9]*)""",
        I
    )

    private val GENERIC_TITLES = Regex(
        """^(google\s*pay|gpay|phonepe|paytm|bhim|amazon\s*pay|whatsapp|mobikwik|freecharge|payment.*|money.*|transaction.*|upi.*)$""",
        I
    )

    fun parse(title: String?, text: String?, bigText: String?, subText: String?): Result? {
        // bigText is usually the expanded form of text; use it instead when it contains text.
        val main = if (bigText != null && (text == null || bigText.contains(text))) bigText else text
        val extra = if (main === bigText) null else bigText
        val body = listOfNotNull(title, main, extra, subText)
            .map { it.trim().trimEnd('.') }
            .filter { it.isNotEmpty() }
            .joinToString(". ")
        if (body.isBlank()) return null
        if (IGNORE.containsMatchIn(body)) return null

        val direction = direction(body) ?: return null
        val amountPaise = amount(body) ?: return null
        if (amountPaise <= 0) return null

        val party = when (direction) {
            Direction.DEBIT -> TO_PARTY.find(body)?.groupValues?.get(1)
            Direction.CREDIT -> FROM_PARTY.find(body)?.groupValues?.get(1)
                ?: SENT_YOU.find(body)?.groupValues?.get(1)
        }?.let(::cleanParty) ?: titleAsParty(title)

        return Result(amountPaise, direction, party, reference(body))
    }

    fun direction(text: String): Direction? {
        val credit = CREDIT.find(text)
        val debit = DEBIT.find(text)
        return when {
            credit == null && debit == null -> null
            credit == null -> Direction.DEBIT
            debit == null -> Direction.CREDIT
            // "sent you" / "paid you" start at the same index as "sent" / "paid".
            credit.range.first <= debit.range.first -> Direction.CREDIT
            else -> Direction.DEBIT
        }
    }

    fun amount(text: String): Long? {
        val raw = AMOUNT.find(text)?.groupValues?.get(1) ?: BARE_AMOUNT.find(text)?.groupValues?.get(1) ?: return null
        return toPaise(raw)
    }

    /** Exact decimal conversion: "125.29" -> 12529 (Double math would give 12528). */
    fun toPaise(raw: String): Long? {
        val clean = raw.replace(",", "").trimEnd('.')
        if (clean.isEmpty()) return null
        return try {
            BigDecimal(clean).movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact()
        } catch (e: NumberFormatException) {
            null
        } catch (e: ArithmeticException) {
            null
        }
    }

    fun reference(text: String): String? {
        return REFERENCE.findAll(text)
            .map { it.groupValues[1] }
            .firstOrNull { it.length >= 6 }
    }

    private fun cleanParty(raw: String): String? {
        var s = raw.trim().trim('"', '\'', '`').trimEnd('.', ',', ':', ';', '-').replace(Regex("""\s+"""), " ")
        s = s.replace(Regex("""(?i)^(?:mr\.?|ms\.?|mrs\.?)\s+"""), "")
        s = s.removeSuffix("'s").trim()
        if (s.length < 2 || s.length > 60) return null
        if (s.all { it.isDigit() || it == ' ' }) return null
        if (AMOUNT.containsMatchIn(s)) return null
        if (s.equals("you", ignoreCase = true) || s.startsWith("your ", ignoreCase = true)) return null
        return s
    }

    private fun titleAsParty(title: String?): String? {
        val t = title?.trim() ?: return null
        if (t.length < 2 || t.length > 40) return null
        if (t.any { it.isDigit() }) return null
        if (CREDIT.containsMatchIn(t) || DEBIT.containsMatchIn(t) || GENERIC_TITLES.matches(t)) return null
        return t
    }
}

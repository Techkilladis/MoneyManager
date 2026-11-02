package com.moneymanager.notification.parsers

/** A UPI payment extracted from a bank SMS. */
data class ParsedUpiTransaction(
    val amountPaise: Long,
    val merchant: String?,
    val sourceApp: String,
    val transactionTimestamp: Long,
    val transactionReference: String?,
    val parserName: String,
    val parserVersion: String = "1.0",
    val confidence: Double = 1.0,
    /** "DEBIT" (money out) or "CREDIT" (money in). */
    val direction: String = "DEBIT"
)

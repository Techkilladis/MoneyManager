package com.moneymanager.notification.parsers

import com.moneymanager.notification.normalizer.NormalizedNotification
import android.os.Bundle
import android.os.Parcelable

/**
 * Result of a UPI notification parsing attempt.
 */
data class ParsedUpiTransaction(
    val amountPaise: Long,
    val merchant: String?,
    val sourceApp: String,
    val transactionTimestamp: Long,
    val transactionReference: String?,
    val parserName: String,
    val parserVersion: String = "1.0",
    val confidence: Double = 1.0
) : Parcelable {
    constructor(parcel: android.os.Parcel) : this(
        amountPaise = parcel.readLong(),
        merchant = parcel.readString(),
        sourceApp = parcel.readString()!!,
        transactionTimestamp = parcel.readLong(),
        transactionReference = parcel.readString(),
        parserName = parcel.readString()!!,
        parserVersion = parcel.readString()!!,
        confidence = parcel.readDouble()
    )

    override fun writeToParcel(dest: android.os.Parcel, flags: Int) {
        dest.writeLong(amountPaise)
        dest.writeString(merchant)
        dest.writeString(sourceApp)
        dest.writeLong(transactionTimestamp)
        dest.writeString(transactionReference)
        dest.writeString(parserName)
        dest.writeString(parserVersion)
        dest.writeDouble(confidence)
    }

    override fun describeContents(): Int = 0

    companion object {
        @android.os.Parcelable.Creator
        val CREATOR: android.os.Parcelable.Creator<ParsedUpiTransaction> = object : android.os.Parcelable.Creator<ParsedUpiTransaction> {
            override fun createFromParcel(parcel: android.os.Parcel): ParsedUpiTransaction {
                return ParsedUpiTransaction(parcel)
            }

            override fun newArray(size: Int): Array<ParsedUpiTransaction?> {
                return arrayOfNulls(size)
            }
        }
    }

    fun toBundle(): Bundle {
        val bundle = Bundle()
        bundle.putLong("amountPaise", amountPaise)
        bundle.putString("merchant", merchant)
        bundle.putString("sourceApp", sourceApp)
        bundle.putLong("transactionTimestamp", transactionTimestamp)
        bundle.putString("transactionReference", transactionReference)
        bundle.putString("parserName", parserName)
        bundle.putString("parserVersion", parserVersion)
        bundle.putDouble("confidence", confidence)
        return bundle
    }
}

/**
 * Interface for UPI notification parsers.
 */
interface UpiNotificationParser {
    /**
     * Attempts to parse a normalized notification.
     * Returns null if this parser cannot handle the notification.
     * Returns ParsedUpiTransaction if successfully parsed.
     */
    fun tryParse(notification: NormalizedNotification): ParsedUpiTransaction?

    /**
     * The name of this parser (e.g., "GooglePayParser", "PhonePeParser").
     */
    val name: String

    /**
     * Version of this parser.
     */
    val version: String = "1.0"
}
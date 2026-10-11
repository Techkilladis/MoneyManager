package com.moneymanager.notification.normalizer

import android.service.notification.StatusBarNotification
import android.os.Bundle
import android.os.Build
import android.os.Parcel
import android.os.Parcelable
import androidx.annotation.RequiresApi

/**
 * Normalized representation of an Android notification.
 * Extracts and standardizes the relevant fields for UPI parsing.
 */
@RequiresApi(Build.VERSION_CODES.JELLY_BEAN_MR2)
data class NormalizedNotification(
    val notificationId: String,
    val packageName: String,
    val title: String?,
    val text: String?,
    val bigText: String?,
    val subText: String?,
    val postTime: Long,
    val whenTime: Long?,
    val extras: Bundle?
) : Parcelable {
    constructor(parcel: Parcel) : this(
        notificationId = parcel.readString()!!,
        packageName = parcel.readString()!!,
        title = parcel.readString(),
        text = parcel.readString(),
        bigText = parcel.readString(),
        subText = parcel.readString(),
        postTime = parcel.readLong(),
        whenTime = if (parcel.readInt() == 1) parcel.readLong() else null,
        extras = parcel.readBundle()
    )

    override fun writeToParcel(dest: Parcel, flags: Int) {
        dest.writeString(notificationId)
        dest.writeString(packageName)
        dest.writeString(title)
        dest.writeString(text)
        dest.writeString(bigText)
        dest.writeString(subText)
        dest.writeLong(postTime)
        dest.writeInt(if (whenTime != null) 1 else 0)
        whenTime?.let { dest.writeLong(it) }
        dest.writeBundle(extras)
    }

    override fun describeContents(): Int = 0

    companion object {
        /**
         * Creates a NormalizedNotification from a StatusBarNotification.
         */
        @RequiresApi(Build.VERSION_CODES.JELLY_BEAN_MR2)
        fun fromStatusBarNotification(sbn: StatusBarNotification): NormalizedNotification {
            val extras = sbn.notification.extras
            return NormalizedNotification(
                notificationId = sbn.id.toString(),
                packageName = sbn.packageName,
                title = extras?.getString(android.app.Notification.EXTRA_TITLE),
                text = extras?.getCharSequence(android.app.Notification.EXTRA_TEXT)?.toString(),
                bigText = extras?.getCharSequence(android.app.Notification.EXTRA_BIG_TEXT)?.toString(),
                subText = extras?.getCharSequence(android.app.Notification.EXTRA_SUB_TEXT)?.toString(),
                postTime = sbn.postTime,
                whenTime = if (sbn.notification.`when` > 0) sbn.notification.`when` else null,
                extras = extras
            )
        }

        @JvmField
        val CREATOR: Parcelable.Creator<NormalizedNotification> = object : Parcelable.Creator<NormalizedNotification> {
            override fun createFromParcel(parcel: Parcel): NormalizedNotification {
                return NormalizedNotification(parcel)
            }

            override fun newArray(size: Int): Array<NormalizedNotification?> {
                return arrayOfNulls(size)
            }
        }
    }
}

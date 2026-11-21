package com.moneymanager.notification.sms

import org.junit.Assert.assertEquals
import org.junit.Test

class SmsInboxTest {

    private val now = 1700000000000L
    private val hourMs = 60L * 60 * 1000
    private val dayMs = 24 * hourMs

    @Test
    fun calculateSince_incrementalFirstRun_usesFirstScanDays() {
        val since = SmsInbox.calculateSince(now = now, last = 0L, firstScanDays = 7, fullScan = false)
        assertEquals(now - 7 * dayMs, since)
    }

    @Test
    fun calculateSince_incrementalSubsequentRun_usesLastMinusOneHour() {
        val lastScan = now - 2 * dayMs
        val since = SmsInbox.calculateSince(now = now, last = lastScan, firstScanDays = 7, fullScan = false)
        assertEquals(lastScan - hourMs, since)
    }

    @Test
    fun calculateSince_fullScan_uses90DaysEvenWhenLastExists() {
        val lastScan = now - 2 * dayMs
        val since = SmsInbox.calculateSince(now = now, last = lastScan, firstScanDays = 7, fullScan = true)
        assertEquals(now - 90L * dayMs, since)
    }

    @Test
    fun calculateSince_fullScan_uses90DaysWhenLastIsZero() {
        val since = SmsInbox.calculateSince(now = now, last = 0L, firstScanDays = 7, fullScan = true)
        assertEquals(now - 90L * dayMs, since)
    }
}

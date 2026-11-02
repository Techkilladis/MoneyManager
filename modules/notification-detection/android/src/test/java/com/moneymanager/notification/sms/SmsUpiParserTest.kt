package com.moneymanager.notification.sms

import com.moneymanager.notification.parsers.UpiMessageParser.Direction
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class SmsUpiParserTest {

    private fun parse(body: String, sender: String = "AX-HDFCBK") = SmsUpiParser.parse(sender, body)

    @Test
    fun hdfcDebitToVpa() {
        val r = parse("Rs.250.00 debited from a/c **1234 on 12-10-24 to VPA swiggy@ybl(UPI Ref No 412345678901). Not you? Call 18002586161")
        assertNotNull(r)
        assertEquals(25000L, r!!.amountPaise)
        assertEquals(Direction.DEBIT, r.direction)
        assertEquals("swiggy@ybl", r.counterparty)
        assertEquals("412345678901", r.reference)
    }

    @Test
    fun hdfcSentToName() {
        val r = parse("Sent Rs.1,250.50 From HDFC Bank A/C *1234 To RAVI KUMAR On 12/10/24 Ref 412345678901 Not You? Call 18002586161")
        assertEquals(125050L, r?.amountPaise)
        assertEquals(Direction.DEBIT, r?.direction)
        assertEquals("RAVI KUMAR", r?.counterparty)
        assertEquals("412345678901", r?.reference)
    }

    @Test
    fun indianBankSentToNameWithTitle() {
        val r = parse(
            "Sent Rs.10.00 from A/c *1224 on 20-10-26 to Mr P N Megarajan.RRN 629304916360.Avl Bal Rs.908.67.Not you?SMS BLOCK to 9289592895-Indian Bank",
            sender = "AD-INDBNK"
        )
        assertEquals(1000L, r?.amountPaise)
        assertEquals(Direction.DEBIT, r?.direction)
        assertEquals("P N Megarajan", r?.counterparty)
        assertEquals("629304916360", r?.reference)
    }

    @Test
    fun hdfcCreditFromVpa() {
        val r = parse("Credit Alert! Rs.500.00 credited to HDFC Bank A/c XX1234 on 12-10-24 from VPA priya@okaxis (UPI 412345678901)")
        assertEquals(50000L, r?.amountPaise)
        assertEquals(Direction.CREDIT, r?.direction)
        assertEquals("priya@okaxis", r?.counterparty)
        assertEquals("412345678901", r?.reference)
    }

    @Test
    fun sbiDebitWithoutCurrencyMarker() {
        val r = parse("Dear UPI user A/C X1234 debited by 300.0 on date 12Oct24 trf to AMAZON PAY Refno 412345678901 If not you, call 1800111109", "VM-SBIUPI")
        assertEquals(30000L, r?.amountPaise)
        assertEquals(Direction.DEBIT, r?.direction)
        assertEquals("AMAZON PAY", r?.counterparty)
        assertEquals("412345678901", r?.reference)
    }

    @Test
    fun infoLineWithSlashFormat() {
        val r = parse("Your a/c XX1234 is debited for Rs 99.00 on 12-Oct-24. Info: UPI/DR/412345678901/JIO PREPAID/HDFC/jio@ybl. Bal Rs 5,000.00")
        assertEquals(9900L, r?.amountPaise)
        assertEquals(Direction.DEBIT, r?.direction)
        assertEquals("JIO PREPAID", r?.counterparty)
        assertEquals("412345678901", r?.reference)
    }

    @Test
    fun usesTheTransactionAmountNotTheBalance() {
        val r = parse("Rs 120 debited from a/c XX1234 to VPA shop@paytm UPI Ref 412345678901. Avl Bal Rs 9,999.00")
        assertEquals(12000L, r?.amountPaise)
    }

    @Test
    fun creditNotBeforeDebitWordIsDebit() {
        // "credited" here describes the beneficiary, after the account was debited.
        val r = parse("Rs 100 debited from a/c XX1234 and credited to shop@ybl. UPI Ref 412345678901")
        assertEquals(Direction.DEBIT, r?.direction)
    }

    @Test
    fun rejectsMessagesThatAreNotCompletedUpiTransactions() {
        assertNull(parse("123456 is your OTP for UPI payment of Rs 500. Do not share."))
        assertNull(parse("Your UPI payment of Rs 500 to shop@ybl has failed. Amount will be refunded."))
        assertNull(parse("Rs 500 payment request from VPA friend@ybl is pending. Approve in UPI app."))
        assertNull(parse("Get Rs 200 cashback on your next UPI payment! Offer valid till 31 Oct"))
        assertNull(parse("Rs 5,000 will be debited from a/c XX1234 on 15-10-24 for UPI mandate"))
    }

    @Test
    fun rejectsCardAndNonUpiBankMessages() {
        assertNull(parse("Rs 1,499 spent on HDFC Bank Credit Card XX1234 at AMAZON on 12-10-24"))
        assertNull(parse("Rs 2,000 withdrawn from ATM on 12-10-24. Avl Bal Rs 8,000"))
    }

    @Test
    fun ignoresMessagesFromPhoneNumbers() {
        assertNull(parse("I paid you Rs 500 via UPI, check", "+919876543210"))
        assertNull(parse("Rs 500 debited, UPI Ref 412345678901", "9876543210"))
    }

    @Test
    fun parsesCounterpartyOnlyWhenItLooksLikeAName() {
        val r = parse("Rs 75 debited from a/c XX1234 on 12-10-24. UPI Ref 412345678901")
        assertNotNull(r)
        assertNull(r!!.counterparty)
    }

    @Test
    fun smsKeyIsStablePerMessageAndDiffersAcrossMessages() {
        val a = SmsUpiParser.smsKey("AX-HDFCBK", 1000L, "body")
        assertEquals(a, SmsUpiParser.smsKey("AX-HDFCBK", 1000L, "body"))
        assertNotEquals(a, SmsUpiParser.smsKey("AX-HDFCBK", 1001L, "body"))
        assertNotEquals(a, SmsUpiParser.smsKey("AX-HDFCBK", 1000L, "body2"))
    }
}

package com.moneymanager.notification.parsers

import com.moneymanager.notification.parsers.UpiMessageParser.Direction
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class UpiMessageParserTest {

    private fun parse(text: String, title: String? = null) = UpiMessageParser.parse(title, text, null, null)

    // ------------------------------------------------------------ amounts

    @Test
    fun convertsDecimalAmountsExactly() {
        // 125.29 * 100 in floating point is 12528.999…, which used to truncate to 12528.
        assertEquals(12529L, UpiMessageParser.toPaise("125.29"))
        assertEquals(1999L, UpiMessageParser.toPaise("19.99"))
        assertEquals(50L, UpiMessageParser.toPaise("0.5"))
        assertEquals(12500000L, UpiMessageParser.toPaise("1,25,000"))
        assertEquals(12345678L, UpiMessageParser.toPaise("123,456.78"))
    }

    @Test
    fun readsRupeeSymbolRsAndInr() {
        assertEquals(12550L, parse("You paid ₹125.50 to Swiggy")?.amountPaise)
        assertEquals(50000L, parse("Rs. 500 sent to Ravi")?.amountPaise)
        assertEquals(9900L, parse("Paid INR 99 to Jio")?.amountPaise)
        assertEquals(15000000L, parse("₹1,50,000 paid to Landlord")?.amountPaise)
    }

    @Test
    fun ignoresStrayLettersThatLookLikeCurrency() {
        // The old pattern [₹Rs] matched a lone "s", so "Orders 2" parsed as ₹2.
        assertNull(UpiMessageParser.amount("Your orders 2 items were shipped"))
    }

    @Test
    fun usesTheFirstAmountNotTheBalance() {
        assertEquals(25000L, parse("₹250 paid to Zomato. Available balance ₹5,000")?.amountPaise)
    }

    // ------------------------------------------------------------ direction

    @Test
    fun detectsMoneyOut() {
        assertEquals(Direction.DEBIT, parse("You paid ₹125.50 to Swiggy")?.direction)
        assertEquals(Direction.DEBIT, parse("₹500 sent to Ravi Kumar")?.direction)
        assertEquals(Direction.DEBIT, parse("Rs 300 debited from your account for UPI payment")?.direction)
        assertEquals(Direction.DEBIT, parse("Payment of ₹1,200 to Airtel successful")?.direction)
    }

    @Test
    fun detectsMoneyIn() {
        assertEquals(Direction.CREDIT, parse("₹500 received from Priya Sharma")?.direction)
        assertEquals(Direction.CREDIT, parse("Rs. 2,000 credited to your account")?.direction)
        assertEquals(Direction.CREDIT, parse("Ravi sent you ₹250")?.direction)
        assertEquals(Direction.CREDIT, parse("Payment received of ₹99 from Amit")?.direction)
    }

    // ------------------------------------------------------------ counterparty

    @Test
    fun extractsPayee() {
        assertEquals("Swiggy", parse("You paid ₹125.50 to Swiggy. UPI Ref: 412345678901")?.counterparty)
        assertEquals("Ravi Kumar", parse("₹500 sent to Ravi Kumar via UPI")?.counterparty)
        assertEquals("ravi@okaxis", parse("₹500 sent to ravi@okaxis")?.counterparty)
        assertEquals("Big Bazaar", parse("₹1,000 paid to Big Bazaar on 12 Oct")?.counterparty)
    }

    @Test
    fun extractsSender() {
        assertEquals("Priya Sharma", parse("₹500 received from Priya Sharma")?.counterparty)
        assertEquals("Ravi", parse("Ravi sent you ₹250")?.counterparty)
    }

    @Test
    fun fallsBackToTitleForSenderName() {
        val result = UpiMessageParser.parse("Anita Desai", "Sent you ₹750", null, null)
        assertEquals(Direction.CREDIT, result?.direction)
        assertEquals("Anita Desai", result?.counterparty)
    }

    @Test
    fun doesNotUseGenericTitleAsName() {
        assertNull(UpiMessageParser.parse("Google Pay", "₹100 received", null, null)?.counterparty)
    }

    // ------------------------------------------------------------ reference

    @Test
    fun extractsReferenceWithDigits() {
        assertEquals("412345678901", parse("Paid ₹10 to Tea Stall. UPI Ref No 412345678901")?.reference)
        assertEquals("T2410121234", parse("₹10 paid to X. Transaction ID: T2410121234")?.reference)
    }

    @Test
    fun doesNotTreatWordsAsReference() {
        // "Transaction successful" used to produce reference "successful",
        // which made later payments of the same amount look like duplicates.
        assertNull(parse("Transaction successful. ₹100 paid to Chai Point")?.reference)
    }

    // ------------------------------------------------------------ rejections

    @Test
    fun rejectsNonPayments() {
        assertNull(parse("Payment of ₹500 to Ravi failed"))
        assertNull(parse("₹200 payment to Swiggy is pending"))
        assertNull(parse("Amit requested ₹300 from you"))
        assertNull(parse("Get ₹100 cashback on your next payment"))
        assertNull(parse("Your electricity bill of ₹1,240 is due"))
        assertNull(parse("Hi! How are you doing?"))
        assertNull(parse("You paid to Swiggy"))
    }

    @Test
    fun combinesTitleAndBigText() {
        val result = UpiMessageParser.parse(
            "Payment successful",
            "₹349 paid to Netflix",
            "₹349 paid to Netflix. UPI transaction ID 987654321012",
            null
        )
        assertNotNull(result)
        assertEquals(34900L, result!!.amountPaise)
        assertEquals("Netflix", result.counterparty)
        assertEquals("987654321012", result.reference)
    }

    // ------------------------------------------------------------ bank SMS formats (user samples)

    @Test
    fun parsesICICIDualPartyDebit() {
        // "ICICI Bank Acct XX172 debited for Rs 625.00 on 08-Nov-26; TAMILAGA UNAVU credited. UPI:006743575869."
        val result = parse(
            "ICICI Bank Acct XX172 debited for Rs 625.00 on 08-Nov-26; TAMILAGA UNAVU credited. UPI:006743575869. Call 18002662 for dispute."
        )
        assertNotNull(result)
        assertEquals(Direction.DEBIT, result?.direction)
        assertEquals(62500L, result!!.amountPaise)
        assertEquals("TAMILAGA UNAVU", result.counterparty)
    }

    @Test
    fun parsesICICIDualPartyDebitWithFullName() {
        // "ICICI Bank Acct XX172 debited for Rs 1695.00 on 07-Nov-26; VENKATESH A M credited."
        val result = parse(
            "ICICI Bank Acct XX172 debited for Rs 1695.00 on 07-Nov-26; VENKATESH A M credited. UPI:006723958737."
        )
        assertNotNull(result)
        assertEquals(Direction.DEBIT, result?.direction)
        assertEquals(169500L, result!!.amountPaise)
        assertEquals("VENKATESH A M", result.counterparty)
    }

    @Test
    fun parsesICICIDualPartyDebitShopName() {
        // "ICICI Bank Acct XX172 debited for Rs 368.00 on 04-Nov-26; Pothys Madurai credited."
        val result = parse(
            "ICICI Bank Acct XX172 debited for Rs 368.00 on 04-Nov-26; Pothys Madurai credited. UPI:006591114305."
        )
        assertNotNull(result)
        assertEquals(Direction.DEBIT, result?.direction)
        assertEquals(36800L, result!!.amountPaise)
        assertEquals("Pothys Madurai", result.counterparty)
    }

    @Test
    fun parsesICICICreditFromMr() {
        // "Dear Customer, Acct XX172 is credited with Rs 30.00 on 03-Apr-26 from Mr Arnav Astu. UPI:645934930351."
        val result = parse(
            "Dear Customer, Acct XX172 is credited with Rs 30.00 on 03-Apr-26 from Mr Arnav Astu. UPI:645934930351."
        )
        assertNotNull(result)
        assertEquals(Direction.CREDIT, result?.direction)
        assertEquals(3000L, result!!.amountPaise)
        // From_PARTY matches "from Mr Arnav Astu" — honorific "Mr" should be stripped
        assertNotNull(result.counterparty)
    }

    @Test
    fun parsesICICICreditFromMrWithAnotherName() {
        // "Dear Customer, Acct XX172 is credited with Rs 184.00 on 21-Feb-26 from Mr P N Megaraja. UPI:605208731014."
        val result = parse(
            "Dear Customer, Acct XX172 is credited with Rs 184.00 on 21-Feb-26 from Mr P N Megaraja. UPI:605208731014."
        )
        assertNotNull(result)
        assertEquals(Direction.CREDIT, result?.direction)
        assertEquals(18400L, result!!.amountPaise)
        assertNotNull(result.counterparty)
    }
}

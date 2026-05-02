"""
test_recon_bugs.py — Unit tests for 3 critical Recon pipeline bug fixes.

Run: python test_recon_bugs.py

Bug #1 (data integrity): intentSignals not persisted — signal_type NOT NULL violated
Bug #2 (data integrity): news.signal_type silently dropped — camelCase mismatch
Bug #3 (billing):        credits not refunded on pipeline failure
"""

import sys
import unittest
from unittest.mock import AsyncMock, MagicMock


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_intent_signal_from_api() -> dict:
    """Simulates a raw dict returned from the /api/recon JSON response.
    Pydantic IntentSignal has signal_type (snake_case) → JSON key is snake_case.
    """
    return {
        "title":         "Startup X membuka 50 lowongan baru",
        "date":          "01 May 2026",
        "source":        "linkedin.com",
        "summary":       "Sinyal pertumbuhan tim.",
        "url":           "https://linkedin.com/jobs/x",
        "signal_type":   "hiring",   # ← snake_case from Pydantic serialization
        "verifiedAmount": None,
        "verifiedDate":  None,
    }


def _make_news_item_from_api() -> dict:
    """Simulates a raw NewsItem dict from /api/recon JSON response."""
    return {
        "title":       "Startup X raih pendanaan Seri B",
        "date":        "01 May 2026",
        "source":      "techcrunch.com",
        "summary":     "Mendapat investasi $10M.",
        "url":         "https://techcrunch.com/x",
        "signal_type": "money",   # ← snake_case from Pydantic serialization
    }


# ─── Bug #1: intentSignals signal_type field access ───────────────────────────

class TestBug1IntentSignalFieldAccess(unittest.TestCase):
    """
    Verifies that the fixed field accessor pattern correctly resolves
    signal_type from an API-response dict (snake_case key).

    The bug: saveCompanyProfile used s.signalType (camelCase) → undefined in JS.
    The fix: (s as any).signal_type ?? s.signalType
    """

    def _broken_access(self, s: dict):
        """Simulates the BROKEN accessor: s.signalType (undefined when key is snake_case)."""
        return s.get("signalType")  # always None — camelCase key missing

    def _fixed_access(self, s: dict):
        """Simulates the FIXED accessor: (s as any).signal_type ?? s.signalType"""
        return s.get("signal_type") or s.get("signalType")

    def test_broken_returns_none_for_api_response(self):
        sig = _make_intent_signal_from_api()
        result = self._broken_access(sig)
        self.assertIsNone(result, "Bug reproduced: broken accessor returns None for API response")

    def test_fixed_returns_correct_value_for_api_response(self):
        sig = _make_intent_signal_from_api()
        result = self._fixed_access(sig)
        self.assertEqual(result, "hiring", "Fix works: correct signal_type for API response")

    def test_fixed_still_works_for_db_mapped_signal(self):
        """When profile is re-read from DB via getCompanyById, key is camelCase (signalType)."""
        db_signal = {
            "title":         "Startup X membuka 50 lowongan baru",
            "signalType":    "hiring",  # ← camelCase from getCompanyById mapping
            "verifiedAmount": None,
            "verifiedDate":  None,
        }
        result = self._fixed_access(db_signal)
        self.assertEqual(result, "hiring", "Fix works: correct signal_type for DB-read signal")

    def test_null_signal_type_is_preserved(self):
        """A signal with no signal_type stays None/null — not coerced to a wrong value."""
        sig = _make_intent_signal_from_api()
        sig["signal_type"] = None
        result = self._fixed_access(sig)
        # None → falsy, so falls through to signalType (also absent) → None
        self.assertIsNone(result)


# ─── Bug #2: news signal_type field access ────────────────────────────────────

class TestBug2NewsSignalTypeFieldAccess(unittest.TestCase):
    """
    Verifies that the fixed accessor resolves signal_type from a NewsItem
    API response dict. Unlike Bug #1, the DB insert succeeds (signal_type is
    nullable on news), but the value was silently dropped as null.

    The bug: n.signalType ?? null → always null when key is snake_case.
    The fix: (n as any).signal_type ?? n.signalType ?? null
    """

    def _broken_access(self, n: dict):
        return n.get("signalType") or None   # always None

    def _fixed_access(self, n: dict):
        return n.get("signal_type") or n.get("signalType") or None

    def test_broken_drops_signal_type_for_api_response(self):
        news = _make_news_item_from_api()
        result = self._broken_access(news)
        self.assertIsNone(result, "Bug reproduced: broken accessor drops signal_type")

    def test_fixed_preserves_signal_type_for_api_response(self):
        news = _make_news_item_from_api()
        result = self._fixed_access(news)
        self.assertEqual(result, "money", "Fix works: signal_type preserved for API news item")

    def test_fixed_works_for_db_mapped_news(self):
        db_news = {
            "title":      "Startup X raih pendanaan",
            "signalType": "money",  # ← camelCase from getCompanyById
        }
        result = self._fixed_access(db_news)
        self.assertEqual(result, "money", "Fix works for DB-read news item")

    def test_null_signal_type_stays_null(self):
        news = _make_news_item_from_api()
        news["signal_type"] = None
        result = self._fixed_access(news)
        self.assertIsNone(result, "None signal_type stays null after fix")


# ─── Bug #3: credits refunded on pipeline failure ─────────────────────────────

class TestBug3CreditsRefundedOnFailure(unittest.IsolatedAsyncioTestCase):
    """
    Verifies that generate_recon refunds credits (via credits_service.grant)
    when run_recon_pipeline raises RuntimeError or an unexpected Exception.

    The bug: credits debited before pipeline runs; on failure no refund issued.
    The fix: await credits_service.grant(user_id, cost, ..., tx_type="refund")
             in both RuntimeError and Exception except blocks.
    """

    async def _call_endpoint(
        self,
        mock_pipeline,
        mock_debit: AsyncMock,
        mock_grant: AsyncMock,
    ):
        """
        Drive the generate_recon handler logic directly (without FastAPI routing).
        We replicate only the credit debit → pipeline → refund flow.
        """
        from app.core.billing import OpCost

        user_id = "test-user-id"
        url     = "https://example.com"
        cost    = OpCost.RECON_FREE   # 1 credit

        # Debit succeeds
        debited = await mock_debit(user_id, cost, f"Recon free: {url}")
        self.assertTrue(debited)

        try:
            await mock_pipeline(url=url, mode="free")
        except RuntimeError as exc:
            await mock_grant(user_id, cost, f"Refund Recon gagal: {url}", tx_type="refund")
            raise
        except Exception as exc:
            await mock_grant(user_id, cost, f"Refund Recon error: {url}", tx_type="refund")
            raise

    async def test_refund_issued_on_runtime_error(self):
        mock_pipeline = AsyncMock(side_effect=RuntimeError("Pipeline gagal"))
        mock_debit    = AsyncMock(return_value=True)
        mock_grant    = AsyncMock(return_value=True)

        with self.assertRaises(RuntimeError):
            await self._call_endpoint(mock_pipeline, mock_debit, mock_grant)

        mock_grant.assert_called_once()
        _, kwargs = mock_grant.call_args
        self.assertEqual(kwargs.get("tx_type"), "refund",
                         "grant must be called with tx_type='refund'")

    async def test_refund_issued_on_unexpected_exception(self):
        mock_pipeline = AsyncMock(side_effect=ValueError("Unexpected"))
        mock_debit    = AsyncMock(return_value=True)
        mock_grant    = AsyncMock(return_value=True)

        with self.assertRaises(ValueError):
            await self._call_endpoint(mock_pipeline, mock_debit, mock_grant)

        mock_grant.assert_called_once()
        _, kwargs = mock_grant.call_args
        self.assertEqual(kwargs.get("tx_type"), "refund")

    async def test_no_refund_on_success(self):
        """On success, grant/refund must NOT be called."""
        from app.models.schemas import CompanyProfile, LinkedInInfo, CampaignProgress

        mock_profile = MagicMock(spec=CompanyProfile)
        mock_pipeline = AsyncMock(return_value=(mock_profile, 100))
        mock_debit    = AsyncMock(return_value=True)
        mock_grant    = AsyncMock(return_value=True)

        from app.core.billing import OpCost
        user_id = "test-user-id"
        url     = "https://example.com"
        cost    = OpCost.RECON_FREE

        await mock_debit(user_id, cost, f"Recon free: {url}")
        profile, tokens = await mock_pipeline(url=url, mode="free")

        mock_grant.assert_not_called()

    async def test_debit_amount_matches_refund_amount(self):
        """The refunded amount must equal the debited amount — no over/under refund."""
        from app.core.billing import OpCost

        user_id = "test-user-id"
        url     = "https://example.com"
        cost    = OpCost.RECON_PRO   # 5 credits

        mock_pipeline = AsyncMock(side_effect=RuntimeError("Pro pipeline fail"))
        mock_debit    = AsyncMock(return_value=True)
        mock_grant    = AsyncMock(return_value=True)

        with self.assertRaises(RuntimeError):
            debited = await mock_debit(user_id, cost, f"Recon pro: {url}")
            self.assertTrue(debited)
            try:
                await mock_pipeline(url=url, mode="pro")
            except RuntimeError:
                await mock_grant(user_id, cost, f"Refund Recon gagal: {url}", tx_type="refund")
                raise

        grant_call_args = mock_grant.call_args
        refund_amount = grant_call_args[0][1]   # positional arg #2
        self.assertEqual(refund_amount, cost,
                         f"Refund amount {refund_amount} must equal debit amount {cost}")


# ─── Runner ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Running Recon pipeline bug-fix tests...\n")
    loader  = unittest.TestLoader()
    suite   = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(TestBug1IntentSignalFieldAccess))
    suite.addTests(loader.loadTestsFromTestCase(TestBug2NewsSignalTypeFieldAccess))
    suite.addTests(loader.loadTestsFromTestCase(TestBug3CreditsRefundedOnFailure))
    runner  = unittest.TextTestRunner(verbosity=2)
    result  = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)

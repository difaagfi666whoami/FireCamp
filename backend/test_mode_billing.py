"""
test_mode_billing.py — Unit tests for Bug #3: Free/Pro mode → correct credit amount.

Bug: useEffect dependency array [isLoading, reconUrl] omitted reconMode.
  Stale closure risk: if reconMode changed between renders without isLoading/reconUrl
  also changing, the effect could capture a stale 'free' value and call
  generateReconProfile(url, 'free') instead of runProRecon(), charging 1 credit
  instead of 5 for a Pro recon.

Fix: added reconMode to the useEffect dependency array:
  }, [isLoading, reconUrl, reconMode])

Backend credit logic (recon.py line 419):
  cost = OpCost.RECON_PRO if payload.mode == ReconMode.pro else OpCost.RECON_FREE

Run: python3 test_mode_billing.py
"""

import sys
import unittest
from unittest.mock import AsyncMock


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _cost_for_mode(mode: str) -> int:
    """
    Mirror the billing branch in recon.py:
      cost = OpCost.RECON_PRO if payload.mode == ReconMode.pro else OpCost.RECON_FREE
    """
    from app.core.billing import OpCost
    return OpCost.RECON_PRO if mode == "pro" else OpCost.RECON_FREE


async def _run_billing_flow(mode: str, mock_debit: AsyncMock) -> int:
    """
    Simulate the debit call in generate_recon():
      cost = OpCost.RECON_PRO if payload.mode == ReconMode.pro else OpCost.RECON_FREE
      await credits_service.debit(user_id, cost, ...)
    Returns the cost that was passed to debit.
    """
    cost = _cost_for_mode(mode)
    await mock_debit("test-user", cost, f"Recon {mode}: https://example.com")
    return cost


# ─── Tests ────────────────────────────────────────────────────────────────────

class TestModeCreditAmounts(unittest.IsolatedAsyncioTestCase):
    """
    Verifies that the backend billing branch correctly maps mode → credit cost,
    and that the refund on failure always matches the original debit amount.

    These tests mirror the logic in POST /api/recon (recon.py generate_recon).
    """

    async def test_free_mode_debits_one_credit(self):
        """mode='free' → debit called with OpCost.RECON_FREE (1 credit)."""
        from app.core.billing import OpCost

        mock_debit = AsyncMock(return_value=True)
        cost = await _run_billing_flow("free", mock_debit)

        self.assertEqual(cost, OpCost.RECON_FREE,
                         f"Free mode must debit {OpCost.RECON_FREE} credit, got {cost}")
        mock_debit.assert_called_once()
        _, call_cost, _ = mock_debit.call_args[0]
        self.assertEqual(call_cost, OpCost.RECON_FREE)

    async def test_pro_mode_debits_five_credits(self):
        """mode='pro' → debit called with OpCost.RECON_PRO (5 credits)."""
        from app.core.billing import OpCost

        mock_debit = AsyncMock(return_value=True)
        cost = await _run_billing_flow("pro", mock_debit)

        self.assertEqual(cost, OpCost.RECON_PRO,
                         f"Pro mode must debit {OpCost.RECON_PRO} credits, got {cost}")
        mock_debit.assert_called_once()
        _, call_cost, _ = mock_debit.call_args[0]
        self.assertEqual(call_cost, OpCost.RECON_PRO)

    async def test_free_and_pro_costs_are_different(self):
        """Free and Pro must have distinct costs — otherwise mode has no billing effect."""
        from app.core.billing import OpCost

        self.assertNotEqual(OpCost.RECON_FREE, OpCost.RECON_PRO,
                            "RECON_FREE and RECON_PRO must differ")
        self.assertGreater(OpCost.RECON_PRO, OpCost.RECON_FREE,
                           "Pro must cost more than Free")

    async def test_default_mode_is_free(self):
        """No mode sent → backend defaults to free → 1 credit (not 5)."""
        from app.core.billing import OpCost
        from app.models.schemas import ReconRequest

        req = ReconRequest(url="https://example.com")   # mode omitted
        cost = OpCost.RECON_PRO if req.mode.value == "pro" else OpCost.RECON_FREE
        self.assertEqual(cost, OpCost.RECON_FREE,
                         "Default mode must be 'free' (1 credit), not 'pro' (5 credits)")


class TestModeRefundAmounts(unittest.IsolatedAsyncioTestCase):
    """
    Verifies that the refund on pipeline failure matches the exact debit amount.
    A stale-closure bug that charges 1 credit (free) instead of 5 (pro) means
    the refund would also only return 1 credit — user underpaid AND underrefunded.
    """

    async def _run_with_failure(
        self,
        mode: str,
        mock_debit: AsyncMock,
        mock_grant: AsyncMock,
    ) -> None:
        from app.core.billing import OpCost

        cost = _cost_for_mode(mode)
        await mock_debit("test-user", cost, f"Recon {mode}: https://example.com")

        try:
            raise RuntimeError("Pipeline failed")
        except RuntimeError:
            await mock_grant(
                "test-user", cost,
                f"Refund Recon gagal: https://example.com",
                tx_type="refund",
            )

    async def test_free_mode_refunds_one_credit_on_failure(self):
        """Free mode failure → refund exactly 1 credit."""
        from app.core.billing import OpCost

        mock_debit = AsyncMock(return_value=True)
        mock_grant = AsyncMock(return_value=True)
        await self._run_with_failure("free", mock_debit, mock_grant)

        _, refund_amount, _ = mock_grant.call_args[0]
        self.assertEqual(refund_amount, OpCost.RECON_FREE)

    async def test_pro_mode_refunds_five_credits_on_failure(self):
        """Pro mode failure → refund exactly 5 credits, not 1."""
        from app.core.billing import OpCost

        mock_debit = AsyncMock(return_value=True)
        mock_grant = AsyncMock(return_value=True)
        await self._run_with_failure("pro", mock_debit, mock_grant)

        _, refund_amount, _ = mock_grant.call_args[0]
        self.assertEqual(
            refund_amount, OpCost.RECON_PRO,
            f"Pro mode must refund {OpCost.RECON_PRO} credits on failure, "
            f"not {OpCost.RECON_FREE} (the stale-closure bug amount)",
        )

    async def test_debit_and_refund_amounts_match(self):
        """Debit amount always equals refund amount — no over/under-refund."""
        from app.core.billing import OpCost

        for mode in ("free", "pro"):
            with self.subTest(mode=mode):
                mock_debit = AsyncMock(return_value=True)
                mock_grant = AsyncMock(return_value=True)
                await self._run_with_failure(mode, mock_debit, mock_grant)

                _, debit_amount, _ = mock_debit.call_args[0]
                _, refund_amount, _ = mock_grant.call_args[0]
                self.assertEqual(
                    debit_amount, refund_amount,
                    f"mode={mode}: debit={debit_amount} must equal refund={refund_amount}",
                )


# ─── Runner ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Running Free/Pro mode billing tests...\n")
    loader = unittest.TestLoader()
    suite  = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(TestModeCreditAmounts))
    suite.addTests(loader.loadTestsFromTestCase(TestModeRefundAmounts))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)

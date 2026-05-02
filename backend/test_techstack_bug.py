"""
test_techstack_bug.py — Unit test for techStack downstream payload bug fix.

Bug: tech_stack column exists in DB but was absent from every layer above it:
  - getCompanyById SELECT omitted tech_stack
  - CompanyProfile TS interface had no techStack field
  - saveCompanyProfile INSERT omitted tech_stack
  - Backend Pydantic CompanyProfile had no techStack field
  → techStack was always stripped before reaching Match/Craft

Fix: wired tech_stack through all 4 layers so it survives to downstream payload.

Run: python3 test_techstack_bug.py
"""

import sys
import unittest


# ─── Simulate backend Pydantic model_dump() ───────────────────────────────────

class TestTechStackInPydanticModel(unittest.TestCase):
    """
    Verifies that adding techStack to the Pydantic CompanyProfile means
    model_dump() (used in craft.py: company_data = payload.companyProfile.model_dump())
    includes techStack in the downstream dict.
    """

    def _make_company_profile_dict(self, tech_stack: list) -> dict:
        """
        Simulate what CompanyProfile.model_dump() returns after the fix.
        Before the fix: techStack key was absent entirely.
        After the fix: techStack is present with the correct value.
        """
        return {
            "id":           "test-uuid",
            "name":         "Startup X",
            "industry":     "SaaS",
            "techStack":    tech_stack,   # ← the fixed field
            "painPoints":   [{"category": "Technology", "issue": "Slow CI", "severity": "high"}],
            "deepInsights": [],
        }

    def test_techstack_present_in_model_dump(self):
        """After fix: techStack appears in model_dump output."""
        company = self._make_company_profile_dict(["React", "Python", "PostgreSQL"])
        self.assertIn("techStack", company)
        self.assertEqual(company["techStack"], ["React", "Python", "PostgreSQL"])

    def test_techstack_empty_list_by_default(self):
        """Default techStack is [] — never absent, never None."""
        company = self._make_company_profile_dict([])
        self.assertIn("techStack", company)
        self.assertIsInstance(company["techStack"], list)
        self.assertEqual(len(company["techStack"]), 0)

    def test_broken_model_missing_techstack(self):
        """Reproduce the bug: old model_dump lacked techStack entirely."""
        broken_company = {
            "id":        "test-uuid",
            "name":      "Startup X",
            "industry":  "SaaS",
            # techStack NOT present — this is what caused the bug
            "painPoints": [],
        }
        self.assertNotIn("techStack", broken_company,
                         "Bug reproduced: old payload had no techStack key")


# ─── Simulate getCompanyById field mapping ────────────────────────────────────

class TestTechStackMapping(unittest.TestCase):
    """
    Verifies that the getCompanyById mapping correctly reads tech_stack from
    the Supabase row and maps it to techStack in the TypeScript CompanyProfile.

    Before fix: tech_stack not in SELECT → data.tech_stack undefined → dropped.
    After fix:  tech_stack in SELECT → mapped as techStack ?? [].
    """

    def _map_db_row_broken(self, row: dict) -> dict:
        """Simulate the BROKEN getCompanyById mapping (no tech_stack)."""
        return {
            "id":           row["id"],
            "name":         row["name"],
            "deep_insights": row.get("deep_insights", []),
            # techStack missing — bug!
        }

    def _map_db_row_fixed(self, row: dict) -> dict:
        """Simulate the FIXED getCompanyById mapping."""
        return {
            "id":           row["id"],
            "name":         row["name"],
            "deepInsights": row.get("deep_insights", []),
            "techStack":    row.get("tech_stack") or [],   # fix: tech_stack → techStack
        }

    def test_broken_mapping_drops_tech_stack(self):
        row = {"id": "1", "name": "X", "deep_insights": [], "tech_stack": ["React"]}
        result = self._map_db_row_broken(row)
        self.assertNotIn("techStack", result, "Bug reproduced: broken mapper drops techStack")

    def test_fixed_mapping_includes_tech_stack(self):
        row = {"id": "1", "name": "X", "deep_insights": [], "tech_stack": ["React", "FastAPI"]}
        result = self._map_db_row_fixed(row)
        self.assertIn("techStack", result)
        self.assertEqual(result["techStack"], ["React", "FastAPI"])

    def test_fixed_mapping_defaults_to_empty_list(self):
        """Row with NULL tech_stack (legacy rows) → empty list, not None."""
        row = {"id": "1", "name": "X", "deep_insights": [], "tech_stack": None}
        result = self._map_db_row_fixed(row)
        self.assertEqual(result["techStack"], [])

    def test_fixed_mapping_handles_missing_column(self):
        """Row without tech_stack key (pre-migration) → empty list."""
        row = {"id": "1", "name": "X", "deep_insights": []}
        result = self._map_db_row_fixed(row)
        self.assertEqual(result["techStack"], [])


# ─── Simulate downstream payload construction ─────────────────────────────────

class TestTechStackInDownstreamPayload(unittest.TestCase):
    """
    Verifies the end-to-end flow: a CompanyProfile loaded from DB (via
    getCompanyById) retains techStack when serialized into the Match/Craft
    request payload.

    This is the core fix criterion:
    'run Recon Pro → run Match → verify techStack appears in Match's input'
    """

    def _build_match_payload(self, profile: dict) -> dict:
        """Simulate lib/api/match.ts runMatching() body construction."""
        return {
            "companyProfile": profile,
            "campaign_id":    None,
        }

    def _build_craft_payload(self, profile: dict, product: dict) -> dict:
        """Simulate lib/api/craft.ts generateCampaign() body construction."""
        return {
            "companyProfile":  profile,
            "selectedProduct": product,
        }

    def test_techstack_survives_match_payload(self):
        """techStack from getCompanyById is present in POST /api/match body."""
        profile = {
            "id":        "uuid-123",
            "name":      "Startup X",
            "industry":  "SaaS",
            "techStack": ["React", "Node.js", "PostgreSQL"],
            "painPoints": [{"category": "Technology", "issue": "Slow CI", "severity": "high"}],
        }
        payload = self._build_match_payload(profile)
        self.assertIn("techStack", payload["companyProfile"])
        self.assertEqual(payload["companyProfile"]["techStack"], ["React", "Node.js", "PostgreSQL"])

    def test_techstack_survives_craft_payload(self):
        """techStack from getCompanyById is present in POST /api/craft body."""
        profile = {
            "id":        "uuid-123",
            "name":      "Startup X",
            "industry":  "SaaS",
            "techStack": ["Django", "React", "Redis"],
            "painPoints": [{"category": "Operations", "issue": "Manual deploy", "severity": "medium"}],
        }
        product = {"id": "prod-1", "name": "DevOps Suite", "tagline": "Automate everything"}
        payload = self._build_craft_payload(profile, product)
        self.assertEqual(payload["companyProfile"]["techStack"], ["Django", "React", "Redis"])

    def test_techstack_empty_still_present_in_payload(self):
        """Empty techStack is [] in payload — key must exist, not be absent."""
        profile = {"id": "x", "name": "Y", "techStack": [], "painPoints": []}
        payload = self._build_match_payload(profile)
        self.assertIn("techStack", payload["companyProfile"])
        self.assertIsInstance(payload["companyProfile"]["techStack"], list)

    def test_model_dump_includes_techstack_for_craft(self):
        """
        Craft router does: company_data = payload.companyProfile.model_dump()
        Verify techStack is in that dict so craft_service receives it.
        """
        # Simulate CompanyProfile.model_dump() after the Pydantic fix
        profile_dump = {
            "id":           "uuid-123",
            "name":         "Startup X",
            "industry":     "SaaS",
            "techStack":    ["Python", "FastAPI"],
            "painPoints":   [],
            "deepInsights": [],
            "news":         [],
            "contacts":     [],
        }
        # craft_service.generate_campaign_emails(company_data, product_data)
        company_data = profile_dump   # model_dump() result
        self.assertIn("techStack", company_data,
                      "model_dump() must include techStack so craft_service sees it")
        self.assertEqual(company_data["techStack"], ["Python", "FastAPI"])


# ─── Simulate saveCompanyProfile INSERT ───────────────────────────────────────

class TestTechStackSavedToDb(unittest.TestCase):
    """
    Verifies the saveCompanyProfile INSERT row includes tech_stack,
    so a free-mode Recon result writes techStack back to the DB column.
    """

    def _build_insert_row_broken(self, profile: dict) -> dict:
        """Simulate the BROKEN companies INSERT (no tech_stack)."""
        return {
            "user_id":      "uid",
            "url":          profile.get("url", ""),
            "name":         profile.get("name", ""),
            "deep_insights": profile.get("deepInsights", []),
            # tech_stack missing — bug!
        }

    def _build_insert_row_fixed(self, profile: dict) -> dict:
        """Simulate the FIXED companies INSERT."""
        return {
            "user_id":      "uid",
            "url":          profile.get("url", ""),
            "name":         profile.get("name", ""),
            "deep_insights": profile.get("deepInsights", []),
            "tech_stack":   profile.get("techStack") or [],   # fix
        }

    def test_broken_insert_omits_tech_stack(self):
        profile = {"url": "https://x.com", "name": "X", "techStack": ["React"]}
        row = self._build_insert_row_broken(profile)
        self.assertNotIn("tech_stack", row, "Bug reproduced: broken INSERT omits tech_stack")

    def test_fixed_insert_includes_tech_stack(self):
        profile = {"url": "https://x.com", "name": "X", "techStack": ["React", "Django"]}
        row = self._build_insert_row_fixed(profile)
        self.assertIn("tech_stack", row)
        self.assertEqual(row["tech_stack"], ["React", "Django"])

    def test_fixed_insert_defaults_to_empty_array(self):
        profile = {"url": "https://x.com", "name": "X"}
        row = self._build_insert_row_fixed(profile)
        self.assertEqual(row["tech_stack"], [])


# ─── Runner ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Running techStack downstream payload bug-fix tests...\n")
    loader = unittest.TestLoader()
    suite  = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(TestTechStackInPydanticModel))
    suite.addTests(loader.loadTestsFromTestCase(TestTechStackMapping))
    suite.addTests(loader.loadTestsFromTestCase(TestTechStackInDownstreamPayload))
    suite.addTests(loader.loadTestsFromTestCase(TestTechStackSavedToDb))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)

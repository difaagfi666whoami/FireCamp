#!/usr/bin/env node
/**
 * Campfire Pricing Calculator
 * Usage: node calculator.js
 *
 * Inputs actual token counts from OpenAI dashboard and outputs:
 * - Recommended price per credit
 * - Recommended pack pricing
 * - Break-even analysis (minimum users to cover paid API fixed costs)
 */

const readline = require('readline');

// ─── Current pack definitions ──────────────────────────────────────────────
const PACKS = [
  { id: 'starter', name: 'Starter',  credits: 50,  price_idr: 100_000 },
  { id: 'growth',  name: 'Growth',   credits: 200, price_idr: 350_000 },
  { id: 'scale',   name: 'Scale',    credits: 500, price_idr: 750_000 },
];

// ─── Current credit costs per stage ────────────────────────────────────────
const CREDIT_COSTS = {
  recon_free: 1,
  recon_pro:  5,
  match:      1,
  craft:      2,
  polish:     1,
};

// ─── API pricing (May 2025) ─────────────────────────────────────────────────
const API_RATES = {
  gpt4o_input_per_1m:      2.50,
  gpt4o_output_per_1m:    10.00,
  gpt4o_mini_input_per_1m: 0.15,
  gpt4o_mini_output_per_1m: 0.60,
  serper_per_search:        0.02,
  tavily_per_search:        0.01,
  hunter_per_call:          0.049,
  usd_to_idr:           16_000,
};

// ─── Fixed monthly API plan costs (paid tiers) ──────────────────────────────
const FIXED_MONTHLY = {
  serper_2500:  50,   // USD/month for 2,500 Serper searches
  tavily_basic: 20,   // USD/month for Tavily Basic (~10,000 searches) [NEEDS VERIFICATION]
  hunter_basic: 49,   // USD/month for Hunter Basic (1,000 verifications)
};

// ─── Default token estimates (from static code analysis) ────────────────────
const DEFAULTS = {
  recon_free: {
    mini_in: 9_300,  mini_out: 4_950,
    gpt4o_in: 12_267, gpt4o_out: 3_000,
    serper: 15, tavily: 5, hunter: 3,
  },
  recon_pro: {
    mini_in: 11_300, mini_out: 5_450,
    gpt4o_in: 15_000, gpt4o_out: 4_000,
    serper: 20, tavily: 7, hunter: 4,
  },
  match: {
    mini_in: 0, mini_out: 0,
    gpt4o_in: 950, gpt4o_out: 800,
    serper: 0, tavily: 0, hunter: 0,
  },
  craft: {
    mini_in: 0, mini_out: 0,
    gpt4o_in: 1_600, gpt4o_out: 2_000,
    serper: 0, tavily: 0, hunter: 0,
  },
  polish: {
    mini_in: 0, mini_out: 0,
    gpt4o_in: 300, gpt4o_out: 600,
    serper: 0, tavily: 0, hunter: 0,
  },
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

function calcStageCostUSD(stage) {
  const r = API_RATES;
  const d = stage;
  const llm_mini = (d.mini_in / 1e6) * r.gpt4o_mini_input_per_1m
                 + (d.mini_out / 1e6) * r.gpt4o_mini_output_per_1m;
  const llm_4o   = (d.gpt4o_in / 1e6) * r.gpt4o_input_per_1m
                 + (d.gpt4o_out / 1e6) * r.gpt4o_output_per_1m;
  const serper   = d.serper  * r.serper_per_search;
  const tavily   = d.tavily  * r.tavily_per_search;
  const hunter   = d.hunter  * r.hunter_per_call;
  return { llm_mini, llm_4o, serper, tavily, hunter, total: llm_mini + llm_4o + serper + tavily + hunter };
}

function toIDR(usd) {
  return Math.round(usd * API_RATES.usd_to_idr);
}

function fmt(idr) {
  return `Rp ${idr.toLocaleString('id-ID')}`;
}

function printTable(stages, creditPerIDR) {
  const cols = ['Stage', 'Credits', 'Cost (IDR)', 'Revenue (IDR)', 'Margin (IDR)', 'Margin %', 'Status'];
  const rows = Object.entries(stages).map(([key, tokens]) => {
    const cost = calcStageCostUSD(tokens);
    const costIDR = toIDR(cost.total);
    const credits = CREDIT_COSTS[key];
    const revenueIDR = Math.round(credits * creditPerIDR);
    const marginIDR = revenueIDR - costIDR;
    const marginPct = ((marginIDR / revenueIDR) * 100).toFixed(1);
    const status = marginPct >= 40 ? '🟢 Healthy' : marginPct >= 10 ? '🟡 Thin' : '🔴 Negative';
    return [key.replace('_', ' '), credits, fmt(costIDR), fmt(revenueIDR), fmt(marginIDR), `${marginPct}%`, status];
  });

  const widths = cols.map((c, i) => Math.max(c.length, ...rows.map(r => String(r[i]).length)));
  const line = widths.map(w => '-'.repeat(w + 2)).join('+');
  console.log('\n' + line);
  console.log(cols.map((c, i) => ` ${c.padEnd(widths[i])} `).join('|'));
  console.log(line);
  rows.forEach(r => console.log(r.map((c, i) => ` ${String(c).padEnd(widths[i])} `).join('|')));
  console.log(line);
}

async function getTokenInputs() {
  console.log('\n── Token Count Input ─────────────────────────────────────────');
  console.log('Press Enter to use estimated defaults from cost-analysis.md\n');

  const stages = JSON.parse(JSON.stringify(DEFAULTS));
  for (const [key, def] of Object.entries(stages)) {
    const label = key.replace('_', ' ').toUpperCase();
    process.stdout.write(`${label} — GPT-4o input tokens [${def.gpt4o_in}]: `);
    const val = await new Promise(r => rl.once('line', r));
    if (val.trim()) def.gpt4o_in = parseInt(val.trim(), 10);

    process.stdout.write(`${label} — GPT-4o output tokens [${def.gpt4o_out}]: `);
    const val2 = await new Promise(r => rl.once('line', r));
    if (val2.trim()) def.gpt4o_out = parseInt(val2.trim(), 10);

    if (def.serper > 0) {
      process.stdout.write(`${label} — Serper calls [${def.serper}]: `);
      const val3 = await new Promise(r => rl.once('line', r));
      if (val3.trim()) def.serper = parseInt(val3.trim(), 10);
    }
  }
  return stages;
}

function recommendPricing(stages, targetMarginPct) {
  const target = targetMarginPct / 100;
  console.log(`\n── Recommended Pricing at ${targetMarginPct}% Target Margin ──────────`);

  let maxCreditPriceIDR = Infinity;
  for (const [key, tokens] of Object.entries(stages)) {
    const cost = calcStageCostUSD(tokens);
    const costIDR = toIDR(cost.total);
    const credits = CREDIT_COSTS[key];
    // revenue = credits × pricePerCredit
    // margin = (revenue - cost) / revenue >= target
    // price >= costIDR / (credits × (1 - target))
    const minPricePerCredit = costIDR / (credits * (1 - target));
    console.log(`  ${key.padEnd(12)}: min Rp ${Math.ceil(minPricePerCredit).toLocaleString('id-ID')}/credit to hit ${targetMarginPct}% margin`);
    maxCreditPriceIDR = Math.min(maxCreditPriceIDR, Infinity); // binding = highest minimum
  }

  // Find binding constraint (stage that needs highest price/credit)
  const bindingStage = Object.entries(stages).reduce((prev, [key, tokens]) => {
    const cost = toIDR(calcStageCostUSD(tokens).total);
    const credits = CREDIT_COSTS[key];
    const minPrice = cost / (credits * (1 - target));
    return minPrice > prev.price ? { key, price: minPrice } : prev;
  }, { key: '', price: 0 });

  const recommendedCreditPrice = Math.ceil(bindingStage.price / 100) * 100;
  console.log(`\n  Binding stage: ${bindingStage.key}`);
  console.log(`  Recommended price per credit: Rp ${recommendedCreditPrice.toLocaleString('id-ID')}`);

  console.log('\n  Recommended pack pricing:');
  PACKS.forEach(pack => {
    const newPrice = Math.ceil((pack.credits * recommendedCreditPrice) / 5000) * 5000;
    console.log(`    ${pack.name.padEnd(8)}: ${pack.credits} credits → Rp ${newPrice.toLocaleString('id-ID')} (was Rp ${pack.price_idr.toLocaleString('id-ID')})`);
  });
}

function breakEvenAnalysis() {
  console.log('\n── Break-Even Analysis (Fixed API Costs) ─────────────────────');
  const serperFixed = toIDR(FIXED_MONTHLY.serper_2500);
  const hunterFixed = toIDR(FIXED_MONTHLY.hunter_basic);
  const tavilyFixed = toIDR(FIXED_MONTHLY.tavily_basic);
  const totalFixed  = serperFixed + hunterFixed + tavilyFixed;

  console.log(`  Fixed monthly API costs (paid plans):`);
  console.log(`    Serper  ($50/mo  = 2,500 searches): ${fmt(serperFixed)}`);
  console.log(`    Hunter  ($49/mo  = 1,000 calls):    ${fmt(hunterFixed)}`);
  console.log(`    Tavily  ($20/mo  est.):              ${fmt(tavilyFixed)} [NEEDS VERIFICATION]`);
  console.log(`    Total fixed:                         ${fmt(totalFixed)}`);

  // Revenue per Recon Pro run at each pack tier
  PACKS.forEach(pack => {
    const creditPriceIDR = pack.price_idr / pack.credits;
    const reconProRevenue = CREDIT_COSTS.recon_pro * creditPriceIDR;
    const reconFreeCostIDR = toIDR(calcStageCostUSD(DEFAULTS.recon_free).total);
    const reconProMarginIDR = reconProRevenue - toIDR(calcStageCostUSD(DEFAULTS.recon_pro).total);
    const runsToBreakEven = Math.ceil(totalFixed / reconProMarginIDR);
    const usersAtWeeklyRecon = Math.ceil(runsToBreakEven / 4.33); // 1 run/week per user
    console.log(`\n  ${pack.name} (Rp ${Math.round(creditPriceIDR).toLocaleString('id-ID')}/credit):`);
    console.log(`    Recon Pro margin/run:  ${fmt(reconProMarginIDR)}`);
    console.log(`    Runs to break even:    ${runsToBreakEven} runs/month`);
    console.log(`    ≈ Users needed:        ${usersAtWeeklyRecon} users (each doing 1 Recon Pro/week)`);
  });
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          CAMPFIRE PRICING CALCULATOR  v1.0                  ║');
  console.log('║  Validate token estimates · Set margin targets · Break-even  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const modeInput = await ask('\nMode: (1) Use estimated defaults  (2) Enter actual token counts\nChoice [1]: ');
  const mode = modeInput.trim() === '2' ? 2 : 1;

  const stages = mode === 2 ? await getTokenInputs() : DEFAULTS;

  const apiInput = await ask('\nAPI tier: (1) Free tier only  (2) Paid APIs (Serper/Tavily/Hunter)\nChoice [1]: ');
  const usePaid = apiInput.trim() === '2';
  if (!usePaid) {
    console.log('  [Using free-tier APIs: Serper, Tavily, Hunter costs = Rp 0]');
    for (const s of Object.values(stages)) { s.serper = 0; s.tavily = 0; s.hunter = 0; }
  }

  const marginInput = await ask('\nTarget margin % (e.g. 40): ');
  const targetMargin = parseFloat(marginInput.trim()) || 40;

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('MARGIN ANALYSIS — CURRENT PRICING');
  console.log('══════════════════════════════════════════════════════════════');
  for (const pack of PACKS) {
    const creditPrice = pack.price_idr / pack.credits;
    console.log(`\n  Pack: ${pack.name} — Rp ${Math.round(creditPrice).toLocaleString('id-ID')}/credit`);
    printTable(stages, creditPrice);
  }

  recommendPricing(stages, targetMargin);
  breakEvenAnalysis();

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('NOTES');
  console.log('══════════════════════════════════════════════════════════════');
  console.log('  - All token counts are estimates from static code analysis.');
  console.log('  - Verify actuals in OpenAI dashboard after a real production run.');
  console.log('  - Tavily Research endpoint pricing is UNVERIFIED — marked with [!]');
  console.log('  - Hunter cost assumes ~3–4 calls/run; verify in Hunter dashboard.');
  console.log('  - Serper: 100 free/mo → exhausted in ~6 Recon Free runs.');
  console.log('  - See docs/financial/cost-analysis.md for full analysis.');

  rl.close();
}

main().catch(err => { console.error(err); rl.close(); process.exit(1); });

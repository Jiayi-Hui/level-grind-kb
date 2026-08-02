# Tiff Standard Templates Mapping

Date: 2026-08-02  
Context: Tiff said the monthly meeting tonight will briefly cover upcoming team arrangements and standardized templates. He tagged Jiayi to check whether Level Grind's knowledge base can add several new file types based on these materials, then use them for tracking and analysis.

## Candidate Knowledge Base Files

### 1. Investment Memo

Source template: `投资备忘录模板.docx`

Purpose: capture initiation, update, or rating-change logic as an ex-ante investment record.

Core fields:

- Stock name and ticker
- Memo type: initiation, update, rating change
- Business and industry overview
- Investment thesis
- Our case vs. consensus expectations
- Financial forecast and key estimate gaps
- Historical valuation, including forward P/E and P/B band interpretation
- Upcoming catalysts
- Upside, downside, catalyst, time window, invalidation condition

Tracking and analysis use:

- Link thesis points to measurable drivers: earnings, multiple, operating metric, or consensus gap.
- Preserve the original timestamped view before later results are known.
- Connect memo fields to later model changes, catalyst outcomes, price path, and idea backtest.

### 2. Meeting Notes

Source template: `会议纪要模板.docx`

Purpose: turn management meetings, earnings calls, expert calls, and site visits into structured research evidence.

Core fields:

- Stock name and ticker
- Meeting type
- Date, attendees, context
- Executive summary
- Key takeaway
- Change vs. previous view
- Potential expectation gap vs. consensus
- Discussion notes
- Q&A highlights
- Follow-ups and action items
- Conviction change

Tracking and analysis use:

- Separate facts, management or expert opinions, and analyst interpretation.
- Record what changed versus the prior thesis or estimates.
- Track whether follow-ups were completed and whether the meeting's signal later proved useful.
- Link meeting notes to existing company ideas, claims, catalysts, and backtest outcomes.

### 3. Coverage And Trade View

Source template: `美股TMT覆盖组合与交易观点 (2).xlsx`

Purpose: maintain the team coverage universe, sub-sector view, and active idea book.

Observed workbook structure:

- `Cover`: dashboard summary and data-as-of date
- `Coverage`: ticker-level coverage universe linked to raw data
- `Sub Sector View`: sub-sector aggregates, view, key drivers, top idea, risk or hedge
- `Idea Generation`: active long/short ideas, sizing, upside, downside, conviction, rationale, vs consensus
- `Raw Data`: market and consensus data source table

Core fields:

- Company, ticker, sub-sector, industry
- Market cap, liquidity, last price, consensus target price, street rating
- Sub-sector view, key drivers, top idea, risk or hedge
- Long/short direction, sizing, upside, downside, conviction
- Rationale and vs-consensus explanation
- Data as-of date and source

Tracking and analysis use:

- Track changes in active ideas, conviction, sizing, upside/downside, and rationale over time.
- Compare idea outcomes by sub-sector, analyst, direction, catalyst type, and consensus gap.
- Provide a structured upstream layer for later quant/event-study/backtest work.

## Product Implication For Level Grind

These templates should not become a static attachment archive. They should become standardized knowledge-base file types that preserve ex-ante research logic, PM validation, version history, and later outcomes.

Recommended first implementation order:

1. Add file type metadata for `Investment Memo`, `Meeting Notes`, and `Coverage And Trade View`.
2. Preserve the original source file and extract a structured summary layer.
3. Require company/ticker, source date, author or owner, and PM validation status.
4. Link extracted fields to existing company idea, claim, catalyst, upside/downside, and backtest entities.
5. Build the first tracking view around one complete idea chain: memo or meeting note -> validated idea -> evidence updates -> catalyst/price/model outcome -> backtest result.

Open questions for Tiff:

- Which templates are mandatory for the whole team, and which are optional?
- Should analysts upload drafts directly, or should Tiff validate and hand over files before they enter Level Grind?
- Does `Coverage And Trade View` belong at team level, sub-sector level, or analyst level?
- What is the first tracking question Tiff wants answered: idea hit rate, catalyst follow-through, conviction change accuracy, consensus-gap realization, or price reaction?
- What counts as an analysis result good enough for the first demo?

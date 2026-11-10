import { formatMoney } from './money';
import type { AskResult, Insights } from './types';

export interface AskAssistant {
  answer(question: string, insights: Insights): Promise<AskResult>;
}

function peakSummary(insights: Insights): string {
  const top = [...insights.peakHours].sort((a, b) => b.salesMinor - a.salesMinor).slice(0, 3);
  if (!top.length || top[0].orders === 0) return 'There is not enough sales activity to identify peak hours.';
  const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;
  return `Peak hours are ${top.map((b) => `${fmt(b.hour)} (${b.orders} orders, ${formatMoney(b.salesMinor)})`).join(', ')}.`;
}

function locationBlurb(insights: Insights): string[] {
  return [...insights.byLocation]
    .sort((a, b) => b.netSalesMinor - a.netSalesMinor)
    .map(
      (l) =>
        `${l.locationName} (${l.brandName}, ${l.city}): ${formatMoney(l.netSalesMinor)} · ${l.orderCount} orders · avg ticket ${formatMoney(l.avgTicketMinor)} · labor ${l.laborCostPct}%`,
    );
}

export class RuleBasedAskAssistant implements AskAssistant {
  async answer(question: string, insights: Insights): Promise<AskResult> {
    const q = question.trim();
    const lower = q.toLowerCase();
    const loc = insights.byLocation.find((l) => lower.includes(l.locationName.toLowerCase()) || lower.includes(l.city.toLowerCase()));
    const scoped = loc ?? null;
    const t = scoped ?? insights.totals;
    const where = scoped ? ` at ${scoped.locationName}` : ' across the selected locations';

    if (!q) {
      return {
        question: q,
        engine: 'rules',
        answer: 'Ask about sales, labor cost, peak hours, a specific location, or anomalies. All figures come from the canonical model, not a language model.',
        bullets: [],
      };
    }

    if (/(anomal|alert|issue|risk|flag|wrong)/.test(lower)) {
      const rows = scoped ? insights.anomalies.filter((a) => a.locationId === scoped.locationId) : insights.anomalies;
      if (!rows.length) {
        return { question: q, engine: 'rules', answer: `No anomalies flagged${where} for this sample window.`, bullets: [] };
      }
      return {
        question: q,
        engine: 'rules',
        answer: `${rows.length} anomal${rows.length === 1 ? 'y' : 'ies'} flagged${where}.`,
        bullets: rows.slice(0, 6).map((a) => `${a.severity.toUpperCase()} — ${a.title}: ${a.detail}`),
      };
    }

    if (/(peak|busy|rush|hour)/.test(lower)) {
      return { question: q, engine: 'rules', answer: peakSummary(insights), bullets: [] };
    }

    if (/(labor|wage|staff|payroll|hour)/.test(lower) && /(cost|%|percent|ratio|too high|high)/.test(lower)) {
      const ranking = [...insights.byLocation].sort((a, b) => b.laborCostPct - a.laborCostPct);
      return {
        question: q,
        engine: 'rules',
        answer: `Labor cost${where} is ${'laborCostPct' in t ? t.laborCostPct : insights.totals.laborCostPct}% of net sales (${formatMoney('laborCostMinor' in t ? t.laborCostMinor : insights.totals.laborCostMinor)} over ${('laborHours' in t ? t.laborHours : insights.totals.laborHours).toFixed(1)} hours).`,
        bullets: ranking.map((l) => `${l.locationName}: ${l.laborCostPct}% (${formatMoney(l.laborCostMinor)})`),
      };
    }

    if (/(compare|breakdown|by location|which location|best|worst)/.test(lower) || /location/.test(lower) && !scoped) {
      return {
        question: q,
        engine: 'rules',
        answer: `Location comparison for the sample window (${formatMoney(insights.totals.netSalesMinor)} net sales, labor ${insights.totals.laborCostPct}%).`,
        bullets: locationBlurb(insights),
      };
    }

    if (/(loyalty|member|points|redeem)/.test(lower)) {
      return {
        question: q,
        engine: 'rules',
        answer: `${insights.totals.loyaltyMembers} active sample members${where}: ${insights.totals.loyaltyEarn} points earned and ${insights.totals.loyaltyRedeem} redeemed.`,
        bullets: insights.byLocation.map((l) => `${l.locationName}: +${l.loyaltyEarn} / −${l.loyaltyRedeem}`),
      };
    }

    if (/(sale|revenue|ticket|cover|guest|order)/.test(lower) || scoped) {
      const k = scoped ?? insights.totals;
      return {
        question: q,
        engine: 'rules',
        answer: `Net sales${where} are ${formatMoney(k.netSalesMinor)} across ${k.orderCount} closed orders (avg ticket ${formatMoney(k.avgTicketMinor)}, ${k.covers} covers). ${k.voidedMinor ? `Voided volume: ${formatMoney(k.voidedMinor)}. ` : ''}Labor sits at ${k.laborCostPct}%.`,
        bullets: scoped ? [] : locationBlurb(insights),
      };
    }

    return {
      question: q,
      engine: 'rules',
      answer: `Here is a snapshot${where}: ${formatMoney(insights.totals.netSalesMinor)} net sales, ${insights.totals.orderCount} orders, labor ${insights.totals.laborCostPct}%, ${insights.anomalies.length} anomal${insights.anomalies.length === 1 ? 'y' : 'ies'}.`,
      bullets: [peakSummary(insights), ...locationBlurb(insights).slice(0, 3)],
    };
  }
}

export interface LlmOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

/**
 * Optional OpenAI-compatible adapter. The model only sees aggregated KPIs (no raw guest
 * names or connector secrets). Any failure falls back to the rule engine. Output is treated
 * as untrusted text — it never writes to the store.
 */
export class LlmAskAssistant implements AskAssistant {
  constructor(
    private readonly options: LlmOptions,
    private readonly fallback: AskAssistant = new RuleBasedAskAssistant(),
  ) {}

  async answer(question: string, insights: Insights): Promise<AskResult> {
    if (!this.options.apiKey) return this.fallback.answer(question, insights);
    try {
      const url = `${(this.options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '')}/chat/completions`;
      const context = {
        totals: insights.totals,
        byLocation: insights.byLocation,
        peakHours: insights.peakHours.filter((h) => h.orders > 0),
        anomalies: insights.anomalies,
        period: insights.period,
      };
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.options.model ?? 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                'You are an operations analyst for a multi-location restaurant group. Answer only from the provided KPI JSON. All names are fictional sample data. Be concise. Do not invent figures.',
            },
            { role: 'user', content: `KPIs: ${JSON.stringify(context)}\n\nQuestion: ${question}` },
          ],
        }),
      });
      if (!res.ok) throw new Error(`llm http ${res.status}`);
      const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = body.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error('empty llm response');
      return { question, answer: text, bullets: [], engine: 'llm' };
    } catch {
      const fallback = await this.fallback.answer(question, insights);
      return { ...fallback, engine: 'rules' };
    }
  }
}

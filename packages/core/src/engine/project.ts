import type { Plan, SavingsAccount } from "../model/schema";
import type { CalcResult } from "./calculate";

export type AccountProjection = {
  account: SavingsAccount;
  /** Monthly transfer into the account (active buckets + surplus if routed here). */
  monthly: number;
  /** Bucket ids that pay into this account. */
  bucketIds: string[];
  receivesSurplus: boolean;
  /** Balance at the end of each month; index 0 is today's balance. Length = months + 1. */
  series: number[];
  deposits: number;
  interest: number;
  end: number;
};

export type SavingsProjection = {
  months: number;
  accounts: AccountProjection[];
  /** Sum over all accounts per month (same length as each series). */
  total: number[];
  /** Monthly savings (buckets + surplus) that are not routed to any account. */
  unassigned: number;
};

/**
 * Projects every savings account `months` months ahead. Transfers come from the
 * current calculation (switches applied, inactive buckets count 0) and are booked
 * at the end of each month; interest is the annual rate compounded monthly.
 * The periodic reserve is not included: it is spent on the yearly payments.
 */
export function projectSavings(plan: Plan, result: CalcResult, months: number): SavingsProjection {
  const n = Math.max(0, Math.round(months));
  const accountIds = new Set(plan.accounts.map((a) => a.id));
  const surplusTo = plan.settings.surplusAccountId && accountIds.has(plan.settings.surplusAccountId) ? plan.settings.surplusAccountId : null;

  let unassigned = surplusTo ? 0 : result.surplus;
  for (const b of plan.savings) {
    if (!b.accountId || !accountIds.has(b.accountId)) unassigned += result.savings.items[b.id] ?? 0;
  }

  const accounts = plan.accounts.map((account): AccountProjection => {
    const bucketIds = plan.savings.filter((b) => b.accountId === account.id).map((b) => b.id);
    const receivesSurplus = surplusTo === account.id;
    const monthly = bucketIds.reduce((s, id) => s + (result.savings.items[id] ?? 0), 0) + (receivesSurplus ? result.surplus : 0);
    const r = account.rate / 100 / 12;
    const series = [account.balance];
    let bal = account.balance;
    for (let m = 0; m < n; m++) {
      bal = bal * (1 + r) + monthly;
      series.push(bal);
    }
    const deposits = monthly * n;
    return { account, monthly, bucketIds, receivesSurplus, series, deposits, interest: bal - account.balance - deposits, end: bal };
  });

  const total = Array.from({ length: n + 1 }, (_, m) => accounts.reduce((s, a) => s + a.series[m], 0));
  return { months: n, accounts, total, unassigned };
}

"use client";

import { FormEvent, useMemo, useState } from "react";
import { Calculator, X } from "lucide-react";
import { Account, NewTrade, Trade } from "@/lib/types";

type Props = {
  accounts: Account[];
  trade?: Trade | null;
  onClose: () => void;
  onSave: (trade: NewTrade) => void | Promise<void>;
};

const localDateTime = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export function TradeModal({ accounts, trade, onClose, onSave }: Props) {
  const [side, setSide] = useState<"Buy" | "Sell">(trade?.side || "Buy");
  const [entry, setEntry] = useState(String(trade?.entry ?? ""));
  const [exit, setExit] = useState(String(trade?.exit ?? ""));
  const [sl, setSl] = useState(String(trade?.sl ?? ""));
  const [tp, setTp] = useState(String(trade?.tp ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const riskReward = useMemo(() => {
    const entryValue = Number(entry);
    const stopValue = Number(sl);
    const targetValue = Number(tp);
    const risk = Math.abs(entryValue - stopValue);
    const reward = Math.abs(targetValue - entryValue);
    if (![entryValue, stopValue, targetValue].every(Number.isFinite) || risk <= 0) return null;
    return reward / risk;
  }, [entry, sl, tp]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const openedAt = String(data.get("openedAt"));
    const closedAt = String(data.get("closedAt"));
    const payload: NewTrade = {
      accountId: String(data.get("accountId")),
      symbol: String(data.get("symbol")).trim().toUpperCase(),
      side,
      lots: Number(data.get("lots")),
      entry: Number(data.get("entry")),
      exit: Number(data.get("exit")),
      sl: Number(data.get("sl")),
      tp: Number(data.get("tp")),
      pnl: Number(data.get("pnl")),
      openedAt,
      closedAt,
      setup: String(data.get("setup")).trim(),
      notes: String(data.get("notes") || "").trim(),
    };

    if (!payload.accountId || !payload.symbol || !payload.setup) {
      setError("Account, symbol and setup are required.");
      return;
    }
    if (![payload.lots, payload.entry, payload.exit, payload.sl, payload.tp, payload.pnl].every(Number.isFinite)) {
      setError("Enter valid numeric trade values.");
      return;
    }
    if (payload.lots <= 0) {
      setError("Lot size must be greater than zero.");
      return;
    }
    if (!openedAt || !closedAt || new Date(closedAt) < new Date(openedAt)) {
      setError("Closing time must be after opening time.");
      return;
    }

    setSaving(true);
    try {
      await onSave(payload);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this trade.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={trade ? "Edit trade" : "Add trade"}>
      <form className="modal trade-modal" onSubmit={submit}>
        <header>
          <div>
            <h2>{trade ? "Edit trade" : "Add manual trade"}</h2>
            <p>{trade ? "Correct the trade record and save your changes." : "Record a closed position in your journal."}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close modal"><X /></button>
        </header>

        <div className="form-grid">
          <label>Account
            <select name="accountId" defaultValue={trade?.accountId || accounts[0]?.id} required>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          <label>Symbol<input name="symbol" required defaultValue={trade?.symbol || "XAUUSD"} placeholder="XAUUSD" /></label>
          <label>Side
            <div className="seg">
              <button type="button" className={side === "Buy" ? "active" : ""} onClick={() => setSide("Buy")}>Buy</button>
              <button type="button" className={side === "Sell" ? "active sell" : ""} onClick={() => setSide("Sell")}>Sell</button>
            </div>
          </label>
          <label>Lot size<input name="lots" type="number" step="any" min="0.001" required defaultValue={trade?.lots} /></label>
          <label>Entry price<input name="entry" type="number" step="any" required value={entry} onChange={(event) => setEntry(event.target.value)} /></label>
          <label>Exit price<input name="exit" type="number" step="any" required value={exit} onChange={(event) => setExit(event.target.value)} /></label>
          <label>Stop loss<input name="sl" type="number" step="any" required value={sl} onChange={(event) => setSl(event.target.value)} /></label>
          <label>Take profit<input name="tp" type="number" step="any" required value={tp} onChange={(event) => setTp(event.target.value)} /></label>
          <label>Net P&amp;L<input name="pnl" type="number" step="any" required defaultValue={trade?.pnl} /></label>
          <label>Setup<input name="setup" required defaultValue={trade?.setup} placeholder="Liquidity sweep" /></label>
          <label>Opened<input name="openedAt" type="datetime-local" required defaultValue={localDateTime(trade?.openedAt)} /></label>
          <label>Closed<input name="closedAt" type="datetime-local" required defaultValue={localDateTime(trade?.closedAt)} /></label>
          <label className="wide">Notes<textarea name="notes" defaultValue={trade?.notes} placeholder="Reason, execution quality, emotion and lesson" /></label>
        </div>

        <div className="rr-preview">
          <Calculator size={17} />
          <span>Planned risk-to-reward</span>
          <strong>{riskReward === null ? "—" : `1:${riskReward.toFixed(2)}`}</strong>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}

        <footer>
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary" disabled={saving}>{saving ? "Saving…" : trade ? "Save changes" : "Save trade"}</button>
        </footer>
      </form>
    </div>
  );
}

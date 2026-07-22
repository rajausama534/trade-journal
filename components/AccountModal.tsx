"use client";

import { FormEvent, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Account } from "@/lib/types";
import { isDemoMode, supabase } from "@/lib/supabase";

type Props = {
  account?: Account;
  onClose: () => void;
  onSave: (account: Omit<Account, "id">) => void;
};

export function AccountModal({ account, onClose, onSave }: Props) {
  const [deleting, setDeleting] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const startingBalance = Number(data.get("startingBalance"));
    const currentBalance = Number(data.get("balance") || startingBalance);

    onSave({
      name: String(data.get("name")),
      firm: String(data.get("firm")),
      platform: String(data.get("platform")),
      balance: currentBalance,
      startingBalance,
      dailyLimit: Number(data.get("dailyLimit")),
      maxLimit: Number(data.get("maxLimit")),
      status: String(data.get("status")) as Account["status"],
    });
  }

  async function removeAccount() {
    if (!account) return;

    if (isDemoMode || !supabase) {
      alert("Account removal is unavailable in demo mode.");
      return;
    }

    const confirmed = window.confirm(
      `Remove ${account.name}? This will permanently delete the account, its linked trades, and its MT5 connection. This cannot be undone.`,
    );

    if (!confirmed) return;

    const typedName = window.prompt(
      `Type the account name exactly to confirm deletion:\n\n${account.name}`,
    );

    if (typedName !== account.name) {
      if (typedName !== null) alert("The account name did not match. Nothing was deleted.");
      return;
    }

    setDeleting(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setDeleting(false);
      alert(authError?.message || "Your session has expired. Please sign in again.");
      return;
    }

    const tradeDelete = await supabase
      .from("trades")
      .delete()
      .eq("account_id", account.id)
      .eq("user_id", user.id);

    if (tradeDelete.error) {
      setDeleting(false);
      alert(`Could not remove linked trades: ${tradeDelete.error.message}`);
      return;
    }

    const connectionDelete = await supabase
      .from("mt5_connections")
      .delete()
      .eq("account_id", account.id)
      .eq("user_id", user.id);

    if (connectionDelete.error) {
      setDeleting(false);
      alert(`Could not remove the MT5 connection: ${connectionDelete.error.message}`);
      return;
    }

    const accountDelete = await supabase
      .from("accounts")
      .delete()
      .eq("id", account.id)
      .eq("user_id", user.id);

    if (accountDelete.error) {
      setDeleting(false);
      alert(`Could not remove the account: ${accountDelete.error.message}`);
      return;
    }

    onClose();
    window.location.reload();
  }

  return <div className="overlay"><form className="modal" onSubmit={submit}><header><div><h2>{account ? "Edit account" : "Add account"}</h2><p>{account ? "Update the account details and risk limits." : "Create an account before recording trades."}</p></div><button type="button" className="icon-btn" onClick={onClose}><X/></button></header><div className="form-grid"><label>Account name<input name="name" required defaultValue={account?.name} placeholder="100K Challenge"/></label><label>Prop firm<input name="firm" required defaultValue={account?.firm} placeholder="FundedHive"/></label><label>Platform<select name="platform" defaultValue={account?.platform || "MT5"}><option>MT5</option><option>Match-Trader</option><option>cTrader</option><option>Manual</option></select></label><label>Connection status<select name="status" defaultValue={account?.status || "Manual"}><option>Connected</option><option>Manual</option><option>Sync pending</option></select></label><label>Starting balance<input name="startingBalance" type="number" required min="0" step="0.01" defaultValue={account?.startingBalance}/></label><label>Current balance<input name="balance" type="number" required min="0" step="0.01" defaultValue={account?.balance}/></label><label>Daily loss limit<input name="dailyLimit" type="number" required min="0" step="0.01" defaultValue={account?.dailyLimit}/></label><label>Maximum loss limit<input name="maxLimit" type="number" required min="0" step="0.01" defaultValue={account?.maxLimit}/></label></div><footer>{account && <button type="button" className="signout" onClick={removeAccount} disabled={deleting}><Trash2 size={17}/>{deleting ? "Removing..." : "Remove account"}</button>}<span style={{flex:1}}/><button type="button" className="secondary" onClick={onClose} disabled={deleting}>Cancel</button><button className="primary" disabled={deleting}>{account ? "Save changes" : "Save account"}</button></footer></form></div>;
}

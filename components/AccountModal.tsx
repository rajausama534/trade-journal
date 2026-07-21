"use client";

import { FormEvent } from "react";
import { X } from "lucide-react";
import { Account } from "@/lib/types";

type Props = {
  account?: Account;
  onClose: () => void;
  onSave: (account: Omit<Account, "id">) => void;
};

export function AccountModal({ account, onClose, onSave }: Props) {
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

  return <div className="overlay"><form className="modal" onSubmit={submit}><header><div><h2>{account ? "Edit account" : "Add account"}</h2><p>{account ? "Update the account details and risk limits." : "Create an account before recording trades."}</p></div><button type="button" className="icon-btn" onClick={onClose}><X/></button></header><div className="form-grid"><label>Account name<input name="name" required defaultValue={account?.name} placeholder="100K Challenge"/></label><label>Prop firm<input name="firm" required defaultValue={account?.firm} placeholder="FundedHive"/></label><label>Platform<select name="platform" defaultValue={account?.platform || "MT5"}><option>MT5</option><option>Match-Trader</option><option>cTrader</option><option>Manual</option></select></label><label>Connection status<select name="status" defaultValue={account?.status || "Manual"}><option>Connected</option><option>Manual</option><option>Sync pending</option></select></label><label>Starting balance<input name="startingBalance" type="number" required min="0" step="0.01" defaultValue={account?.startingBalance}/></label><label>Current balance<input name="balance" type="number" required min="0" step="0.01" defaultValue={account?.balance}/></label><label>Daily loss limit<input name="dailyLimit" type="number" required min="0" step="0.01" defaultValue={account?.dailyLimit}/></label><label>Maximum loss limit<input name="maxLimit" type="number" required min="0" step="0.01" defaultValue={account?.maxLimit}/></label></div><footer><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary">{account ? "Save changes" : "Save account"}</button></footer></form></div>;
}

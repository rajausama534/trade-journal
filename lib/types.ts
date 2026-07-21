export type Account = { id:string; name:string; firm:string; platform:string; balance:number; startingBalance:number; status:"Connected"|"Manual"|"Sync pending"; dailyLimit:number; maxLimit:number };
export type Trade = { id:string; accountId:string; symbol:string; side:"Buy"|"Sell"; lots:number; entry:number; exit:number; openedAt:string; closedAt:string; sl:number; tp:number; pnl:number; setup:string; notes?:string };
export type NewTrade = Omit<Trade,"id">;
export interface TradeConnector { readonly name:string; connect():Promise<void>; sync(accountId:string):Promise<Trade[]>; disconnect():Promise<void> }

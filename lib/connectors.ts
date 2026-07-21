import { Trade, TradeConnector } from "./types";
abstract class PlaceholderConnector implements TradeConnector {
 abstract readonly name:string;
 async connect(){throw new Error(`${this.name} connector is not configured yet.`)}
 async sync(_accountId:string):Promise<Trade[]>{throw new Error(`${this.name} sync is an integration placeholder.`)}
 async disconnect(){return}
}
export class MT5Connector extends PlaceholderConnector { readonly name="MT5 EA" }
export class MatchTraderConnector extends PlaceholderConnector { readonly name="Match-Trader API" }
export class CTraderConnector extends PlaceholderConnector { readonly name="cTrader Open API" }

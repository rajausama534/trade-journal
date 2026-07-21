import { Account, Trade } from "./types";
export const accounts:Account[]=[
 {id:"a1",name:"Evaluation 100K",firm:"FundedHive",platform:"MT5",balance:103842,startingBalance:100000,status:"Sync pending",dailyLimit:5000,maxLimit:10000},
 {id:"a2",name:"Instant 50K",firm:"Equity Edge",platform:"Match-Trader",balance:51276,startingBalance:50000,status:"Manual",dailyLimit:2500,maxLimit:5000}
];
export const trades:Trade[]=[
 {id:"t1",accountId:"a1",symbol:"XAUUSD",side:"Buy",lots:1,entry:2417.8,exit:2423.4,openedAt:"2026-07-18T08:12",closedAt:"2026-07-18T09:40",sl:2413,tp:2426,pnl:560,setup:"Liquidity sweep"},
 {id:"t2",accountId:"a1",symbol:"NAS100",side:"Sell",lots:.5,entry:22980,exit:23042,openedAt:"2026-07-17T14:10",closedAt:"2026-07-17T15:03",sl:23035,tp:22890,pnl:-310,setup:"Resistance rejection"},
 {id:"t3",accountId:"a2",symbol:"EURUSD",side:"Buy",lots:2,entry:1.1642,exit:1.1671,openedAt:"2026-07-16T07:35",closedAt:"2026-07-16T10:22",sl:1.1625,tp:1.168,pnl:580,setup:"Trend continuation"},
 {id:"t4",accountId:"a1",symbol:"XAUUSD",side:"Sell",lots:.7,entry:2441.2,exit:2436.5,openedAt:"2026-07-15T12:15",closedAt:"2026-07-15T13:06",sl:2445,tp:2433,pnl:329,setup:"15M breakout"},
 {id:"t5",accountId:"a2",symbol:"GBPUSD",side:"Buy",lots:1,entry:1.341,exit:1.3391,openedAt:"2026-07-14T08:55",closedAt:"2026-07-14T09:31",sl:1.3395,tp:1.344,pnl:-190,setup:"Support rejection"},
 {id:"t6",accountId:"a1",symbol:"US30",side:"Buy",lots:.4,entry:44520,exit:44705,openedAt:"2026-07-11T13:33",closedAt:"2026-07-11T15:12",sl:44400,tp:44720,pnl:740,setup:"Trend continuation"}
];

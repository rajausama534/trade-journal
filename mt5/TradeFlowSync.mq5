#property strict
#property version "1.00"
#property description "Read-only TradeFlow history synchronizer"
input string WebhookUrl="https://trade-journal-seven-gilt.vercel.app/api/mt5/sync";
input string SyncToken="";
input int SyncEverySeconds=60;
input int HistoryDays=3650;
datetime last_closed=0;
string Escape(string s){StringReplace(s,"\\","\\\\");StringReplace(s,"\"","\\\"");return s;}
string Iso(datetime t){MqlDateTime d;TimeToStruct(t,d);return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",d.year,d.mon,d.day,d.hour,d.min,d.sec);}
bool FindEntry(long pid,double &price,datetime &opened){int n=HistoryDealsTotal();for(int i=0;i<n;i++){ulong x=HistoryDealGetTicket(i);if((long)HistoryDealGetInteger(x,DEAL_POSITION_ID)==pid&&(ENUM_DEAL_ENTRY)HistoryDealGetInteger(x,DEAL_ENTRY)==DEAL_ENTRY_IN){price=HistoryDealGetDouble(x,DEAL_PRICE);opened=(datetime)HistoryDealGetInteger(x,DEAL_TIME);return true;}}return false;}
void SendDeal(ulong ticket){if(SyncToken=="")return;long pid=(long)HistoryDealGetInteger(ticket,DEAL_POSITION_ID);double entry=0;datetime opened=0;if(!FindEntry(pid,entry,opened))return;datetime closed=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME);long dtype=HistoryDealGetInteger(ticket,DEAL_TYPE);string side=dtype==DEAL_TYPE_SELL?"Buy":"Sell";string json=StringFormat("{\"login\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"trade\":{\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"side\":\"%s\",\"lots\":%.2f,\"entry\":%.8f,\"exit\":%.8f,\"openedAt\":\"%s\",\"closedAt\":\"%s\",\"pnl\":%.2f,\"commission\":%.2f,\"swap\":%.2f}}",AccountInfoInteger(ACCOUNT_LOGIN),AccountInfoDouble(ACCOUNT_BALANCE),AccountInfoDouble(ACCOUNT_EQUITY),ticket,Escape(HistoryDealGetString(ticket,DEAL_SYMBOL)),side,HistoryDealGetDouble(ticket,DEAL_VOLUME),entry,HistoryDealGetDouble(ticket,DEAL_PRICE),Iso(opened),Iso(closed),HistoryDealGetDouble(ticket,DEAL_PROFIT),HistoryDealGetDouble(ticket,DEAL_COMMISSION),HistoryDealGetDouble(ticket,DEAL_SWAP));char data[],result[];string headers="Content-Type: application/json\r\nAuthorization: Bearer "+SyncToken+"\r\n",response;StringToCharArray(json,data,0,WHOLE_ARRAY,CP_UTF8);int code=WebRequest("POST",WebhookUrl,headers,15000,data,result,response);if(code>=200&&code<300)last_closed=MathMax(last_closed,closed);else Print("TradeFlow sync failed. HTTP ",code);}
void Sync(){datetime from=TimeCurrent()-HistoryDays*86400;if(!HistorySelect(from,TimeCurrent()))return;int n=HistoryDealsTotal();for(int i=0;i<n;i++){ulong t=HistoryDealGetTicket(i);ENUM_DEAL_ENTRY e=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(t,DEAL_ENTRY);datetime closed=(datetime)HistoryDealGetInteger(t,DEAL_TIME);if((e==DEAL_ENTRY_OUT||e==DEAL_ENTRY_OUT_BY)&&closed>=last_closed)SendDeal(t);}}
int OnInit(){EventSetTimer(SyncEverySeconds);Sync();return INIT_SUCCEEDED;}
void OnTimer(){Sync();}
void OnDeinit(const int reason){EventKillTimer();}

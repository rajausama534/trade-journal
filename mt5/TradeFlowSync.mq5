#property strict
#property version "1.20"
#property description "Read-only Exness MT5 history synchronizer for TradeFlow"

input string WebhookUrl="https://trade-journal-seven-gilt.vercel.app/api/mt5/sync";
input string SyncToken="";
input bool GoldOnly=true;
input int SyncEverySeconds=60;
input int HistoryDays=3650;

datetime last_closed=0;
ulong last_ticket=0;

string Escape(string s){StringReplace(s,"\\","\\\\");StringReplace(s,"\"","\\\"");StringReplace(s,"\r"," ");StringReplace(s,"\n"," ");return s;}
string Iso(datetime t){MqlDateTime d;TimeToStruct(t,d);return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",d.year,d.mon,d.day,d.hour,d.min,d.sec);}
bool IsGold(string s){StringToUpper(s);return StringFind(s,"XAU")>=0||StringFind(s,"GOLD")>=0;}

int Post(string json,string label){
  char data[],result[]; string headers="Content-Type: application/json\r\nAuthorization: Bearer "+SyncToken+"\r\n",response;
  StringToCharArray(json,data,0,WHOLE_ARRAY,CP_UTF8); if(ArraySize(data)>0)ArrayResize(data,ArraySize(data)-1);
  ResetLastError(); int code=WebRequest("POST",WebhookUrl,headers,15000,data,result,response);
  if(code>=200&&code<300) Print("TradeFlow ",label," successful (HTTP ",code,")");
  else Print("TradeFlow ",label," failed. HTTP ",code,", MT5 error ",GetLastError(),", response: ",CharArrayToString(result));
  return code;
}

bool FindEntry(long pid,double &price,datetime &opened){
  int n=HistoryDealsTotal();
  for(int i=0;i<n;i++){
    ulong x=HistoryDealGetTicket(i);
    if((long)HistoryDealGetInteger(x,DEAL_POSITION_ID)!=pid)continue;
    ENUM_DEAL_ENTRY e=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(x,DEAL_ENTRY);
    if(e==DEAL_ENTRY_IN||e==DEAL_ENTRY_INOUT){price=HistoryDealGetDouble(x,DEAL_PRICE);opened=(datetime)HistoryDealGetInteger(x,DEAL_TIME);return true;}
  }
  return false;
}

void Heartbeat(){
  string json=StringFormat("{\"login\":%I64d,\"balance\":%.2f,\"equity\":%.2f}",AccountInfoInteger(ACCOUNT_LOGIN),AccountInfoDouble(ACCOUNT_BALANCE),AccountInfoDouble(ACCOUNT_EQUITY));
  Post(json,"connection");
}

bool SendDeal(ulong ticket){
  string symbol=HistoryDealGetString(ticket,DEAL_SYMBOL); if(GoldOnly&&!IsGold(symbol))return true;
  long pid=(long)HistoryDealGetInteger(ticket,DEAL_POSITION_ID); double entry=0; datetime opened=0; if(!FindEntry(pid,entry,opened))return true;
  datetime closed=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME); long dtype=HistoryDealGetInteger(ticket,DEAL_TYPE);
  string side=dtype==DEAL_TYPE_SELL?"Buy":"Sell";
  string json=StringFormat("{\"login\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"trade\":{\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"side\":\"%s\",\"lots\":%.2f,\"entry\":%.8f,\"exit\":%.8f,\"openedAt\":\"%s\",\"closedAt\":\"%s\",\"pnl\":%.2f,\"commission\":%.2f,\"swap\":%.2f}}",
    AccountInfoInteger(ACCOUNT_LOGIN),AccountInfoDouble(ACCOUNT_BALANCE),AccountInfoDouble(ACCOUNT_EQUITY),ticket,Escape(symbol),side,
    HistoryDealGetDouble(ticket,DEAL_VOLUME),entry,HistoryDealGetDouble(ticket,DEAL_PRICE),Iso(opened),Iso(closed),
    HistoryDealGetDouble(ticket,DEAL_PROFIT),HistoryDealGetDouble(ticket,DEAL_COMMISSION),HistoryDealGetDouble(ticket,DEAL_SWAP));
  int code=Post(json,"trade import");
  if(code>=200&&code<300){last_closed=closed;last_ticket=ticket;GlobalVariableSet("TradeFlowLastClosed",(double)last_closed);GlobalVariableSet("TradeFlowLastTicket",(double)last_ticket);return true;}
  return false;
}

void Sync(){
  if(SyncToken==""){Print("TradeFlow SyncToken is empty");return;}
  Heartbeat(); datetime from=TimeCurrent()-HistoryDays*86400;
  if(!HistorySelect(from,TimeCurrent())){Print("TradeFlow could not select history. MT5 error ",GetLastError());return;}
  int n=HistoryDealsTotal();
  for(int i=0;i<n;i++){
    ulong t=HistoryDealGetTicket(i); ENUM_DEAL_ENTRY e=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(t,DEAL_ENTRY); datetime closed=(datetime)HistoryDealGetInteger(t,DEAL_TIME);
    if(e!=DEAL_ENTRY_OUT&&e!=DEAL_ENTRY_OUT_BY)continue;
    if(closed<last_closed||(closed==last_closed&&t<=last_ticket))continue;
    if(!SendDeal(t))break;
  }
}

int OnInit(){
  if(GlobalVariableCheck("TradeFlowLastClosed"))last_closed=(datetime)GlobalVariableGet("TradeFlowLastClosed");
  if(GlobalVariableCheck("TradeFlowLastTicket"))last_ticket=(ulong)GlobalVariableGet("TradeFlowLastTicket");
  EventSetTimer(MathMax(10,SyncEverySeconds)); Sync(); return INIT_SUCCEEDED;
}
void OnTimer(){Sync();}
void OnDeinit(const int reason){EventKillTimer();}

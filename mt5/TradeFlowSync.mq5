#property strict
#property version "1.30"
#property description "Read-only Exness MT5 history synchronizer for TradeFlow"

input string WebhookUrl="https://trade-journal-seven-gilt.vercel.app/api/mt5/sync";
input string SyncToken="";
input bool GoldOnly=true;
input bool StartFromActivation=true;
input int SyncEverySeconds=30;
input int HistoryDays=30;

datetime last_closed=0;
ulong last_ticket=0;
string state_prefix="";

string Escape(string s){StringReplace(s,"\\","\\\\");StringReplace(s,"\"","\\\"");StringReplace(s,"\r"," ");StringReplace(s,"\n"," ");return s;}
string Iso(datetime t){MqlDateTime d;TimeToStruct(t,d);return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",d.year,d.mon,d.day,d.hour,d.min,d.sec);}
bool IsGold(string s){StringToUpper(s);return StringFind(s,"XAU")>=0||StringFind(s,"GOLD")>=0;}

int Post(string json,string label){
  char data[],result[];
  string headers="Content-Type: application/json\r\nAuthorization: Bearer "+SyncToken+"\r\n",response;
  StringToCharArray(json,data,0,WHOLE_ARRAY,CP_UTF8);
  if(ArraySize(data)>0)ArrayResize(data,ArraySize(data)-1);
  ResetLastError();
  int code=WebRequest("POST",WebhookUrl,headers,15000,data,result,response);
  if(code>=200&&code<300)Print("TradeFlow ",label," successful (HTTP ",code,")");
  else Print("TradeFlow ",label," failed. HTTP ",code,", MT5 error ",GetLastError(),", response: ",CharArrayToString(result));
  return code;
}

bool FindEntry(long position_id,double &price,datetime &opened){
  int total=HistoryDealsTotal();
  for(int i=0;i<total;i++){
    ulong ticket=HistoryDealGetTicket(i);
    if((long)HistoryDealGetInteger(ticket,DEAL_POSITION_ID)!=position_id)continue;
    ENUM_DEAL_ENTRY entry=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket,DEAL_ENTRY);
    if(entry==DEAL_ENTRY_IN||entry==DEAL_ENTRY_INOUT){
      price=HistoryDealGetDouble(ticket,DEAL_PRICE);
      opened=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME);
      return true;
    }
  }
  return false;
}

void SaveState(){
  GlobalVariableSet(state_prefix+"LastClosed",(double)last_closed);
  GlobalVariableSet(state_prefix+"LastTicket",(double)last_ticket);
}

void Heartbeat(){
  string json=StringFormat("{\"login\":%I64d,\"balance\":%.2f,\"equity\":%.2f}",
    AccountInfoInteger(ACCOUNT_LOGIN),AccountInfoDouble(ACCOUNT_BALANCE),AccountInfoDouble(ACCOUNT_EQUITY));
  Post(json,"connection");
}

bool SendDeal(ulong ticket){
  string symbol=HistoryDealGetString(ticket,DEAL_SYMBOL);
  if(GoldOnly&&!IsGold(symbol))return true;

  long position_id=(long)HistoryDealGetInteger(ticket,DEAL_POSITION_ID);
  double entry_price=0;
  datetime opened=0;
  if(!FindEntry(position_id,entry_price,opened))return true;

  datetime closed=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME);
  long deal_type=HistoryDealGetInteger(ticket,DEAL_TYPE);
  string side=deal_type==DEAL_TYPE_SELL?"Buy":"Sell";

  string json=StringFormat(
    "{\"login\":%I64d,\"balance\":%.2f,\"equity\":%.2f,\"trade\":{\"ticket\":\"%I64u\",\"symbol\":\"%s\",\"side\":\"%s\",\"lots\":%.2f,\"entry\":%.8f,\"exit\":%.8f,\"openedAt\":\"%s\",\"closedAt\":\"%s\",\"pnl\":%.2f,\"commission\":%.2f,\"swap\":%.2f}}",
    AccountInfoInteger(ACCOUNT_LOGIN),AccountInfoDouble(ACCOUNT_BALANCE),AccountInfoDouble(ACCOUNT_EQUITY),ticket,
    Escape(symbol),side,HistoryDealGetDouble(ticket,DEAL_VOLUME),entry_price,HistoryDealGetDouble(ticket,DEAL_PRICE),
    Iso(opened),Iso(closed),HistoryDealGetDouble(ticket,DEAL_PROFIT),HistoryDealGetDouble(ticket,DEAL_COMMISSION),HistoryDealGetDouble(ticket,DEAL_SWAP));

  int code=Post(json,"trade import");
  if(code>=200&&code<300){
    last_closed=closed;
    last_ticket=ticket;
    SaveState();
    return true;
  }
  return false;
}

void Sync(){
  if(SyncToken==""){
    Print("TradeFlow SyncToken is empty");
    return;
  }

  Heartbeat();
  datetime from=MathMax(TimeCurrent()-HistoryDays*86400,last_closed-1);
  if(!HistorySelect(from,TimeCurrent())){
    Print("TradeFlow could not select history. MT5 error ",GetLastError());
    return;
  }

  int total=HistoryDealsTotal();
  for(int i=0;i<total;i++){
    ulong ticket=HistoryDealGetTicket(i);
    ENUM_DEAL_ENTRY entry=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(ticket,DEAL_ENTRY);
    datetime closed=(datetime)HistoryDealGetInteger(ticket,DEAL_TIME);
    if(entry!=DEAL_ENTRY_OUT&&entry!=DEAL_ENTRY_OUT_BY)continue;
    if(closed<last_closed||(closed==last_closed&&ticket<=last_ticket))continue;
    if(!SendDeal(ticket))break;
  }
}

int OnInit(){
  long login=AccountInfoInteger(ACCOUNT_LOGIN);
  state_prefix=StringFormat("TradeFlow_%I64d_",login);

  if(GlobalVariableCheck(state_prefix+"LastClosed")){
    last_closed=(datetime)GlobalVariableGet(state_prefix+"LastClosed");
    last_ticket=(ulong)GlobalVariableGet(state_prefix+"LastTicket");
  }else if(StartFromActivation){
    last_closed=TimeCurrent();
    last_ticket=0;
    SaveState();
  }else{
    last_closed=TimeCurrent()-HistoryDays*86400;
  }

  EventSetTimer(MathMax(10,SyncEverySeconds));
  Sync();
  return INIT_SUCCEEDED;
}

void OnTimer(){Sync();}
void OnDeinit(const int reason){EventKillTimer();}

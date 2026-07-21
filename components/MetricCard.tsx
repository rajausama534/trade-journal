import { LucideIcon } from "lucide-react";
export function MetricCard({label,value,detail,icon:Icon,tone="green"}:{label:string;value:string;detail:string;icon:LucideIcon;tone?:"green"|"red"|"blue"}){
 const effectiveTone=value.trim().startsWith("-")?"red":tone;
 return <article className={`metric metric-${effectiveTone}`}><div className={`icon ${effectiveTone}`}><Icon size={18}/></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>
}

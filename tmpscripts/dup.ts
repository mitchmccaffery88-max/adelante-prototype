import { listResources } from "../src/lib/communityResources";
const norm=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const rs=listResources();
console.log("total",rs.length);
for(let i=0;i<rs.length;i++)for(let j=i+1;j<rs.length;j++){
 const a=norm(rs[i]!.name),b=norm(rs[j]!.name);
 const at=new Set(a.split(" ")),bt=new Set(b.split(" "));
 const inter=[...at].filter(t=>bt.has(t)&&t.length>3).length;
 if(rs[i]!.categoryId===rs[j]!.categoryId && inter>=2) console.log(rs[i]!.categoryId,"|",rs[i]!.id,rs[i]!.name,"<>",rs[j]!.id,rs[j]!.name);
}

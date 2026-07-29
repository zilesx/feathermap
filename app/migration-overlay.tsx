"use client";

import {useMemo,useState} from "react";

type Species={slug:string;display_name:string;category_slug:string;migration_profile?:{flyways?:string[];spring?:{start_month:number;end_month:number;direction:string};fall?:{start_month:number;end_month:number;direction:string};confidence?:string}};
type Point={lat:number;lon:number};
const ROUTES:Record<string,Point[]>={
  pacific:[{lat:31,lon:-116},{lat:38,lon:-122},{lat:45,lon:-121},{lat:51,lon:-124}],
  central:[{lat:27,lon:-98},{lat:35,lon:-102},{lat:42,lon:-99},{lat:50,lon:-103}],
  mississippi:[{lat:28,lon:-91},{lat:35,lon:-91},{lat:43,lon:-91},{lat:50,lon:-97}],
  atlantic:[{lat:26,lon:-81},{lat:34,lon:-78},{lat:41,lon:-74},{lat:49,lon:-68}]
};

function world(lat:number,lon:number,zoom:number){
  const scale=256*2**zoom;
  const sin=Math.sin(Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/180);
  return{x:(lon+180)/360*scale,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale};
}

export default function MigrationOverlay({catalog,category,center,zoom,width,height}:{catalog:Species[];category:string;center:Point;zoom:number;width:number;height:number}){
  const options=useMemo(()=>catalog.filter(item=>(category==="all"||item.category_slug===category)&&item.migration_profile?.flyways?.length),[catalog,category]);
  const[selected,setSelected]=useState("all");
  const active=options.some(item=>item.slug===selected)?selected:"all";
  const profiles=active==="all"?options:options.filter(item=>item.slug===active);
  const month=new Date().getMonth()+1;
  const directions=new Map<string,string>();
  for(const item of profiles){
    const profile=item.migration_profile;
    if(!profile)continue;
    const season=[profile.spring,profile.fall].find(value=>value&&month>=value.start_month&&month<=value.end_month);
    for(const flyway of profile.flyways||[])directions.set(flyway,season?.direction||"seasonal");
  }
  const origin=world(center.lat,center.lon,zoom);
  const project=(point:Point)=>{const value=world(point.lat,point.lon,zoom);return{x:width/2+value.x-origin.x,y:height/2+value.y-origin.y}};
  return <div className="migration-overlay" aria-label="Generalized species migration corridors">
    <div className="migration-key">
      <label>Migration pattern<select value={active} onChange={event=>setSelected(event.target.value)}><option value="all">Filtered species</option>{options.map(item=><option key={item.slug} value={item.slug}>{item.display_name}</option>)}</select></label>
      <small>Generalized seasonal direction—not live tracking.</small>
    </div>
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs><marker id="migration-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8Z"/></marker></defs>
      {[...directions].map(([name,direction])=>{
        const route=direction==="south"?[...ROUTES[name]].reverse():ROUTES[name];
        const points=route.map(project).filter(point=>point.x>-300&&point.x<width+300&&point.y>-300&&point.y<height+300);
        if(points.length<2)return null;
        const d=points.map((point,index)=>`${index?"L":"M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
        return <g key={name} className={`migration-route ${name}`}><path className="migration-halo" d={d}/><path className="migration-line" d={d} markerEnd="url(#migration-arrow)"/><text x={points[Math.floor(points.length/2)].x+8} y={points[Math.floor(points.length/2)].y-8}>{name}</text></g>
      })}
    </svg>
  </div>;
}

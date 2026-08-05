"use client";
import {useEffect,useState} from "react";
import "./platform-controls.css";
import {networkError} from "../request-errors";

const API=process.env.NEXT_PUBLIC_API_URL||"https://api.feather-map.com";

async function call(path:string,token:string,options:RequestInit={}){
 let response:Response;try{response=await fetch(`${API}${path}`,{...options,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...options.headers}})}catch(cause){throw networkError("admin",cause)}
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(data.error||"Request failed");
 return data;
}

export default function PlatformControls({visible,token}:{visible:boolean;token:string}){
 const[flags,setFlags]=useState<any[]>([]);
 const[operations,setOperations]=useState<any>({totals:{},recent_failures:[]});
 const[roles,setRoles]=useState<any[]>([]);
 const[permissions,setPermissions]=useState<any[]>([]);
 const[selectedRole,setSelectedRole]=useState<any>(null);
 const[status,setStatus]=useState("");
 const[errors,setErrors]=useState<Record<string,string>>({});
 const[override,setOverride]=useState({flag:"",user_id:"",value:"true",reason:"",expires_at:""});

 async function load(){
  if(!visible||!token)return;
  setStatus("Loading platform controls…");
  setErrors({});
  const results=await Promise.allSettled([
   call("/api/admin/features",token),
   call("/api/admin/operations/sync",token),
   call("/api/admin/roles",token)
  ]);
  const nextErrors:Record<string,string>={};
  if(results[0].status==="fulfilled"){
   const nextFlags=results[0].value.flags||[];
   setFlags(nextFlags);
   setOverride(value=>({...value,flag:value.flag||nextFlags[0]?.id||""}));
  }else nextErrors.features=results[0].reason?.message||"Could not load feature flags";
  if(results[1].status==="fulfilled")setOperations(results[1].value);
  else nextErrors.operations=results[1].reason?.message||"Could not load synchronization health";
  if(results[2].status==="fulfilled"){setRoles(results[2].value.roles||[]);setPermissions(results[2].value.permissions||[])}
  else nextErrors.roles=results[2].reason?.message||"Could not load roles";
  setErrors(nextErrors);
  setStatus(Object.keys(nextErrors).length?"Some platform controls could not be loaded.":"");
 }

 useEffect(()=>{void load()},[visible,token]);

 async function save(flag:any){
  setStatus("Saving…");
  try{
   await call(`/api/admin/features/${flag.id}`,token,{method:"PATCH",body:JSON.stringify(flag)});
   await load();
   setStatus("Saved");
  }catch(error){setStatus(error instanceof Error?error.message:"Could not save")}
 }

 async function saveOverride(event:React.FormEvent){
  event.preventDefault();
  setStatus("Saving override…");
  try{
   await call(`/api/admin/features/${override.flag}/users/${override.user_id}`,token,{
    method:"PUT",
    body:JSON.stringify({
     value:override.value==="true",
     reason:override.reason,
     expires_at:override.expires_at?new Date(override.expires_at).toISOString():null
    })
   });
   setOverride({...override,user_id:"",reason:"",expires_at:""});
   setStatus("Override saved");
  }catch(error){setStatus(error instanceof Error?error.message:"Could not save override")}
 }

 if(!visible)return null;
 return <section className="platform-controls">
  <header><div><h2>Platform controls</h2><p>Controlled rollout, access policy, and synchronization health.</p></div><button onClick={load}>Refresh</button></header>
  {status&&<div className="admin-notice">{status}</div>}
  <section className="platform-section">
   <h3>Predefined access roles</h3>
   {errors.roles?<div className="platform-error">{errors.roles}</div>:roles.length===0?<div className="platform-empty">No role definitions are available.</div>:<div className="role-definition-grid">
    {roles.map(role=><button type="button" className="role-definition-card" key={role.key} onClick={()=>setSelectedRole(role)} aria-label={`View permissions for ${role.display_name}`}><b>{role.display_name}</b><span>{role.description}</span><small>{role.permissions.length} permissions · View details</small></button>)}
   </div>}
  </section>
  <section className="platform-section">
   <h3>Feature flags</h3>
   {errors.features?<div className="platform-error">{errors.features}</div>:flags.length===0?<div className="platform-empty">No feature flags have been configured.</div>:<div className="feature-grid">
    {flags.map((flag,index)=><article key={flag.id}>
     <div><b>{flag.display_name}</b><code>{flag.key}</code><p>{flag.description}</p></div>
     <div className="feature-toggles">{[["enabled","Enabled"],["default_value","Default on"],["emergency_disabled","Emergency off"]].map(([key,label])=><label key={key}><input type="checkbox" checked={!!flag[key]} onChange={event=>setFlags(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,[key]:event.target.checked}:item))}/>{label}</label>)}</div>
     <div className="feature-fields"><label>Rollout %<input type="number" min="0" max="100" value={flag.rollout_percentage} onChange={event=>setFlags(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,rollout_percentage:Number(event.target.value)}:item))}/></label>
     <label>Minimum version<input value={flag.minimum_client_version||""} onChange={event=>setFlags(items=>items.map((item,itemIndex)=>itemIndex===index?{...item,minimum_client_version:event.target.value}:item))}/></label>
     <button className="primary" onClick={()=>save(flag)}>Save</button></div>
    </article>)}
   </div>}
  </section>
  {flags.length>0&&!errors.features&&<section className="platform-section">
   <h3>User-specific override</h3>
   <form className="override-form" onSubmit={saveOverride}>
    <label>Feature<select value={override.flag} onChange={event=>setOverride({...override,flag:event.target.value})}>{flags.map(flag=><option key={flag.id} value={flag.id}>{flag.display_name}</option>)}</select></label>
    <label>User ID<input required value={override.user_id} onChange={event=>setOverride({...override,user_id:event.target.value})}/></label>
    <label>Value<select value={override.value} onChange={event=>setOverride({...override,value:event.target.value})}><option value="true">Enabled</option><option value="false">Disabled</option></select></label>
    <label>Expires<input type="datetime-local" value={override.expires_at} onChange={event=>setOverride({...override,expires_at:event.target.value})}/></label>
    <label className="override-reason">Reason<input required minLength={4} value={override.reason} onChange={event=>setOverride({...override,reason:event.target.value})}/></label>
    <button className="primary">Apply override</button>
   </form>
  </section>}
  <section className="platform-section">
   <h3>Synchronization health</h3>
   {errors.operations?<div className="platform-error">{errors.operations}</div>:<>
    <div className="sync-metrics">{Object.entries(operations.totals||{}).map(([key,value])=><div key={key}><b>{String(value)}</b><span>{key.replaceAll("_"," ")}</span></div>)}</div>
    {operations.recent_failures?.length?<div className="sync-failures">{operations.recent_failures.map((item:any,index:number)=><p key={index}><b>{item.error_code||item.event_type}</b><span>{item.platform} {item.client_version||"unknown"} · {new Date(item.created_at).toLocaleString()}</span></p>)}</div>:<p>No recent synchronization failures.</p>}
   </>}
  </section>
  {selectedRole&&<div className="admin-overlay role-permission-overlay" onClick={()=>setSelectedRole(null)}><section className="admin-detail role-permission-detail" role="dialog" aria-modal="true" aria-labelledby="role-permission-title" onClick={event=>event.stopPropagation()}><button className="detail-close" onClick={()=>setSelectedRole(null)} aria-label="Close permission details">×</button><span className="case-type">Predefined access role</span><h2 id="role-permission-title">{selectedRole.display_name}</h2><p>{selectedRole.description}</p><div className="permission-detail-list">{selectedRole.permissions.map((key:string)=>{const permission=permissions.find(item=>item.key===key);return <article key={key}><b>{key.replaceAll(/[._]/g," ").replace(/\b\w/g,(value:string)=>value.toUpperCase())}</b><span>{permission?.description||"Allows this administrative operation."}</span>{permission?.sensitive&&<small>Sensitive operation</small>}</article>})}</div><button className="primary" onClick={()=>setSelectedRole(null)}>Close</button></section></div>}
 </section>;
}

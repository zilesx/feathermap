"use client";

import {useEffect,useState} from "react";

const API=process.env.NEXT_PUBLIC_API_URL||"https://flyway-api.zileslabs.com";
type Appearance="system"|"dark"|"light";

function applyAppearance(value:Appearance){
  document.documentElement.dataset.theme=value;
  localStorage.setItem("flyway_appearance",value);
}

export default function AppearanceControl(){
  const[appearance,setAppearance]=useState<Appearance>("system");
  const[saving,setSaving]=useState(false);
  useEffect(()=>{
    const local=(localStorage.getItem("flyway_appearance")||"system") as Appearance;setAppearance(local);applyAppearance(local);
    const raw=localStorage.getItem("flyway_session");if(!raw)return;
    try{const token=JSON.parse(raw).access_token;fetch(`${API}/api/profile`,{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.ok?r.json():null).then(profile=>{const next=profile?.preferences?.appearance as Appearance|undefined;if(next){setAppearance(next);applyAppearance(next)}})}catch{}
  },[]);
  async function update(value:Appearance){
    setAppearance(value);applyAppearance(value);const raw=localStorage.getItem("flyway_session");if(!raw)return;
    try{setSaving(true);const session=JSON.parse(raw);const profile=await fetch(`${API}/api/profile`,{headers:{Authorization:`Bearer ${session.access_token}`}}).then(r=>r.json());await fetch(`${API}/api/profile`,{method:"PATCH",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({preferences:{...(profile.preferences||{}),appearance:value}})})}finally{setSaving(false)}
  }
  return <label className="appearance-control"><span><b>Appearance</b><small>{saving?"Saving…":"Follows your profile"}</small></span><select value={appearance} onChange={e=>update(e.target.value as Appearance)} aria-label="Appearance preference"><option value="system">System default</option><option value="dark">Dark mode</option><option value="light">Light mode</option></select></label>;
}

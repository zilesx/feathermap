"use client";

export type DraftState="draft"|"queued"|"syncing"|"failed"|"submitted";
export type ReportDraft={
  id:string;
  state:DraftState;
  updatedAt:string;
  retryCount:number;
  lastError?:string;
  payload:Record<string,unknown>;
};

export interface LocationService{current():Promise<{latitude:number;longitude:number;accuracy_meters:number}>}
export interface CameraService{available():boolean;capture():Promise<File|null>}
export interface SecureStorageService{get(key:string):Promise<string|null>;set(key:string,value:string):Promise<void>;remove(key:string):Promise<void>}
export interface DraftRepository{get(id:string):Promise<ReportDraft|null>;put(draft:ReportDraft):Promise<void>;remove(id:string):Promise<void>;list():Promise<ReportDraft[]>}
export interface NetworkService{online():boolean;subscribe(listener:(online:boolean)=>void):()=>void}
export interface SyncService{submit(draft:ReportDraft):Promise<void>}
export interface MapCacheService{prepareRegion(_bounds:{north:number;south:number;east:number;west:number}):Promise<void>}
export interface NotificationService{notify(title:string,options?:NotificationOptions):Promise<void>}

export const newClientId=()=>crypto.randomUUID();

function database():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open("feathermap-local",1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains("report-drafts"))request.result.createObjectStore("report-drafts",{keyPath:"id"})};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function transaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore,resolve:(value:T)=>void,reject:(reason?:unknown)=>void)=>void):Promise<T>{
  const db=await database();
  return new Promise<T>((resolve,reject)=>{const tx=db.transaction("report-drafts",mode);run(tx.objectStore("report-drafts"),resolve,reject);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error)});
}
export const webDraftRepository:DraftRepository={
  get:id=>transaction("readonly",(store,resolve,reject)=>{const r=store.get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)}),
  put:draft=>transaction("readwrite",(store,resolve,reject)=>{const r=store.put(draft);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)}),
  remove:id=>transaction("readwrite",(store,resolve,reject)=>{const r=store.delete(id);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)}),
  list:()=>transaction("readonly",(store,resolve,reject)=>{const r=store.getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})
};
export const webNetworkService:NetworkService={
  online:()=>navigator.onLine,
  subscribe(listener){const on=()=>listener(true),off=()=>listener(false);window.addEventListener("online",on);window.addEventListener("offline",off);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off)}}
};
export const webLocationService:LocationService={current:()=>new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy_meters:Math.round(p.coords.accuracy)}),reject,{enableHighAccuracy:true,timeout:12000}))};
export const webCameraService:CameraService={available:()=>typeof document!=="undefined",capture:async()=>null};
export const webSecureStorageService:SecureStorageService={
  async get(key){return sessionStorage.getItem(key)},async set(key,value){sessionStorage.setItem(key,value)},async remove(key){sessionStorage.removeItem(key)}
};
export const webMapCacheService:MapCacheService={async prepareRegion(){/* Browser tile caching remains deliberately provider-managed. */}};
export const webNotificationService:NotificationService={async notify(title,options){if("Notification"in window&&Notification.permission==="granted")new Notification(title,options)}};

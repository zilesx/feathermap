import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

async function render(path="/"){
  const workerUrl=new URL("../dist/server/index.js",import.meta.url);workerUrl.searchParams.set("test",`${process.pid}-${Date.now()}`);const{default:worker}=await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`,{headers:{accept:"text/html"}}),{ASSETS:{fetch:async()=>new Response("Not found",{status:404})}},{waitUntil(){},passThroughOnException(){}});
}

test("server-renders the FeatherMap map",async()=>{const response=await render();assert.equal(response.status,200);const html=await response.text();assert.match(html,/<title>FeatherMap/);assert.match(html,/MIGRATORY ACTIVITY, EXACT LOCATIONS PROTECTED/);assert.match(html,/Past 7 days/);assert.match(html,/Report birds/);assert.doesNotMatch(html,/codex-preview|Your site is taking shape/)});

test("ships protected administration and trust features",async()=>{for(const path of ["/admin","/auth/reset-password"]){const response=await render(path);assert.equal(response.status,200)}const[api,migration]=await Promise.all([readFile(new URL("../api/server.mjs",import.meta.url),"utf8"),readFile(new URL("../supabase/migrate_trust_layers_profile.sql",import.meta.url),"utf8")]);assert.match(api,/\/api\/auth\/recover/);assert.match(api,/\/api\/admin\/duplicates/);assert.match(api,/weatherSnapshot/);assert.match(api,/scrubImage/);assert.match(api,/signout-all/);assert.match(migration,/duplicate_candidates/);assert.match(migration,/hunting_regulations/);assert.match(migration,/notifications/)});

test("keeps map overlays legible in light and system themes",async()=>{const css=await readFile(new URL("../app/theme.css",import.meta.url),"utf8");assert.match(css,/\.filter:not\(\.active\)/);assert.match(css,/\.filter\.active\{background:#f4f7f2;color:#142019/);assert.match(css,/\.hotspot span\{color:#fff\}/);assert.match(css,/\.map-attribution/);assert.match(css,/\.heat-legend/)});

test("ships the privacy-safe density map and owner report deletion",async()=>{const[page,css,api,migration]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/map-radar.css",import.meta.url),"utf8"),readFile(new URL("../api/server.mjs",import.meta.url),"utf8"),readFile(new URL("../supabase/migrate_owner_report_deletion.sql",import.meta.url),"utf8")]);assert.match(page,/view-density/);assert.match(page,/Dots are privacy-safe aggregate cells/);assert.match(page,/Delete my report/);assert.doesNotMatch(page,/Default map visualization/);assert.match(css,/\.density-dot/);assert.match(css,/\.timeframe-control/);assert.match(api,/sighting\.delete/);assert.match(api,/\/restore/);assert.match(migration,/deleted_at/);assert.match(migration,/deleted_by/)});

test("ships actionable administration and readable audit details",async()=>{const[admin,css,api]=await Promise.all([readFile(new URL("../app/admin/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/admin/admin-directory.css",import.meta.url),"utf8"),readFile(new URL("../api/server.mjs",import.meta.url),"utf8")]);assert.match(admin,/Needs attention/);assert.match(admin,/Technical details/);assert.match(admin,/deviceSummary/);assert.match(css,/Original submission · read only/);assert.match(css,/\.operations-overview/);assert.match(api,/action_label/);assert.match(api,/deleted_reports/)});

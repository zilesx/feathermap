const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://192.168.0.66:8000";

function headers(useServiceRole = false) {
  const key = useServiceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!key) throw new Error("Supabase key is not configured");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function getNearbySightings() {
  const response = await fetch(`${url}/rest/v1/rpc/nearby_sightings`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ p_limit: 100 }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  return response.json();
}

export async function createSighting(input: Record<string, unknown>, accessToken: string) {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Supabase anon key is not configured");
  const response = await fetch(`${url}/rest/v1/sightings`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  return response.json();
}

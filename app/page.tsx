"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import MigrationOverlay from "./migration-overlay";
import FeedbackPanel from "./feedback-panel";
import StableMap from "./stable-map";
import "./feedback-launcher.css";
import { newClientId, webDraftRepository, webLocationService, webNetworkService, type ReportDraft } from "./platform-services";
import { networkError, operationFor } from "./request-errors";
import "./platform-foundation.css";
const API = process.env.NEXT_PUBLIC_API_URL || "https://api.feather-map.com";
const APP_ENV = (process.env.NEXT_PUBLIC_APP_ENV || (API.includes("api-dev.") ? "development" : "production")).toLowerCase();
type LiveReport = {
    id: string;
    species: string;
    subspecies?: string | null;
    count_range?: string | null;
    flock_size: string;
    flock_min?: number | null;
    flock_max?: number | null;
    estimated_birds?: number | null;
    behavior: string;
    zone_latitude: number;
    zone_longitude: number;
    confidence: number;
    occurred_at: string;
    confirmations: number;
    notes?: string | null;
    weather?: Record<string, any> | null;
    observed_weather?: Record<string, any> | null;
    reporter_name?: string;
    report_type?: "sighting" | "banded";
    banded?: Record<string, any> | null;
    banded_entries?: Array<{ species_slug?: string; subspecies_slug?: string | null; band_number?: string | null; band_type?: string | null; band_color?: string | null; encounter_type?: string | null }>;
    has_photo?: boolean;
};
type SightingComment = {
    id: string;
    body: string;
    display_name: string;
    created_at: string;
};
type MapReport = LiveReport & {
    x: number;
    y: number;
    size: number;
    color: string;
    age: string;
    owner?: boolean;
    status?: string;
};
type Panel = "map" | "activity" | "saved" | "more" | "admin";
type Filter = string;
type CatalogSpecies = {
    slug: string;
    display_name: string;
    category_slug: string;
    enabled?: boolean;
    typical_flock_median?: number;
    typical_flock_max?: number;
    occasional_flock_ceiling?: number;
    reference_url?: string;
    reference_source?: string;
    migration_profile?: {
        flyways?: string[];
        spring?: {
            start_month: number;
            end_month: number;
            direction: string;
        };
        fall?: {
            start_month: number;
            end_month: number;
            direction: string;
        };
        confidence?: string;
    };
};
type CatalogCategory = {
    slug: string;
    display_name: string;
    color?: string;
};
type CatalogSubspecies = {
    slug: string;
    species_slug: string;
    display_name: string;
    scientific_name?: string;
    taxonomy_type: string;
    regions?: string[];
    reference_url?: string;
};
type CountRange = {
    slug: string;
    display_label: string;
    minimum_count: number;
    maximum_count: number | null;
    description?: string | null;
    sort_order: number;
};
type BandedMapReport = { id: string; sighting_id: string; species: string; subspecies?: string | null; zone_latitude: number; zone_longitude: number; occurred_at: string };
type OwnedMapReport = { id: string; species: string; subspecies?: string | null; latitude: number; longitude: number; estimated_birds?: number | null; flock_size?: string; behavior?: string; confidence?: number; confirmations?: number; notes?: string | null; observed_weather?: Record<string, any> | null; status?: string; occurred_at: string; reporter_name?: string; owner?: boolean; has_photo?: boolean; report_type?: "sighting" | "banded"; banded?: Record<string, any> | null; banded_entries?: LiveReport["banded_entries"] };
type ReportBirdEntry = {
    id: string;
    species: string;
    subspecies: string;
    count_range: string;
    banded: boolean;
    band_number: string;
    band_type: string;
    band_color: string;
    encounter_type: string;
};
const freshReportBird = (species = "mallard", countRange = "26_50"): ReportBirdEntry => ({ id: crypto.randomUUID(), species, subspecies: "", count_range: countRange, banded: false, band_number: "", band_type: "unknown", band_color: "", encounter_type: "observed" });
type MapCenter = {
    lat: number;
    lon: number;
};
type MapView = "density";
type Preferences = {
    visible_groups: string[];
    default_days: number;
    auto_open_card: boolean;
    appearance?: "system" | "dark" | "light";
    map_view?: MapView;
    reduced_map_motion?: boolean;
    colorblind_map?: boolean;
};
type HeatCell = {
    cell_latitude: number;
    cell_longitude: number;
    report_count: number;
    estimated_birds: number;
    dominant_category: string;
    intensity: number;
    category_breakdown?: Record<string, {
        reports: number;
        birds: number;
    }>;
};
const labels: Record<string, string> = { mallard: "Mallard", teal: "Teal", gadwall: "Gadwall", pintail: "Pintail", wood_duck: "Wood duck", diver: "Diving duck", mixed: "Mixed ducks", other: "Other migratory bird", canada_goose: "Canada goose", snow_goose: "Snow goose", white_fronted_goose: "White-fronted goose", sandhill_crane: "Sandhill crane", tundra_swan: "Tundra swan", feeding: "Feeding", circling: "Circling", flying_over: "Flying over", resting: "Resting on water", moving_in: "Moving into area", banded_encounter: "Banded bird encounter" };
const colors: Record<string, string> = { mallard: "green", teal: "blue", mixed: "gold", gadwall: "gray", canada_goose: "gold", snow_goose: "blue", white_fronted_goose: "gold", sandhill_crane: "gray", tundra_swan: "blue" };
const speciesValues: Record<string, string> = { Mallard: "mallard", Teal: "teal", Gadwall: "gadwall", Pintail: "pintail", "Mixed ducks": "mixed", "Canada goose": "canada_goose", "Snow goose": "snow_goose", "White-fronted goose": "white_fronted_goose", "Sandhill crane": "sandhill_crane", "Tundra swan": "tundra_swan" };
const geese = new Set(["canada_goose", "snow_goose", "white_fronted_goose", "tundra_swan"]);
const allGroups = ["ducks", "geese", "cranes", "doves", "shorebirds", "upland", "other"];
const defaultPreferences: Preferences = { visible_groups: allGroups, default_days: 30, auto_open_card: true, appearance: "system", map_view: "density", reduced_map_motion: false, colorblind_map: false };
const mapViewLabels: Record<MapView, string> = { density: "Activity density" };
function birdGroup(species: string) { return species === "sandhill_crane" ? "cranes" : geese.has(species) ? "geese" : "ducks"; }
function flockDotScale(flock: string, estimate = 0) { if (!estimate) {
    const values = String(flock).match(/[\d,]+/g)?.map(value => Number(value.replaceAll(",", ""))) || [];
    estimate = Math.max(...values, 0);
} if (estimate > 0)
    return Math.max(.34, Math.min(1, Math.log10(estimate + 1) / 5)); return .34; }
function formatCountRange(item: CountRange) { const number = (value: number) => new Intl.NumberFormat("en-US").format(value); return item.maximum_count === null ? `${number(item.minimum_count)}+` : `${number(item.minimum_count)}\u2013${number(item.maximum_count)}`; }
const amountValues: Record<string, string> = { "1_10": "1-10", "11_25": "11-25", "26_50": "26-50", "51_plus": "51+" };
function localDateTime(value = Date.now()) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function age(iso: string) { const m = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`; }
function position(n: number, offset: number) { const value = Math.abs(Math.sin(n * 997 + offset) * 10000); return 14 + (value - Math.floor(value)) * 72; }
function project(lat: number, lon: number, zoom: number) { const size = 256 * 2 ** zoom; const safeLat = Math.max(-85.0511, Math.min(85.0511, lat)); const sin = Math.sin(safeLat * Math.PI / 180); return { x: (lon + 180) / 360 * size, y: (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size }; }
function unproject(x: number, y: number, zoom: number): MapCenter { const size = 256 * 2 ** zoom; const lon = x / size * 360 - 180; const n = Math.PI - 2 * Math.PI * y / size; return { lat: 180 / Math.PI * Math.atan(Math.sinh(n)), lon: ((lon + 540) % 360) - 180 }; }
let pendingReportSubspecies = "";
let pendingReportCountRange = "";
async function request(path: string, options: RequestInit = {}) { if (path === "/api/sightings" && options.method === "POST" && typeof options.body === "string") {
    const payload = JSON.parse(options.body);
    options = { ...options, body: JSON.stringify({ ...payload, subspecies: pendingReportSubspecies || null, count_range: pendingReportCountRange || payload.count_range }) };
} let res: Response; try {
    res = await fetch(`${API}${path}`, options);
}
catch (cause) {
    throw networkError(operationFor(path, String(options.method || "GET").toUpperCase()), cause);
} const text = await res.text(); let data: any = null; try {
    data = text ? JSON.parse(text) : null;
}
catch {
    data = { error: text || `Request failed (${res.status})` };
} if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined")
        window.dispatchEvent(new CustomEvent("feathermap:session-expired"));
    throw new Error(data?.error || `Request failed (${res.status})`);
} return data; }
function qrSource(value: unknown) { const text = String(value || "").trim(); if (!text)
    return ""; if (text.startsWith("data:image/") || /^https:\/\//i.test(text))
    return text; if (text.startsWith("<svg") || text.startsWith("<?xml"))
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`; return ""; }
function tokenExpiry(token: string) { try {
    return Number(JSON.parse(atob(token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/"))).exp) * 1000;
}
catch {
    return 0;
} }
async function compressImage(file: File) { if (!file.type.startsWith("image/") || file.size < 900000)
    return file; const bitmap = await createImageBitmap(file); const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale); canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height); const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .84)); bitmap.close(); return blob ? new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : file; }
type CanvasActivityPoint = {
    x: number;
    y: number;
    radius: number;
    color: string;
    intensity: number;
};
function ActivityCanvas({ points, width, height }: {
    points: CanvasActivityPoint[];
    width: number;
    height: number;
}) { const ref = useRef<HTMLCanvasElement | null>(null); useEffect(() => { const canvas = ref.current; if (!canvas)
    return; const ratio = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; const context = canvas.getContext("2d"); if (!context)
    return; context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height); for (const point of points) {
    if (point.x < -30 || point.y < -30 || point.x > width + 30 || point.y > height + 30)
        continue;
    context.globalAlpha = Math.max(.66, Math.min(.94, point.intensity));
    context.beginPath();
    context.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
    context.fillStyle = point.color;
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = "rgba(7,16,11,.72)";
    context.stroke();
} context.globalAlpha = 1; }, [points, width, height]); return <canvas ref={ref} className="activity-canvas" aria-label="Privacy-safe aggregate bird activity" role="img"/>; }
function NumericStepper({label,value,min,max,onChange,optional=false}:{label:string;value:number|null;min:number;max:number;onChange:(value:number|null)=>void;optional?:boolean}){const timer=useRef<number|null>(null),interval=useRef<number|null>(null),latest=useRef(value);latest.current=value;const stop=()=>{if(timer.current!==null)window.clearTimeout(timer.current);if(interval.current!==null)window.clearInterval(interval.current);timer.current=null;interval.current=null};const adjust=(delta:number)=>onChange(Math.min(max,Math.max(min,(latest.current??0)+delta)));const hold=(delta:number)=>{adjust(delta);timer.current=window.setTimeout(()=>{interval.current=window.setInterval(()=>adjust(delta),90)},420)};useEffect(()=>stop,[]);return <div className="numeric-stepper" role="group" aria-label={label}><button type="button" aria-label={`Decrease ${label}`} disabled={value===null||value<=min} onPointerDown={()=>hold(-1)} onPointerUp={stop} onPointerLeave={stop} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();adjust(-1)}}}>−</button><output aria-live="polite">{value===null?"Not specified":value}</output><button type="button" aria-label={`Increase ${label}`} disabled={value!==null&&value>=max} onPointerDown={()=>hold(1)} onPointerUp={stop} onPointerLeave={stop} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();adjust(1)}}}>+</button>{optional&&<button type="button" className="stepper-clear" disabled={value===null} onClick={()=>onChange(null)}>Clear</button>}</div>}
export default function Home() {
    const [reports, setReports] = useState<MapReport[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [loading, setLoading] = useState(true);
    const [panel, setPanel] = useState<Panel>("map");
    const [activityView, setActivityView] = useState<"community" | "mine" | "review">("community");
    const [newActivityCount, setNewActivityCount] = useState(0);
    const [pendingActivityIds, setPendingActivityIds] = useState<string[]>([]);
    const [highlightedActivityIds, setHighlightedActivityIds] = useState<string[]>([]);
    const [reviewTaskCount, setReviewTaskCount] = useState(0);
    const [mapRefreshAvailable, setMapRefreshAvailable] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);
    const [detailReturnPanel, setDetailReturnPanel] = useState<Panel>("map");
    const reportsRef = useRef<MapReport[]>([]);
    const refreshGeneration = useRef(0);
    const [filter, setFilter] = useState<Filter>("all");
    const [catalog, setCatalog] = useState<CatalogSpecies[]>([]);
    const [categories, setCategories] = useState<CatalogCategory[]>([]);
    const [subspeciesCatalog, setSubspeciesCatalog] = useState<CatalogSubspecies[]>([]);
    const [countRanges, setCountRanges] = useState<CountRange[]>([]);
    // null means every taxon in the active category; [] explicitly means none.
    const [taxonFilters, setTaxonFilters] = useState<string[] | null>(null);
    const [openCategory, setOpenCategory] = useState("");
    const [timeDays, setTimeDays] = useState(30);
    const [customRange, setCustomRange] = useState({ start: "", end: "" });
    const [locationOpen, setLocationOpen] = useState(false);
    const [popularLocations, setPopularLocations] = useState<any[]>([]);
    const [savedLocations, setSavedLocations] = useState<any[]>([]);
    const [reportLocation, setReportLocation] = useState<any>({ source: "current", label: "Current device location", latitude: null, longitude: null, accuracy_meters: 0 });
    const [reportLocationState, setReportLocationState] = useState<"idle" | "loading" | "selected" | "error">("idle");
    const [ownedMapReports, setOwnedMapReports] = useState<OwnedMapReport[]>([]);
    const [observedAt, setObservedAt] = useState(localDateTime());
    const [placeQuery, setPlaceQuery] = useState("");
    const [placeResults, setPlaceResults] = useState<any[]>([]);
    const [savedIds, setSavedIds] = useState<string[]>([]);
    const [detailId, setDetailId] = useState("");
    const [cardOpen, setCardOpen] = useState(true);
    const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
    const [preferencesReady, setPreferencesReady] = useState(false);
    const [mapView, setMapView] = useState<MapView>("density");
    const [preferencesStatus, setPreferencesStatus] = useState("");
    const [zoom, setZoom] = useState(4);
    const [center, setCenter] = useState<MapCenter>({ lat: 39.5, lon: -98.35 });
    const [viewport, setViewport] = useState({ width: 1280, height: 720 });
    const drag = useRef<{
        pointerX: number;
        pointerY: number;
        centerX: number;
        centerY: number;
    } | null>(null);
    const pointers = useRef(new Map<number, {
        x: number;
        y: number;
    }>());
    const pinch = useRef<{
        distance: number;
        zoom: number;
        worldX: number;
        worldY: number;
    } | null>(null);
    const mapGesture = useRef(false);
    const locationRequest = useRef(0);
    const pendingReportTap = useRef<{
        id: string;
        x: number;
        y: number;
        pointerId: number;
    } | null>(null);
    const mapRef = useRef<HTMLDivElement | null>(null);
    const [reporting, setReporting] = useState(false);
    const [speciesPickerOpen, setSpeciesPickerOpen] = useState(true);
    const [selectingReportLocation, setSelectingReportLocation] = useState(false);
    const [clientReportId, setClientReportId] = useState(newClientId);
    const [authOpen, setAuthOpen] = useState(false);
    const [authMode, setAuthMode] = useState<"login" | "signup" | "recover">("login");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [authError, setAuthError] = useState("");
    const [authBusy, setAuthBusy] = useState(false);
    const [token, setToken] = useState("");
    const [profile, setProfile] = useState<any>(null);
    const [species, setSpecies] = useState("mallard");
    const [subspecies, setSubspecies] = useState("");
    const [amount, setAmount] = useState("26_50");
    const [behavior, setBehavior] = useState("feeding");
    const [status, setStatus] = useState("");
    const [notes, setNotes] = useState("");
    const [photo, setPhoto] = useState<File | null>(null);
    const [photoRetry, setPhotoRetry] = useState<{
        sightingId: string;
        file: File;
    } | null>(null);
    const [observedWeather, setObservedWeather] = useState<any>({ sky: "", precipitation: "none", wind: "", wind_direction: "", temperature: "", temperature_unit: "F", visibility: "" });
    const [photos, setPhotos] = useState<{
        id: string;
        url: string;
    }[]>([]);
    const [bandedMapReports, setBandedMapReports] = useState<BandedMapReport[]>([]);
    const [comments, setComments] = useState<SightingComment[]>([]);
    const [comment, setComment] = useState("");
    const [commentStatus, setCommentStatus] = useState("");
    const [rawHeatCells, setHeatCells] = useState<HeatCell[]>([]);
    const [heatLoading, setHeatLoading] = useState(true);
    const heatRequest = useRef(0);
    const [securityOpen, setSecurityOpen] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [securityStatus, setSecurityStatus] = useState("");
    const [mfa, setMfa] = useState<any>(null);
    const [mfaEnroll, setMfaEnroll] = useState<any>(null);
    const [mfaCode, setMfaCode] = useState("");
    const [profileOpen, setProfileOpen] = useState(false);
    const [profileDraft, setProfileDraft] = useState<any>({});
    const [profileSaving, setProfileSaving] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [layersOpen, setLayersOpen] = useState(false);
    const [showFlyways, setShowFlyways] = useState(false);
    const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
    const [deletePassword, setDeletePassword] = useState("");
    const [deleteConfirmation, setDeleteConfirmation] = useState("");
    const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
    const [deleteStatus, setDeleteStatus] = useState("");
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [confirmationState, setConfirmationState] = useState<{
        confirmed: boolean;
        own_report: boolean;
        loading: boolean;
        error?: string;
    }>({ confirmed: false, own_report: false, loading: false });
    const [mapLocationStatus, setMapLocationStatus] = useState("");
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [feedbackUnread, setFeedbackUnread] = useState(0);
    const [sessionSeconds, setSessionSeconds] = useState<number | null>(null);
    const [sessionRefreshing, setSessionRefreshing] = useState(false);
    const [sessionRefreshError, setSessionRefreshError] = useState("");
    const [deleteReportTarget, setDeleteReportTarget] = useState<MapReport | null>(null);
    const [deleteReportBusy, setDeleteReportBusy] = useState(false);
    const [harvestOpen, setHarvestOpen] = useState(false);
    const [harvestItems, setHarvestItems] = useState<any[]>([{ species_slug: "mallard", subspecies_slug: "", recovered_count: 0 }]);
    const [harvestDraft, setHarvestDraft] = useState<any>({ occurred_at: localDateTime(), ended_at: "", hunter_count: 1, observed_count: 0, shots_fired: "", unrecovered_count: "", notes: "" });
    const [harvestStatus, setHarvestStatus] = useState("");
    const [harvestView, setHarvestView] = useState<"journal" | "add">("journal");
    const [harvestJournal, setHarvestJournal] = useState<any>({ outings: [], statistics: {} });
    const [harvestSpeciesFilter, setHarvestSpeciesFilter] = useState("");
    const [harvestDaysFilter, setHarvestDaysFilter] = useState(365);
    const [reportType, setReportType] = useState<"seen" | "harvest" | "banded">("seen");
    const [reportBirds, setReportBirds] = useState<ReportBirdEntry[]>(() => [freshReportBird()]);
    const [expandedTaxon, setExpandedTaxon] = useState("");
    const [bandedOpen, setBandedOpen] = useState(false);
    const [bandedStatus, setBandedStatus] = useState("");
    const [bandedBusy, setBandedBusy] = useState(false);
    const freshBandedDraft = () => ({ client_report_id: crypto.randomUUID(), category_slug: "ducks", species_slug: "mallard", subspecies_slug: "", band_number: "", band_type: "unknown", band_color: "", encounter_type: "observed", occurred_at: localDateTime(), notes: "" });
    const [bandedDraft, setBandedDraft] = useState<any>(freshBandedDraft);
    const categoryFor = (slug: string) => catalog.find(item => item.slug === slug)?.category_slug || birdGroup(slug);
    const displayLabel = (slug: string) => catalog.find(item => item.slug === slug)?.display_name || labels[slug] || slug.replaceAll("_", " ");
    const categoryColor = (slug: string) => categories.find(item => item.slug === slug)?.color || "#d71920";
    const categorySpecies = catalog.filter(item => item.category_slug === filter);
    const defaultCategorySelection = () => categorySpecies.map(item => item.slug);
    const toggleCategorySpecies = (slug: string, checked: boolean) => setTaxonFilters(current => {
        const selected = current === null ? defaultCategorySelection() : current;
        return checked ? [...new Set([...selected.filter(value => !subspeciesCatalog.some(sub => sub.slug === value && sub.species_slug === slug)), slug])] : selected.filter(value => value !== slug);
    });
    const toggleCategorySubspecies = (speciesSlug: string, slug: string, checked: boolean) => setTaxonFilters(current => {
        const selected = current === null ? defaultCategorySelection() : current;
        return checked ? [...new Set([...selected.filter(value => value !== speciesSlug), slug])] : selected.filter(value => value !== slug);
    });
    const categoryRing = (cell: HeatCell) => { const entries = Object.entries(cell.category_breakdown || {}), total = entries.reduce((sum, [, value]) => sum + Number(value.birds || 0), 0); if (!total)
        return categoryColor(cell.dominant_category); let cursor = 0; return `conic-gradient(${entries.map(([slug, value]) => { const start = cursor; cursor += Number(value.birds || 0) / total * 100; return `${categoryColor(slug)} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`; }).join(",")})`; };
    const ownedDisplayReports = useMemo<MapReport[]>(() => ownedMapReports.map(report => ({
        ...report,
        zone_latitude: Number(report.latitude),
        zone_longitude: Number(report.longitude),
        x: position(Number(report.latitude), 1),
        y: position(Number(report.longitude), 2),
        size: 76,
        color: categoryColor(categoryFor(report.species)),
        age: age(report.occurred_at),
        flock_size: report.flock_size || (report.estimated_birds ? String(report.estimated_birds) : "Count not specified"),
        behavior: report.behavior || "reported",
        confidence: Number(report.confidence) || 0,
        confirmations: Number(report.confirmations) || 0,
        reporter_name: "You",
        owner: true
    })), [ownedMapReports, catalog, categories]);
    const visibleReports = useMemo(() => { const ownerIds = new Set(ownedDisplayReports.map(report => report.id)); return [...ownedDisplayReports, ...reports.filter(report => !ownerIds.has(report.id))].filter(r => preferences.visible_groups.includes(categoryFor(r.species)) && (filter === "all" || filter === categoryFor(r.species)) && (taxonFilters === null || taxonFilters.includes(r.subspecies || r.species))); }, [reports, ownedDisplayReports, filter, taxonFilters, preferences.visible_groups, catalog]);
    const heatCells = useMemo(() => { if (taxonFilters !== null)
        return []; const allowedGroups = new Set(preferences.visible_groups); const filtered = rawHeatCells.map(cell => { const breakdown = cell.category_breakdown || {}; const entries = Object.entries(breakdown).filter(([slug]) => allowedGroups.has(slug) && (filter === "all" || filter === slug)); if (!entries.length) {
            if (filter === "all" && allowedGroups.has(cell.dominant_category) && !Object.keys(breakdown).length)
                return cell;
            return null;
        } const reportCount = entries.reduce((sum, [, value]) => sum + Number(value.reports || 0), 0), estimatedBirds = entries.reduce((sum, [, value]) => sum + Number(value.birds || 0), 0), dominantCategory = entries.reduce((best, entry) => Number(entry[1].birds || 0) > Number(best[1].birds || 0) ? entry : best)[0]; return { ...cell, report_count: reportCount, estimated_birds: estimatedBirds, dominant_category: dominantCategory, category_breakdown: Object.fromEntries(entries) }; }).filter(Boolean) as HeatCell[]; const maximum = Math.max(1, ...filtered.map(cell => cell.estimated_birds || cell.report_count)); return filtered.map(cell => ({ ...cell, intensity: Math.max(.18, Math.min(1, (cell.estimated_birds || cell.report_count) / maximum)) })); }, [rawHeatCells, filter, taxonFilters, preferences.visible_groups]);
    const savedReports = useMemo(() => reports.filter(r => savedIds.includes(r.id)), [reports, savedIds]);
    const selectableReports = useMemo(() => { const ownerIds = new Set(ownedDisplayReports.map(report => report.id)); return [...ownedDisplayReports, ...reports.filter(report => !ownerIds.has(report.id))]; }, [ownedDisplayReports, reports]);
    const selected = useMemo(() => selectableReports.find(r => r.id === selectedId) || visibleReports[0], [selectableReports, visibleReports, selectedId]);
    const detail = useMemo(() => selectableReports.find(r => r.id === detailId), [selectableReports, detailId]);
    const mapGeometry = useMemo(() => { const centerPx = project(center.lat, center.lon, zoom); const size = 256 * 2 ** zoom; const tileZoom = Math.floor(zoom); const scale = 2 ** (zoom - tileZoom); const tileCenter = project(center.lat, center.lon, tileZoom); const minX = Math.floor((tileCenter.x - viewport.width / (2 * scale)) / 256) - 1, maxX = Math.floor((tileCenter.x + viewport.width / (2 * scale)) / 256) + 1, minY = Math.max(0, Math.floor((tileCenter.y - viewport.height / (2 * scale)) / 256) - 1), maxY = Math.min(2 ** tileZoom - 1, Math.floor((tileCenter.y + viewport.height / (2 * scale)) / 256) + 1); const tiles = []; for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
            const wrapped = ((x % (2 ** tileZoom)) + 2 ** tileZoom) % (2 ** tileZoom);
            tiles.push({ key: `${tileZoom}-${x}-${y}`, url: `https://tile.openstreetmap.org/${tileZoom}/${wrapped}/${y}.png`, left: (x * 256 - tileCenter.x) * scale + viewport.width / 2, top: (y * 256 - tileCenter.y) * scale + viewport.height / 2, tileSize: 256 * scale });
        } return { tiles, centerPx, size }; }, [center, zoom, viewport]);
    const activityCanvasPoints = useMemo(() => zoom >= 12 ? [] : heatCells.map((cell, index) => { const point = markerPosition({ zone_latitude: cell.cell_latitude, zone_longitude: cell.cell_longitude } as MapReport), jitter = Math.max(0, 7 - zoom) * 1.1, angle = ((index * 137.508) % 360) * Math.PI / 180, volume = Math.log2(Math.max(2, cell.estimated_birds || cell.report_count)); return { x: Number(point.left) + Math.cos(angle) * jitter, y: Number(point.top) + Math.sin(angle) * jitter, radius: Math.max(3.5, Math.min(zoom < 7 ? 9 : 7, 2.6 + volume * .48 + cell.intensity * 2.2)), color: categoryColor(cell.dominant_category), intensity: cell.intensity }; }), [heatCells, mapGeometry, zoom, viewport, categories]);
    const useAggregateActivity = zoom < 7 && taxonFilters === null;
    const pointIsVisible = (x: number, y: number, margin = 30) => x >= -margin && y >= -margin && x <= viewport.width + margin && y <= viewport.height + margin;
    const reportsInViewport = useMemo(() => visibleReports.filter(report => { const point = markerPosition(report); return pointIsVisible(Number(point.left), Number(point.top)); }), [visibleReports, mapGeometry, viewport.width, viewport.height, zoom]);
    const aggregatePointsInViewport = useMemo(() => activityCanvasPoints.filter(point => pointIsVisible(point.x, point.y)), [activityCanvasPoints, viewport.width, viewport.height]);
    const bandedReportsInViewport = reportsInViewport.filter(report => report.report_type === "banded").length;
    const bandedReportCount = visibleReports.filter(report => report.report_type === "banded").length;
    const renderedActivityCount = useAggregateActivity ? aggregatePointsInViewport.length + bandedReportsInViewport : reportsInViewport.length;
    const ownedFilteredCount = ownedMapReports.filter(report => preferences.visible_groups.includes(categoryFor(report.species)) && (filter === "all" || filter === categoryFor(report.species)) && (taxonFilters === null || taxonFilters.includes(report.subspecies || report.species))).length;
    const activeActivityCount = useAggregateActivity ? activityCanvasPoints.length + bandedReportCount + ownedFilteredCount : visibleReports.length;
    const activityIsLoading = loading || (useAggregateActivity && heatLoading);
    function rangeQuery() { return timeDays === 0 && customRange.start && customRange.end ? `start=${encodeURIComponent(customRange.start)}&end=${encodeURIComponent(customRange.end)}` : `days=${timeDays}`; }
    async function load(highlightNew = false) { try {
        const data = await request(`/api/sightings?${rangeQuery()}`);
        const mapped = (data.sightings || []).map((r: LiveReport) => ({ ...r, x: position(r.zone_latitude, 1), y: position(r.zone_longitude, 2), size: 68 + Math.round(flockDotScale(r.flock_size, Number(r.estimated_birds)) * 40), color: colors[r.species] || "gray", age: age(r.occurred_at) }));
        if (highlightNew) setHighlightedActivityIds(pendingActivityIds.length ? pendingActivityIds : mapped.filter((report: MapReport) => !reportsRef.current.some(current => current.id === report.id)).map((report: MapReport) => report.id));
        else if (pendingActivityIds.length) { setHighlightedActivityIds(pendingActivityIds); setPendingActivityIds([]); }
        reportsRef.current = mapped;
        setReports(mapped);
        setRefreshTick(value => value + 1);
        if (mapped[0])
            setSelectedId(v => v || mapped[0].id);
    }
    finally {
        setLoading(false);
    } }
    async function checkForNewActivity() {
        const data = await request(`/api/sightings?${rangeQuery()}`);
        const known = new Set(reportsRef.current.map(report => report.id));
        const pending = (data.sightings || []).map((report: LiveReport) => report.id).filter((id: string) => !known.has(id));
        setPendingActivityIds(pending);
        setNewActivityCount(pending.length);
        setMapRefreshAvailable(pending.length > 0);
    }
    async function refreshActivity() {
        const generation = ++refreshGeneration.current;
        await Promise.all([load(true), loadOwnedReports(), request(`/api/map/banded?${rangeQuery()}`).then(data => { if (generation === refreshGeneration.current) setBandedMapReports(data.reports || []); })]);
        if (generation !== refreshGeneration.current) return;
        setPendingActivityIds([]);
        setNewActivityCount(0);
        setMapRefreshAvailable(false);
        setRefreshTick(value => value + 1);
    }
    useEffect(() => { const resize = () => setViewport({ width: window.innerWidth, height: window.innerHeight }); resize(); window.addEventListener("resize", resize); setSavedIds(JSON.parse(localStorage.getItem("flyway_saved") || "[]")); const saved = localStorage.getItem("flyway_session"); if (saved) {
        const s = JSON.parse(saved);
        setToken(s.access_token);
        request("/api/profile", { headers: { Authorization: `Bearer ${s.access_token}` } }).then(p => { setProfile(p); applyPreferences(p.preferences || defaultPreferences); }).catch(() => localStorage.removeItem("flyway_session")).finally(() => setPreferencesReady(true));
    }
    else
        setPreferencesReady(true); return () => window.removeEventListener("resize", resize); }, []);
    useEffect(() => { if (!preferencesReady)
        return; setLoading(true); load(); }, [preferencesReady, timeDays, customRange.start, customRange.end]);
    useEffect(() => { if (!preferencesReady) return; request(`/api/map/banded?${rangeQuery()}`).then(data => setBandedMapReports(data.reports || [])).catch(() => setBandedMapReports([])); }, [preferencesReady, timeDays, customRange.start, customRange.end]);
    async function loadOwnedReports() { if (!token) { setOwnedMapReports([]); return []; } const data = await request(`/api/sightings/mine/map?${rangeQuery()}`, { headers: { Authorization: `Bearer ${token}` } }); const next = data.reports || []; setOwnedMapReports(next); return next; }
    useEffect(() => { if (!preferencesReady || !token) { setOwnedMapReports([]); return; } void loadOwnedReports().catch(() => setOwnedMapReports([])); }, [preferencesReady, token, timeDays, customRange.start, customRange.end]);
    useEffect(() => { if (!preferencesReady) return; const poll = () => { if (document.visibilityState !== "visible" || reporting || selectingReportLocation || !navigator.onLine) return; void checkForNewActivity().catch(() => {}); }; const timer = window.setInterval(poll, 60000); const visible = () => document.visibilityState === "visible" && poll(); document.addEventListener("visibilitychange", visible); return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); }; }, [preferencesReady, reporting, selectingReportLocation, timeDays, customRange.start, customRange.end]);
    useEffect(() => { if (!token || !profile || profile.role === "user") { setReviewTaskCount(0); return; } const check = () => request("/api/admin/moderation?status=active", { headers: { Authorization: `Bearer ${token}` } }).then(data => setReviewTaskCount(Number(data.cases?.length || data.total || 0))).catch(() => setReviewTaskCount(0)); void check(); const timer = window.setInterval(check, 60000); return () => window.clearInterval(timer); }, [token, profile?.role]);
    useEffect(() => { request("/api/catalog").then(data => { const next = data.species || [], ranges = data.count_ranges || []; setCatalog(next); setCategories(data.categories || []); setSubspeciesCatalog(data.subspecies || []); setCountRanges(ranges); Object.keys(amountValues).forEach(key => delete amountValues[key]); ranges.slice(0, 8).forEach((item: CountRange) => amountValues[item.slug] = formatCountRange(item)); setSpecies(current => next.some((item: CatalogSpecies) => item.slug === current) ? current : next[0]?.slug || ""); setAmount(current => ranges.some((item: CountRange) => item.slug === current) ? current : ranges[0]?.slug || ""); }).catch(() => { }); }, []);
    useEffect(() => {
        if (!reporting)
            return;
        document.querySelectorAll<HTMLButtonElement>(".choice-grid.four button").forEach((button, index) => {
            const range = countRanges[index];
            if (!range)
                return;
            const label = formatCountRange(range);
            button.textContent = label;
            button.setAttribute("aria-label", `${label} birds`);
        });
    }, [reporting, countRanges, amount]);
    useEffect(() => { const requestId = ++heatRequest.current; if (!preferencesReady || zoom >= 7 || taxonFilters !== null) {
        setHeatCells([]);
        setHeatLoading(false);
        return;
    } setHeatCells([]); setHeatLoading(true); const timer = window.setTimeout(() => request(`/api/map/heatmap?${rangeQuery()}&zoom=${zoom.toFixed(1)}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined).then(data => { if (requestId === heatRequest.current)
        setHeatCells(data.cells || []); }).catch(() => { if (requestId === heatRequest.current)
        setHeatCells([]); }).finally(() => { if (requestId === heatRequest.current)
        setHeatLoading(false); }), 220); return () => window.clearTimeout(timer); }, [preferencesReady, Math.floor(zoom * 2), timeDays, customRange.start, customRange.end, taxonFilters, token, refreshTick]);
    useEffect(() => { if (!detailId) return; const refresh = () => Promise.all([request(`/api/sightings/${detailId}/photos`), request(`/api/sightings/${detailId}/comments`)]).then(([p, c]) => { setPhotos(p.photos || []); setComments(c.comments || []); }).catch(() => {}); void refresh(); const timer = window.setInterval(refresh, 20000); return () => window.clearInterval(timer); }, [detailId]);
    useEffect(() => { if (!selectedId || !token) {
        setConfirmationState({ confirmed: false, own_report: false, loading: false });
        return;
    } setConfirmationState(s => ({ ...s, loading: true, error: undefined })); request(`/api/sightings/${selectedId}/confirmation-state`, { headers: { Authorization: `Bearer ${token}` } }).then(s => setConfirmationState({ ...s, loading: false })).catch(e => setConfirmationState({ confirmed: false, own_report: false, loading: false, error: e instanceof Error ? e.message : "Could not load confirmation" })); }, [selectedId, token]);
    useEffect(() => { if (token && new URLSearchParams(location.search).has("feedback"))
        setFeedbackOpen(true); }, [token]);
    useEffect(() => { setTaxonFilters(null); setExpandedTaxon(""); }, [filter]);
    useEffect(() => { const params = new URLSearchParams(location.search); if (params.get("session") === "expired") {
        setAuthMode("login");
        setAuthError("Your session expired. Sign in again to continue.");
        setAuthOpen(true);
    } }, []);
    useEffect(() => { pendingReportSubspecies = subspecies; }, [subspecies]);
    useEffect(() => { pendingReportCountRange = amount; }, [amount]);
    useEffect(() => { setSubspecies(""); }, [species]);
    useEffect(() => { document.querySelector(".app-shell")?.classList.toggle("species-picker-closed", reporting && !speciesPickerOpen); }, [reporting, speciesPickerOpen]);
    useEffect(() => { if (!reporting)
        return; setSpeciesPickerOpen(true); let cleanup = () => { }; const timer = window.setTimeout(() => { const grid = document.querySelector<HTMLElement>(".modal .choice-grid:first-of-type"); const selected = (event: Event) => { if ((event.target as HTMLElement).closest("button"))
        setSpeciesPickerOpen(false); }; grid?.addEventListener("click", selected); cleanup = () => grid?.removeEventListener("click", selected); }, 0); return () => { window.clearTimeout(timer); cleanup(); }; }, [reporting]);
    useEffect(() => { if (!token) {
        setFeedbackUnread(0);
        return;
    } const check = () => request("/api/feedback", { headers: { Authorization: `Bearer ${token}` } }).then(data => setFeedbackUnread(Number(data.unread_count) || 0)).catch(() => { }); void check(); const timer = window.setInterval(check, 60000); return () => window.clearInterval(timer); }, [token]);
    useEffect(() => { if (!token) {
        setSessionSeconds(null);
        return;
    } let refreshing = false; const startedKey = "feathermap_session_started_at"; if (!localStorage.getItem(startedKey))
        localStorage.setItem(startedKey, String(Date.now())); const tick = () => { const started = Number(localStorage.getItem(startedKey)) || Date.now(), absoluteHours = Math.max(1, Number(profile?.session_policy?.absolute_hours) || 72), remaining = Math.max(0, Math.ceil((started + absoluteHours * 3600000 - Date.now()) / 1000)), warning = Math.max(60, Number(profile?.session_policy?.warning_seconds) || 300), accessRemaining = Math.ceil((tokenExpiry(token) - Date.now()) / 1000); setSessionSeconds(remaining <= warning ? remaining : null); if (remaining === 0) {
        void logout();
        return;
    } if (accessRemaining < 300 && !refreshing) {
        refreshing = true;
        void continueSession(false).finally(() => { refreshing = false; });
    } }; tick(); const timer = window.setInterval(tick, 30000); return () => window.clearInterval(timer); }, [token, profile?.session_policy?.warning_seconds, profile?.session_policy?.absolute_hours]);
    useEffect(() => { const sync = (event: StorageEvent) => { if (event.key !== "flyway_session")
        return; if (!event.newValue) {
        setToken("");
        setProfile(null);
        return;
    } try {
        setToken(JSON.parse(event.newValue).access_token);
    }
    catch { } }; window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync); }, []);
    useEffect(() => { const expired = () => { localStorage.removeItem("flyway_session"); setToken(""); setProfile(null); setPanel("map"); setAuthMode("login"); setAuthError("Your session expired. Sign in again to continue."); setAuthOpen(true); }; window.addEventListener("feathermap:session-expired", expired); return () => window.removeEventListener("feathermap:session-expired", expired); }, []);
    useEffect(() => { document.querySelectorAll<HTMLButtonElement>(".confirm-btn").forEach(button => { button.disabled = confirmationState.confirmed || confirmationState.own_report || confirmationState.loading; button.textContent = confirmationState.loading ? "Checking…" : confirmationState.confirmed ? "✓ Confirmed" : confirmationState.own_report ? "Your report" : "✓ Confirm activity"; button.title = confirmationState.error || ""; button.classList.toggle("owner-status", confirmationState.own_report); if (confirmationState.own_report) {
        button.setAttribute("role", "status");
        button.setAttribute("aria-label", "This is your report");
        button.tabIndex = -1;
    }
    else {
        button.removeAttribute("role");
        button.removeAttribute("aria-label");
        button.tabIndex = 0;
    } }); }, [confirmationState, detailId, cardOpen]);
    useEffect(() => { document.querySelectorAll<HTMLElement>("a,button,h2").forEach(element => { const label = element.textContent?.trim(); if (label === "Administration")
        element.textContent = "Admin Portal"; if (label === "Open admin console")
        element.textContent = "Open Admin Portal"; }); }, [panel, profile]);
    useEffect(() => { document.querySelectorAll<HTMLElement>(".density-dot").forEach((element, index) => { const cell = heatCells[index % Math.max(1, heatCells.length)]; if (!cell)
        return; element.style.setProperty("--category-color", categoryColor(cell.dominant_category)); element.style.setProperty("--category-ring", categoryRing(cell)); element.style.background = categoryColor(cell.dominant_category); }); document.querySelectorAll<HTMLElement>("[data-report-id]").forEach(element => { const report = reports.find(item => item.id === element.dataset.reportId); if (report)
        element.style.setProperty("--category-color", categoryColor(categoryFor(report.species))); }); document.querySelectorAll<HTMLElement>(".filters .filter").forEach((element, index) => { const category = index ? categories[index - 1] : null; if (category)
        element.style.setProperty("--category-color", categoryColor(category.slug)); }); }, [heatCells, reports, categories]);
    useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key !== "Escape")
        return; if (openCategory)
        setOpenCategory("");
    else if (feedbackOpen)
        setFeedbackOpen(false);
    else if (authOpen)
        setAuthOpen(false);
    else if (reporting)
        setReporting(false);
    else if (detailId)
        setDetailId("");
    else if (panel !== "map")
        setPanel("map");
    else if (cardOpen)
        setCardOpen(false); }; const outside = (event: PointerEvent) => { if (openCategory && !(event.target as HTMLElement).closest(".taxonomy-filter, .filter-composite"))
        setOpenCategory(""); }; window.addEventListener("keydown", close); window.addEventListener("pointerdown", outside); return () => { window.removeEventListener("keydown", close); window.removeEventListener("pointerdown", outside); }; }, [openCategory, feedbackOpen, authOpen, reporting, detailId, panel, cardOpen]);
    function showReport(id: string) { setDetailReturnPanel(panel); setSelectedId(id); setCardOpen(true); setDetailId(id); }
    function selectReport(id: string) { setSelectedId(id); setCardOpen(true); setDetailId(""); setPanel("map"); }
    function openDetail(id: string) { setDetailReturnPanel(panel); setSelectedId(id); setCardOpen(true); setDetailId(id); }
    function closeDetail() { setDetailId(""); setPanel(detailReturnPanel); }
    function applyPreferences(next: Preferences) { const validDays = [1, 7, 30, 90, 180, 365]; const days = validDays.includes(Number(next.default_days)) ? Number(next.default_days) : 30; setPreferences({ ...defaultPreferences, ...next, default_days: days }); setMapView("density"); setTimeDays(days); }
    async function savePreferences(next: Preferences) { setPreferences(next); setPreferencesStatus("Saving…"); try {
        const data = await request("/api/profile", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ preferences: next }) });
        applyPreferences(data.preferences);
        setPreferencesStatus("Saved");
        setTimeout(() => setPreferencesStatus(""), 1200);
    }
    catch (e) {
        setPreferencesStatus(e instanceof Error ? e.message : "Could not save preferences");
    } }
    function changeZoom(amount: number) { setZoom(current => Math.min(15, Math.max(2, current + amount))); }
    function mapPointerDown(event: ReactPointerEvent<HTMLDivElement>) { if (event.pointerType === "mouse" && event.button !== 0)
        return; event.currentTarget.classList.add("map-moving"); if (pointers.current.size === 0)
        mapGesture.current = false; const reportTarget = selectingReportLocation ? null : (event.target as HTMLElement).closest<HTMLElement>("[data-report-id]"); pendingReportTap.current = reportTarget ? { id: reportTarget.dataset.reportId!, x: event.clientX, y: event.clientY, pointerId: event.pointerId } : null; if (!reportTarget && !selectingReportLocation)
        setCardOpen(false); event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.current.size === 1) {
        const p = project(center.lat, center.lon, zoom);
        drag.current = { pointerX: event.clientX, pointerY: event.clientY, centerX: p.x, centerY: p.y };
        pinch.current = null;
    }
    else if (pointers.current.size === 2) {
        mapGesture.current = true;
        pendingReportTap.current = null;
        const [a, b] = [...pointers.current.values()];
        const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        const p = project(center.lat, center.lon, zoom);
        pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom, worldX: p.x + midX - viewport.width / 2, worldY: p.y + midY - viewport.height / 2 };
        drag.current = null;
    } }
    function mapPointerMove(event: ReactPointerEvent<HTMLDivElement>) { if (!pointers.current.has(event.pointerId))
        return; if (drag.current && Math.hypot(event.clientX - drag.current.pointerX, event.clientY - drag.current.pointerY) > 5)
        mapGesture.current = true; pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (pointers.current.size === 2 && pinch.current) {
        mapGesture.current = true;
        const [a, b] = [...pointers.current.values()];
        const distance = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
        const next = Math.min(15, Math.max(2, pinch.current.zoom + Math.log2(distance / pinch.current.distance)));
        const ratio = 2 ** (next - pinch.current.zoom);
        const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        setZoom(next);
        setCenter(unproject(pinch.current.worldX * ratio - (midX - viewport.width / 2), pinch.current.worldY * ratio - (midY - viewport.height / 2), next));
    }
    else if (drag.current) {
        setCenter(unproject(drag.current.centerX - (event.clientX - drag.current.pointerX), drag.current.centerY - (event.clientY - drag.current.pointerY), zoom));
    } }
    function mapPointerEnd(event: ReactPointerEvent<HTMLDivElement>) { if (event.pointerType === "mouse" && event.button !== 0)
        return; const tap = pendingReportTap.current; const singleTap = !mapGesture.current && pointers.current.size === 1; const shouldOpen = !!tap && tap.pointerId === event.pointerId && singleTap && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 8; if (selectingReportLocation && singleTap) {
        const rect = event.currentTarget.getBoundingClientRect(), centerPx = project(center.lat, center.lon, zoom), point = unproject(centerPx.x + event.clientX - rect.left - rect.width / 2, centerPx.y + event.clientY - rect.top - rect.height / 2, zoom);
        setReportLocation({ source: "map", label: "Selected point on map", latitude: point.lat, longitude: point.lon, accuracy_meters: 0 });
    } pointers.current.delete(event.pointerId); pendingReportTap.current = null; pinch.current = null; drag.current = null; if (!pointers.current.size)
        event.currentTarget.classList.remove("map-moving"); if (shouldOpen)
        selectReport(tap.id); if (pointers.current.size === 1) {
        const [remaining] = [...pointers.current.values()];
        const p = project(center.lat, center.lon, zoom);
        drag.current = { pointerX: remaining.x, pointerY: remaining.y, centerX: p.x, centerY: p.y };
    } }
    function resetMap() { const latitude = Number(reportLocation.latitude), longitude = Number(reportLocation.longitude); if (Number.isFinite(latitude) && Number.isFinite(longitude)) { setCenter({ lat: latitude, lon: longitude }); setZoom(8); setMapLocationStatus("Map reset to your last confirmed location"); setTimeout(() => setMapLocationStatus(""), 2600); return; } locateMe(); }
    function locateMe() { const requestId = ++locationRequest.current; if (!navigator.geolocation) {
        setMapLocationStatus("Location is unavailable on this device.");
        return;
    } setMapLocationStatus("Finding your location…"); navigator.geolocation.getCurrentPosition(pos => { if (requestId !== locationRequest.current)
        return; setCenter({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setZoom(8); setMapLocationStatus("Using your current location"); setTimeout(() => setMapLocationStatus(""), 2600); }, error => { if (requestId !== locationRequest.current)
        return; setMapLocationStatus(error.code === 1 ? "Location permission denied. Showing your previous map view." : "Location unavailable. Showing your previous map view."); setTimeout(() => setMapLocationStatus(""), 5000); }, { enableHighAccuracy: true, timeout: 12000 }); }
    async function openLocations() { setLocationOpen(true); setPopularLocations([]); if (!token) {
        setSavedLocations([]);
        return;
    } const data = await request("/api/locations/saved", { headers: { Authorization: `Bearer ${token}` } }); setSavedLocations(data.locations || []); }
    function chooseLocation(item: any) { setCenter({ lat: Number(item.latitude), lon: Number(item.longitude) }); setZoom(Number(item.zoom) || 7); setLocationOpen(false); }
    async function saveCurrentLocation() { if (!token) {
        setLocationOpen(false);
        setAuthOpen(true);
        return;
    } const label = prompt("Name this saved location", "Favorite area"); if (!label)
        return; await request("/api/locations/saved", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ label, latitude: center.lat, longitude: center.lon, zoom }) }); await openLocations(); }
    function markerPosition(r: MapReport) { const point = project(r.zone_latitude, r.zone_longitude, zoom); let dx = point.x - mapGeometry.centerPx.x; if (dx > mapGeometry.size / 2)
        dx -= mapGeometry.size; if (dx < -mapGeometry.size / 2)
        dx += mapGeometry.size; return { left: dx + viewport.width / 2, top: point.y - mapGeometry.centerPx.y + viewport.height / 2 }; }
    function toggleSaved(id: string) { if (!token) {
        setAuthOpen(true);
        return;
    } setSavedIds(current => { const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]; localStorage.setItem("flyway_saved", JSON.stringify(next)); return next; }); }
    async function authenticate() { if (authBusy)
        return; setAuthBusy(true); setAuthError(""); try {
        const data = await request(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, display_name: displayName }) });
        if (!data.access_token) {
            setAuthError("Check your email to confirm your account, then sign in.");
            setAuthMode("login");
            return;
        }
        localStorage.setItem("flyway_session", JSON.stringify(data));
        localStorage.setItem("feathermap_session_started_at", String(Date.now()));
        setToken(data.access_token);
        const p = await request("/api/profile", { headers: { Authorization: `Bearer ${data.access_token}` } });
        setProfile(p);
        applyPreferences(p.preferences || defaultPreferences);
        setAuthOpen(false);
        const returnTo = new URLSearchParams(location.search).get("returnTo");
        if (returnTo?.startsWith("/"))
            location.href = returnTo;
    }
    catch (e) {
        setAuthError(e instanceof Error ? e.message : "Sign in failed");
    }
    finally {
        setAuthBusy(false);
    } }
    async function recover() { if (authBusy)
        return; setAuthBusy(true); setAuthError("Sending a secure recovery link…"); try {
        const data = await request("/api/auth/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        setAuthError(data.message);
    }
    catch {
        setAuthError("If an account exists, a recovery link will be sent.");
    }
    finally {
        setAuthBusy(false);
    } }
    async function changePassword() { setSecurityStatus("Updating…"); try {
        const data = await request("/api/auth/password", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password: newPassword }) });
        setNewPassword("");
        setSecurityStatus(data.message);
    }
    catch (e) {
        setSecurityStatus(e instanceof Error ? e.message : "Password update failed");
    } }
    async function openSecurity() { setSecurityOpen(true); setSecurityStatus(""); try {
        const [mfaData, sessionData] = await Promise.all([request("/api/auth/mfa", { headers: { Authorization: `Bearer ${token}` } }), request("/api/account/sessions", { headers: { Authorization: `Bearer ${token}` } })]);
        setMfa(mfaData); setSessions(sessionData.sessions || []);
    }
    catch (e) {
        setSecurityStatus(e instanceof Error ? e.message : "Security settings unavailable");
    } }
    async function openProfile() { setProfileDraft({ ...profile }); setProfileOpen(true); setSecurityStatus(""); }
    async function saveProfile() { if (profileSaving) return; setProfileSaving(true); setSecurityStatus("Saving profile and map preferences…"); try {
        await request("/api/profile", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(profileDraft) });
        const p = await request("/api/profile", { headers: { Authorization: `Bearer ${token}` } });
        setProfile(p);
        setProfileDraft(p);
        applyPreferences(p.preferences || defaultPreferences);
        setSecurityStatus("Profile and map preferences saved");
    }
    catch (e) {
        setSecurityStatus(e instanceof Error ? e.message : "Could not save profile");
    } finally { setProfileSaving(false); } }
    async function signoutAll() { if (!confirm("Sign out every device, including this one?"))
        return; await request("/api/account/signout-all", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); localStorage.removeItem("flyway_session"); location.href = "/"; }
    async function signoutSession(id: string) { if (!confirm("Sign out this device?")) return; setSecurityStatus("Signing out device…"); try { await request(`/api/account/sessions/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); const data = await request("/api/account/sessions", { headers: { Authorization: `Bearer ${token}` } }); setSessions(data.sessions || []); setSecurityStatus("Device signed out"); } catch (error) { setSecurityStatus(error instanceof Error ? error.message : "Could not sign out device"); } }
    async function deleteAccount() { if (deleteBusy || deleteConfirmation !== "DELETE" || !deleteAcknowledged)
        return; setDeleteBusy(true); setDeleteStatus(""); try {
        await request("/api/account/delete", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePassword, confirmation: deleteConfirmation, acknowledge: deleteAcknowledged }) });
        localStorage.removeItem("flyway_session");
        localStorage.removeItem("flyway_profile");
        location.href = "/";
    }
    catch (error) {
        setDeleteStatus(error instanceof Error ? error.message : "Account deletion failed");
        setDeleteBusy(false);
    } }
    async function openNotifications() { setNotificationsOpen(true); const data = await request("/api/notifications", { headers: { Authorization: `Bearer ${token}` } }); setNotifications(data.notifications || []); }
    async function reportContent(content_type: string, content_id: string) { if (!token) {
        setAuthOpen(true);
        return;
    } const reason = prompt("Why are you reporting this content?", "other"); if (!reason)
        return; await request("/api/flags", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ content_type, content_id, reason }) }); setCommentStatus("Submitted for moderator review."); }
    async function enrollMfa() { setSecurityStatus("Creating authenticator enrollment…"); try {
        const data = await request("/api/auth/mfa/enroll", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        setMfaEnroll({ ...data, totp: { ...data.totp, qr_code: qrSource(data.totp?.qr_code) } });
        setSecurityStatus("Scan the QR code, then enter the six-digit code.");
    }
    catch (e) {
        setSecurityStatus(e instanceof Error ? e.message : "Enrollment failed");
    } }
    async function verifyMfa() { if (!mfaEnroll?.id)
        return; setSecurityStatus("Verifying…"); try {
        const challenge = await request(`/api/auth/mfa/${mfaEnroll.id}/challenge`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        await request(`/api/auth/mfa/${mfaEnroll.id}/verify`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ challenge_id: challenge.id, code: mfaCode }) });
        setMfaEnroll(null);
        setMfaCode("");
        setSecurityStatus("Authenticator app enabled.");
        setMfa(await request("/api/auth/mfa", { headers: { Authorization: `Bearer ${token}` } }));
    }
    catch (e) {
        setSecurityStatus(e instanceof Error ? e.message : "Verification failed");
    } }
    async function openReport() { if (!token) {
        setAuthOpen(true);
        return;
    } setReportType("seen"); setReportBirds([freshReportBird(species, amount)]); setObservedAt(localDateTime()); setReportLocation({ source: "current", label: "Current device location", latitude: null, longitude: null, accuracy_meters: 0 }); setReportLocationState("idle"); setPlaceResults([]); setPopularLocations([]); setReporting(true); try {
        const data = await request("/api/locations/saved", { headers: { Authorization: `Bearer ${token}` } });
        setSavedLocations(data.locations || []);
    }
    catch {
        setSavedLocations([]);
    } }
    function chooseReportLocation(item: any, source: string) { setReportLocation({ source, label: item.label, latitude: Number(item.latitude), longitude: Number(item.longitude), accuracy_meters: 0 }); setReportLocationState("selected"); }
    async function selectCurrentReportLocation() { if (reportLocationState === "loading") return; setReportLocationState("loading"); setStatus(""); setReportLocation({ source: "current", label: "Getting your location…", latitude: null, longitude: null, accuracy_meters: 0 }); try { const location = await webLocationService.current(); setReportLocation({ source: "current", label: "Current location selected", latitude: location.latitude, longitude: location.longitude, accuracy_meters: location.accuracy_meters }); setReportLocationState("selected"); } catch { setReportLocation({ source: "current", label: "Location unavailable. Choose on map instead.", latitude: null, longitude: null, accuracy_meters: 0 }); setReportLocationState("error"); } }
    async function searchReportPlaces() { if (placeQuery.trim().length < 3)
        return; setStatus("Searching locations…"); try {
        const data = await request(`/api/locations/search?q=${encodeURIComponent(placeQuery.trim())}`);
        setPlaceResults(data.locations || []);
        setStatus("");
    }
    catch (e) {
        setStatus(e instanceof Error ? e.message : "Could not search locations");
    } }
    async function submitAt(latitude: number, longitude: number, accuracy_meters = 0) {
        const primary = reportBirds[0] || freshReportBird(species, amount);
        const entries = [primary, ...reportBirds.slice(1)].map(({ id, ...entry }) => entry);
        const payload = { client_report_id: clientReportId, species: primary.species, subspecies: primary.subspecies, count_range: primary.count_range, flock_size: amountValues[primary.count_range], entries, behavior, notes, observed_weather: observedWeather, latitude, longitude, accuracy_meters, occurred_at: new Date(observedAt).toISOString(), location_source: reportLocation.source };
        const draft: ReportDraft = { id: clientReportId, state: webNetworkService.online() ? "syncing" : "queued", updatedAt: new Date().toISOString(), retryCount: 0, payload };
        await webDraftRepository.put(draft);
        if (!webNetworkService.online()) {
            setStatus("Saved on this device. Keep this page available and submit when you are online.");
            return;
        }
        try {
            setStatus("Sharing protected activity…");
            const created = await request("/api/sightings", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-FeatherMap-Version": "0.1.0", "X-FeatherMap-Platform": "web" }, body: JSON.stringify(payload) });
            if (reportType === "harvest") {
                const observedCount = reportBirds.reduce((total, entry) => {
                    const range = countRanges.find(item => item.slug === entry.count_range);
                    if (!range)
                        return total;
                    const maximum = range.maximum_count == null ? range.minimum_count : range.maximum_count;
                    return total + Math.round((Number(range.minimum_count) + Number(maximum)) / 2);
                }, 0);
                await request("/api/harvests", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...harvestDraft, linked_sighting_id: created.id, occurred_at: new Date(observedAt).toISOString(), observed_count: observedCount, observed_count_range_slug: reportBirds[0]?.count_range || null, observed_count_label: countRanges.find(item => item.slug === reportBirds[0]?.count_range)?.display_label || null, latitude, longitude, location_source: reportLocation.source, notes, weather: observedWeather, items: harvestItems.filter(item => Number(item.recovered_count) > 0) }) });
            }
            await webDraftRepository.remove(clientReportId);
            setClientReportId(newClientId());
            if (photo) {
                setStatus("Compressing and sanitizing photo…");
                const safe = await compressImage(photo);
                try {
                    await uploadReportPhoto(created.id, safe);
                }
                catch {
                    setPhotoRetry({ sightingId: created.id, file: safe });
                    setStatus("Your report was saved, but the photo could not be uploaded. Retry the photo without creating another report.");
                    await Promise.all([load(), loadOwnedReports()]);
                    setReporting(false);
                    setSelectedId(created.id);
                    setCardOpen(false);
                    setDetailId(created.id);
                    return;
                }
            }
            setPhotoRetry(null);
            setStatus(created.idempotent_replay ? "This report was already received." : "Activity shared. Your exact location stays private.");
            setNotes("");
            setPhoto(null);
            setObservedWeather({ sky: "", precipitation: "none", wind: "", wind_direction: "", temperature: "", temperature_unit: "F", visibility: "" });
            setReportBirds([freshReportBird(species, amount)]);
            if (reportType === "harvest") {
                setHarvestDraft({ occurred_at: localDateTime(), ended_at: "", hunter_count: 1, observed_count: 0, shots_fired: "", unrecovered_count: "", notes: "" });
                setHarvestItems([{ species_slug: catalog[0]?.slug || "mallard", subspecies_slug: "", recovered_count: 0 }]);
            }
            await Promise.all([load(), loadOwnedReports()]);
            setReporting(false);
            setStatus("");
            setSelectedId(created.id);
            setCardOpen(false);
            setDetailId(created.id);
        }
        catch (e) {
            await webDraftRepository.put({ ...draft, state: "failed", retryCount: 1, lastError: e instanceof Error ? e.message : "Submission failed", updatedAt: new Date().toISOString() });
            setStatus(e instanceof Error ? e.message : "Your report could not be submitted. It remains saved on this device.");
        }
    }
    async function uploadReportPhoto(sightingId: string, file: File) { return request(`/api/sightings/${sightingId}/photos`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.type, "X-FeatherMap-Version": "0.1.0", "X-FeatherMap-Platform": "web" }, body: file }); }
    async function retryReportPhoto() { if (!photoRetry)
        return; setStatus("Retrying photo upload…"); try {
        await uploadReportPhoto(photoRetry.sightingId, photoRetry.file);
        setPhotoRetry(null);
        setPhoto(null);
        setNotes("");
        setStatus("Photo uploaded. Your report is complete.");
        setTimeout(() => { setReporting(false); setStatus(""); }, 1400);
    }
    catch {
        setStatus("The photo still could not be uploaded. Your report remains safely saved.");
    } }
    async function submit() { if (!observedAt) {
        setStatus("Choose when you observed the birds.");
        return;
    } if (!Number.isFinite(reportLocation.latitude) || !Number.isFinite(reportLocation.longitude)) {
        setStatus("Select Current location or Choose on map before sharing.");
        return;
    } return submitAt(reportLocation.latitude, reportLocation.longitude, reportLocation.accuracy_meters); }
    async function saveBandedBird() { if (bandedBusy)
        return; setBandedBusy(true); setBandedStatus("Preparing protected band encounter…"); try {
        const location = reportLocation.source === "current" ? await webLocationService.current() : { latitude: Number(reportLocation.latitude), longitude: Number(reportLocation.longitude), accuracy_meters: reportLocation.accuracy_meters };
        if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) throw new Error("Choose a report location.");
        const created = await request("/api/banded-birds", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-FeatherMap-Version": "0.1.0", "X-FeatherMap-Platform": "web" }, body: JSON.stringify({ ...bandedDraft, category_slug: categoryFor(species), species_slug: species, subspecies_slug: subspecies, occurred_at: observedAt, notes, latitude: location.latitude, longitude: location.longitude, location_source: reportLocation.source }) });
        if (photo && created.sighting_id) await uploadReportPhoto(created.sighting_id, await compressImage(photo));
        setBandedStatus("Banded bird report saved.");
        setBandedDraft(freshBandedDraft());
        setNotes(""); setPhoto(null);
        await load();
        setTimeout(() => { setReporting(false); setBandedStatus(""); }, 900);
    }
    catch (error) {
        setBandedStatus(error instanceof Error ? error.message : "Could not save banded bird report");
    }
    finally {
        setBandedBusy(false);
    } }
    async function postComment() { if (!token) {
        setAuthOpen(true);
        return;
    } if (!detail || !comment.trim())
        return; setCommentStatus("Posting…"); try {
        await request(`/api/sightings/${detail.id}/comments`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ body: comment }) });
        setComment("");
        const data = await request(`/api/sightings/${detail.id}/comments`);
        setComments(data.comments || []);
        setCommentStatus("");
    }
    catch (e) {
        setCommentStatus(e instanceof Error ? e.message : "Could not post comment");
    } }
    async function confirm() { if (!token) {
        setAuthOpen(true);
        return;
    } if (!selected || confirmationState.confirmed || confirmationState.own_report || confirmationState.loading)
        return; setConfirmationState(s => ({ ...s, loading: true, error: undefined })); try {
        await request(`/api/sightings/${selected.id}/confirm`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        setConfirmationState({ confirmed: true, own_report: false, loading: false });
        setReports(rows => rows.map(r => r.id === selected.id ? { ...r, confirmations: Number(r.confirmations || 0) + 1 } : r));
    }
    catch (e) {
        setConfirmationState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Confirmation failed" }));
    } }
    function deleteOwnReport(id: string) { if (!token || !confirmationState.own_report)
        return; const target = reports.find(report => report.id === id); if (target)
        setDeleteReportTarget(target); }
    async function confirmDeleteReport() { if (!deleteReportTarget || deleteReportBusy)
        return; setDeleteReportBusy(true); setCommentStatus(""); try {
        await request(`/api/sightings/${deleteReportTarget.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        setReports(rows => rows.filter(row => row.id !== deleteReportTarget.id));
        setSavedIds(ids => ids.filter(value => value !== deleteReportTarget.id));
        setDetailId("");
        setCardOpen(false);
        setSelectedId("");
        setDeleteReportTarget(null);
    }
    catch (e) {
        setCommentStatus(e instanceof Error ? e.message : "Could not delete report");
    }
    finally {
        setDeleteReportBusy(false);
    } }
    async function openHarvestJournal() { setHarvestOpen(true); setHarvestView("journal"); setHarvestStatus("Loading journal…"); try { const data = await request("/api/harvests", { headers: { Authorization: `Bearer ${token}` } }); setHarvestJournal(data); setHarvestStatus(""); } catch (error) { setHarvestStatus(error instanceof Error ? error.message : "Could not load harvest journal"); } }
    async function removeHarvest(id: string) { if (!confirm("Delete this private harvest entry? This cannot be undone.")) return; try { await request(`/api/harvests/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); await openHarvestJournal(); } catch (error) { setHarvestStatus(error instanceof Error ? error.message : "Could not delete harvest entry"); } }
    async function saveHarvest() { setHarvestStatus("Saving private harvest…"); try {
        await request("/api/harvests", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...harvestDraft, occurred_at: new Date(harvestDraft.occurred_at).toISOString(), ended_at: harvestDraft.ended_at ? new Date(harvestDraft.ended_at).toISOString() : null, items: harvestItems }) });
        setHarvestDraft({ occurred_at: localDateTime(), ended_at: "", hunter_count: 1, observed_count: 0, shots_fired: "", unrecovered_count: "", notes: "" }); setHarvestItems([{ species_slug: catalog[0]?.slug || "mallard", subspecies_slug: "", recovered_count: 0 }]); await openHarvestJournal(); setHarvestStatus("Private harvest saved");
    }
    catch (error) {
        setHarvestStatus(error instanceof Error ? error.message : "Could not save harvest");
    } }
    async function logout() { try {
        await request("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    }
    catch { } localStorage.removeItem("flyway_session"); localStorage.removeItem("feathermap_session_started_at"); setToken(""); setProfile(null); setPanel("map"); }
    async function continueSession(extend = true) { if (sessionRefreshing || profile?.session_policy?.allow_extension === false)
        return; setSessionRefreshing(true); setSessionRefreshError(""); try {
        const saved = JSON.parse(localStorage.getItem("flyway_session") || "{}");
        const refreshed = await request("/api/auth/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: saved.refresh_token }) });
        localStorage.setItem("flyway_session", JSON.stringify(refreshed));
        if (extend)
            localStorage.setItem("feathermap_session_started_at", String(Date.now()));
        setToken(refreshed.access_token);
        setSessionSeconds(null);
    }
    catch (error) {
        setSessionRefreshError(error instanceof Error ? error.message : "Your session could not be refreshed. Try again.");
    }
    finally {
        setSessionRefreshing(false);
    } }
    const reportList = (items: MapReport[], empty: string) => <div className="activity-list" aria-live="polite">{items.length ? items.map(r => { const isNew=highlightedActivityIds.includes(r.id), behaviorLabel=labels[r.behavior] || String(r.behavior || "Reported activity").replaceAll("_", " "); return <button className={`activity-row${r.owner ? " owned-report-row" : ""}${isNew ? " new-activity-row" : ""}`} aria-label={`Open ${displayLabel(r.species)} report by ${r.reporter_name || "FeatherMap member"}`} key={r.id} onClick={() => showReport(r.id)}><span className={`duck-badge ${r.color || "gray"}`} aria-hidden="true">⌁</span><span><b>{displayLabel(r.species)}</b><small>{r.flock_size || "Reported"} birds · {behaviorLabel} · {r.reporter_name || "FeatherMap member"}</small><span className="activity-row-flags">{isNew && <i>New</i>}{r.owner && <i>Your report</i>}{r.has_photo && <i>Photo</i>}{(r.report_type === "banded" || Boolean(r.banded) || (r.banded_entries?.length ?? 0)>0) && <i>Banded</i>}</span></span><span className="row-meta">{r.age || age(r.occurred_at)}<small>{Number(r.confidence)||0}% confidence</small></span></button>}) : <div className="panel-empty">{empty}</div>}</div>;
    const ownedIds = new Set(ownedMapReports.map(report => report.id));
    const mapActivity = visibleReports.filter(report => !ownedIds.has(report.id)).map(report => ({ id: report.id, latitude: Number(report.zone_latitude), longitude: Number(report.zone_longitude), color: categoryColor(categoryFor(report.species)), birds: Math.max(1, Number(report.estimated_birds) || Number(String(report.flock_size).replace(/[^0-9]/g, "")) || 1), banded: report.report_type === "banded" }));
    const aggregateActivity = heatCells.map((cell, index) => ({ id: `aggregate-${index}`, latitude: Number(cell.cell_latitude), longitude: Number(cell.cell_longitude), color: categoryColor(cell.dominant_category), birds: Math.max(1, Number(cell.estimated_birds) || Number(cell.report_count) || 1) }));
    const ownedActivity = ownedMapReports.filter(report => preferences.visible_groups.includes(categoryFor(report.species)) && (filter === "all" || filter === categoryFor(report.species)) && (taxonFilters === null || taxonFilters.includes(report.subspecies || report.species))).map(report => ({ id: report.id, latitude: Number(report.latitude), longitude: Number(report.longitude), color: categoryColor(categoryFor(report.species)), birds: Math.max(1, Number(report.estimated_birds) || 1), owner: true }));
    const priorityBandedActivity = bandedMapReports.filter(report => !ownedIds.has(report.sighting_id) && preferences.visible_groups.includes(categoryFor(report.species)) && (filter === "all" || filter === categoryFor(report.species)) && (taxonFilters === null || taxonFilters.includes(report.subspecies || report.species))).map(report => ({ id: report.sighting_id, latitude: Number(report.zone_latitude), longitude: Number(report.zone_longitude), color: categoryColor(categoryFor(report.species)), birds: 1, banded: true }));
    const openAdmin = () => { location.href = "/admin"; };
    const renderAdmin = () => null;
    const reportContextPanel = <aside className="report-context-panel report-time-panel" aria-label="Observation time"><h3>Observation details</h3><label>When observed<input type="datetime-local" value={observedAt} min={localDateTime(Date.now() - 7 * 86400000)} max={localDateTime()} onChange={e => setObservedAt(e.target.value)}/></label>{Date.now() - new Date(observedAt).getTime() > 3600000 && <p className="delayed-report-note">Delayed report · observed {age(new Date(observedAt).toISOString())} ago</p>}</aside>;
    return <main className="app-shell">{reporting && reportContextPanel}{selectingReportLocation && <aside className="map-location-picker" aria-live="polite"><div><b>Choose observation location</b><span>Tap the map to place the private report pin. Pan or zoom to refine it.</span></div><button onClick={() => { setSelectingReportLocation(false); setReporting(true); }}>Cancel</button><button className="primary" disabled={reportLocation.source !== "map"} onClick={() => { setSelectingReportLocation(false); setReporting(true); }}>Use selected point</button></aside>}<section className="map" aria-label="Duck activity map">{mapLocationStatus && <div className="map-location-status" role="status" aria-live="polite"><span className={mapLocationStatus.startsWith("Finding") ? "location-spinner" : ""}/><b>{mapLocationStatus}</b>{mapLocationStatus.startsWith("Finding") && <button onClick={() => { locationRequest.current++; setMapLocationStatus(""); }}>Skip</button>}</div>}
    <header className="topbar"><div className="brand" aria-label="FeatherMap"><div className="brandmark" aria-hidden="true">F</div><div><strong>FEATHERMAP</strong><span>MIGRATORY ACTIVITY, EXACT LOCATIONS PROTECTED</span></div></div><button className="area" onClick={resetMap}><span><small>LIVE WORLD MAP</small>{zoom <= 3 ? "Worldwide bird activity" : zoom <= 5 ? "United States activity" : `${Math.abs(center.lat).toFixed(1)}°${center.lat >= 0 ? "N" : "S"}, ${Math.abs(center.lon).toFixed(1)}°${center.lon >= 0 ? "E" : "W"}`}</span></button><div className="weather"><span>◎</span><div><b>Global</b><small>Pan anywhere · Live reports</small></div></div><button className="avatar" onClick={() => profile ? setPanel("more") : setAuthOpen(true)} aria-label={profile ? "Open account" : "Sign in"}>{profile?.display_name?.slice(0, 2).toUpperCase() || "IN"}</button></header>
    {panel === "map" && <><aside className="filters" aria-label="Bird category filters">{[{ slug: "all", display_name: "All birds" }, ...categories].map(value => <span className={`filter-composite ${filter === value.slug ? "active" : ""}`} key={value.slug}><button className="filter" aria-pressed={filter === value.slug} onClick={() => { setFilter(value.slug); if (value.slug === "all") setOpenCategory(""); }}>{value.display_name}{value.slug !== "all" && filter === value.slug && taxonFilters !== null ? ` · ${taxonFilters.length}` : ""}</button>{value.slug !== "all" && <button className="filter-refine" aria-label={`${openCategory === value.slug ? "Collapse" : "Refine"} ${value.display_name}`} aria-expanded={openCategory === value.slug} onClick={event => { if (filter !== value.slug) setFilter(value.slug); setOpenCategory(current => current === value.slug ? "" : value.slug); event.currentTarget.parentElement?.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"}); }}><svg aria-hidden="true" viewBox="0 0 20 20" focusable="false"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg></button>}</span>)}</aside><div className="timeframe-control"><select className="time-filter" value={timeDays} onChange={e => setTimeDays(Number(e.target.value))} aria-label="Sighting timeframe"><option value={1}>Past 24 hours</option><option value={7}>Past 7 days</option><option value={30}>Past 30 days</option><option value={90}>Past 90 days</option><option value={180}>Past 6 months</option><option value={365}>Past year</option><option value={0}>Custom dates</option></select>{timeDays === 0 && <span className="custom-range"><label>From<input type="date" value={customRange.start} max={customRange.end || new Date().toISOString().slice(0, 10)} onChange={e => setCustomRange({ ...customRange, start: e.target.value })}/></label><label>To<input type="date" value={customRange.end} min={customRange.start} max={new Date().toISOString().slice(0, 10)} onChange={e => setCustomRange({ ...customRange, end: e.target.value })}/></label></span>}</div>
    <div ref={mapRef} className="map-canvas maplibre-host">
      <StableMap camera={{ ...center, zoom }} activity={mapActivity} aggregate={aggregateActivity} priority={priorityBandedActivity} owned={ownedActivity} aggregateMode={useAggregateActivity} selectingLocation={selectingReportLocation} selectedLocation={selectingReportLocation && reportLocation.source === "map" ? { latitude: Number(reportLocation.latitude), longitude: Number(reportLocation.longitude) } : null} onCameraChange={camera => { setCenter({ lat: camera.lat, lon: camera.lon }); setZoom(camera.zoom); }} onSelectReport={selectReport} onSelectLocation={point => { setReportLocation({ source: "map", label: "Selected point on map", latitude: point.latitude, longitude: point.longitude, accuracy_meters: 0 }); setReportLocationState("selected"); }}/>
      {showFlyways && <MigrationOverlay catalog={catalog} category={filter} center={center} zoom={zoom} width={viewport.width} height={viewport.height}/>}
      {mapRefreshAvailable && <button className="map-refresh-notice" onClick={() => { setMapRefreshAvailable(false); setNewActivityCount(0); void load(); void loadOwnedReports(); }}><span aria-hidden="true">●</span> New activity · Refresh map</button>}
      {!activityIsLoading && activeActivityCount === 0 && <div className="empty-map"><b>No reports match these filters</b><span>Adjust the bird or date filters, or share protected activity.</span></div>}
    </div>
    <div className="map-controls" aria-label="Map controls"><button onClick={() => changeZoom(.75)} aria-label="Zoom in">+</button><button onClick={() => changeZoom(-.75)} aria-label="Zoom out">−</button><button className="reset-map" onClick={resetMap} aria-label="Reset map near my location" title="Reset map near my location">⌖</button><button onClick={() => setLayersOpen(true)} aria-label="Map layers" aria-expanded={layersOpen}>▧</button><span>ZOOM {zoom.toFixed(1)}</span></div><div className="map-attribution">© OpenStreetMap contributors</div>
    {cardOpen && selected && visibleReports.some(r => r.id === selected.id) && <section className="report-card"><button className="close-card" onClick={() => setCardOpen(false)} aria-label="Dismiss live activity">×</button><div className="report-head"><div className={`duck-badge ${selected.color}`}>⌁</div><div><span className="eyebrow">LIVE ACTIVITY · {selected.age.toUpperCase()} AGO</span><h2>{displayLabel(selected.species)}</h2><small className="reporter-name">Reported by {selected.reporter_name || "Anonymous"}</small><div className="report-indicators">{selected.has_photo && <button className="report-indicator photo" aria-label="View attached photo" title="Photo attached" onClick={() => openDetail(selected.id)}><span aria-hidden="true">▣</span> Photo</button>}{(selected.report_type === "banded" || Boolean(selected.banded) || (selected.banded_entries?.length ?? 0) > 0) && <button className="report-indicator banded" aria-label="View banded bird details" title="Banded bird reported" onClick={() => openDetail(selected.id)}><span aria-hidden="true">★</span> Banded</button>}</div></div><button className={`save-btn ${savedIds.includes(selected.id) ? "saved" : ""}`} onClick={() => toggleSaved(selected.id)} aria-label={savedIds.includes(selected.id) ? "Remove saved sighting" : "Save sighting"}>{savedIds.includes(selected.id) ? "★" : "☆"}</button><div className="confidence"><b>{selected.confidence}%</b><span>CONFIDENCE</span></div></div><div className="stats"><div><span>ESTIMATED FLOCK</span><strong>{selected.flock_size} birds</strong></div><div><span>BEHAVIOR</span><strong>{labels[selected.behavior]}</strong></div><div><span>CONFIRMED</span><strong className="up">{selected.confirmations} hunters</strong></div></div><div className="privacy"><span><b>Location protected</b>This report is displayed as a randomized activity zone. The hunter’s exact spot is never returned.</span></div><div className="confirm"><span>Seen them too?</span><button className="card-detail-btn" onClick={() => openDetail(selected.id)}>View details</button><button className="confirm-btn" onClick={confirm}>✓ Confirm activity</button></div></section>}</>}
    {panel !== "map" && <div className="panel-backdrop" onClick={() => setPanel("map")}><section className="content-panel" onClick={e => e.stopPropagation()}><div className="panel-head"><div><span className="eyebrow">FEATHERMAP NETWORK</span><h2>{panel === "activity" ? "Activity" : panel === "saved" ? "Saved sightings" : panel === "admin" ? "Administration" : "Your account"}</h2></div><div className="panel-actions">{panel === "activity" && <button onClick={() => { setNewActivityCount(0); setMapRefreshAvailable(false); void load(); void loadOwnedReports(); }}>↻ Refresh</button>}<button className="panel-close" onClick={() => setPanel("map")} aria-label="Close and return to map">×</button></div></div>{panel === "activity" && <><nav className="activity-tabs" aria-label="Activity views"><button className={activityView === "community" ? "active" : ""} onClick={() => { setActivityView("community"); setNewActivityCount(0); }}>Community activity{newActivityCount > 0 && <span className="activity-count">{newActivityCount}</span>}</button>{token && <button className={activityView === "mine" ? "active" : ""} onClick={() => setActivityView("mine")}>My reports <span>{ownedMapReports.length}</span></button>}{profile?.role !== "user" && <button className={activityView === "review" ? "active" : ""} onClick={() => setActivityView("review")}><span aria-hidden="true">◆</span> Review{reviewTaskCount > 0 && <span className="review-count">{reviewTaskCount}</span>}</button>}</nav>{activityView === "community" && reportList(reports, "No recent reports yet.")}{activityView === "mine" && reportList(ownedDisplayReports, "You have not shared a report in this timeframe.")}{activityView === "review" && <div className="review-activity-summary"><b>{reviewTaskCount ? `${reviewTaskCount} moderation ${reviewTaskCount === 1 ? "task" : "tasks"} need attention` : "No active moderation tasks"}</b><a href="/admin?view=moderation">Open review queue</a></div>}</>}{panel === "saved" && reportList(savedReports, "Save useful sightings from the map and they’ll appear here on this device.")}{panel === "admin" && renderAdmin()}{panel === "more" && <div className="account-card"><div className="account-avatar">{profile?.display_name?.slice(0, 2).toUpperCase() || "IN"}</div><h3>{profile?.display_name || "Hunter"}</h3>{profile?.email && <p className="account-email">{profile.email}</p>}<p>Manage your profile, preferences, security, and activity using the controls below.</p>{profile && <nav className="account-actions" aria-label="Account actions"><button onClick={openProfile}>Edit profile</button><button onClick={openNotifications}>Notifications</button><button onClick={openSecurity}>Password &amp; security</button><button onClick={openHarvestJournal}>Field notes</button>{profile.role !== "user" && <a href="/admin">Admin Portal</a>}<button className="signout" onClick={logout}>Sign out</button></nav>}</div>}</section></div>}
    <nav className="bottom-nav"><button className={panel === "map" ? "active" : ""} onClick={() => setPanel("map")}><span className="icon">⌖</span>Map</button><button className={panel === "activity" ? "active" : ""} onClick={() => setPanel("activity")}><span className="icon">≡</span>Activity{newActivityCount > 0 && <span className="nav-badge activity-dot" aria-label={`${newActivityCount} new reports`}/>} {reviewTaskCount > 0 && <span className="nav-badge review-shield" aria-label={`${reviewTaskCount} review tasks`}>◆</span>}</button><button className="report-button" onClick={openReport}><span>＋</span>Report birds</button><button className={panel === "saved" ? "active" : ""} onClick={() => token ? setPanel("saved") : setAuthOpen(true)}><span className="icon">☆</span>Saved</button><button className={panel === "more" ? "active" : ""} onClick={() => profile ? setPanel("more") : setAuthOpen(true)}><span className="icon">◌</span>{profile ? "Account" : "Sign in"}</button></nav>
  </section>
  {token && <button className={`feedback-launcher ${feedbackUnread ? "has-unread" : ""}`} onClick={() => setFeedbackOpen(true)} aria-label={feedbackUnread ? `Feedback — ${feedbackUnread} unread update${feedbackUnread === 1 ? "" : "s"}` : "Send product feedback"}>Feedback{feedbackUnread > 0 && <i className="feedback-launcher-dot" aria-hidden="true"/>}</button>}
  {feedbackOpen && <FeedbackPanel token={token} onClose={() => setFeedbackOpen(false)} onUnreadChange={setFeedbackUnread}/>}
  {detail && <aside className="detail-context-tools"><div><span>REPORTED BY</span><b>{detail.reporter_name || "Flyway member"}</b></div>{detail.observed_weather && <div><span>REPORTED CONDITIONS</span><b>{[detail.observed_weather.sky?.replaceAll("_", " "), detail.observed_weather.precipitation, detail.observed_weather.wind && `${detail.observed_weather.wind} wind`].filter(Boolean).join(" · ")}</b><small>{detail.observed_weather.temperature !== undefined ? `${detail.observed_weather.temperature}°${detail.observed_weather.temperature_unit || "F"}` : ""}{detail.observed_weather.wind_direction ? ` · ${detail.observed_weather.wind_direction}` : ""}{detail.observed_weather.visibility ? ` · ${detail.observed_weather.visibility} visibility` : ""}</small></div>}{detail.weather && <div><span>REGIONAL WEATHER SNAPSHOT</span><b>{detail.weather.temperature}° · {detail.weather.wind_speed} {detail.weather.wind_unit}</b><small>{detail.weather.cloud_cover}% cloud · {detail.weather.pressure_msl} hPa</small></div>}{token && <div className="content-report-tools"><button onClick={() => reportContent("sighting", detail.id)}>Report sighting</button>{detail.notes && <button onClick={() => reportContent("note", detail.id)}>Report note</button>}{photos.map(photo => <button key={photo.id} onClick={() => reportContent("photo", photo.id)}>Report photo</button>)}{comments.map(item => <button key={item.id} onClick={() => reportContent("comment", item.id)}>Report comment</button>)}</div>}</aside>}
  {panel === "more" && profile && !profileOpen && !securityOpen && !notificationsOpen && !harvestOpen && !bandedOpen && <div className="account-quick-actions"><button onClick={openProfile}>Edit profile</button><button onClick={openNotifications}>Notifications</button><button onClick={openSecurity}>Password &amp; security</button><button onClick={openHarvestJournal}>Harvest journal</button>{profile.role !== "user" && <a href="/admin">Admin Portal</a>}<button onClick={logout}>Sign out</button></div>}
  {detail && <div className="modal-wrap" onClick={() => setDetailId("")}><article className="modal detail-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PROTECTED ACTIVITY ZONE · {detail.age.toUpperCase()} AGO</span><h2>{displayLabel(detail.species)}</h2><small className="detail-reporter">Reported by {detail.reporter_name || "Anonymous"}</small></div><button onClick={() => setDetailId("")} aria-label="Close details">×</button></div><div className="detail-hero"><div className={`duck-badge ${detail.color}`}>⌁</div><div><b>{detail.flock_size} birds</b><span>{labels[detail.behavior]}</span></div><div className="detail-confidence"><b>{detail.confidence}%</b><span>confidence</span></div></div><div className="detail-grid"><div><span>REPORTED</span><b>{new Date(detail.occurred_at).toLocaleString()}</b></div><div><span>COMMUNITY</span><b>{detail.confirmations} confirmations</b></div><div><span>LOCATION</span><b>Randomized activity zone</b></div><div><span>SPECIES GROUP</span><b>{categories.find(item => item.slug === categoryFor(detail.species))?.display_name || "Migratory bird"}</b></div></div><section className="detail-indicators" aria-label="Report attachments and special observations">{detail.has_photo && <span className="detail-indicator photo"><span aria-hidden="true">▣</span> Photo attached</span>}{(detail.report_type === "banded" || Boolean(detail.banded) || (detail.banded_entries?.length ?? 0) > 0) && <span className="detail-indicator banded"><span aria-hidden="true">★</span> Banded bird</span>}</section>{((detail.banded_entries?.length ?? 0) > 0 || Boolean(detail.banded)) && <section className="banded-detail"><div><span className="eyebrow">BANDED BIRD DETAILS</span><h3>{detail.banded_entries?.length || 1} banded {detail.banded_entries?.length === 1 ? "bird" : "birds"}</h3></div><div className="banded-detail-list">{(detail.banded_entries?.length ? detail.banded_entries : [detail.banded!]).map((band,index) => <article key={`${band.band_number || band.species_slug || "band"}-${index}`}><b>{displayLabel(band.species_slug || detail.species)}</b><span>{[band.subspecies_slug && displayLabel(band.subspecies_slug), band.band_type && band.band_type.replaceAll("_", " "), band.band_color, band.encounter_type && band.encounter_type.replaceAll("_", " ")].filter(Boolean).join(" · ") || "Band details not specified"}</span>{band.band_number && <small>Band {band.band_number}</small>}</article>)}</div></section>}<section className="sighting-story">{detail.notes && <div className="report-note"><span>REPORTER NOTE</span><p>{detail.notes}</p></div>}{photos.length > 0 && <div className="photo-grid">{photos.map(item => <img key={item.id} src={`${API}${item.url}`} alt={`Photo attached to ${displayLabel(detail.species)} sighting`}/>)}</div>}</section><div className="shield"><span>◉</span><div><b>Exact location hidden</b><p>The map displays a randomized zone. The reporting hunter’s exact coordinates, route, and blind are never shown.</p></div></div><section className="comments"><div className="comments-head"><b>Community comments</b><span>{comments.length}</span></div>{comments.length ? <div className="comment-list">{comments.map(item => <article key={item.id}><b>{item.display_name}</b><time>{new Date(item.created_at).toLocaleString()}</time><p>{item.body}</p></article>)}</div> : <p className="no-comments">No comments yet.</p>}<div className="comment-compose"><textarea value={comment} onChange={e => setComment(e.target.value)} maxLength={500} placeholder={token ? "Add a helpful observation…" : "Sign in to comment"} disabled={!token}/><button onClick={postComment}>{token ? "Post" : "Sign in"}</button></div>{commentStatus && <p className="comment-status">{commentStatus}</p>}</section><div className="detail-actions"><button className={`save-detail ${savedIds.includes(detail.id) ? "saved" : ""}`} onClick={() => toggleSaved(detail.id)}>{savedIds.includes(detail.id) ? "★ Saved" : "☆ Save sighting"}</button><button className="confirm-btn" onClick={confirm}>✓ Confirm activity</button>{confirmationState.own_report && <button className="delete-report" onClick={() => deleteOwnReport(detail.id)}>Delete my report</button>}</div></article></div>}
  {reporting && <div className="modal-wrap" onClick={() => setReporting(false)}><div className={`modal report-modal report-type-${reportType}`} onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">COMMUNITY REPORT</span><h2>Report bird activity</h2></div><button onClick={() => setReporting(false)}>×</button></div><div className="report-type-selector" role="group" aria-label="Report type"><button className={reportType === "seen" ? "active" : ""} onClick={() => setReportType("seen")}>Seen</button><button className={reportType === "harvest" ? "active" : ""} onClick={() => setReportType("harvest")}>Harvest</button><button className={reportType === "banded" ? "active" : ""} onClick={() => setReportType("banded")}>Banded bird</button></div><section className="report-location-card"><div className="report-location-card-copy"><span>◉</span><div><b>Your location will be blurred</b><p>Hunters receive a randomized activity zone—not your pin, route, or blind.</p><small className={`report-location-state ${reportLocationState}`}>{reportLocationState === "loading" ? "Getting your location…" : reportLocation.source === "map" && Number.isFinite(reportLocation.latitude) ? "✓ Protected map location selected" : reportLocation.source === "current" && Number.isFinite(reportLocation.latitude) ? "✓ Current location selected" : reportLocation.label}</small></div></div><div className="report-location-card-actions"><button type="button" className={reportLocation.source === "current" && reportLocationState === "selected" && Number.isFinite(reportLocation.latitude) ? "active" : ""} onClick={selectCurrentReportLocation} disabled={reportLocationState === "loading"}><span>{reportLocationState === "loading" && reportLocation.source === "current" ? "Getting location…" : "Current location"}</span>{reportLocation.source === "current" && reportLocationState === "selected" && Number.isFinite(reportLocation.latitude) && <span className="location-choice-check" aria-label="Selected">✓</span>}</button><button type="button" className={reportLocation.source === "map" && reportLocationState === "selected" && Number.isFinite(reportLocation.latitude) ? "active" : ""} onClick={() => { setSelectingReportLocation(true); setReporting(false); }}><span>Choose on map</span>{reportLocation.source === "map" && reportLocationState === "selected" && Number.isFinite(reportLocation.latitude) && <span className="location-choice-check" aria-label="Selected">✓</span>}</button></div>{savedLocations.length > 0 && <label>Saved location<select value="" onChange={event => { const item = savedLocations.find(value => String(value.id) === event.target.value); if (item) chooseReportLocation(item, "saved"); }}><option value="">Choose a saved location…</option>{savedLocations.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}</section><section className="report-birds-inline" aria-label="Birds included in this report"><div className="report-birds-heading"><span className="eyebrow">BIRDS IN THIS REPORT</span><h3>{reportBirds.length} {reportBirds.length === 1 ? "bird entry" : "bird entries"}</h3></div>{reportBirds.map((entry,index)=><article className="report-bird-entry" key={entry.id}><div className="report-bird-entry-head"><strong>{index===0?"Primary bird":`Bird ${index+1}`}</strong>{index>0&&<button type="button" onClick={()=>setReportBirds(items=>items.filter(item=>item.id!==entry.id))}>Remove</button>}</div><div className="report-bird-entry-grid"><label>Species<select value={entry.species} onChange={event=>setReportBirds(items=>items.map(item=>item.id===entry.id?{...item,species:event.target.value,subspecies:""}:item))}>{catalog.map(item=><option key={item.slug} value={item.slug}>{item.display_name}</option>)}</select></label><label>Subspecies (optional)<select value={entry.subspecies} onChange={event=>setReportBirds(items=>items.map(item=>item.id===entry.id?{...item,subspecies:event.target.value}:item))}><option value="">Not specified</option>{subspeciesCatalog.filter(item=>item.species_slug===entry.species).map(item=><option key={item.slug} value={item.slug}>{item.display_name}</option>)}</select></label><label>{reportType === "harvest" ? "How many observed?" : "How many?"}<select value={entry.count_range} onChange={event=>setReportBirds(items=>items.map(item=>item.id===entry.id?{...item,count_range:event.target.value}:item))}>{countRanges.map(item=><option key={item.slug} value={item.slug}>{formatCountRange(item)}</option>)}</select></label></div><label className="banded-toggle"><input type="checkbox" checked={entry.banded} onChange={event=>setReportBirds(items=>items.map(item=>item.id===entry.id?{...item,banded:event.target.checked}:item))}/><span>One bird in this entry was banded</span></label>{entry.banded&&<div className="banded-fields"><p className="privacy-copy">This encounter will appear as a protected star. Submit official recoveries to the appropriate wildlife authority too.</p><div className="banded-grid"><label>Band number<input value={entry.band_number} onChange={event=>setReportBirds(items=>items.map(item=>item.id===entry.id?{...item,band_number:event.target.value}:item))}/></label><label>Band type<select value={entry.band_type} onChange={event=>setReportBirds(items=>items.map(item=>item.id===entry.id?{...item,band_type:event.target.value}:item))}><option value="unknown">Unknown</option><option value="metal">Metal band</option><option value="color">Color band</option><option value="neck_collar">Neck collar</option><option value="wing_tag">Wing tag</option></select></label><label>Band color<input value={entry.band_color} onChange={event=>setReportBirds(items=>items.map(item=>item.id===entry.id?{...item,band_color:event.target.value}:item))}/></label><label>Encounter<select value={entry.encounter_type} onChange={event=>setReportBirds(items=>items.map(item=>item.id===entry.id?{...item,encounter_type:event.target.value}:item))}><option value="observed">Observed</option><option value="photographed">Photographed</option><option value="recovered">Recovered</option><option value="harvested">Harvested</option></select></label></div></div>}</article>)}<button type="button" className="add-bird-entry" onClick={()=>setReportBirds(items=>[...items,freshReportBird(catalog[0]?.slug||species,countRanges[0]?.slug||amount)])}>+ Add another bird</button></section>{reportType === "harvest" && <section className="inline-harvest-fields"><div><span className="eyebrow">PRIVATE HARVEST JOURNAL</span><h3>Recovered harvest</h3><p>Observed birds use the ranges above. Enter only birds recovered.</p></div><div className="harvest-grid"><label>Hunters<NumericStepper label="hunter count" value={Number(harvestDraft.hunter_count)} min={1} max={100} onChange={value => setHarvestDraft({ ...harvestDraft, hunter_count: value ?? 1 })}/></label></div><div className="harvest-items">{harvestItems.map((item,index)=><div key={index}><select aria-label={`Harvest species ${index+1}`} value={item.species_slug} onChange={event=>setHarvestItems(items=>items.map((current,i)=>i===index?{...current,species_slug:event.target.value,subspecies_slug:""}:current))}>{catalog.map(speciesItem=><option key={speciesItem.slug} value={speciesItem.slug}>{speciesItem.display_name}</option>)}</select><select aria-label={`Harvest subspecies ${index+1}`} value={item.subspecies_slug} onChange={event=>setHarvestItems(items=>items.map((current,i)=>i===index?{...current,subspecies_slug:event.target.value}:current))}><option value="">No subspecies</option>{subspeciesCatalog.filter(sub=>sub.species_slug===item.species_slug).map(sub=><option key={sub.slug} value={sub.slug}>{sub.display_name}</option>)}</select><NumericStepper label={`recovered ${displayLabel(item.species_slug)} count`} value={Number(item.recovered_count||0)} min={0} max={1000} onChange={value=>setHarvestItems(items=>items.map((current,i)=>i===index?{...current,recovered_count:value??0}:current))}/><button type="button" aria-label="Remove harvested species" disabled={harvestItems.length===1} onClick={()=>setHarvestItems(items=>items.filter((_,i)=>i!==index))}>×</button></div>)}</div><button type="button" className="secondary-action" onClick={()=>setHarvestItems(items=>[...items,{species_slug:catalog[0]?.slug||"mallard",subspecies_slug:"",recovered_count:0}])}>Add harvested species</button></section>}<div className="legacy-report-fields"><label>What did you see?</label><div className="choice-grid">{catalog.map(item => <button className={species === item.slug ? "active" : ""} onClick={() => setSpecies(item.slug)} key={item.slug}>{item.display_name}</button>)}</div><label>How many?</label><div className="choice-grid four">{Object.keys(amountValues).map(a => <button className={amount === a ? "active" : ""} onClick={() => setAmount(a)} key={a}>{a}</button>)}</div></div><label>What were they doing?</label><select value={behavior} onChange={e => setBehavior(e.target.value)}><option value="feeding">Feeding</option><option value="circling">Circling</option><option value="flying_over">Flying over</option><option value="resting">Resting on water</option><option value="moving_in">Moving into area</option></select><fieldset className="weather-report"><legend>Observed weather (optional)</legend><div className="weather-report-grid"><label>Sky<select value={observedWeather.sky} onChange={e => setObservedWeather({ ...observedWeather, sky: e.target.value })}><option value="">Not specified</option><option value="clear">Clear</option><option value="partly_cloudy">Partly cloudy</option><option value="overcast">Overcast</option><option value="fog">Fog</option></select></label><label>Precipitation<select value={observedWeather.precipitation} onChange={e => setObservedWeather({ ...observedWeather, precipitation: e.target.value })}><option value="none">None</option><option value="drizzle">Drizzle</option><option value="rain">Rain</option><option value="snow">Snow</option><option value="sleet">Sleet</option></select></label><label>Wind<select value={observedWeather.wind} onChange={e => setObservedWeather({ ...observedWeather, wind: e.target.value })}><option value="">Not specified</option><option value="calm">Calm</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="strong">Strong</option></select></label><label>Direction<select value={observedWeather.wind_direction} onChange={e => setObservedWeather({ ...observedWeather, wind_direction: e.target.value })}><option value="">Not specified</option>{["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map(v => <option key={v}>{v}</option>)}</select></label><label className="temperature-field">Temperature<span className="temperature-entry"><NumericStepper label="temperature" value={observedWeather.temperature === "" ? null : Number(observedWeather.temperature)} min={observedWeather.temperature_unit === "C" ? -73 : -100} max={observedWeather.temperature_unit === "C" ? 66 : 150} optional onChange={value => setObservedWeather({ ...observedWeather, temperature: value === null ? "" : String(value) })}/><span className="temperature-unit" role="group" aria-label="Temperature unit"><button type="button" className={observedWeather.temperature_unit === "F" ? "active" : ""} aria-pressed={observedWeather.temperature_unit === "F"} onClick={() => setObservedWeather({ ...observedWeather, temperature_unit: "F" })}>°F</button><button type="button" className={observedWeather.temperature_unit === "C" ? "active" : ""} aria-pressed={observedWeather.temperature_unit === "C"} onClick={() => setObservedWeather({ ...observedWeather, temperature_unit: "C" })}>°C</button></span></span></label><label>Visibility<select value={observedWeather.visibility} onChange={e => setObservedWeather({ ...observedWeather, visibility: e.target.value })}><option value="">Not specified</option><option value="good">Good</option><option value="moderate">Moderate</option><option value="poor">Poor</option></select></label></div></fieldset>{reportType === "banded" && <div className="banded-inline"><p className="privacy-copy">Band encounters appear as a protected star on the map. Submit official recoveries to the appropriate wildlife authority too.</p><div className="banded-grid"><label>Band number<input value={bandedDraft.band_number} onChange={event => setBandedDraft({ ...bandedDraft, band_number: event.target.value })}/></label><label>Band type<select value={bandedDraft.band_type} onChange={event => setBandedDraft({ ...bandedDraft, band_type: event.target.value })}><option value="unknown">Unknown</option><option value="metal">Metal band</option><option value="color">Color band</option><option value="neck_collar">Neck collar</option><option value="wing_tag">Wing tag</option></select></label><label>Band color<input value={bandedDraft.band_color} onChange={event => setBandedDraft({ ...bandedDraft, band_color: event.target.value })}/></label><label>Encounter<select value={bandedDraft.encounter_type} onChange={event => setBandedDraft({ ...bandedDraft, encounter_type: event.target.value })}><option value="observed">Observed</option><option value="photographed">Photographed</option><option value="recovered">Recovered</option><option value="harvested">Harvested</option></select></label></div></div>}<label>Field note (optional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} maxLength={1000} placeholder="Habitat, direction of travel, or other useful context…"/><label>Photo (optional)</label><input className="photo-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => { const file = e.target.files?.[0] || null; if (file && file.size > 5242880) {
        setStatus("Photo must be 5 MB or smaller.");
        setPhoto(null);
    }
    else
        setPhoto(file); }}/><button className="share" disabled={reportType === "banded" && bandedBusy} onClick={reportType === "banded" ? saveBandedBird : submit}>{reportType === "banded" ? (bandedBusy ? "Saving…" : "Save protected band encounter →") : reportType === "harvest" ? "Share report and save harvest →" : "Share protected report →"}</button>{(reportType === "banded" ? bandedStatus : status) && <p className="form-status">{reportType === "banded" ? bandedStatus : status}</p>}</div></div>}
  {authOpen && <div className="modal-wrap" onClick={() => setAuthOpen(false)}><form className="modal auth-modal" onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); authMode === "recover" ? recover() : authenticate(); }}><div className="modal-head"><div><span className="eyebrow">FEATHERMAP ACCOUNT</span><h2>{authMode === "login" ? "Welcome back" : authMode === "signup" ? "Join FeatherMap" : "Reset your password"}</h2></div><button type="button" onClick={() => setAuthOpen(false)}>×</button></div>{authMode === "signup" && <><label>Display name</label><input autoComplete="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Marsh Observer"/></>}<label>Email</label><input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="observer@example.com"/>{authMode !== "recover" && <><label>Password</label><input type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} required value={password} onChange={e => setPassword(e.target.value)} placeholder="8 characters minimum"/></>}<button type="submit" className="share" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "login" ? "Sign in" : authMode === "signup" ? "Create account" : "Send recovery link"}</button>{authError && <p className="form-status">{authError}</p>}{authMode === "login" && <button type="button" className="auth-switch" onClick={() => setAuthMode("recover")}>Forgot password?</button>}<button type="button" className="auth-switch" onClick={() => setAuthMode(authMode === "login" ? "signup" : "login")}>{authMode === "login" ? "New to FeatherMap? Create an account" : "Return to sign in"}</button></form></div>}
  {securityOpen && <div className="modal-wrap" onClick={() => setSecurityOpen(false)}><div className="modal auth-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">ACCOUNT SECURITY</span><h2>Password &amp; MFA</h2></div><button onClick={() => setSecurityOpen(false)} aria-label="Close security">×</button></div><label>New password</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="12+ characters with letters and numbers"/><button className="share" onClick={changePassword}>Change password</button><div className="security-summary"><b>Authenticator app (TOTP)</b><p>{mfa?.factors?.length ? `${mfa.factors.length} factor enrolled` : "Optional for your account."}</p><small>Current policy: {mfa?.policy?.mfa_policy || "optional"}. Administrator TOTP is configurable and currently optional.</small>{!mfaEnroll && <button className="auth-switch" onClick={enrollMfa}>Set up authenticator</button>}{mfaEnroll && <div className="mfa-enroll">{mfaEnroll.totp?.qr_code && <img src={mfaEnroll.totp.qr_code} alt="Authenticator setup QR code"/>}<code>{mfaEnroll.totp?.secret}</code><input inputMode="numeric" maxLength={6} value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, ""))} placeholder="6-digit code"/><button className="share" onClick={verifyMfa}>Verify authenticator</button></div>}</div>{securityStatus && <p className="form-status">{securityStatus}</p>}</div></div>}
  {profileOpen && <div className="modal-wrap" onClick={() => setProfileOpen(false)}><div className="modal account-edit-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PUBLIC PROFILE</span><h2>Edit profile</h2></div><button onClick={() => setProfileOpen(false)}>×</button></div><div className="profile-grid"><label>First name<input value={profileDraft.first_name || ""} onChange={e => setProfileDraft({ ...profileDraft, first_name: e.target.value })}/></label><label>Last name<input value={profileDraft.last_name || ""} onChange={e => setProfileDraft({ ...profileDraft, last_name: e.target.value })}/></label><label>Broad region<input value={profileDraft.region || ""} onChange={e => setProfileDraft({ ...profileDraft, region: e.target.value })} placeholder="State, province, or country"/></label><label>Distance units<select value={profileDraft.distance_units || "miles"} onChange={e => setProfileDraft({ ...profileDraft, distance_units: e.target.value })}><option value="miles">Miles</option><option value="kilometers">Kilometers</option></select></label><label>Appearance<select value={profileDraft.preferences?.appearance || "system"} onChange={e => { const appearance = e.target.value; document.documentElement.dataset.theme = appearance; localStorage.setItem("flyway_appearance", appearance); setProfileDraft({ ...profileDraft, preferences: { ...(profileDraft.preferences || preferences), appearance } }); }}><option value="system">System default</option><option value="dark">Dark mode</option><option value="light">Light mode</option></select></label></div><label>Short bio<textarea maxLength={280} value={profileDraft.bio || ""} onChange={e => setProfileDraft({ ...profileDraft, bio: e.target.value })}/></label><section className="profile-preferences" aria-labelledby="profile-preferences-title"><div><span className="eyebrow">MAP PREFERENCES</span><h3 id="profile-preferences-title">Map preferences</h3></div><div className="preference-block"><span>BIRD VISIBILITY</span><small>Choose which groups appear on your map.</small><div className="preference-toggles">{categories.map(group => { const draftPreferences = { ...defaultPreferences, ...preferences, ...(profileDraft.preferences || {}) }; const selected = draftPreferences.visible_groups.includes(group.slug); return <button type="button" key={group.slug} className={selected ? "active" : ""} aria-pressed={selected} onClick={() => setProfileDraft({ ...profileDraft, preferences: { ...draftPreferences, visible_groups: selected ? draftPreferences.visible_groups.filter((slug: string) => slug !== group.slug) : [...draftPreferences.visible_groups, group.slug] } })}><b>{selected ? "✓" : ""}</b>{group.display_name}</button>; })}</div></div><label className="preference-row"><span><b>Default history</b><small>Initial age range for sightings</small></span><select value={profileDraft.preferences?.default_days || preferences.default_days} onChange={e => setProfileDraft({ ...profileDraft, preferences: { ...defaultPreferences, ...preferences, ...(profileDraft.preferences || {}), default_days: Number(e.target.value) } })}><option value={1}>24 hours</option><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>6 months</option><option value={365}>1 year</option></select></label><label className="preference-row"><span><b>Open activity card</b><small>Show the summary after selecting a marker</small></span><input type="checkbox" checked={(profileDraft.preferences?.auto_open_card ?? preferences.auto_open_card) === true} onChange={e => setProfileDraft({ ...profileDraft, preferences: { ...defaultPreferences, ...preferences, ...(profileDraft.preferences || {}), auto_open_card: e.target.checked } })}/></label></section><label className="profile-toggle"><span><b>Show my name on community activity</b><small>{profileDraft.show_attribution !== false ? `${profileDraft.first_name || "First name"}${profileDraft.last_name ? ` ${profileDraft.last_name[0].toUpperCase()}.` : ""}` : "FeatherMap member"}</small></span><input type="checkbox" checked={profileDraft.show_attribution === true} onChange={e => setProfileDraft({ ...profileDraft, show_attribution: e.target.checked })}/></label><button className="share" onClick={saveProfile}>Save profile and preferences</button><section className="session-list"><h3>Active sessions</h3>{sessions.map(s => <div key={s.id}><span><b>{s.current ? "Current session" : "Signed-in device"}</b><small>{s.device} · {new Date(s.last_seen_at).toLocaleString()}</small></span></div>)}<button className="danger-action" onClick={signoutAll}>Sign out everywhere</button></section>{securityStatus && <p className="form-status">{securityStatus}</p>}</div></div>}
  {notificationsOpen && <div className="modal-wrap" onClick={() => setNotificationsOpen(false)}><div className="modal notifications-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">YOUR ACTIVITY</span><h2>Notifications</h2></div><button onClick={() => setNotificationsOpen(false)}>×</button></div><div className="notification-list">{notifications.length ? notifications.map(n => <a key={n.id} href={n.href || "#"}><b>{n.title}</b><p>{n.body}</p><time>{new Date(n.created_at).toLocaleString()}</time></a>) : <p>No notifications yet.</p>}</div></div></div>}
  {layersOpen && <div className="modal-wrap" onClick={() => setLayersOpen(false)}><div className="modal layers-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MAP CONTEXT</span><h2>Map layers</h2></div><button onClick={() => setLayersOpen(false)}>×</button></div><label className="profile-toggle"><span><b>North American flyways</b><small>Approximate planning regions, not precise biological boundaries.</small></span><input type="checkbox" checked={showFlyways} onChange={e => setShowFlyways(e.target.checked)}/></label><div className="layer-future"><b>Future layers</b><span>Weather · Wetlands · Refuges · Public lands · Conservation areas</span></div><div className="legal-notice"><b>Hunting regulations</b><p>Season dates, shooting hours, bag limits, permits, and legal access vary by jurisdiction and change annually. Flyway activity is informational only. Always verify current federal, state, tribal, refuge, local, and property-specific rules with the responsible wildlife agency.</p><a href="https://www.fws.gov/law/migratory-bird-hunting-regulations" target="_blank" rel="noreferrer">U.S. Fish &amp; Wildlife Service regulations</a></div></div></div>}
  {locationOpen && <div className="modal-wrap" onClick={() => setLocationOpen(false)}><div className="modal location-modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">MAP LOCATION</span><h2>Choose an area</h2></div><button onClick={() => setLocationOpen(false)} aria-label="Close location picker">×</button></div><button className="share" onClick={() => { locateMe(); setLocationOpen(false); }}>Use my current location</button><button className="auth-switch" onClick={saveCurrentLocation}>Save this map view</button><h3>Popular locations</h3><div className="location-list">{popularLocations.map(item => <button key={item.id} onClick={() => chooseLocation(item)}><b>{item.label}</b><small>{item.flyway} Flyway</small></button>)}</div><h3>My saved locations</h3>{token ? <div className="location-list">{savedLocations.length ? savedLocations.map(item => <div key={item.id}><button onClick={() => chooseLocation(item)}><b>{item.label}</b><small>Saved map view</small></button><button className="location-delete" aria-label={`Delete saved location ${item.label}`} onClick={async () => { await request(`/api/locations/saved/${item.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); await openLocations(); }}>×</button></div>) : <p>No saved locations yet.</p>}</div> : <button className="auth-switch" onClick={() => { setLocationOpen(false); setAuthOpen(true); }}>Sign in to use saved locations</button>}</div></div>}
  {detail && catalog.find(item => item.slug === detail.species)?.reference_url && <a className="bird-reference-link" href={catalog.find(item => item.slug === detail.species)?.reference_url} target="_blank" rel="noopener noreferrer">Learn about {displayLabel(detail.species)} · {catalog.find(item => item.slug === detail.species)?.reference_source || "Bird reference"}</a>}
  {panel === "map" && filter !== "all" && openCategory === filter && <div className="taxonomy-filter" role="dialog" aria-label={`Refine ${categories.find(category => category.slug === filter)?.display_name || "birds"}`}><div className="taxonomy-filter-head"><b>{categories.find(category => category.slug === filter)?.display_name}</b><span>{taxonFilters === null ? "All selected" : `${taxonFilters.length} selected`}</span><button type="button" aria-label="Close bird refinement" onClick={()=>setOpenCategory("")}>×</button></div><div className="taxonomy-options"><label className="taxonomy-all"><input type="checkbox" checked={taxonFilters === null} onChange={event => setTaxonFilters(event.target.checked ? null : [])}/><b>All</b></label>{categorySpecies.map(item => { const children = subspeciesCatalog.filter(sub => sub.species_slug === item.slug); const selected = taxonFilters === null || taxonFilters.includes(item.slug) || (children.length > 0 && children.every(sub => taxonFilters.includes(sub.slug))); const partial = taxonFilters !== null && !selected && children.some(sub => taxonFilters.includes(sub.slug)); return <section key={item.slug}><div className="taxonomy-species-row"><label><input type="checkbox" checked={selected} aria-checked={partial ? "mixed" : selected} onChange={event => toggleCategorySpecies(item.slug, event.target.checked)}/><b>{item.display_name}</b></label>{children.length > 0 && <button type="button" className="taxonomy-expand" aria-expanded={expandedTaxon === item.slug} onClick={() => setExpandedTaxon(current => current === item.slug ? "" : item.slug)}>⌄</button>}</div>{expandedTaxon === item.slug && children.map(sub => <label className="subspecies-option" key={sub.slug}><input type="checkbox" checked={taxonFilters === null || taxonFilters.includes(sub.slug)} onChange={event => toggleCategorySubspecies(item.slug, sub.slug, event.target.checked)}/>{sub.display_name}</label>)}</section>; })}</div></div>}
  {reporting && !speciesPickerOpen && <button className="species-selection-summary" onClick={() => setSpeciesPickerOpen(true)}><span>✓ {displayLabel(species)}</span><small>Change species</small></button>}
  {reporting && <section className="report-birds-floating" aria-label="Birds included in this report"><div className="report-birds-heading"><div><span className="eyebrow">BIRDS IN THIS REPORT</span><h3>{reportBirds.length} {reportBirds.length === 1 ? "entry" : "entries"}</h3></div><button className="add-bird-entry" onClick={() => setReportBirds(current => [...current, freshReportBird(catalog[0]?.slug || species, countRanges[0]?.slug || amount)])}>+ Add another bird</button></div>{reportBirds.map((entry, index) => <article className="report-bird-entry" key={entry.id}><div className="report-bird-entry-head"><strong>{index === 0 ? "Primary bird" : `Bird ${index + 1}`}</strong>{index > 0 && <button onClick={() => setReportBirds(current => current.filter(item => item.id !== entry.id))}>Remove</button>}</div>{index > 0 && <div className="report-bird-entry-grid"><label>Species<select value={entry.species} onChange={event => setReportBirds(current => current.map(item => item.id === entry.id ? { ...item, species: event.target.value, subspecies: "" } : item))}>{catalog.map(item => <option key={item.slug} value={item.slug}>{item.display_name}</option>)}</select></label><label>Subspecies (optional)<select value={entry.subspecies} onChange={event => setReportBirds(current => current.map(item => item.id === entry.id ? { ...item, subspecies: event.target.value } : item))}><option value="">Not specified</option>{subspeciesCatalog.filter(item => item.species_slug === entry.species).map(item => <option key={item.slug} value={item.slug}>{item.display_name}</option>)}</select></label><label>{reportType === "harvest" ? "How many observed?" : "How many?"}<select value={entry.count_range} onChange={event => setReportBirds(current => current.map(item => item.id === entry.id ? { ...item, count_range: event.target.value } : item))}>{countRanges.map(item => <option key={item.slug} value={item.slug}>{formatCountRange(item)}</option>)}</select></label></div>}<label className="banded-toggle"><input type="checkbox" checked={entry.banded} onChange={event => setReportBirds(current => current.map(item => item.id === entry.id ? { ...item, banded: event.target.checked } : item))}/><span>One of these birds was banded</span></label>{entry.banded && <div className="banded-fields"><p className="privacy-copy">The band encounter will appear as a protected star. Submit official recoveries to the appropriate wildlife authority too.</p><div className="banded-grid"><label>Band number<input value={entry.band_number} onChange={event => setReportBirds(current => current.map(item => item.id === entry.id ? { ...item, band_number: event.target.value } : item))}/></label><label>Band type<select value={entry.band_type} onChange={event => setReportBirds(current => current.map(item => item.id === entry.id ? { ...item, band_type: event.target.value } : item))}><option value="unknown">Unknown</option><option value="metal">Metal band</option><option value="color">Color band</option><option value="neck_collar">Neck collar</option><option value="wing_tag">Wing tag</option></select></label><label>Band color<input value={entry.band_color} onChange={event => setReportBirds(current => current.map(item => item.id === entry.id ? { ...item, band_color: event.target.value } : item))}/></label><label>Encounter<select value={entry.encounter_type} onChange={event => setReportBirds(current => current.map(item => item.id === entry.id ? { ...item, encounter_type: event.target.value } : item))}><option value="observed">Observed</option><option value="photographed">Photographed</option><option value="recovered">Recovered</option><option value="harvested">Harvested</option></select></label></div></div>}</article>)}</section>}
  {reporting && reportType === "seen" && <section className="report-count-floating"><label>How many birds?</label>{countRanges.length <= 8 ? <div className="report-count-buttons">{countRanges.map(item => <button key={item.slug} className={amount === item.slug ? "active" : ""} onClick={() => setAmount(item.slug)} title={item.description || item.display_label}>{formatCountRange(item)}</button>)}</div> : <select aria-label="Number of birds observed" value={amount} onChange={event => setAmount(event.target.value)}>{countRanges.map(item => <option key={item.slug} value={item.slug}>{formatCountRange(item)}</option>)}</select>}</section>}
  {reporting && subspeciesCatalog.some(item => item.species_slug === species) && <label className="report-subspecies-floating">Subspecies or variant (optional)<select value={subspecies} onChange={event => setSubspecies(event.target.value)}><option value="">Unknown / not specified</option>{subspeciesCatalog.filter(item => item.species_slug === species).map(item => <option key={item.slug} value={item.slug}>{item.display_name}</option>)}</select></label>}
  {harvestOpen && <div className="modal-wrap harvest-layer" onClick={() => setHarvestOpen(false)}><section className="modal harvest-modal" onClick={event => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PRIVATE HUNTING JOURNAL</span><h2>Harvest journal</h2></div><button onClick={() => setHarvestOpen(false)} aria-label="Close harvest journal">×</button></div><div className="harvest-journal-heading"><p className="privacy-copy">Harvest details are private by default. Public statistics use privacy-safe aggregates only.</p><button className="share report-new-harvest" onClick={() => { setHarvestOpen(false); openReport().then(() => setReportType("harvest")); }}>Report new harvest</button></div><div className="harvest-summary-grid"><div><span>OUTINGS</span><b>{harvestJournal.statistics?.outings || 0}</b></div><div><span>BIRDS RECOVERED</span><b>{harvestJournal.statistics?.harvested || 0}</b></div><div><span>OBSERVED-TO-HARVEST</span><b>{harvestJournal.statistics?.observation_conversion == null ? "—" : `${Math.round(harvestJournal.statistics.observation_conversion * 100)}%`}</b></div></div><div className="harvest-journal-filters"><label>History<select value={harvestDaysFilter} onChange={event => setHarvestDaysFilter(Number(event.target.value))}><option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>6 months</option><option value={365}>1 year</option><option value={730}>2 years</option></select></label><label>Species<select value={harvestSpeciesFilter} onChange={event => setHarvestSpeciesFilter(event.target.value)}><option value="">All species</option>{catalog.map(item => <option key={item.slug} value={item.slug}>{item.display_name}</option>)}</select></label></div><div className="harvest-journal-list">{(harvestJournal.outings || []).filter((outing:any) => new Date(outing.occurred_at).getTime() >= Date.now() - harvestDaysFilter * 86400000 && (!harvestSpeciesFilter || (outing.items || []).some((item:any) => item.species_slug === harvestSpeciesFilter))).map((outing:any) => <details className="harvest-journal-entry" key={outing.id}><summary><span><b>{new Date(outing.occurred_at).toLocaleDateString()}</b><small>{(outing.items || []).map((item:any) => `${item.recovered_count} ${displayLabel(item.subspecies_slug || item.species_slug)}`).join(" · ") || "No recovered birds"}</small></span><span>{outing.observed_count_label || (outing.observed_count != null ? `${outing.observed_count} observed` : "Observation count unavailable")}</span></summary><div className="harvest-entry-detail"><p><b>Hunters:</b> {outing.hunter_count}</p>{outing.notes && <p><b>Notes:</b> {outing.notes}</p>}<button className="danger-action" onClick={() => removeHarvest(outing.id)}>Delete entry</button></div></details>)}{!(harvestJournal.outings || []).some((outing:any) => new Date(outing.occurred_at).getTime() >= Date.now() - harvestDaysFilter * 86400000 && (!harvestSpeciesFilter || (outing.items || []).some((item:any) => item.species_slug === harvestSpeciesFilter))) && <div className="harvest-empty"><b>No harvest entries match these filters.</b><span>Start a new report when you are ready.</span></div>}</div>{harvestStatus && <p className="form-status">{harvestStatus}</p>}</section></div>}
  {deleteReportTarget && <div className="modal-wrap delete-report-layer" onClick={() => !deleteReportBusy && setDeleteReportTarget(null)}><section className="modal delete-report-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-report-title" onClick={event => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">DELETE ACTIVITY REPORT</span><h2 id="delete-report-title">Delete {displayLabel(deleteReportTarget.species)} report?</h2></div><button disabled={deleteReportBusy} onClick={() => setDeleteReportTarget(null)} aria-label="Close report deletion">×</button></div><div className="danger-notice"><strong>This removes the report from FeatherMap.</strong><p>{new Date(deleteReportTarget.occurred_at).toLocaleString()} · {deleteReportTarget.flock_size} birds. Photos, comments, confirmations, and saved references associated with it will also be removed.</p></div>{commentStatus && <p className="form-status error">{commentStatus}</p>}<div className="delete-account-actions"><button disabled={deleteReportBusy} onClick={() => setDeleteReportTarget(null)}>Cancel</button><button className="danger-action" disabled={deleteReportBusy} onClick={confirmDeleteReport}>{deleteReportBusy ? "Deleting…" : "Delete report"}</button></div></section></div>}
  {deleteAccountOpen && <div className="modal-wrap delete-account-layer" onClick={() => !deleteBusy && setDeleteAccountOpen(false)}><section className="modal delete-account-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" onClick={event => event.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">PERMANENT ACCOUNT DELETION</span><h2 id="delete-account-title">Delete your account?</h2></div><button aria-label="Close account deletion" disabled={deleteBusy} onClick={() => setDeleteAccountOpen(false)}>×</button></div><div className="danger-notice"><strong>This cannot be undone.</strong><p>Your profile, reports, comments, photos, saved locations, feedback, notifications, and active sessions will be permanently removed.</p></div><label>Current password<input type="password" autoComplete="current-password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)}/></label><label>Type DELETE to confirm<input value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} autoCapitalize="characters"/></label><label className="delete-account-ack"><input type="checkbox" checked={deleteAcknowledged} onChange={event => setDeleteAcknowledged(event.target.checked)}/><span>I understand that this permanently deletes my account and community activity.</span></label>{deleteStatus && <p className="form-status error">{deleteStatus}</p>}<div className="delete-account-actions"><button disabled={deleteBusy} onClick={() => setDeleteAccountOpen(false)}>Cancel</button><button className="danger-action" disabled={deleteBusy || !deletePassword || deleteConfirmation !== "DELETE" || !deleteAcknowledged} onClick={deleteAccount}>{deleteBusy ? "Deleting…" : "Permanently delete account"}</button></div></section></div>}
  {sessionSeconds !== null && <div className="modal-wrap"><section className="modal session-expiry-modal" role="alertdialog" aria-modal="true" aria-labelledby="session-expiry-title"><span className="eyebrow">ACCOUNT SECURITY</span><h2 id="session-expiry-title">Your session is expiring</h2><p>Continue your session to keep working, or sign out securely.</p><strong className="session-countdown">{Math.floor(sessionSeconds / 60)}:{String(sessionSeconds % 60).padStart(2, "0")}</strong><div className="session-expiry-actions"><button className="signout" onClick={logout}>Sign out</button><button className="continue" disabled={sessionRefreshing || profile?.session_policy?.allow_extension === false} onClick={continueSession}>{sessionRefreshing ? "Refreshing…" : "Continue session"}</button></div></section></div>}
  {securityOpen && <section className="security-sessions-floating" aria-labelledby="active-sessions-title"><h3 id="active-sessions-title">Active sessions</h3>{sessions.map(session => <div key={session.id}><span><b>{session.current ? "Current device" : "Signed-in device"}</b><small>{session.device} · {new Date(session.last_seen_at).toLocaleString()}</small></span>{!session.current && <button onClick={() => signoutSession(session.id)}>Sign out</button>}</div>)}<button className="danger-action" onClick={signoutAll}>Sign out everywhere</button></section>}
  {APP_ENV !== "production" && <div className="environment-badge" role="status">{APP_ENV === "development" ? "DEV" : APP_ENV.toUpperCase()}</div>}
  {profile && <div className={`mobile-location-indicator ${reportLocation.source === "current" ? "enabled" : "manual"}`} role="status"><span aria-hidden="true">{reportLocation.source === "current" ? "●" : "◇"}</span>{reportLocation.source === "current" ? "Location available" : "Manual location"}</div>}
  {photoRetry && <aside className="photo-retry-notice" role="alert"><span><b>Report saved</b>The photo still needs to be uploaded.</span><button onClick={retryReportPhoto}>Retry photo</button><button aria-label="Dismiss photo upload notice" onClick={() => setPhotoRetry(null)}>×</button></aside>}
  {sessionRefreshError && <aside className="network-status-notice" role="alert"><span>{sessionRefreshError}</span><button onClick={() => setSessionRefreshError("")} aria-label="Dismiss session error">×</button></aside>}
  </main>;
}

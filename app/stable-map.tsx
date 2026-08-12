"use client";

import { useEffect, useRef } from "react";
import "./stable-map.css";

declare global {
  interface Window { maplibregl?: any; }
}

type Camera = { lat: number; lon: number; zoom: number };
type Activity = {
  id: string;
  latitude: number;
  longitude: number;
  color: string;
  birds: number;
  banded?: boolean;
};

type Props = {
  camera: Camera;
  activity: Activity[];
  aggregate: Activity[];
  aggregateMode: boolean;
  selectingLocation: boolean;
  selectedLocation?: { latitude: number; longitude: number } | null;
  onCameraChange: (camera: Camera) => void;
  onSelectReport: (id: string) => void;
  onSelectLocation: (location: { latitude: number; longitude: number }) => void;
};

const SCRIPT = "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js";
const STYLES = "https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css";
let loader: Promise<any> | null = null;

function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${STYLES}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = STYLES;
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
    const script = existing || document.createElement("script");
    script.src = SCRIPT;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(window.maplibregl);
    script.onerror = () => reject(new Error("The interactive map could not be loaded."));
    if (!existing) document.head.appendChild(script);
  });
  return loader;
}

function collection(items: Activity[]) {
  return {
    type: "FeatureCollection",
    features: items.map(item => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [item.longitude, item.latitude] },
      properties: item,
    })),
  };
}

function resolvedTheme() {
  const preference = document.documentElement.dataset.theme || "system";
  if (preference === "dark" || preference === "light") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyBasemapTheme(instance: any) {
  if (!instance.getLayer("osm")) return;
  const dark = resolvedTheme() === "dark";
  const paint: Record<string, number> = dark
    ? { "raster-brightness-min": .08, "raster-brightness-max": .48, "raster-contrast": .14, "raster-saturation": -.42, "raster-hue-rotate": 12 }
    : { "raster-brightness-min": 0, "raster-brightness-max": 1, "raster-contrast": 0, "raster-saturation": 0, "raster-hue-rotate": 0 };
  for (const [property, value] of Object.entries(paint)) instance.setPaintProperty("osm", property, value);
}

export default function StableMap(props: Props) {
  const container = useRef<HTMLDivElement | null>(null);
  const map = useRef<any>(null);
  const loaded = useRef(false);
  const propsRef = useRef(props);

  useEffect(() => { propsRef.current = props; }, [props]);

  useEffect(() => {
    let cancelled = false;
    let themeObserver: MutationObserver | null = null;
    let themeMedia: MediaQueryList | null = null;
    let themeListener: (() => void) | null = null;
    void loadMapLibre().then(maplibre => {
      if (cancelled || !container.current || map.current) return;
      const instance = new maplibre.Map({
        container: container.current,
        center: [props.camera.lon, props.camera.lat],
        zoom: props.camera.zoom,
        minZoom: 2,
        maxZoom: 15,
        attributionControl: false,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
              maxzoom: 19,
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-fade-duration": 0 } }],
        },
      });
      map.current = instance;
      instance.dragRotate.disable();
      instance.touchZoomRotate.disableRotation();
      instance.on("load", () => {
        if (cancelled) return;
        loaded.current = true;
        applyBasemapTheme(instance);
        instance.addSource("feathermap-activity", { type: "geojson", data: collection([]) });
        instance.addLayer({
          id: "feathermap-dots",
          type: "circle",
          source: "feathermap-activity",
          filter: ["!=", ["get", "banded"], true],
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["interpolate", ["linear"], ["ln", ["+", 1, ["max", 1, ["get", "birds"]]]], 0, 5, 12, 13],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.94,
          },
        });
        instance.addLayer({
          id: "feathermap-banded",
          type: "symbol",
          source: "feathermap-activity",
          filter: ["==", ["get", "banded"], true],
          layout: { "text-field": "★", "text-size": 28, "text-allow-overlap": true },
          paint: { "text-color": ["get", "color"], "text-halo-color": "#ffffff", "text-halo-width": 2 },
        });
        for (const layer of ["feathermap-dots", "feathermap-banded"]) {
          instance.on("click", layer, (event: any) => {
            const id = event.features?.[0]?.properties?.id;
            if (id) propsRef.current.onSelectReport(String(id));
          });
          instance.on("mouseenter", layer, () => { instance.getCanvas().style.cursor = "pointer"; });
          instance.on("mouseleave", layer, () => { instance.getCanvas().style.cursor = ""; });
        }
        const items = propsRef.current.aggregateMode ? propsRef.current.aggregate : propsRef.current.activity;
        instance.getSource("feathermap-activity").setData(collection(items));
      });
      themeListener = () => applyBasemapTheme(instance);
      themeObserver = new MutationObserver(themeListener);
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
      themeMedia = window.matchMedia("(prefers-color-scheme: dark)");
      themeMedia.addEventListener("change", themeListener);
      instance.on("moveend", () => {
        const center = instance.getCenter();
        propsRef.current.onCameraChange({ lat: center.lat, lon: center.lng, zoom: instance.getZoom() });
      });
      instance.on("click", (event: any) => {
        if (!propsRef.current.selectingLocation) return;
        propsRef.current.onSelectLocation({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
      });
    }).catch(error => {
      if (container.current) container.current.dataset.error = error instanceof Error ? error.message : "Map unavailable";
    });
    return () => {
      cancelled = true;
      themeObserver?.disconnect();
      if (themeMedia && themeListener) themeMedia.removeEventListener("change", themeListener);
      loaded.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded.current) return;
    const current = instance.getCenter();
    if (Math.abs(current.lat - props.camera.lat) < 1e-7 && Math.abs(current.lng - props.camera.lon) < 1e-7 && Math.abs(instance.getZoom() - props.camera.zoom) < 1e-7) return;
    instance.jumpTo({ center: [props.camera.lon, props.camera.lat], zoom: props.camera.zoom });
  }, [props.camera.lat, props.camera.lon, props.camera.zoom]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded.current) return;
    const items = props.aggregateMode ? props.aggregate : props.activity;
    instance.getSource("feathermap-activity")?.setData(collection(items));
  }, [props.activity, props.aggregate, props.aggregateMode]);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !loaded.current) return;
    const existing = instance.getSource("selected-report-location");
    const data = props.selectedLocation ? collection([{ id: "selected", latitude: props.selectedLocation.latitude, longitude: props.selectedLocation.longitude, color: "#c8ee5d", birds: 1 }]) : collection([]);
    if (existing) existing.setData(data);
    else {
      instance.addSource("selected-report-location", { type: "geojson", data });
      instance.addLayer({ id: "selected-report-location", type: "circle", source: "selected-report-location", paint: { "circle-radius": 8, "circle-color": "#c8ee5d", "circle-stroke-color": "#102016", "circle-stroke-width": 3 } });
    }
  }, [props.selectedLocation?.latitude, props.selectedLocation?.longitude]);

  return <div ref={container} className="stable-map" aria-label="Interactive FeatherMap"/>;
}

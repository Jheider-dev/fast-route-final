"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import { QuadTree, Rectangle } from "@/utils/QuadTree";
import { RouteGraph } from "@/utils/Graph";

interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  seq: number;
  active: boolean;
}

const mainIcon = L.icon({
  iconUrl: "/ubicacion.png",
  iconRetinaUrl: "/ubicacion.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const stopIcon = L.icon({
  iconUrl: "/stop.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const nearestStopIcon = L.icon({
  iconUrl: "/stop.png",
  iconSize: [48, 48],
  iconAnchor: [24, 48],
});

const busIcon = L.icon({
  iconUrl: "/bus.png", 
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

export default function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const nearestMarkerRef = useRef<L.Marker | null>(null);
  const walkingRouteRef = useRef<L.Polyline | null>(null);
  const busMarkersRef = useRef<{ [key: string]: L.Marker }>({});
  
  const hasCenteredRef = useRef(false);
  const timeoutRef = useRef<any>(null);
  const lastPositionRef = useRef<{lat: number, lon: number} | null>(null);
  const lastMoveTimeRef = useRef<number>(Date.now()); 

  const [firstPoint, setFirstPoint] = useState<{ lat: number; lon: number } | null>(null);
  const stopsRef = useRef<Stop[]>([]);

  const quadTreeRef = useRef<QuadTree | null>(null);
  const routeGraphRef = useRef<RouteGraph | null>(null);
  
  const [graphInfo, setGraphInfo] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);

  const [serviceStatus, setServiceStatus] = useState<'waiting' | 'active' | 'offline'>('offline');
  const [lastUpdateInfo, setLastUpdateInfo] = useState<string>("Esperando señal...");

  async function loadStops(map: L.Map) {
    const { data, error } = await supabase
      .from("stops")
      .select("*")
      .eq("active", true)
      .order("seq", { ascending: true });

    if (error) return;
    stopsRef.current = data as Stop[];

    const boundary = new Rectangle(-15.84, -70.02, 0.05, 0.05); 
    const qt = new QuadTree(boundary, 4); 
    const graph = new RouteGraph();

    stopsRef.current.forEach((stop, index) => {
      L.marker([stop.lat, stop.lon], { icon: stopIcon }).addTo(map).bindPopup(stop.name);
      
      qt.insert({ x: stop.lat, y: stop.lon, data: stop });

      if (index < stopsRef.current.length - 1) {
        const nextStop = stopsRef.current[index + 1];
        const dist = distanceMeters(stop.lat, stop.lon, nextStop.lat, nextStop.lon);
        graph.addConnection(stop.id, nextStop.id, dist);
      }
    });

    quadTreeRef.current = qt;
    routeGraphRef.current = graph;
  }

  async function loadRoute(map: L.Map) {
    const { data, error } = await supabase
      .from("routes")
      .select("geojson")
      .limit(1);

    if (error) {
      console.error("Error cargando ruta:", error);
      return;
    }

    if (!data || data.length === 0) {
      console.warn("No hay rutas en la tabla routes");
      return;
    }

    const route = data[0].geojson;

    if (!route) {
      console.warn("La ruta no tiene geojson");
      return;
    }

    L.geoJSON(route, {
      style: { weight: 5, opacity: 0.8, color: "#2563eb" },
    }).addTo(map);
  }


  function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function getNearestStop(lat: number, lon: number) {
    if (!quadTreeRef.current) return null;

    const range = new Rectangle(lat, lon, 0.01, 0.01);
    let candidates = quadTreeRef.current.query(range); 
    
    if (candidates.length === 0) {
       candidates = stopsRef.current.map(s => ({ x: s.lat, y: s.lon, data: s }));
    }

    let minDist = Infinity;
    let nearest: { stop: Stop; distance: number } | null = null;

    candidates.forEach((p) => {
      const stop = p.data as Stop;
      const d = distanceMeters(lat, lon, stop.lat, stop.lon);
      if (d < minDist) {
        minDist = d;
        nearest = { stop, distance: d };
      }
    });
    return nearest;
  }

  async function fetchWalkingRoute(lat1: number, lon1: number, lat2: number, lon2: number) {
    try {
      const apiKey = process.env.NEXT_PUBLIC_ORS_API_KEY;
      if (!apiKey) return null;
      const res = await fetch(
        "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
        {
          method: "POST",
          headers: { "Authorization": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ coordinates: [[lon1, lat1], [lon2, lat2]] }),
        }
      );
      if (!res.ok) return null;
      return await res.json();
    } catch (err) { return null; }
  }

  async function highlightNearest(map: L.Map, userLat: number, userLon: number) {
    const nearest: any = getNearestStop(userLat, userLon);
    
    if (!nearest) {
      setGraphInfo("Sin paraderos cercanos.");
      return;
    }
    const { stop } = nearest;

    if (routeGraphRef.current && stopsRef.current.length > 0) {
      const currentIndex = stopsRef.current.findIndex(s => s.id === stop.id);
      let mensajeGrafo = "";

      if (currentIndex < stopsRef.current.length - 1) {
        const nextStop = stopsRef.current[currentIndex + 1];
        
        const pathData = routeGraphRef.current.findShortestPath(stop.id, nextStop.id);
        const distanciaTramo = Math.round(pathData.distance);
        
        mensajeGrafo = `Tramo (Grafo): Del paradero "${stop.name}" al siguiente ("${nextStop.name}") hay ${distanciaTramo}m.`;
      } else {
        mensajeGrafo = `Estás en el último paradero ("${stop.name}").`;
      }
      
      setGraphInfo(mensajeGrafo);
    }

    if (nearestMarkerRef.current) nearestMarkerRef.current.remove();
    nearestMarkerRef.current = L.marker([stop.lat, stop.lon], { icon: nearestStopIcon })
      .addTo(map)
      .bindPopup(`Paradero más cercano:<br>${stop.name}`)
      .openPopup();

    const routeData: any = await fetchWalkingRoute(userLat, userLon, stop.lat, stop.lon);
    if (!routeData || !routeData.features || routeData.features.length === 0) return;
    const coords = routeData.features[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]);

    if (walkingRouteRef.current) walkingRouteRef.current.remove();
    walkingRouteRef.current = L.polyline(coords, {
      weight: 4, dashArray: "10 10", color: "#ea580c"
    }).addTo(map);

    map.fitBounds(walkingRouteRef.current.getBounds(), { padding: [50, 50] });
  }

  function updateBusMarker(payload: any) {
    if (!mapRef.current) return;
    
    const { bus_id, lat, lon } = payload;
    const map = mapRef.current;
    const now = Date.now();
    const timeString = new Date().toLocaleTimeString();

    setLastUpdateInfo(timeString);

    const lastLat = lastPositionRef.current?.lat || 0;
    const lastLon = lastPositionRef.current?.lon || 0;
    const hasMoved = (lat !== lastLat || lon !== lastLon);

    if (hasMoved) {
      lastPositionRef.current = { lat, lon };
      lastMoveTimeRef.current = now; 
      setServiceStatus('active');
      
      if (!hasCenteredRef.current) {
        map.flyTo([lat, lon], 16, { duration: 1.5 });
        hasCenteredRef.current = true;
      }
    } else {
      const timeSinceLastMove = now - lastMoveTimeRef.current;
      if (timeSinceLastMove > 60000) { 
         setServiceStatus('waiting'); 
      } else {
         setServiceStatus('active'); 
      }
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setServiceStatus('offline');
    }, 65000); 

    if (busMarkersRef.current[bus_id]) {
      busMarkersRef.current[bus_id].setLatLng([lat, lon]);
    } else {
      const newMarker = L.marker([lat, lon], { icon: busIcon })
        .addTo(map)
        .bindPopup(`Bus activo`);
      busMarkersRef.current[bus_id] = newMarker;
    }
  }

  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map("map", {
      center: [-15.84, -70.0219],
      zoom: 14,
      zoomControl: false,
    });
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    loadStops(map);
    loadRoute(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (firstPoint) return;
      const { lat, lng } = e.latlng;
      setFirstPoint({ lat, lon: lng });
      if (markerRef.current) markerRef.current.remove();
      markerRef.current = L.marker([lat, lng], { icon: mainIcon }).addTo(map);
      highlightNearest(map, lat, lng);
    });

    const channel = supabase
      .channel("positions-tracker")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "positions" }, (payload) => {
        updateBusMarker(payload.new);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [firstPoint]);

  let statusColor = "";
  let statusText = "";
  let statusMessage = "";
  let dotColor = "";
  let pingColor = "";

  if (serviceStatus === 'active') {
    statusColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
    statusText = "EN RUTA (En Movimiento)";
    dotColor = "bg-emerald-500";
    pingColor = "bg-emerald-400";
    statusMessage = `Último movimiento: ${lastUpdateInfo}`;
  } else if (serviceStatus === 'waiting') {
    statusColor = "bg-orange-100 text-orange-700 border-orange-200";
    statusText = "DETENIDO / ESPERANDO";
    dotColor = "bg-orange-500";
    pingColor = "hidden";
    statusMessage = "El bus está detenido o esperando pasajeros.";
  } else {
    statusColor = "bg-red-100 text-red-700 border-red-200";
    statusText = "FUERA DE SERVICIO";
    dotColor = "bg-red-500";
    pingColor = "hidden";
    statusMessage = "No hay señal del conductor. El servicio puede haber finalizado.";
  }

  return (
    <div className="relative w-full h-full">
      <div id="map" className="w-full h-full z-0 outline-none focus:outline-none bg-zinc-100" />

      <div className="absolute top-4 left-4 z-[400] pointer-events-none">
        <div className="bg-white/95 backdrop-blur shadow-xl rounded-xl p-4 border border-zinc-200 max-w-xs pointer-events-auto transition-all duration-300 relative group">
          
          <div className="flex justify-between items-start">
             <h3 className="font-bold text-slate-800 text-sm mb-2">Estado del Servicio</h3>
             <button 
               onClick={() => setShowDebug(!showDebug)}
               className={`text-xs p-1 rounded hover:bg-zinc-100 transition-colors ${showDebug ? 'text-blue-600' : 'text-zinc-300'}`}
             >
               🛠️
             </button>
          </div>
          
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors duration-500 ${statusColor}`}>
            <span className="relative flex h-2.5 w-2.5">
              {serviceStatus === 'active' && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pingColor}`}></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dotColor}`}></span>
            </span>
            {statusText}
          </div>

          <div className="mt-3 pt-2 border-t border-zinc-100">
             <p className={`text-[10px] font-mono leading-tight ${serviceStatus === 'offline' ? 'text-red-400' : 'text-slate-500'}`}>
               {statusMessage}
             </p>
          </div>
          
          {showDebug && (
            <div className="mt-3 pt-2 border-t border-zinc-100 block animate-in fade-in slide-in-from-top-2">
              <p className="text-[10px] text-blue-600 font-semibold mb-1">Estructura de Datos (Demo):</p>
              <p className="text-[10px] text-slate-600 leading-tight bg-blue-50 p-2 rounded border border-blue-100">
                {graphInfo || "Haz clic en el mapa para ver Dijkstra..."}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
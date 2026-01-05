"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/lib/supabase";
import { QuadTree, Rectangle } from "@/utils/QuadTree";
import { RouteGraph } from "@/utils/Graph";

// --- CONFIGURACIÓN DE ICONOS ---
const createIcon = (url: string, size: [number, number]) => L.icon({
  iconUrl: url,
  iconSize: size,
  iconAnchor: [size[0] / 2, size[1]], // Ancla en la base central
  popupAnchor: [0, -size[1]],
});

const icons = {
  user: createIcon("/ubicacion.png", [40, 40]),
  stop: createIcon("/stop.png", [32, 32]),      // Paradero normal
  nearest: createIcon("/stop.png", [50, 50]),   // Paradero resaltado (más grande)
  bus: createIcon("/bus.png", [45, 45]),        // Bus
};

interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  seq: number;
  active: boolean;
}

export default function Map() {
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const walkingRouteRef = useRef<L.Polyline | null>(null);
  const connectionLineRef = useRef<L.Polyline | null>(null);

  // --- SOLUCIÓN AL ERROR DE DUPLICADOS ---
  // Guardamos referencia a todos los marcadores para editarlos en lugar de crear nuevos
  const busMarkersRef = useRef<{ [key: string]: L.Marker }>({});
  const stopMarkersRef = useRef<{ [key: string]: L.Marker }>({}); 
  const lastHighlightedStopId = useRef<string | null>(null); // Recordamos cuál está grande

  const hasCenteredRef = useRef(false);
  const timeoutRef = useRef<any>(null);
  const lastPositionRef = useRef<{lat: number, lon: number} | null>(null);
  const lastMoveTimeRef = useRef<number>(Date.now()); 

  const [firstPoint, setFirstPoint] = useState<{ lat: number; lon: number } | null>(null);
  const stopsRef = useRef<Stop[]>([]);
  const quadTreeRef = useRef<QuadTree | null>(null);
  const routeGraphRef = useRef<RouteGraph | null>(null);
  
  // Estados para UI
  const [graphInfo, setGraphInfo] = useState<string>("");
  const [showDebug, setShowDebug] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'waiting' | 'active' | 'offline'>('offline');
  const [lastUpdateInfo, setLastUpdateInfo] = useState<string>("Esperando señal...");
  
  // Estado para el Buscador
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredStops, setFilteredStops] = useState<Stop[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // --- 1. CARGA DE DATOS (QuadTree & Grafo) ---
  async function loadStops(map: L.Map) {
    const { data, error } = await supabase
      .from("stops")
      .select("*")
      .eq("active", true)
      .order("seq", { ascending: true });

    if (error || !data) return;
    
    const stopsData = data as Stop[];
    stopsRef.current = stopsData;

    // Inicializamos Estructuras de Datos
    const boundary = new Rectangle(-15.84, -70.02, 0.05, 0.05); 
    const qt = new QuadTree(boundary, 4); 
    const graph = new RouteGraph();

    stopsData.forEach((stop, index) => {
      // 1. CREAR MARCADOR
      const marker = L.marker([stop.lat, stop.lon], { icon: icons.stop })
        .addTo(map)
        .bindPopup(`<b>${stop.name}</b><br>Paradero #${stop.seq}`);
      
      // 2. GUARDAR REFERENCIA (Para poder cambiarle el tamaño luego sin duplicar)
      stopMarkersRef.current[stop.id] = marker; 

      // 3. Insertar en QuadTree y Grafo
      qt.insert({ x: stop.lat, y: stop.lon, data: stop });

      if (index < stopsData.length - 1) {
        const nextStop = stopsData[index + 1];
        const dist = distanceMeters(stop.lat, stop.lon, nextStop.lat, nextStop.lon);
        graph.addConnection(stop.id, nextStop.id, dist);
      }
    });

    quadTreeRef.current = qt;
    routeGraphRef.current = graph;
    console.log("Estructuras de datos cargadas: QuadTree y Grafo");
  }

  // --- 2. RUTA ESTÁTICA ---
  async function loadRoute(map: L.Map) {
    console.log("Intentando cargar ruta..."); 

    // Intentamos buscar la ruta por nombre específico para evitar errores
    let { data } = await supabase
      .from("routes")
      .select("geojson")
      .eq("name", "Ruta Principal Universitaria")
      .limit(1);
    
    // Si no encuentra por nombre, busca la primera que haya (fallback)
    if (!data || data.length === 0) {
        const result = await supabase.from("routes").select("geojson").limit(1);
        data = result.data;
    }

    if (!data || data.length === 0) {
      console.warn("La tabla 'routes' parece vacía o bloqueada por RLS.");
      return;
    }

    console.log("Ruta encontrada:", data[0]); 

    if (data[0]?.geojson) {
      try {
        L.geoJSON(data[0].geojson as any, {
          style: { weight: 5, opacity: 0.6, color: "#3b82f6" }, 
        }).addTo(map);
        console.log("Ruta dibujada en el mapa."); 
      } catch (err) {
        console.error("Error al dibujar GeoJSON:", err); 
      }
    }
  }

  // --- MATEMÁTICAS AUXILIARES ---
  function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // --- 3. LÓGICA DE BÚSQUEDA (QUADTREE) ---
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

  // --- 4. INTERACCIÓN VISUAL (ARREGLADA) ---
  async function highlightNearest(map: L.Map, userLat: number, userLon: number, fromSearch = false) {
    const nearest: any = getNearestStop(userLat, userLon);
    
    if (!nearest) {
      setGraphInfo("Sin paraderos cercanos.");
      return;
    }
    const { stop } = nearest;

    // --- PASO A: RESTAURAR EL ANTERIOR ---
    // Si había un marcador grande, lo volvemos pequeño
    if (lastHighlightedStopId.current && stopMarkersRef.current[lastHighlightedStopId.current]) {
        const prevMarker = stopMarkersRef.current[lastHighlightedStopId.current];
        prevMarker.setIcon(icons.stop); // Icono normal
        prevMarker.setZIndexOffset(0);  // Capa normal
    }

    // --- PASO B: RESALTAR EL NUEVO ---
    // Buscamos el marcador existente y lo hacemos grande
    if (stopMarkersRef.current[stop.id]) {
        const currentMarker = stopMarkersRef.current[stop.id];
        currentMarker.setIcon(icons.nearest); // Icono grande
        currentMarker.setZIndexOffset(1000);  // Traer al frente
        
        // Popup personalizado según si es búsqueda o click
        const popupContent = fromSearch 
             ? `<b>Resultado:</b><br>${stop.name}`
             : `<b>Más cercano:</b><br>${stop.name}<br>Distancia: ${Math.round(nearest.distance)}m`;
        
        currentMarker.bindPopup(popupContent).openPopup();
        lastHighlightedStopId.current = stop.id; // Recordamos este ID
    }

    // Información del Grafo
    if (routeGraphRef.current && stopsRef.current.length > 0) {
      const currentIndex = stopsRef.current.findIndex(s => s.id === stop.id);
      let mensajeGrafo = "";

      if (currentIndex < stopsRef.current.length - 1) {
        const nextStop = stopsRef.current[currentIndex + 1];
        const pathData = routeGraphRef.current.findShortestPath(stop.id, nextStop.id);
        mensajeGrafo = `Grafo: Siguiente nodo "${nextStop.name}" a ${Math.round(pathData.distance)}m.`;
        
        // DIBUJAR CONEXIÓN DEL GRAFO
        if(connectionLineRef.current) connectionLineRef.current.remove();
        connectionLineRef.current = L.polyline([[stop.lat, stop.lon], [nextStop.lat, nextStop.lon]], {
            color: '#8b5cf6', weight: 3, dashArray: '5, 10'
        }).addTo(map);
      } else {
        mensajeGrafo = `Nodo final del grafo: "${stop.name}".`;
        if(connectionLineRef.current) connectionLineRef.current.remove();
      }
      setGraphInfo(mensajeGrafo);
    }

    // Dibujar línea punteada desde el usuario hasta el paradero (si no es búsqueda)
    if (walkingRouteRef.current) walkingRouteRef.current.remove();
    
    if (fromSearch) {
        // Si es búsqueda, volamos directo al paradero
        map.flyTo([stop.lat, stop.lon], 17, { duration: 1.5 });
    } else {
        // Si es click usuario, dibujamos la línea naranja
        walkingRouteRef.current = L.polyline([[userLat, userLon], [stop.lat, stop.lon]], {
            weight: 4, dashArray: "10 10", color: "#ea580c"
        }).addTo(map);
        map.fitBounds(walkingRouteRef.current.getBounds(), { padding: [100, 100] });
    }
  }

  // --- 5. BUSCADOR ---
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    if (term.length > 0) {
      setIsSearching(true);
      const results = stopsRef.current.filter(s => 
        s.name.toLowerCase().includes(term.toLowerCase())
      );
      setFilteredStops(results);
    } else {
      setIsSearching(false);
    }
  };

  const selectStop = (stop: Stop) => {
    setSearchTerm(stop.name);
    setIsSearching(false);
    if(mapRef.current) {
        highlightNearest(mapRef.current, stop.lat, stop.lon, true);
    }
  };

  // --- 6. TRACKING EN TIEMPO REAL ---
  function updateBusMarker(payload: any) {
    if (!mapRef.current) return;
    
    const { bus_id, lat, lon } = payload;
    const now = Date.now();
    setLastUpdateInfo(new Date().toLocaleTimeString());

    const lastLat = lastPositionRef.current?.lat || 0;
    const lastLon = lastPositionRef.current?.lon || 0;
    const hasMoved = (lat !== lastLat || lon !== lastLon);

    if (hasMoved) {
      lastPositionRef.current = { lat, lon };
      lastMoveTimeRef.current = now; 
      setServiceStatus('active');
      
      if (!hasCenteredRef.current) {
        mapRef.current.flyTo([lat, lon], 16, { duration: 1.5 });
        hasCenteredRef.current = true;
      }
    } else {
      if (now - lastMoveTimeRef.current > 60000) setServiceStatus('waiting'); 
      else setServiceStatus('active'); 
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setServiceStatus('offline'), 65000); 

    if (busMarkersRef.current[bus_id]) {
      busMarkersRef.current[bus_id].setLatLng([lat, lon]);
    } else {
      busMarkersRef.current[bus_id] = L.marker([lat, lon], { icon: icons.bus })
        .addTo(mapRef.current)
        .bindPopup(`Bus en ruta`);
    }
  }

  // --- INICIALIZACIÓN ---
  useEffect(() => {
    if (typeof window === "undefined") return; // Protección SSR
    if (mapRef.current) return;

    const map = L.map("map", {
      center: [-15.84, -70.0219],
      zoom: 14,
      zoomControl: false,
    });
    
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);

    loadStops(map);
    loadRoute(map);

    // Evento Click: "Dónde estoy y cuál es mi paradero más cercano"
    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      setFirstPoint({ lat, lon: lng });
      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = L.marker([lat, lng], { icon: icons.user }).addTo(map);
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // --- RENDERIZADO ---
  let statusColor = serviceStatus === 'active' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                    serviceStatus === 'waiting' ? "bg-orange-100 text-orange-700 border-orange-200" :
                    "bg-red-100 text-red-700 border-red-200";

  return (
    <div className="relative w-full h-full font-sans">
      {/* MAPA */}
      <div id="map" className="w-full h-full z-0 bg-zinc-100" />

      {/* --- NUEVO: BUSCADOR DE PARADEROS --- */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-[90%] max-w-md z-[1000]">
        <div className="relative shadow-xl">
            <input 
                type="text" 
                placeholder="Buscar paradero (ej. Puerta Civil)..." 
                className="w-full p-4 pl-12 rounded-full border-none outline-none shadow-lg text-slate-700 font-medium bg-white/95 backdrop-blur focus:ring-2 focus:ring-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
            />
            {/* Lista de Resultados */}
            {isSearching && filteredStops.length > 0 && (
                <div className="absolute top-14 left-0 w-full bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-100 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {filteredStops.map(stop => (
                        <div 
                            key={stop.id}
                            onClick={() => selectStop(stop)}
                            className="p-3 px-5 hover:bg-blue-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center group"
                        >
                            <span className="text-slate-700 font-medium group-hover:text-blue-600 transition-colors">{stop.name}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">#{stop.seq}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* --- TARJETA DE ESTADO (Izquierda) --- */}
      <div className="absolute bottom-8 left-4 z-[400] max-w-[280px]">
        <div className="bg-white/95 backdrop-blur shadow-2xl rounded-2xl p-4 border border-zinc-200 transition-all duration-300">
          
          <div className="flex justify-between items-center mb-3">
             <h3 className="font-bold text-slate-800 text-sm">Estado del Servicio</h3>
             <button onClick={() => setShowDebug(!showDebug)} className="text-slate-400 hover:text-blue-500 transition">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
             </button>
          </div>
          
          <div className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border mb-3 ${statusColor}`}>
            <span className="relative flex h-2.5 w-2.5">
              {serviceStatus === 'active' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400"></span>}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${serviceStatus === 'active' ? 'bg-emerald-500' : serviceStatus === 'waiting' ? 'bg-orange-500' : 'bg-red-500'}`}></span>
            </span>
            {serviceStatus === 'active' ? "EN RUTA" : serviceStatus === 'waiting' ? "ESPERANDO" : "FUERA DE SERVICIO"}
          </div>

          <p className="text-[10px] text-slate-500 font-mono text-center">
             Última señal: {lastUpdateInfo}
          </p>
          
          {/* Debug Panel (QuadTree Info) */}
          {showDebug && (
            <div className="mt-3 pt-3 border-t border-zinc-100 animate-in fade-in">
              <p className="text-[10px] uppercase tracking-wider text-blue-600 font-bold mb-1">Algoritmos en uso:</p>
              <div className="bg-blue-50/50 p-2 rounded border border-blue-100/50">
                <p className="text-[10px] text-slate-600 leading-snug">
                  {graphInfo || "Usa el buscador o haz clic en el mapa para ver el Grafo y QuadTree en acción."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
/*
 * ParKada (formerly iParkBayan) — ParkingMapPage
 * Clean Satellite View + Navigation (Waze & GMaps) + Real-time Geolocation + In-App Route Directions + Supabase Real-time
 * ADDED: Near Me Button, Estimated Travel Time, Favorites
 * FIXED: Waze starting point, Search auto-center
 * IMPROVED: List View Layout
 * UPDATED: Non‑accredited markers: green pin without slot count; cards: no rate, no star, not clickable (but navigation works)
 * ADDED: Parking reviews (average rating) in list view – stars
 * CHANGED: Favorite indicator and toggle button are now ❤️ hearts (instead of stars)
 * MODIFIED: Non‑accredited list card shows "Closed" when parking is closed (instead of always "Walk‑in Only")
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "../../supabaseClient";
import { MapPin, List, Map, Search, Loader2, Plus, Minus, Layers, Navigation, Route as RouteIcon, Crosshair, Star, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// Leaflet Imports
import { MapContainer, TileLayer, Marker, Tooltip, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- HELPER: Distance Calculator (Haversine Formula) ---
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// --- HELPER: Estimate Travel Time ---
const getEstimatedTravelTime = (distanceKm: number) => {
  const minutes = Math.ceil(distanceKm / 0.5);
  if (minutes < 1) return "<1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// --- HELPER: Check if Parking is Open ---
const isParkingOpen = (openHoursStr: string | null | undefined, currentDate: Date) => {
  if (!openHoursStr) return true;
  if (openHoursStr.toLowerCase().includes('24 hours')) return true;

  try {
    const [startStr, endStr] = openHoursStr.split('-');
    if (!startStr || !endStr) return true;

    const parseTime = (timeStr: string) => {
      const match = timeStr.trim().match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
      if (!match) return 0;
      let hours = parseInt(match[1], 10);
      let minutes = match[2] ? parseInt(match[2], 10) : 0;
      let period = match[3].toLowerCase();
      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const startMins = parseTime(startStr);
    const endMins = parseTime(endStr);
    const currentMins = currentDate.getHours() * 60 + currentDate.getMinutes();

    if (startMins < endMins) {
      return currentMins >= startMins && currentMins < endMins;
    } else {
      return currentMins >= startMins || currentMins < endMins;
    }
  } catch (error) {
    console.error("Error parsing open_hours:", error);
    return true;
  }
};

// --- HELPER: Render rating stars (for parking reviews) ---
const renderStars = (rating: number) => {
  if (!rating || rating === 0) return null;
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
      ))}
      {hasHalf && <Star size={10} className="fill-amber-400 text-amber-400" style={{ clipPath: 'inset(0 50% 0 0)' }} />}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={i} size={10} className="text-gray-300" />
      ))}
      <span className="text-[9px] text-gray-500 ml-1">({rating.toFixed(1)})</span>
    </div>
  );
};

// --- NAVIGATION HELPERS ---
const openGoogleMaps = (destLat: number, destLng: number, userLat?: number, userLng?: number) => {
  if (userLat && userLng) {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${destLat},${destLng}&travelmode=driving`, "_blank");
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`, "_blank");
  }
};

const openWaze = (destLat: number, destLng: number, userLat?: number, userLng?: number) => {
  if (userLat && userLng) {
    window.open(`https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes&from=${userLat},${userLng}`, "_blank");
  } else {
    window.open(`https://waze.com/ul?ll=${destLat},${destLng}&navigate=yes`, "_blank");
  }
};

// Component for auto-centering the map
function MapCenterController({ center, zoom }: { center: [number, number] | null; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, map, zoom]);
  return null;
}

// Component for auto-zooming to route bounds
function RouteBoundsController({ routeCoords }: { routeCoords: [number, number][] | null }) {
  const map = useMap();
  useEffect(() => {
    if (routeCoords && routeCoords.length > 0) {
      const bounds = L.latLngBounds(routeCoords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [routeCoords, map]);
  return null;
}

// Custom Zoom Controls Component with Near Me Button
function ZoomHandler({ onCenterToUser }: { onCenterToUser: () => void }) {
  const map = useMap();
  return (
    <div className="absolute right-4 top-20 z-[1000] flex flex-col gap-2">
      <button 
        onClick={() => map.setZoom(19)}
        className="w-10 h-10 bg-primary text-white rounded-full shadow-lg flex items-center justify-center active:scale-90 transition-transform"
      >
        <Layers size={18} />
      </button>
      <button 
        onClick={() => map.zoomIn()}
        className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border border-border"
      >
        <Plus size={20} className="text-primary" />
      </button>
      <button 
        onClick={() => map.zoomOut()}
        className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center border border-border"
      >
        <Minus size={20} className="text-primary" />
      </button>
      <button 
        onClick={onCenterToUser}
        className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform border border-border mt-2"
        title="Go to my location"
      >
        <Crosshair size={20} className="text-primary" />
      </button>
    </div>
  );
}

// Custom Icon for accredited: shows slot count bubble
const createAccreditedIcon = (availableSlots: number, isClosed: boolean, isFavorite: boolean = false) => {
  if (isClosed) {
    return L.divIcon({
      html: `
        <div class="flex flex-col items-center gap-0.5" style="transform: translate(-50%, -100%);">
          <div class="px-2 py-1 rounded-lg text-[10px] font-bold shadow-lg whitespace-nowrap text-white bg-slate-500">
            Closed
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5" class="drop-shadow-lg text-slate-500">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3" fill="white"/>
          </svg>
        </div>`,
      className: 'bg-transparent',
      iconSize: [0, 0], 
    });
  }

  const colorClass = availableSlots > 5 ? 'text-emerald-500' : availableSlots > 0 ? 'text-amber-500' : 'text-rose-500';
  const bgClass = availableSlots > 5 ? 'bg-emerald-500' : availableSlots > 0 ? 'bg-amber-500' : 'bg-rose-500';
  const heartIcon = isFavorite ? '<div class="absolute -top-1 -right-1 bg-rose-500 rounded-full p-0.5"><svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>' : '';
  
  return L.divIcon({
    html: `
      <div class="relative flex flex-col items-center gap-0.5" style="transform: translate(-50%, -100%);">
        <div class="px-2 py-1 rounded-lg text-[10px] font-bold shadow-lg whitespace-nowrap text-white ${bgClass}">
          ${availableSlots > 0 ? `${availableSlots} slots` : 'Full'}
        </div>
        <div class="relative">
          ${heartIcon}
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5" class="drop-shadow-lg ${colorClass}">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3" fill="white"/>
          </svg>
        </div>
      </div>`,
    className: 'bg-transparent',
    iconSize: [0, 0], 
  });
};

// Custom Icon for non-accredited: simple green pin without any text bubble
const createNonAccreditedIcon = (isClosed: boolean, isFavorite: boolean = false) => {
  if (isClosed) {
    return L.divIcon({
      html: `
        <div style="transform: translate(-50%, -100%);">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5" class="drop-shadow-lg text-slate-500">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3" fill="white"/>
          </svg>
        </div>`,
      className: 'bg-transparent',
      iconSize: [0, 0], 
    });
  }

  const heartIcon = isFavorite ? '<div class="absolute -top-1 -right-1 bg-rose-500 rounded-full p-0.5"><svg width="10" height="10" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>' : '';
  
  return L.divIcon({
    html: `
      <div class="relative" style="transform: translate(-50%, -100%);">
        ${heartIcon}
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5" class="drop-shadow-lg text-emerald-500">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3" fill="white"/>
        </svg>
      </div>`,
    className: 'bg-transparent',
    iconSize: [0, 0], 
  });
};

export default function ParkingMapPage() {
  const [, navigate] = useLocation();
  const [lots, setLots] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"map" | "list">("map");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "private" | "public">("all");

  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  
  const [routeCoords, setRouteCoords] = useState<[number, number][] | null>(null);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  
  const [centerOnLot, setCenterOnLot] = useState<[number, number] | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [favorites, setFavorites] = useState<number[]>([]);

  const lipaCenter: [number, number] = [13.9430, 121.1625];

  useEffect(() => {
    const saved = localStorage.getItem("favoriteParkingLots");
    if (saved) setFavorites(JSON.parse(saved));
  }, []);

  const toggleFavorite = (lotId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const newFavs = prev.includes(lotId) ? prev.filter(id => id !== lotId) : [...prev, lotId];
      localStorage.setItem("favoriteParkingLots", JSON.stringify(newFavs));
      return newFavs;
    });
  };

  const centerToUser = () => {
    if (userCoords) {
      setCenterOnLot([userCoords.lat, userCoords.lng]);
    } else {
      alert("Getting your location... Please allow location access.");
    }
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error("Location error:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [lotsRes, slotsRes] = await Promise.all([
          supabase.from('parking_lots').select(`
            id, name, address, latitude, longitude, open_hours, rate_per_hour,
            type, status, is_accredited, average_rating, total_reviews
          `),
          supabase.from('parking_slots').select('*')
        ]);
        
        if (lotsRes.error) throw lotsRes.error;
        if (slotsRes.error) throw slotsRes.error;

        setLots(lotsRes.data || []);
        setSlots(slotsRes.data || []);
      } catch (err) {
        console.error("Supabase Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const lotsChannel = supabase
      .channel('realtime:parking_lots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_lots' }, (payload) => {
        setLots((currentLots) => {
          if (payload.eventType === 'INSERT') return [...currentLots, payload.new];
          if (payload.eventType === 'UPDATE') return currentLots.map((lot) => lot.id === payload.new.id ? { ...lot, ...payload.new } : lot);
          if (payload.eventType === 'DELETE') return currentLots.filter((lot) => lot.id !== payload.old.id);
          return currentLots;
        });
      })
      .subscribe();

    const slotsChannel = supabase
      .channel('realtime:parking_slots')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_slots' }, (payload) => {
        setSlots((currentSlots) => {
          if (payload.eventType === 'INSERT') return [...currentSlots, payload.new];
          if (payload.eventType === 'UPDATE') return currentSlots.map((slot) => slot.id === payload.new.id ? payload.new : slot);
          if (payload.eventType === 'DELETE') return currentSlots.filter((slot) => slot.id !== payload.old.id);
          return currentSlots;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(lotsChannel);
      supabase.removeChannel(slotsChannel);
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    
    const foundLot = computedLots.find(lot => 
      lot.name.toLowerCase().includes(search.toLowerCase()) ||
      lot.address.toLowerCase().includes(search.toLowerCase())
    );
    
    if (foundLot && foundLot.latitude && foundLot.longitude) {
      setCenterOnLot([foundLot.latitude, foundLot.longitude]);
      setRouteCoords(null);
    } else {
      alert("Parking lot not found. Please try another name.");
    }
  };

  const handleShowRoute = async (targetLat: number, targetLng: number) => {
    if (!userCoords) {
      alert("Please allow location access to get directions.");
      return;
    }
    setIsFetchingRoute(true);
    setView("map"); 
    setCenterOnLot(null);

    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${userCoords.lng},${userCoords.lat};${targetLng},${targetLat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
        setRouteCoords(coordinates);
      }
    } catch (err) {
      console.error("Error fetching route:", err);
    } finally {
      setIsFetchingRoute(false);
    }
  };

  const computedLots = lots.map(lot => {
    const lotSlots = slots.filter(s => s.lot_id === lot.id);
    if (lotSlots.length > 0) {
      const available = lotSlots.filter(s => s.status === 'available').length;
      return { ...lot, available_slots: available, total_slots: lotSlots.length };
    }
    return lot; 
  });

  const filteredAndSorted = computedLots
    .filter((lot) => {
      const matchSearch = lot.name.toLowerCase().includes(search.toLowerCase()) ||
                          lot.address.toLowerCase().includes(search.toLowerCase());
      const matchFilter = filter === "all" || lot.type === filter;
      return matchSearch && matchFilter;
    })
    .map((lot) => {
      const distance = userCoords && lot.latitude && lot.longitude
        ? getDistance(userCoords.lat, userCoords.lng, lot.latitude, lot.longitude)
        : null;
      const travelTime = distance ? getEstimatedTravelTime(distance) : null;
      return { ...lot, currentDistance: distance, travelTime };
    })
    .sort((a, b) => {
      if (a.is_accredited !== b.is_accredited) {
        return a.is_accredited === true ? -1 : 1;
      }
      if (a.currentDistance === null) return 1;
      if (b.currentDistance === null) return -1;
      return a.currentDistance - b.currentDistance;
    });

  const listSorted = [...filteredAndSorted];

  return (
<MobileLayout title="Find Parking" showBack={view !== "list"} onBack={() => navigate("/home")} noPadding>
        <div className="flex flex-col h-[calc(100dvh-56px)] bg-slate-50">
        
        {/* HEADER */}
        <div className="px-4 py-3 bg-white border-b border-border space-y-2 z-20 shadow-sm">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parking in Lipa City..."
              className="pl-9 h-10 rounded-xl bg-muted/40 text-sm border-none"
            />
          </form>
          <div className="flex gap-2 items-center">
            {(["all", "private", "public"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-[11px] font-bold transition-all capitalize border",
                  filter === f ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-muted-foreground border-border"
                )}
              >
                {f}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 bg-muted rounded-full p-1">
              <button onClick={() => setView("map")} className={cn("p-1.5 rounded-full transition-all", view === "map" ? "bg-white shadow-sm" : "")}>
                <Map size={14} className={view === "map" ? "text-primary" : "text-muted-foreground"} />
              </button>
              <button onClick={() => setView("list")} className={cn("p-1.5 rounded-full transition-all", view === "list" ? "bg-white shadow-sm" : "")}>
                <List size={14} className={view === "list" ? "text-primary" : "text-muted-foreground"} />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <Loader2 className="animate-spin text-primary" />
            <p className="text-xs font-medium text-muted-foreground">Updating map data...</p>
          </div>
        ) : view === "map" ? (
          <div className="flex-1 relative overflow-hidden bg-slate-900">
            <MapContainer center={lipaCenter} zoom={17} maxZoom={21} zoomControl={false} className="w-full h-full">
              <TileLayer url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}" attribution="© Google Satellite" maxZoom={21} />
              <MapCenterController center={centerOnLot} zoom={19} />
              <RouteBoundsController routeCoords={routeCoords} />
              
              {userCoords && (
                <Marker position={[userCoords.lat, userCoords.lng]} icon={L.divIcon({ 
                  html: '<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg ring-4 ring-blue-500/30 animate-pulse"></div>', 
                  className: '' 
                })} />
              )}

              {routeCoords && (
                <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.8} dashArray="10, 10" />
              )}

              <ZoomHandler onCenterToUser={centerToUser} />
              
              {filteredAndSorted.map((lot) => {
                const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
                const isFavorite = favorites.includes(lot.id);
                const isAccredited = lot.is_accredited === true;

                return lot.latitude && lot.longitude ? (
                  <Marker 
                    key={lot.id}
                    position={[lot.latitude, lot.longitude]} 
                    icon={isAccredited 
                      ? createAccreditedIcon(lot.available_slots, isClosed, isFavorite)
                      : createNonAccreditedIcon(isClosed, isFavorite)
                    }
                    eventHandlers={isAccredited ? { 
                      click: () => {
                        if (!isClosed) navigate(`/parking/${lot.id}`);
                      } 
                    } : {}}
                  >
                    <Tooltip permanent direction="bottom" offset={[0, 10]} className={cn(
                      "border-none shadow-xl text-white text-[10px] font-bold px-2 py-0.5 rounded-md",
                      isAccredited ? "bg-primary" : "bg-gray-500"
                    )}>
                      {lot.name}
                      {isFavorite && " ❤️"}
                    </Tooltip>
                  </Marker>
                ) : null;
              })}
            </MapContainer>

            {/* BOTTOM SHEET PREVIEW */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md rounded-t-[24px] p-4 shadow-2xl z-[1000]">
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 px-1">
                {filteredAndSorted.length} Results
              </p>
              
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {filteredAndSorted.map((lot) => {
                  const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
                  const isFavorite = favorites.includes(lot.id);
                  const isAccredited = lot.is_accredited === true;

                  if (!isAccredited) {
                    return (
                      <div key={lot.id} className="shrink-0 w-72 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm flex flex-col gap-3 opacity-80 cursor-default">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-black text-slate-800 truncate flex items-center gap-1">
                              {lot.name}
                              {isFavorite && <Heart size={10} className="fill-rose-500 text-rose-500" />}
                            </p>
                            <button onClick={(e) => toggleFavorite(lot.id, e)} className="p-1 hover:bg-gray-100 rounded-full">
                              <Heart size={14} className={isFavorite ? "fill-rose-500 text-rose-500" : "text-gray-300"} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[8px] h-4 px-1.5 uppercase font-bold">{lot.type}</Badge>
                              {isClosed && <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Closed</span>}
                            </div>
                            {lot.currentDistance !== null && !isClosed && (
                              <span className="text-[10px] font-black text-primary">
                                {lot.currentDistance.toFixed(1)} km • {lot.travelTime}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); handleShowRoute(lot.latitude, lot.longitude); }} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 py-2 rounded-xl text-[9px] font-black flex items-center justify-center gap-1">
                            {isFetchingRoute ? <Loader2 size={14} className="animate-spin" /> : <RouteIcon size={14} />}
                            ROUTE
                          </button>
                          <button onClick={() => openGoogleMaps(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-[9px] font-black flex items-center justify-center gap-1">
                            <Map size={14} /> GMAPS
                          </button>
                          <button onClick={() => openWaze(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng)} className="flex-1 bg-[#33CCFF] hover:bg-[#2DBBEA] text-white py-2 rounded-xl text-[9px] font-black flex items-center justify-center gap-1">
                            <Navigation size={14} /> WAZE
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={lot.id} className={cn("shrink-0 w-72 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm flex flex-col gap-3", isClosed && "opacity-80")}>
                      <div onClick={() => !isClosed && navigate(`/parking/${lot.id}`)} className="flex flex-col gap-1 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-black text-slate-800 truncate flex items-center gap-1">
                            {lot.name}
                            {isFavorite && <Heart size={10} className="fill-rose-500 text-rose-500" />}
                          </p>
                          <button onClick={(e) => toggleFavorite(lot.id, e)} className="p-1 hover:bg-gray-100 rounded-full">
                            <Heart size={14} className={isFavorite ? "fill-rose-500 text-rose-500" : "text-gray-300"} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[8px] h-4 px-1.5 uppercase font-bold">{lot.type}</Badge>
                          {isClosed ? (
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Closed</span>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-medium">₱{lot.rate_per_hour}/hr</span>
                          )}
                          {lot.currentDistance !== null && (
                            <span className="text-[10px] font-black text-primary ml-auto">
                              {lot.currentDistance.toFixed(1)} km • {lot.travelTime}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={(e) => { e.stopPropagation(); handleShowRoute(lot.latitude, lot.longitude); }} className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 py-2 rounded-xl text-[9px] font-black flex items-center justify-center gap-1">
                          {isFetchingRoute ? <Loader2 size={14} className="animate-spin" /> : <RouteIcon size={14} />}
                          ROUTE
                        </button>
                        <button onClick={() => openGoogleMaps(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng)} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-[9px] font-black flex items-center justify-center gap-1">
                          <Map size={14} /> GMAPS
                        </button>
                        <button onClick={() => openWaze(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng)} className="flex-1 bg-[#33CCFF] hover:bg-[#2DBBEA] text-white py-2 rounded-xl text-[9px] font-black flex items-center justify-center gap-1">
                          <Navigation size={14} /> WAZE
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* LIST VIEW - shows "Closed" for non-accredited when closed */
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-10">
            {listSorted.map((lot) => {
              const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';
              const isFavorite = favorites.includes(lot.id);
              const isAccredited = lot.is_accredited === true;

              // Non-accredited
              if (!isAccredited) {
                return (
                  <div
                    key={lot.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 opacity-80 cursor-default"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-black text-slate-800">{lot.name}</p>
                          {isFavorite && (
                            <Heart size={12} className="fill-rose-500 text-rose-500" />
                          )}
                        </div>
                        <div className="text-[9px] text-gray-400 mt-0.5">No ratings</div>
                        <div className="flex items-start gap-1 mt-1.5">
                          <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-gray-500 leading-tight">{lot.address}</p>
                        </div>
                      </div>
                      <div className="text-right"></div>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-3 pt-2 border-t border-gray-50">
                      <div className="flex items-center gap-1.5">
                        <div className={cn("w-2 h-2 rounded-full", isClosed ? "bg-gray-400" : "bg-gray-400")} />
                        <span className="text-[11px] font-bold text-gray-700">
                          {isClosed ? "Closed" : "Walk‑in Only"}
                        </span>
                      </div>
                      {lot.currentDistance !== null && !isClosed && (
                        <div className="flex items-center gap-1.5">
                          <Navigation size={10} className="text-primary" />
                          <span className="text-[11px] font-medium text-gray-600">
                            {lot.currentDistance.toFixed(1)} km
                          </span>
                          <span className="text-[10px] text-gray-400">•</span>
                          <span className="text-[11px] font-bold text-primary">
                            {lot.travelTime}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button onClick={(e) => { e.stopPropagation(); handleShowRoute(lot.latitude, lot.longitude); }} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all">
                        <RouteIcon size={14} /> ROUTE
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openGoogleMaps(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng); }} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all">
                        <Map size={14} /> GMAPS
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); openWaze(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng); }} className="flex-1 bg-[#33CCFF] hover:bg-[#2DBBEA] text-white py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all">
                        <Navigation size={14} /> WAZE
                      </button>
                    </div>
                  </div>
                );
              }

              // Accredited
              return (
                <div
                  key={lot.id}
                  onClick={() => !isClosed && navigate(`/parking/${lot.id}`)}
                  className={cn(
                    "bg-white rounded-2xl p-4 shadow-sm border border-slate-100 active:scale-[0.98] transition-all",
                    !isClosed ? "cursor-pointer" : "cursor-default opacity-70"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-black text-slate-800">{lot.name}</p>
                        {isFavorite && (
                          <Heart size={12} className="fill-rose-500 text-rose-500" />
                        )}
                      </div>
                      {lot.average_rating > 0 && renderStars(lot.average_rating)}
                      <div className="flex items-start gap-1 mt-1.5">
                        <MapPin size={12} className="text-gray-400 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-gray-500 leading-tight">{lot.address}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-primary">₱{lot.rate_per_hour}</p>
                      <p className="text-[8px] text-gray-400">/hour</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-3 pt-2 border-t border-gray-50">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        isClosed ? "bg-gray-400" :
                        lot.available_slots > 5 ? "bg-emerald-500" : 
                        lot.available_slots > 0 ? "bg-amber-500" : "bg-rose-500"
                      )} />
                      <span className="text-[11px] font-bold text-gray-700">
                        {isClosed ? "Closed" : `${lot.available_slots} / ${lot.total_slots} slots`}
                      </span>
                    </div>
                    {lot.currentDistance !== null && !isClosed && (
                      <div className="flex items-center gap-1.5">
                        <Navigation size={10} className="text-primary" />
                        <span className="text-[11px] font-medium text-gray-600">
                          {lot.currentDistance.toFixed(1)} km
                        </span>
                        <span className="text-[10px] text-gray-400">•</span>
                        <span className="text-[11px] font-bold text-primary">
                          {lot.travelTime}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button onClick={(e) => { e.stopPropagation(); handleShowRoute(lot.latitude, lot.longitude); }} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all">
                      <RouteIcon size={14} /> ROUTE
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openGoogleMaps(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng); }} className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all">
                      <Map size={14} /> GMAPS
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openWaze(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng); }} className="flex-1 bg-[#33CCFF] hover:bg-[#2DBBEA] text-white py-2.5 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all">
                      <Navigation size={14} /> WAZE
                    </button>
                  </div>
                </div>
              );
            })}
            
            {listSorted.length === 0 && (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">No parking lots found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
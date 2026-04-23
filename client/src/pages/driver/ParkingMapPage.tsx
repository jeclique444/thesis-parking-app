/*
 * ParKada (formerly iParkBayan) — ParkingMapPage
 * Clean Satellite View + Navigation (Waze & GMaps) + Real-time Geolocation + In-App Route Directions + Supabase Real-time
 */
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import MobileLayout from "@/components/MobileLayout";
import { supabase } from "../../supabaseClient";
import { MapPin, List, Map, Search, Loader2, Plus, Minus, Layers, Navigation, Route as RouteIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// Leaflet Imports
import { MapContainer, TileLayer, Marker, Tooltip, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// --- HELPER: Distance Calculator (Haversine Formula) ---
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius ng Earth sa kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance sa KM
};

// --- HELPER: Check if Parking is Open Based on Time ---
const isParkingOpen = (openHoursStr: string | null | undefined, currentDate: Date) => {
  if (!openHoursStr) return true; // Default kung walang nakalagay sa DB
  if (openHoursStr.toLowerCase().includes('24 hours')) return true;

  try {
    const [startStr, endStr] = openHoursStr.split('-');
    if (!startStr || !endStr) return true;

    // Regex para makuha ang oras, minuto, at am/pm
    const parseTime = (timeStr: string) => {
      const match = timeStr.trim().match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
      if (!match) return 0;
      
      let hours = parseInt(match[1], 10);
      let minutes = match[2] ? parseInt(match[2], 10) : 0;
      let period = match[3].toLowerCase();

      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      return hours * 60 + minutes; // Convert to minutes from midnight
    };

    const startMins = parseTime(startStr);
    const endMins = parseTime(endStr);
    const currentMins = currentDate.getHours() * 60 + currentDate.getMinutes();

    // Normal day range (e.g., 7:00 AM - 10:00 PM)
    if (startMins < endMins) {
      return currentMins >= startMins && currentMins < endMins;
    } 
    // Crosses midnight (e.g., 7:00 AM - 12:00 AM or 10:00 PM - 5:00 AM)
    else {
      return currentMins >= startMins || currentMins < endMins;
    }
  } catch (error) {
    console.error("Error parsing open_hours:", error);
    return true; // Fallback
  }
};

// --- NAVIGATION HELPERS ---

// Helper for Google Maps Navigation (Starts from user's current location)
const openGoogleMaps = (destLat: number, destLng: number, userLat?: number, userLng?: number) => {
  if (userLat && userLng) {
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${destLat},${destLng}&travelmode=driving`, "_blank");
  } else {
    // Fallback if no user location is available
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=driving`, "_blank");
  }
};

// Helper for Waze Navigation (Waze automatically uses current GPS location as starting point)
const openWaze = (lat: number, lng: number) => {
  const url = `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  window.open(url, "_blank");
};

// Custom Zoom Controls Component
function ZoomHandler() {
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
    </div>
  );
}

// Updated Custom Icon to support "Closed" state
const createCustomIcon = (availableSlots: number, isClosed: boolean) => {
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

  const isSomeFree = availableSlots > 0;
  const colorClass = availableSlots > 5 ? 'text-emerald-500' : isSomeFree ? 'text-amber-500' : 'text-rose-500';
  const bgClass = availableSlots > 5 ? 'bg-emerald-500' : isSomeFree ? 'bg-amber-500' : 'bg-rose-500';
  
  return L.divIcon({
    html: `
      <div class="flex flex-col items-center gap-0.5" style="transform: translate(-50%, -100%);">
        <div class="px-2 py-1 rounded-lg text-[10px] font-bold shadow-lg whitespace-nowrap text-white ${bgClass}">
          ${availableSlots > 0 ? `${availableSlots} slots available` : 'Full'}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5" class="drop-shadow-lg ${colorClass}">
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

  // Real-time clock checker state
  const [currentTime, setCurrentTime] = useState(new Date());

  const lipaCenter: [number, number] = [13.9430, 121.1625];

  // Geolocation Effect
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

  // Clock Update Effect
  useEffect(() => {
    // Mag-uupdate ang component every 1 minute para ma-check kung closed na
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Data Fetching and Realtime Subscriptions
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [lotsRes, slotsRes] = await Promise.all([
          supabase.from('parking_lots').select('*'),
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
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_lots' },
        (payload) => {
          setLots((currentLots) => {
            if (payload.eventType === 'INSERT') return [...currentLots, payload.new];
            if (payload.eventType === 'UPDATE') return currentLots.map((lot) => lot.id === payload.new.id ? { ...lot, ...payload.new } : lot);
            if (payload.eventType === 'DELETE') return currentLots.filter((lot) => lot.id !== payload.old.id);
            return currentLots;
          });
        }
      )
      .subscribe();

    const slotsChannel = supabase
      .channel('realtime:parking_slots')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_slots' },
        (payload) => {
          setSlots((currentSlots) => {
            if (payload.eventType === 'INSERT') return [...currentSlots, payload.new];
            if (payload.eventType === 'UPDATE') return currentSlots.map((slot) => slot.id === payload.new.id ? payload.new : slot);
            if (payload.eventType === 'DELETE') return currentSlots.filter((slot) => slot.id !== payload.old.id);
            return currentSlots;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(lotsChannel);
      supabase.removeChannel(slotsChannel);
    };
  }, []);

  const handleShowRoute = async (targetLat: number, targetLng: number) => {
    if (!userCoords) {
      alert("Please allow location access to get directions.");
      return;
    }
    setIsFetchingRoute(true);
    setView("map"); 

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
      return { ...lot, currentDistance: distance };
    })
    .sort((a, b) => {
      if (a.currentDistance === null) return 1;
      if (b.currentDistance === null) return -1;
      return a.currentDistance - b.currentDistance;
    });

  return (
    <MobileLayout title="Find Parking" showBack onBack={() => navigate("/home")} noPadding>
      <div className="flex flex-col h-[calc(100dvh-56px)] bg-slate-50">
        
        {/* --- HEADER --- */}
        <div className="px-4 py-3 bg-white border-b border-border space-y-2 z-20 shadow-sm">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parking in Lipa City..."
              className="pl-9 h-10 rounded-xl bg-muted/40 text-sm border-none"
            />
          </div>
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
              <TileLayer
                url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                attribution="© Google Satellite"
                maxZoom={21}
              />
              
              {userCoords && (
                <Marker 
                  position={[userCoords.lat, userCoords.lng]} 
                  icon={L.divIcon({ 
                    html: '<div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg ring-4 ring-blue-500/30 animate-pulse"></div>', 
                    className: '' 
                  })} 
                />
              )}

              {routeCoords && (
                <Polyline 
                  positions={routeCoords} 
                  color="#3b82f6" 
                  weight={5} 
                  opacity={0.8}
                  dashArray="10, 10"
                />
              )}

              <ZoomHandler />
              {filteredAndSorted.map((lot) => {
                // Gamitin ang open_hours mula sa database at ang currentTime state natin
                const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';

                return lot.latitude && lot.longitude ? (
                  <Marker 
                    key={lot.id}
                    position={[lot.latitude, lot.longitude]} 
                    icon={createCustomIcon(lot.available_slots, isClosed)}
                    eventHandlers={{ 
                      click: () => {
                        // Prevent navigation if the lot is closed
                        if (!isClosed) {
                          navigate(`/parking/${lot.id}`);
                        }
                      } 
                    }}
                  >
                    <Tooltip permanent direction="bottom" offset={[0, 10]} className="bg-primary border-none shadow-xl text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {lot.name}
                    </Tooltip>
                  </Marker>
                ) : null;
              })}
            </MapContainer>

            {/* --- BOTTOM SHEET PREVIEW --- */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md rounded-t-[24px] p-4 shadow-2xl z-[1000]">
              <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 px-1">
                {filteredAndSorted.length} Results
              </p>
              
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                {filteredAndSorted.map((lot) => {
                  // Gamitin ang open_hours mula sa database at ang currentTime state natin
                  const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';

                  return (
                    <div key={lot.id} className={cn("shrink-0 w-72 bg-white border border-slate-100 rounded-2xl p-3 shadow-sm flex flex-col gap-3", isClosed && "opacity-80")}>
                      <div 
                        onClick={() => !isClosed && navigate(`/parking/${lot.id}`)}
                        className={cn("flex flex-col gap-1", !isClosed ? "cursor-pointer" : "cursor-default")}
                      >
                        <p className="text-xs font-black text-slate-800 truncate mb-1">{lot.name}</p>
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="text-[8px] h-4 px-1.5 uppercase font-bold">{lot.type}</Badge>
                           
                           {/* If closed, show closed text, else show rate */}
                           {isClosed ? (
                             <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Closed</span>
                           ) : (
                             <span className="text-[10px] text-slate-500 font-medium">₱{lot.rate_per_hour}/hr</span>
                           )}
                           
                           {lot.currentDistance !== null && (
                             <span className="text-[10px] font-black text-primary ml-auto">
                               {lot.currentDistance.toFixed(2)} km
                             </span>
                           )}
                        </div>
                      </div>
                      
                      {/* BUTTONS: Route (App), GMaps, Waze */}
                      <div className="flex gap-1.5">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleShowRoute(lot.latitude, lot.longitude); }}
                          className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 py-2 rounded-xl text-[9px] font-black flex flex-col items-center justify-center gap-1 transition-colors"
                        >
                          {isFetchingRoute ? <Loader2 size={16} className="animate-spin" /> : <RouteIcon size={16} />}
                          APP ROUTE
                        </button>

                        <button 
                          onClick={() => openGoogleMaps(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng)}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-xl text-[9px] font-black flex flex-col items-center justify-center gap-1 transition-colors"
                        >
                          <Map size={16} fill="none" />
                          GMAPS
                        </button>

                        <button 
                          onClick={() => openWaze(lot.latitude, lot.longitude)}
                          className="flex-1 bg-[#33CCFF] hover:bg-[#2DBBEA] text-white py-2 rounded-xl text-[9px] font-black flex flex-col items-center justify-center gap-1 transition-colors"
                        >
                          <Navigation size={16} fill="currentColor" />
                          WAZE
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* --- LIST VIEW --- */
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-10">
            {filteredAndSorted.map((lot) => {
              // Gamitin ang open_hours mula sa database at ang currentTime state natin
              const isClosed = lot.open_hours ? !isParkingOpen(lot.open_hours, currentTime) : lot.status === 'closed';  

              return (
                <div
                  key={lot.id}
                  className={cn("bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 transition-colors", 
                    isClosed ? "opacity-75" : "active:bg-slate-50")}
                >
                  <div 
                    onClick={() => !isClosed && navigate(`/parking/${lot.id}`)} 
                    className={cn("flex-1 flex items-center gap-4 min-w-0", !isClosed ? "cursor-pointer" : "cursor-default")}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                      isClosed ? "bg-slate-100 text-slate-500" :
                      lot.available_slots > 5 ? "bg-emerald-50 text-emerald-600" : 
                      lot.available_slots > 0 ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                    )}>
                      <MapPin size={24} fill="currentColor" fillOpacity={0.2} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-black text-slate-800 truncate">{lot.name}</p>
                        <Badge variant="secondary" className="text-[8px] h-4 px-1 shadow-none uppercase">{lot.type}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mb-1">{lot.address}</p>
                      
                      <div className="flex items-center gap-2">
                        {isClosed ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase tracking-widest">
                            Closed
                          </span>
                        ) : (
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                            lot.available_slots > 5 ? "bg-emerald-100 text-emerald-700" : 
                            lot.available_slots > 0 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                          )}>
                            {lot.available_slots} / {lot.total_slots} Slots
                          </span>
                        )}
                        
                        {lot.currentDistance !== null && (
                          <span className="text-[10px] font-bold text-primary ml-auto">
                            {lot.currentDistance.toFixed(2)} km
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* LIST VIEW BUTTONS */}
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleShowRoute(lot.latitude, lot.longitude); }}
                      className="p-2.5 bg-blue-500/10 text-blue-500 rounded-full hover:bg-blue-500 hover:text-white transition-all"
                      title="Draw Route on Map"
                    >
                      <RouteIcon size={16} />
                    </button>

                    <button 
                      onClick={() => openGoogleMaps(lot.latitude, lot.longitude, userCoords?.lat, userCoords?.lng)}
                      className="p-2.5 bg-green-500/10 text-green-500 rounded-full hover:bg-green-500 hover:text-white transition-all"
                      title="Google Maps"
                    >
                      <Map size={16} />
                    </button>

                    <button 
                      onClick={() => openWaze(lot.latitude, lot.longitude)}
                      className="p-2.5 bg-[#33CCFF]/10 text-[#33CCFF] rounded-full hover:bg-[#33CCFF] hover:text-white transition-all"
                      title="Waze"
                    >
                      <Navigation size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
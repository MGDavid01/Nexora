import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type PuntoMapa = { lat: number; lng: number };

export type DireccionMapa = {
  calle: string;
  colonia: string;
  ciudad: string;
  estado: string;
  cp: string;
};

const TIJUANA: L.LatLngExpression = [32.5149, -117.0382];
const TESELA = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function MapaUbicacion({
  onSeleccionar,
}: {
  onSeleccionar: (punto: PuntoMapa, direccion: DireccionMapa | null) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);
  const onSeleccionarRef = useRef(onSeleccionar);
  onSeleccionarRef.current = onSeleccionar;
  const [punto, setPunto] = useState<PuntoMapa | null>(null);
  const [aviso, setAviso] = useState("Toca cualquier punto del mapa para colocar la ubicación.");
  const colocarRef = useRef<(p: PuntoMapa) => void>(() => {});
  const solicitudActual = useRef(0);

  async function geocodificar(p: PuntoMapa): Promise<DireccionMapa | null> {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("lat", String(p.lat));
      url.searchParams.set("lon", String(p.lng));
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("accept-language", "es");
      const respuesta = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      if (!respuesta.ok) return null;
      const datos = (await respuesta.json()) as { address?: Record<string, string> };
      const a = datos.address ?? {};
      return {
        calle: [a.road, a.house_number].filter(Boolean).join(" "),
        colonia: a.suburb || a.neighbourhood || a.city_district || "",
        ciudad: a.city || a.town || a.village || a.municipality || "",
        estado: a.state || "",
        cp: a.postcode || "",
      };
    } catch {
      return null;
    }
  }

  async function colocar(p: PuntoMapa) {
    const solicitud = ++solicitudActual.current;
    setPunto(p);
    setAviso("Buscando la dirección de ese punto…");
    const instancia = mapa.current;
    if (instancia) {
      if (marcador.current) {
        marcador.current.setLatLng([p.lat, p.lng]);
      } else {
        const m = L.marker([p.lat, p.lng], { draggable: true, icon: pinIcon() }).addTo(instancia);
        m.on("dragend", () => {
          const pos = m.getLatLng();
          void colocarRef.current({ lat: pos.lat, lng: pos.lng });
        });
        marcador.current = m;
      }
    }
    const direccion = await geocodificar(p);
    if (solicitud !== solicitudActual.current) return;
    onSeleccionarRef.current(p, direccion);
    setAviso(
      direccion
        ? "Dirección autocompletada. Revísala y ajusta calle/número si hace falta."
        : "No se pudo autocompletar la dirección; escríbela manualmente.",
    );
  }
  colocarRef.current = colocar;

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const instancia = L.map(contenedor.current, {
      center: TIJUANA,
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer(TESELA, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(instancia);
    instancia.on("click", (e: L.LeafletMouseEvent) => {
      void colocarRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    mapa.current = instancia;

    const resize = () => instancia.invalidateSize();
    const observer = new ResizeObserver(resize);
    observer.observe(contenedor.current);
    const t = window.setTimeout(resize, 80);

    return () => {
      window.clearTimeout(t);
      observer.disconnect();
      instancia.off("click");
      instancia.remove();
      mapa.current = null;
      marcador.current = null;
    };
  }, []);

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setAviso("Tu navegador no permite geolocalización; toca el mapa.");
      return;
    }
    setAviso("Obteniendo tu ubicación…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapa.current?.flyTo([p.lat, p.lng], 15, { duration: 0.45 });
        void colocar(p);
      },
      () => setAviso("No se pudo obtener tu ubicación; toca el mapa para colocarla."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function quitar() {
    solicitudActual.current += 1;
    if (marcador.current) {
      marcador.current.remove();
      marcador.current = null;
    }
    setPunto(null);
    setAviso("Toca cualquier punto del mapa para colocar la ubicación.");
  }

  return (
    <div className="mapa-ubicacion-envoltura">
      <div ref={contenedor} className="mapa-ubicacion" role="img" aria-label="Mapa para elegir la ubicación del servicio" />
      <div className="mapa-ubicacion-acciones">
        <button type="button" data-slot="mapa-accion" onClick={usarMiUbicacion}>
          Mi ubicación
        </button>
        {punto ? (
          <button type="button" data-slot="mapa-accion" onClick={quitar}>
            Quitar punto
          </button>
        ) : null}
      </div>
      <p className="mapa-ubicacion-pie">
        {punto ? `Punto: ${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)} · ` : ""}
        {aviso}
      </p>
    </div>
  );
}

function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    html: `<span style="display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#306998;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.45);"></span>`,
  });
}

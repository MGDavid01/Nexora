import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type PinSolicitud = {
  id: string;
  numero: number;
  titulo: string;
  categoria: string;
  colonia: string;
  lat: number;
  lng: number;
};

const TIJUANA: L.LatLngExpression = [32.5149, -117.0382];
const TESELA = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export function MapaSolicitudes({
  pines,
  seleccionada,
  onSeleccionar,
}: {
  pines: PinSolicitud[];
  seleccionada: string | null;
  onSeleccionar: (id: string) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capa = useRef<L.LayerGroup | null>(null);
  const onSeleccionarRef = useRef(onSeleccionar);
  onSeleccionarRef.current = onSeleccionar;

  useEffect(() => {
    if (!contenedor.current || mapa.current) return;
    const instancia = L.map(contenedor.current, {
      center: TIJUANA,
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer(TESELA, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(instancia);
    capa.current = L.layerGroup().addTo(instancia);
    mapa.current = instancia;

    const resize = () => instancia.invalidateSize();
    const observer = new ResizeObserver(resize);
    observer.observe(contenedor.current);
    const t = window.setTimeout(resize, 80);

    return () => {
      window.clearTimeout(t);
      observer.disconnect();
      instancia.remove();
      mapa.current = null;
      capa.current = null;
    };
  }, []);

  useEffect(() => {
    const instancia = mapa.current;
    const grupo = capa.current;
    if (!instancia || !grupo) return;
    grupo.clearLayers();
    for (const pin of pines) {
      const activa = pin.id === seleccionada;
      const marcador = L.marker([pin.lat, pin.lng], {
        icon: iconoPin(pin.numero, activa),
        zIndexOffset: activa ? 800 : pin.numero,
        title: pin.titulo,
      });
      marcador.bindTooltip(pin.titulo, { direction: "top", offset: [0, -36] });
      marcador.on("click", () => onSeleccionarRef.current(pin.id));
      marcador.addTo(grupo);
    }
  }, [pines, seleccionada]);

  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;
    if (seleccionada) {
      const pin = pines.find((p) => p.id === seleccionada);
      if (pin) instancia.flyTo([pin.lat, pin.lng], Math.max(instancia.getZoom(), 14), { duration: 0.45 });
      return;
    }
    if (pines.length === 0) {
      instancia.setView(TIJUANA, 12);
      return;
    }
    const limites = L.latLngBounds(pines.map((p) => [p.lat, p.lng] as L.LatLngExpression));
    instancia.fitBounds(limites.pad(0.25), { maxZoom: 14, animate: true });
  }, [pines, seleccionada]);

  return <div ref={contenedor} className="sol-mapa-lienzo" role="img" aria-label="Mapa de solicitudes en Tijuana" />;
}

function iconoPin(numero: number, activa: boolean): L.DivIcon {
  return L.divIcon({
    className: activa ? "sol-pin-wrap sol-pin-wrap-activa" : "sol-pin-wrap",
    iconSize: [30, 42],
    iconAnchor: [15, 40],
    popupAnchor: [0, -36],
    html: `<span class="sol-pin${activa ? " sol-pin-activa" : ""}"><svg viewBox="0 0 24 36" aria-hidden="true"><path d="M12 1.5c-6 0-10.5 4.7-10.5 10.7 0 8.2 10.5 22.3 10.5 22.3S22.5 20.4 22.5 12.2C22.5 6.2 18 1.5 12 1.5z"/></svg><span>${numero}</span></span>`,
  });
}

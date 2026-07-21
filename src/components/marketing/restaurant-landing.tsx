"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent, ReactNode } from "react";
import Link from "next/link";
import {
  Search, ChevronDown, ChevronUp, Star, MapPin, Phone, Mail,
  Clock, Leaf, Heart, Menu, X, ArrowRight,
  MessageCircle, Camera, Share2, Radio, Video,
  ShoppingBag, Calendar, Users, ChefHat, Award, Gift,
  Music, Coffee, Cake, BookOpen, Send, CheckCircle, ExternalLink, Play
} from "lucide-react";
import {
  mapsEmbedSrc,
  telHref,
  whatsappChatUrl,
} from "@/lib/contact-links";
import {
  DEFAULT_RESTAURANT_BRAND,
  type RestaurantBrand,
} from "@/types/restaurant-brand";
import type { Product } from "@/types/api";

export type { RestaurantBrand };

// ─── Brand (multi-tenant) ────────────────────────────────────────────────────

const BrandContext = createContext<RestaurantBrand>(DEFAULT_RESTAURANT_BRAND);

function useBrand(): RestaurantBrand {
  return useContext(BrandContext);
}

const CatalogContext = createContext<Product[]>([]);

function useCatalog(): Product[] {
  return useContext(CatalogContext);
}

const MENU_PLACEHOLDER_IMAGE =
  "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=280&fit=crop&auto=format";

// ─── Data ────────────────────────────────────────────────────────────────────

const GALLERY_IMAGES = [
  { src: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=450&fit=crop&auto=format", alt: "Interior del restaurante" },
  { src: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=450&fit=crop&auto=format", alt: "Ambiente íntimo" },
  { src: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=450&fit=crop&auto=format", alt: "Pizza Margherita" },
  { src: "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=600&h=450&fit=crop&auto=format", alt: "Pasta Carbonara" },
  { src: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600&h=450&fit=crop&auto=format", alt: "Tiramisù" },
  { src: "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600&h=450&fit=crop&auto=format", alt: "Spritz aperitivo" },
  { src: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=450&fit=crop&auto=format", alt: "Antipasto della casa" },
  { src: "https://images.unsplash.com/photo-1493770348161-369560ae357d?w=600&h=450&fit=crop&auto=format", alt: "Desayuno italiano" },
];

const REVIEWS = [
  { name: "Andrea Martínez", rating: 5, date: "Junio 2025", text: "La carbonara más auténtica fuera de Roma. El ambiente es increíble y el servicio impecable. Reserven con anticipación porque siempre está lleno.", avatar: "AM" },
  { name: "Luis Fontana", rating: 5, date: "Mayo 2025", text: "La pizza tartufo cambió mi vida. La masa madre de 48 horas se nota, crujiente por fuera y esponjosa por dentro. Volvería todos los viernes.", avatar: "LF" },
  { name: "Sofía Reyes", rating: 5, date: "Mayo 2025", text: "Celebramos nuestro aniversario aquí y fue perfecto. La atención personalizada, el tiramisù de la nonna y el ambiente hacen que valga cada peso.", avatar: "SR" },
  { name: "Carlos Bianchi", rating: 4, date: "Abril 2025", text: "Excelente relación calidad-precio. Los arancini de entrada son adictivos. Solo le quitaría una estrella porque el estacionamiento es pequeño.", avatar: "CB" },
  { name: "Mariana López", rating: 5, date: "Abril 2025", text: "El chef Marco explica cada platillo con tanto amor que entiendes que esto no es solo un restaurante, es una experiencia cultural completa.", avatar: "ML" },
  { name: "Diego Russo", rating: 5, date: "Marzo 2025", text: "Vine por el Spritz y me quedé por la pasta. El ragù bolognese cocido 6 horas tiene una profundidad de sabor impresionante. Grazie mille!", avatar: "DR" },
];

const FAQ_ITEMS = [
  { q: "¿Aceptan tarjetas de crédito y débito?", a: "Sí, aceptamos todas las tarjetas de crédito y débito (Visa, Mastercard, American Express). También pagos en efectivo y transferencias. Ofrecemos hasta 3 meses sin intereses con tarjetas participantes." },
  { q: "¿Emiten facturas fiscales?", a: "Sí, emitimos facturas CFDI. Solicítala al momento del pago o a través de nuestro portal en línea con el folio de tu ticket dentro de los 30 días naturales." },
  { q: "¿Hay estacionamiento disponible?", a: "Contamos con valet parking cortesía para consumos mayores a $500. También hay estacionamiento público a media cuadra en Calle Florencia #45." },
  { q: "¿Se permiten mascotas?", a: "Sí aceptamos mascotas en nuestra terraza exterior. Contamos con bebederos y snacks para perros. Te pedimos que vengan con correa y vacunas al día." },
  { q: "¿Tienen opciones vegetarianas y veganas?", a: "Más del 40% de nuestro menú es vegetariano o adapatable. Tenemos opciones veganas marcadas en el menú. Solo avisa al mesero y adaptamos cualquier platillo." },
  { q: "¿Hacen eventos privados?", a: "Sí, tenemos un salón privado para hasta 40 personas con menú especial. Contáctanos por WhatsApp o email para cotizaciones y disponibilidad." },
  { q: "¿Cuál es la política de cancelación?", a: "Las reservaciones pueden cancelarse hasta 2 horas antes sin cargo. Para grupos de 8+ personas pedimos 24 horas de anticipación." },
];

const PROMOS = [
  { title: "2x1 en Pizzas", subtitle: "Martes de Pizza", desc: "Cada martes, compra una pizza y la segunda es gratis. Válido en toda la carta de pizzas.", color: "bg-[#1a3d2b]", textColor: "text-[#f7f3eb]", accent: "text-[#d4a853]", badge: "MARTES", endsIn: new Date(Date.now() + 2 * 24 * 3600 * 1000) },
  { title: "Happy Hour", subtitle: "Lunes a Viernes", desc: "De 14:00 a 17:00 hrs. 50% de descuento en toda la barra. Spritz, vinos y cocteles.", color: "bg-[#c9612a]", textColor: "text-white", accent: "text-[#ffd89e]", badge: "DAILY", endsIn: new Date(new Date().setHours(17, 0, 0, 0)) },
  { title: "Combo Familiar", subtitle: "Fines de semana", desc: "2 pizzas + 4 pastas + postre familiar + 4 refrescos por solo $890. ¡Ideal para toda la familia!", color: "bg-[#8b5e3c]", textColor: "text-white", accent: "text-[#ffe0b2]", badge: "SAB-DOM", endsIn: new Date(Date.now() + 5 * 24 * 3600 * 1000) },
  { title: "Descuento Estudiante", subtitle: "Siempre vigente", desc: "Presenta tu credencial escolar vigente y obtén 15% de descuento en tu consumo total.", color: "bg-[#2d5c40]", textColor: "text-[#f7f3eb]", accent: "text-[#a8d5b5]", badge: "SIEMPRE", endsIn: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
];

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useCountdown(target: Date) {
  const [time, setTime] = useState({ h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, target.getTime() - Date.now());
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTime({ h, m, s });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return time;
}

// ─── Small components ────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-14">
      <p className="font-nunito-sans text-xs tracking-[0.25em] uppercase text-accent mb-3">{eyebrow}</p>
      <h2 className="font-playfair-display text-4xl md:text-5xl font-bold text-foreground leading-tight">{title}</h2>
      {subtitle && <p className="mt-4 text-muted-foreground font-nunito-sans max-w-xl mx-auto leading-relaxed">{subtitle}</p>}
    </div>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={14} className={i <= rating ? "fill-[#d4a853] text-[#d4a853]" : "text-muted"} />
      ))}
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

function Navbar() {
  const brand = useBrand();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    "Menú",
    "Destacados",
    "Promociones",
    ...(brand.hasReservations ? (["Reservar"] as const) : []),
    "Nosotros",
    "Galería",
    "Opiniones",
    "Contacto",
  ];

  const scrollTo = (id: string) => {
    document.getElementById(id.toLowerCase())?.scrollIntoView({ behavior: "smooth" });
    setOpen(false);
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#1a3d2b] shadow-lg" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        <button onClick={() => scrollTo("inicio")} className="flex items-center gap-3 leading-none">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt=""
              className="size-9 rounded-sm object-cover ring-1 ring-white/20"
            />
          ) : null}
          <span className="flex flex-col items-start">
            <span className="font-pinyon-script text-2xl text-[#d4a853]">{brand.name}</span>
            <span className="font-nunito-sans text-[9px] tracking-[0.3em] uppercase text-[#f7f3eb] opacity-70">
              {brand.tagline ?? "Restaurante"}
            </span>
          </span>
        </button>
        <nav className="hidden lg:flex items-center gap-7">
          {links.map(l => (
            <button key={l} onClick={() => scrollTo(l === "Menú" ? "menu" : l === "Reservar" ? "reservaciones" : l.toLowerCase())}
              className="font-nunito-sans text-xs tracking-widest uppercase text-[#f7f3eb] opacity-80 hover:opacity-100 hover:text-[#d4a853] transition-colors">
              {l}
            </button>
          ))}
        </nav>
        {brand.hasReservations ? (
          <button onClick={() => scrollTo("reservaciones")}
            className="hidden lg:inline-flex items-center gap-2 bg-accent text-white font-nunito-sans text-xs tracking-widest uppercase px-5 py-2.5 rounded-sm hover:bg-[#a84e22] transition-colors">
            Reservar Mesa
          </button>
        ) : (
          <Link
            href="/menu"
            className="hidden lg:inline-flex items-center gap-2 bg-accent text-white font-nunito-sans text-xs tracking-widest uppercase px-5 py-2.5 rounded-sm hover:bg-[#a84e22] transition-colors"
          >
            Ordenar
          </Link>
        )}
        <button className="lg:hidden text-[#f7f3eb]" onClick={() => setOpen(!open)}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div className="lg:hidden bg-[#1a3d2b] border-t border-white/10 px-6 py-6 space-y-4">
          {links.map(l => (
            <button key={l} onClick={() => scrollTo(l === "Menú" ? "menu" : l === "Reservar" ? "reservaciones" : l.toLowerCase())}
              className="block w-full text-left font-nunito-sans text-sm tracking-widest uppercase text-[#f7f3eb] py-2 border-b border-white/10">
              {l}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  const brand = useBrand();
  const heroImage =
    brand.bannerUrl ||
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600&h=900&fit=crop&auto=format";
  const subtitle =
    brand.description?.trim() ||
    "Ingredientes frescos, recetas de la casa y un servicio que te hará sentir como en casa.";

  const ctas = [
    { label: "Ver Menú", id: "menu", primary: true },
    { label: "Ordenar Ahora", id: "ordenar", primary: false },
    ...(brand.hasReservations
      ? [{ label: "Reservar Mesa", id: "reservaciones", primary: false }]
      : []),
    { label: "Cómo Llegar", id: "ubicacion", primary: false },
  ];

  return (
    <section id="inicio" className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[#0e1f16]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={heroImage}
          alt={`Interior de ${brand.name}`}
          className="w-full h-full object-cover opacity-45"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0e1f16]/60 via-[#0e1f16]/30 to-[#0e1f16]/80" />
      </div>
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">
        <p className="font-nunito-sans text-[11px] tracking-[0.4em] uppercase text-[#d4a853] mb-6">
          ✦ {brand.tagline ?? "Restaurante"} ✦
        </p>
        <h1 className="font-playfair-display text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[1.05] mb-6">
          {brand.name}
        </h1>
        <p className="font-nunito-sans text-base md:text-lg text-white/75 max-w-xl mx-auto leading-relaxed mb-10">
          {subtitle}
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          {ctas.map((btn) => (
            <button
              key={btn.label}
              onClick={() =>
                document.getElementById(btn.id)?.scrollIntoView({ behavior: "smooth" })
              }
              className={`font-nunito-sans text-xs tracking-widest uppercase px-7 py-3.5 rounded-sm transition-all duration-200 ${
                btn.primary
                  ? "bg-accent text-white hover:bg-[#a84e22]"
                  : "border border-white/40 text-white hover:bg-white/10 hover:border-white/70"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={() => document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" })}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 hover:text-white/70 transition-colors animate-bounce"
      >
        <ChevronDown size={28} />
      </button>
    </section>
  );
}

// ─── Menu ────────────────────────────────────────────────────────────────────

function DigitalMenu() {
  const products = useCatalog();
  const [categoryId, setCategoryId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  const categories = useMemo(() => {
    const seen = new Map<number, string>();
    for (const product of products) {
      if (!seen.has(product.categoryId)) {
        seen.set(product.categoryId, product.categoryName);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [products]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const catOk =
        categoryId === "all" || product.categoryId === categoryId;
      const searchOk =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.description ?? "").toLowerCase().includes(query);
      return catOk && searchOk;
    });
  }, [products, categoryId, search]);

  return (
    <section id="menu" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow="Menú Digital"
          title="Nuestra Carta"
          subtitle="Platillos publicados desde el panel del restaurante. Explora por categoría o busca por nombre."
        />

        <div className="relative max-w-md mx-auto mb-8">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar platillo..."
            className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-sm font-nunito-sans text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {categories.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            <button
              type="button"
              onClick={() => setCategoryId("all")}
              className={`font-nunito-sans text-xs tracking-widest uppercase px-5 py-2.5 rounded-sm border transition-all ${
                categoryId === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(cat.id)}
                className={`font-nunito-sans text-xs tracking-widest uppercase px-5 py-2.5 rounded-sm border transition-all ${
                  categoryId === cat.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        ) : null}

        {products.length === 0 ? (
          <p className="text-center text-muted-foreground font-nunito-sans py-16">
            Aún no hay platillos publicados. Agrégalos desde el panel de Menú.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground font-nunito-sans py-16">
            No se encontraron platillos con esos filtros.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item) => (
              <div
                key={item.uuid}
                className="bg-card border border-border rounded-sm overflow-hidden hover:shadow-lg transition-shadow group"
              >
                <div className="relative h-48 bg-muted overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl || MENU_PLACEHOLDER_IMAGE}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 font-nunito-sans text-[10px] tracking-widest uppercase bg-black/55 text-white px-2.5 py-1 rounded-sm">
                    {item.categoryName}
                  </span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <h3 className="font-playfair-display text-lg font-bold leading-tight">
                      {item.name}
                    </h3>
                    <span className="font-playfair-display text-xl font-bold text-accent shrink-0 tabular-nums">
                      {item.formattedPrice}
                    </span>
                  </div>
                  {item.description ? (
                    <p className="font-nunito-sans text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>
                  ) : null}
                  <Link
                    href="/menu"
                    className="mt-4 inline-flex items-center gap-2 font-nunito-sans text-xs tracking-widest uppercase text-accent hover:underline"
                  >
                    <ShoppingBag size={13} /> Pedir en menú digital
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Destacados ──────────────────────────────────────────────────────────────

function Destacados() {
  const products = useCatalog();
  const badges = [
    { badge: "Más Vendido", badgeCls: "bg-accent text-white" },
    { badge: "Recomendación del Chef", badgeCls: "bg-[#1a3d2b] text-[#d4a853]" },
    { badge: "Favorito de la Casa", badgeCls: "bg-[#8b5e3c] text-white" },
  ] as const;

  const featured = products.slice(0, 3).map((product, index) => ({
    product,
    ...badges[index]!,
  }));

  if (featured.length === 0) return null;

  return (
    <section id="destacados" className="py-24 bg-secondary">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader
          eyebrow="Lo Mejor de la Casa"
          title="Platillos Destacados"
          subtitle="Una selección de nuestra carta actual para que pruebes lo esencial."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featured.map(({ product, badge, badgeCls }, i) => (
            <div
              key={product.uuid}
              className={`bg-card rounded-sm overflow-hidden border border-border shadow-sm hover:shadow-xl transition-all duration-300 ${
                i === 1 ? "md:-translate-y-4" : ""
              }`}
            >
              <div className="relative h-56 bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl || MENU_PLACEHOLDER_IMAGE}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span
                  className={`absolute top-4 left-4 font-nunito-sans text-[10px] tracking-[0.2em] uppercase px-3 py-1.5 rounded-sm font-bold ${badgeCls}`}
                >
                  {badge}
                </span>
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="font-playfair-display text-xl font-bold text-white">
                    {product.name}
                  </h3>
                  <p className="font-playfair-display text-2xl font-black text-[#d4a853] mt-0.5 tabular-nums">
                    {product.formattedPrice}
                  </p>
                </div>
              </div>
              <div className="p-5">
                <p className="font-nunito-sans text-sm text-muted-foreground leading-relaxed">
                  {product.description?.trim() || product.categoryName}
                </p>
                <Link
                  href="/menu"
                  className="mt-4 w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-nunito-sans text-xs tracking-widest uppercase py-3 rounded-sm hover:bg-[#2d5c40] transition-colors"
                >
                  <ShoppingBag size={14} /> Ordenar
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Promociones ─────────────────────────────────────────────────────────────

function PromoCard({ promo }: { promo: typeof PROMOS[0] }) {
  const time = useCountdown(promo.endsIn);
  return (
    <div className={`${promo.color} rounded-sm p-7 flex flex-col justify-between min-h-[280px] relative overflow-hidden`}>
      <div className="absolute top-0 right-0 opacity-5">
        <div className="w-48 h-48 rounded-full border-[40px] border-white -translate-y-16 translate-x-16" />
      </div>
      <div>
        <span className={`font-nunito-sans text-[9px] tracking-[0.3em] uppercase ${promo.accent} font-bold`}>{promo.badge}</span>
        <h3 className={`font-playfair-display text-2xl font-bold ${promo.textColor} mt-2 leading-tight`}>{promo.title}</h3>
        <p className={`font-nunito-sans text-xs tracking-widest uppercase ${promo.accent} mt-1`}>{promo.subtitle}</p>
        <p className={`font-nunito-sans text-sm ${promo.textColor} opacity-80 mt-3 leading-relaxed`}>{promo.desc}</p>
      </div>
      <div className={`flex gap-3 mt-4 ${promo.textColor}`}>
        {[["Horas", time.h], ["Min", time.m], ["Seg", time.s]].map(([label, val]) => (
          <div key={label as string} className="text-center">
            <div className="font-playfair-display text-3xl font-black">{String(val).padStart(2, "0")}</div>
            <div className="font-nunito-sans text-[9px] tracking-widest uppercase opacity-60">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Promociones() {
  return (
    <section id="promociones" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader eyebrow="Ofertas Especiales" title="Promociones" subtitle="Aprovecha nuestras ofertas de temporada. Los contadores indican el tiempo restante de cada promoción activa." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PROMOS.map((p, i) => <PromoCard key={i} promo={p} />)}
        </div>
      </div>
    </section>
  );
}

// ─── Ordena ──────────────────────────────────────────────────────────────────

function Ordenar() {
  const brand = useBrand();
  const wa = whatsappChatUrl(brand.whatsapp);

  const modalityBits: string[] = [];
  if (brand.hasDelivery) modalityBits.push("Delivery");
  if (brand.hasPickup) modalityBits.push("Pickup");
  const eyebrow =
    modalityBits.length > 0 ? modalityBits.join(" & ") : "Pedidos";

  const platforms = [
    ...(wa
      ? [
          {
            name: "WhatsApp",
            desc: "Atención inmediata",
            color: "bg-green-600",
            hov: "hover:bg-green-700",
            icon: <MessageCircle size={28} />,
            link: wa,
            external: true,
          },
        ]
      : []),
    {
      name: "Pedido en menú",
      desc: brand.hasPickup
        ? "Recoge o pide en mesa"
        : brand.hasDelivery
          ? "Pide a domicilio"
          : "Ordena desde la mesa",
      color: "bg-primary",
      hov: "hover:opacity-90",
      icon: <Award size={28} />,
      link: "/menu",
      external: false,
    },
  ];

  return (
    <section id="ordenar" className="py-24 bg-[#1a3d2b]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="font-nunito-sans text-xs tracking-[0.25em] uppercase text-[#d4a853] mb-3">
            {eyebrow}
          </p>
          <h2 className="font-playfair-display text-4xl md:text-5xl font-bold text-white leading-tight">
            Ordena en Línea
          </h2>
          <p className="mt-4 text-white/60 font-nunito-sans max-w-md mx-auto">
            {brand.hasDelivery || brand.hasPickup
              ? "Recibe tus platillos favoritos donde estés, o pídelos para recoger."
              : "Arma tu pedido desde la mesa con nuestro menú digital."}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {platforms.map((p) => (
            <a
              key={p.name}
              href={p.link}
              {...(p.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              className={`${p.color} ${p.hov} text-white p-6 rounded-sm flex items-center gap-5 transition-all duration-200 group`}
            >
              <div className="shrink-0 w-14 h-14 bg-white/10 rounded-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                {p.icon}
              </div>
              <div>
                <div className="font-playfair-display text-xl font-bold">
                  {p.name}
                </div>
                <div className="font-nunito-sans text-xs opacity-70 mt-0.5">
                  {p.desc}
                </div>
              </div>
              <ExternalLink size={16} className="ml-auto opacity-40 group-hover:opacity-80" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Reservaciones ────────────────────────────────────────────────────────────

function Reservaciones() {
  const brand = useBrand();
  const [form, setForm] = useState({ nombre: "", personas: "2", fecha: "", hora: "20:00", telefono: "", notas: "" });
  const [sent, setSent] = useState(false);
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleSubmit = (e: FormEvent) => { e.preventDefault(); setSent(true); };

  const labelCls = "block font-nunito-sans text-xs tracking-widest uppercase text-muted-foreground mb-2";
  const inputCls = "w-full bg-secondary border border-border rounded-sm px-4 py-3 font-nunito-sans text-sm focus:outline-none focus:ring-2 focus:ring-accent/30";

  return (
    <section id="reservaciones" className="py-24 bg-secondary">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div>
          <p className="font-nunito-sans text-xs tracking-[0.25em] uppercase text-accent mb-3">Reservaciones</p>
          <h2 className="font-playfair-display text-4xl md:text-5xl font-bold text-foreground leading-tight">Reserva tu Mesa</h2>
          <p className="mt-5 text-muted-foreground font-nunito-sans leading-relaxed">
            Asegura tu lugar en {brand.name}. Para grupos de 8+ personas contáctanos directamente por WhatsApp para atención especial.
          </p>
          <div className="mt-8 space-y-4">
            {[
              [
                <Clock key="clock" size={18} />,
                "Horario",
                brand.businessHours?.trim() || "Consulta horarios en contacto",
              ],
              [
                <Phone key="phone" size={18} />,
                "WhatsApp",
                brand.whatsapp?.trim() || "Próximamente",
              ],
              [
                <MapPin key="map-pin" size={18} />,
                "Dirección",
                brand.address?.trim() || "Dirección por confirmar",
              ],
            ].map(([icon, label, value]) => (
              <div key={label as string} className="flex items-start gap-4">
                <div className="w-10 h-10 bg-primary rounded-sm flex items-center justify-center text-primary-foreground shrink-0 mt-0.5">{icon}</div>
                <div>
                  <div className="font-nunito-sans text-[10px] tracking-widest uppercase text-muted-foreground">{label}</div>
                  <div className="font-nunito-sans text-sm font-semibold mt-0.5">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-sm p-8">
          {sent ? (
            <div className="text-center py-10">
              <CheckCircle size={52} className="text-green-600 mx-auto mb-4" />
              <h3 className="font-playfair-display text-2xl font-bold mb-2">¡Reservación Confirmada!</h3>
              <p className="font-nunito-sans text-sm text-muted-foreground">Te contactaremos en breve al número proporcionado para confirmar los detalles.</p>
              <button onClick={() => setSent(false)} className="mt-6 font-nunito-sans text-xs text-accent underline">Hacer otra reservación</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className={labelCls}>Nombre completo</label>
                <input name="nombre" value={form.nombre} onChange={handleChange} required placeholder="María González" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Personas</label>
                  <select name="personas" value={form.personas} onChange={handleChange} className={inputCls}>
                    {["1","2","3","4","5","6","7","8+"].map(n => <option key={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Hora</label>
                  <select name="hora" value={form.hora} onChange={handleChange} className={inputCls}>
                    {["13:00","13:30","14:00","14:30","15:00","19:00","19:30","20:00","20:30","21:00","21:30","22:00"].map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Fecha</label>
                <input name="fecha" type="date" value={form.fecha} onChange={handleChange} required className={inputCls} min={new Date().toISOString().split("T")[0]} />
              </div>
              <div>
                <label className={labelCls}>Teléfono</label>
                <input name="telefono" value={form.telefono} onChange={handleChange} required placeholder="+52 55 0000 0000" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Notas especiales (opcional)</label>
                <textarea name="notas" value={form.notas} onChange={handleChange} placeholder="Alergias, ocasión especial, silla para bebé..." rows={3} className={`${inputCls} resize-none`} />
              </div>
              <button type="submit"
                className="w-full bg-accent text-white font-nunito-sans text-xs tracking-widest uppercase py-4 rounded-sm hover:bg-[#a84e22] transition-colors">
                Confirmar Reservación
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

// ─── Nosotros ────────────────────────────────────────────────────────────────

function Nosotros() {
  const values = [
    { icon: <ChefHat size={24} />, title: "Auténtico", desc: "Recetas originales de cada región de Italia, respetadas desde 1987." },
    { icon: <Leaf size={24} />, title: "Fresco", desc: "Ingredientes de temporada, mozzarella importada y aceite de oliva EV." },
    { icon: <Heart size={24} />, title: "Con Pasión", desc: "Cada platillo se elabora con el mismo amor que en la cucina di nonna." },
    { icon: <Award size={24} />, title: "Premiado", desc: "Best Italian Restaurant CDMX 2022, 2023 y 2024 por Guía Michelin MX." },
  ];

  return (
    <section id="nosotros" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <p className="font-nunito-sans text-xs tracking-[0.25em] uppercase text-accent mb-3">Nuestra Historia</p>
            <h2 className="font-playfair-display text-4xl md:text-5xl font-bold text-foreground leading-tight mb-6">
              Una familia italiana<br /><span className="italic">en el corazón de CDMX</span>
            </h2>
            <div className="space-y-4 text-muted-foreground font-nunito-sans leading-relaxed text-sm">
              <p>En 1987, la familia Conti llegó de Nápoles con una maleta llena de recetas y el sueño de compartir la auténtica cocina italiana con México. Lo que comenzó como un pequeño trattoria de 12 mesas hoy es el restaurante italiano más querido de la Ciudad.</p>
              <p>El Chef Marco Conti, segunda generación, estudió en la Academia Culinaria de Bolonia y volvió con técnicas modernas sin abandonar la filosofía familiar: <em>&ldquo;La comida buena no necesita trucos, necesita tiempo y amor.&rdquo;</em></p>
              <p>Importamos nuestra mozzarella di bufala directamente de Campania, nuestro aceite de oliva de los olivares centenarios de la familia en Apulia, y nuestro café de los cafetales de Sicilia.</p>
            </div>
          </div>
          <div className="relative">
            <img src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=640&h=480&fit=crop&auto=format"
              alt="Chef Marco Conti" className="w-full h-96 object-cover rounded-sm" />
            <div className="absolute -bottom-6 -left-6 bg-primary text-primary-foreground p-5 rounded-sm">
              <div className="font-playfair-display text-3xl font-black text-[#d4a853]">37</div>
              <div className="font-nunito-sans text-[10px] tracking-widest uppercase opacity-80 mt-1">Años de Tradición</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {values.map(v => (
            <div key={v.title} className="bg-card border border-border rounded-sm p-6 text-center hover:border-accent/40 transition-colors group">
              <div className="w-12 h-12 bg-secondary rounded-sm flex items-center justify-center mx-auto mb-4 text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                {v.icon}
              </div>
              <h4 className="font-playfair-display text-lg font-bold mb-2">{v.title}</h4>
              <p className="font-nunito-sans text-xs text-muted-foreground leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Galería ─────────────────────────────────────────────────────────────────

function Galeria() {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <section id="galería" className="py-24 bg-secondary">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader eyebrow="Galería" title="Imágenes de la Casa" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {GALLERY_IMAGES.map((img, i) => (
            <button key={i} onClick={() => setSelected(i)}
              className={`relative overflow-hidden rounded-sm bg-muted group cursor-zoom-in ${i === 0 || i === 5 ? "row-span-2 md:col-span-2" : ""}`}
              style={{ height: i === 0 || i === 5 ? "320px" : "155px" }}>
              <img src={img.src} alt={img.alt}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors flex items-center justify-center">
                <Play size={32} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      </div>
      {selected !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6" onClick={() => setSelected(null)}>
          <button className="absolute top-6 right-6 text-white hover:text-[#d4a853] transition-colors"><X size={28} /></button>
          <img src={GALLERY_IMAGES[selected].src.replace("w=600&h=450", "w=1200&h=900")}
            alt={GALLERY_IMAGES[selected].alt} className="max-w-full max-h-full object-contain rounded-sm" />
        </div>
      )}
    </section>
  );
}

// ─── Opiniones ────────────────────────────────────────────────────────────────

function Opiniones() {
  const avg = (REVIEWS.reduce((a, r) => a + r.rating, 0) / REVIEWS.length).toFixed(1);
  return (
    <section id="opiniones" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader eyebrow="Google Reviews" title="Lo que Dicen de Nosotros" />
        <div className="flex flex-col items-center mb-12">
          <div className="font-playfair-display text-7xl font-black text-accent">{avg}</div>
          <div className="flex gap-1 my-2">
            {[1,2,3,4,5].map(i => <Star key={i} size={20} className="fill-[#d4a853] text-[#d4a853]" />)}
          </div>
          <p className="font-nunito-sans text-xs tracking-widest uppercase text-muted-foreground">{REVIEWS.length * 47}+ Reseñas en Google</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {REVIEWS.map((r, i) => (
            <div key={i} className="bg-card border border-border rounded-sm p-6 hover:border-accent/30 transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center font-playfair-display font-bold text-sm text-[#d4a853]">{r.avatar}</div>
                <div>
                  <div className="font-nunito-sans text-sm font-semibold">{r.name}</div>
                  <div className="font-nunito-sans text-[10px] text-muted-foreground">{r.date}</div>
                </div>
              </div>
              <StarRow rating={r.rating} />
              <p className="font-nunito-sans text-sm text-muted-foreground leading-relaxed mt-3 italic">&ldquo;{r.text}&rdquo;</p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <a href="#" className="inline-flex items-center gap-2 font-nunito-sans text-xs tracking-widest uppercase text-accent border border-accent px-6 py-3 rounded-sm hover:bg-accent hover:text-white transition-colors">
            Ver todas en Google <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Ubicación ────────────────────────────────────────────────────────────────

function Ubicacion() {
  const brand = useBrand();
  const embed = mapsEmbedSrc(brand.googleMapsUrl);
  const address = brand.address?.trim() || "Dirección por confirmar";
  const hours = brand.businessHours?.trim() || "Horario por confirmar";

  return (
    <section id="ubicacion" className="py-24 bg-secondary">
      <div className="max-w-7xl mx-auto px-6">
        <SectionHeader eyebrow="Cómo Llegar" title="Ubicación" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-7">
            <div>
              <p className="font-nunito-sans text-[10px] tracking-[0.25em] uppercase text-accent mb-3 font-semibold">Dirección</p>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-accent mt-0.5 shrink-0" />
                <p className="font-nunito-sans text-sm leading-relaxed whitespace-pre-line">{address}</p>
              </div>
            </div>
            <div>
              <p className="font-nunito-sans text-[10px] tracking-[0.25em] uppercase text-accent mb-3 font-semibold">Horarios</p>
              <div className="flex items-start gap-3">
                <Clock size={16} className="text-accent mt-0.5 shrink-0" />
                <p className="font-nunito-sans text-sm font-semibold leading-relaxed whitespace-pre-line">{hours}</p>
              </div>
            </div>
            {brand.googleMapsUrl ? (
              <a
                href={brand.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 font-nunito-sans text-xs tracking-widest uppercase text-accent border border-accent px-5 py-3 rounded-sm hover:bg-accent hover:text-white transition-colors"
              >
                Abrir en Google Maps <ExternalLink size={13} />
              </a>
            ) : null}
          </div>
          <div className="lg:col-span-2 bg-muted rounded-sm overflow-hidden h-80 lg:h-auto min-h-[320px] relative">
            {embed ? (
              <iframe
                src={embed}
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: "320px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Mapa ${brand.name}`}
                className="w-full h-full"
              />
            ) : (
              <div className="flex h-full min-h-[320px] items-center justify-center px-6 text-center">
                <p className="font-nunito-sans text-sm text-muted-foreground max-w-sm">
                  {brand.googleMapsUrl
                    ? "Usa el enlace de Google Maps para ver la ubicación."
                    : "Configura la URL de Google Maps en Ajustes del panel admin."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Contacto ────────────────────────────────────────────────────────────────

function Contacto() {
  const brand = useBrand();
  const wa = whatsappChatUrl(brand.whatsapp);
  const phone = telHref(brand.whatsapp);
  const socials = [
    { icon: <Camera size={20} />, label: `@${brand.slug ?? "restaurante"}`, href: "#" },
    { icon: <Share2 size={20} />, label: `${brand.name}`, href: "#" },
    { icon: <Radio size={20} />, label: `@${brand.slug ?? "restaurante"}`, href: "#" },
    { icon: <Video size={20} />, label: `${brand.name} Cocina`, href: "#" },
  ];

  const cards = [
    ...(wa
      ? [
          {
            icon: <MessageCircle size={24} />,
            title: "WhatsApp",
            sub: brand.whatsapp ?? "",
            cta: "Escribir ahora",
            href: wa,
            cls: "bg-green-700 hover:bg-green-800",
          },
        ]
      : []),
    ...(phone
      ? [
          {
            icon: <Phone size={24} />,
            title: "Teléfono",
            sub: brand.whatsapp ?? "",
            cta: "Llamar",
            href: phone,
            cls: "bg-[#2d5c40] hover:bg-[#3a7253]",
          },
        ]
      : []),
    ...(brand.address
      ? [
          {
            icon: <MapPin size={24} />,
            title: "Visítanos",
            sub: brand.address,
            cta: brand.googleMapsUrl ? "Ver mapa" : "Ubicación",
            href: brand.googleMapsUrl || "#ubicacion",
            cls: "bg-[#8b5e3c] hover:bg-[#9e6a44]",
          },
        ]
      : []),
  ];

  return (
    <section id="contacto" className="py-24 bg-[#1a3d2b]">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-14">
          <p className="font-nunito-sans text-xs tracking-[0.25em] uppercase text-[#d4a853] mb-3">Estamos para ti</p>
          <h2 className="font-playfair-display text-4xl md:text-5xl font-bold text-white">Contáctanos</h2>
        </div>
        {cards.length > 0 ? (
          <div className={`grid grid-cols-1 gap-5 mb-12 ${cards.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            {cards.map((c) => (
              <a
                key={c.title}
                href={c.href}
                {...(c.href.startsWith("http")
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                className={`${c.cls} text-white rounded-sm p-6 flex flex-col items-center text-center gap-3 transition-colors group`}
              >
                <div className="w-14 h-14 bg-white/10 rounded-sm flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  {c.icon}
                </div>
                <div>
                  <div className="font-playfair-display text-lg font-bold">{c.title}</div>
                  <div className="font-nunito-sans text-xs opacity-70 mt-0.5 line-clamp-2">{c.sub}</div>
                </div>
                <span className="font-nunito-sans text-xs tracking-widest uppercase border border-white/30 px-4 py-1.5 rounded-sm group-hover:bg-white/10 transition-colors">
                  {c.cta}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="mb-12 text-center font-nunito-sans text-sm text-white/60">
            Completa WhatsApp y dirección en Ajustes del panel para mostrar contacto.
          </p>
        )}
        <div className="border-t border-white/10 pt-10">
          <p className="font-nunito-sans text-xs tracking-[0.25em] uppercase text-[#d4a853] text-center mb-6">Síguenos</p>
          <div className="flex flex-wrap justify-center gap-4">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                className="flex items-center gap-2 text-white/60 hover:text-white font-nunito-sans text-sm border border-white/10 hover:border-white/30 px-5 py-2.5 rounded-sm transition-all"
              >
                {s.icon} {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section id="faq" className="py-24 bg-background">
      <div className="max-w-3xl mx-auto px-6">
        <SectionHeader eyebrow="FAQ" title="Preguntas Frecuentes" />
        <div className="space-y-2">
          {FAQ_ITEMS.map((faq, i) => (
            <div key={i} className="border border-border rounded-sm overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-secondary transition-colors">
                <span className="font-nunito-sans text-sm font-semibold pr-4">{faq.q}</span>
                {open === i ? <ChevronUp size={16} className="text-accent shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
              </button>
              {open === i && (
                <div className="px-6 pb-5 bg-card">
                  <p className="font-nunito-sans text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Extras: Lealtad, Eventos, Blog, Newsletter ───────────────────────────────

function ExtrasSection() {
  const brand = useBrand();
  const [email, setEmail] = useState("");
  const [subbed, setSubbed] = useState(false);

  const events = [
    { icon: <Music size={20} />, title: "Música en Vivo", desc: "Viernes y Sábado", sub: "Jazz y cantautores italianos desde las 20:00 hrs." },
    { icon: <Coffee size={20} />, title: "Catas de Vino", desc: "Primer Martes del Mes", sub: "Degustación de vinos DOC con maridaje de quesos." },
    { icon: <Cake size={20} />, title: "Cumpleaños", desc: "Todo el año", sub: "Postre de cortesía y canción especial para el festejado." },
    { icon: <Users size={20} />, title: "Karaoke Italiano", desc: "Jueves", sub: "¡Canta como Pavarotti! A partir de las 21:00 hrs." },
  ];

  const posts = [
    { title: "¿Cómo hacemos nuestra pizza de masa madre?", cat: "Cocina", img: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=250&fit=crop&auto=format" },
    { title: "La historia del Tiramisù: el postre que conquistó el mundo", cat: "Historia", img: "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=400&h=250&fit=crop&auto=format" },
    { title: "Beneficios del café espresso artesanal de Sicilia", cat: "Café", img: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&h=250&fit=crop&auto=format" },
  ];

  return (
    <>
      {/* Lealtad */}
      <section className="py-20 bg-secondary">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <p className="font-nunito-sans text-xs tracking-[0.25em] uppercase text-accent mb-3">Programa Exclusivo</p>
          <h2 className="font-playfair-display text-4xl font-bold mb-4">Programa de Lealtad</h2>
          <p className="font-nunito-sans text-sm text-muted-foreground max-w-lg mx-auto mb-10">Acumula puntos con cada visita y canjéalos por descuentos, platillos gratis y experiencias exclusivas.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[
              { icon: <Gift size={28} />, title: "Acumula Puntos", desc: "1 punto por cada $10 de consumo. Doble en cumpleaños." },
              { icon: <Award size={28} />, title: "Canjea Descuentos", desc: "500 pts = $100 de descuento en tu próxima visita." },
              { icon: <Star size={28} />, title: "Beneficios VIP", desc: "Acceso anticipado a eventos, menús especiales y más." },
            ].map(item => (
              <div key={item.title} className="bg-card border border-border rounded-sm p-7">
                <div className="w-14 h-14 bg-primary rounded-sm flex items-center justify-center text-[#d4a853] mx-auto mb-4">{item.icon}</div>
                <h4 className="font-playfair-display text-lg font-bold mb-2">{item.title}</h4>
                <p className="font-nunito-sans text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <button className="mt-10 inline-flex items-center gap-2 bg-accent text-white font-nunito-sans text-xs tracking-widest uppercase px-8 py-3.5 rounded-sm hover:bg-[#a84e22] transition-colors">
            <Gift size={15} /> Únete Gratis
          </button>
        </div>
      </section>

      {/* Eventos */}
      <section id="eventos" className="py-20 bg-background">
        <div className="max-w-5xl mx-auto px-6">
          <SectionHeader eyebrow="Agenda" title="Eventos Especiales" subtitle={`${brand.name} no es solo un restaurante — es un punto de encuentro cultural en el corazón de la ciudad.`} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {events.map(ev => (
              <div key={ev.title} className="bg-card border border-border rounded-sm p-5 text-center hover:border-accent/40 hover:shadow-sm transition-all group">
                <div className="w-12 h-12 bg-secondary rounded-sm flex items-center justify-center mx-auto mb-4 text-accent group-hover:bg-accent group-hover:text-white transition-colors">{ev.icon}</div>
                <h4 className="font-playfair-display font-bold text-base mb-1">{ev.title}</h4>
                <p className="font-nunito-sans text-[10px] tracking-widest uppercase text-accent mb-2">{ev.desc}</p>
                <p className="font-nunito-sans text-xs text-muted-foreground leading-relaxed">{ev.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Blog */}
      <section className="py-20 bg-secondary">
        <div className="max-w-6xl mx-auto px-6">
          <SectionHeader eyebrow="Blog" title="Nuestra Cocina, tu Inspiración" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <article key={i} className="bg-card border border-border rounded-sm overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer">
                <div className="h-44 bg-muted overflow-hidden">
                  <img src={post.img} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-5">
                  <span className="font-nunito-sans text-[9px] tracking-[0.3em] uppercase text-accent font-semibold">{post.cat}</span>
                  <h4 className="font-playfair-display text-base font-bold mt-2 leading-snug group-hover:text-accent transition-colors">{post.title}</h4>
                  <div className="flex items-center gap-1 mt-4 font-nunito-sans text-xs text-accent">
                    Leer más <ArrowRight size={12} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-20 bg-accent">
        <div className="max-w-xl mx-auto px-6 text-center">
          <BookOpen size={36} className="text-white/80 mx-auto mb-4" />
          <h2 className="font-playfair-display text-3xl md:text-4xl font-bold text-white mb-3">Únete a Nuestra Comunidad</h2>
          <p className="font-nunito-sans text-sm text-white/80 mb-6">Recibe recetas exclusivas, invitaciones a eventos y un <strong className="text-white">10% de descuento</strong> en tu próxima visita.</p>
          {subbed ? (
            <div className="flex items-center justify-center gap-2 text-white font-nunito-sans">
              <CheckCircle size={20} /> <span>¡Gracias! Revisa tu bandeja de entrada.</span>
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); setSubbed(true); }} className="flex gap-2">
              <input value={email} onChange={e => setEmail(e.target.value)} required type="email" placeholder="tu@email.com"
                className="flex-1 bg-white/20 text-white placeholder-white/60 border border-white/30 rounded-sm px-4 py-3 font-nunito-sans text-sm focus:outline-none focus:bg-white/30" />
              <button type="submit" className="bg-white text-accent font-nunito-sans text-xs tracking-widest uppercase px-6 py-3 rounded-sm hover:bg-white/90 transition-colors shrink-0">
                <Send size={14} />
              </button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  const brand = useBrand();
  return (
    <footer className="bg-[#0e1f16] text-white/60 py-14">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
        <div className="md:col-span-2">
          <div className="font-pinyon-script text-3xl text-[#d4a853] mb-1">{brand.name}</div>
          <p className="font-nunito-sans text-[9px] tracking-[0.35em] uppercase opacity-50 mb-4">
            {brand.tagline ?? "Restaurante"}
          </p>
          <p className="font-nunito-sans text-xs leading-relaxed max-w-xs">
            El sitio oficial de {brand.name}. Menú, reservaciones y experiencia gastronómica.
          </p>
        </div>
        <div>
          <p className="font-nunito-sans text-[9px] tracking-[0.25em] uppercase text-[#d4a853] mb-4 font-semibold">Navegación</p>
          {["Menú", "Reservaciones", "Nosotros", "Galería", "Blog", "Eventos", "Contacto"].map(l => (
            <button key={l} onClick={() => document.getElementById(l.toLowerCase())?.scrollIntoView({ behavior: "smooth" })}
              className="block font-nunito-sans text-xs py-1 hover:text-white hover:text-[#d4a853] transition-colors">{l}</button>
          ))}
        </div>
        <div>
          <p className="font-nunito-sans text-[9px] tracking-[0.25em] uppercase text-[#d4a853] mb-4 font-semibold">Contacto</p>
          <div className="space-y-2 font-nunito-sans text-xs">
            {brand.address ? (
              <p className="flex items-center gap-2"><MapPin size={12} className="shrink-0" /> {brand.address}</p>
            ) : null}
            {brand.whatsapp ? (
              <p className="flex items-center gap-2"><Phone size={12} /> {brand.whatsapp}</p>
            ) : null}
            {brand.businessHours ? (
              <p className="flex items-center gap-2"><Clock size={12} /> {brand.businessHours}</p>
            ) : null}
          </div>
          <div className="flex gap-3 mt-5">
            {[<Camera key="instagram" size={16} />, <Share2 key="facebook" size={16} />, <Radio key="twitter" size={16} />, <Video key="youtube" size={16} />].map((icon, i) => (
              <a key={i} href="#" className="w-8 h-8 border border-white/20 rounded-sm flex items-center justify-center hover:border-[#d4a853] hover:text-[#d4a853] transition-colors">{icon}</a>
            ))}
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-3">
        <p className="font-nunito-sans text-[10px]">© {new Date().getFullYear()} {brand.name}. Todos los derechos reservados.</p>
        <p className="font-nunito-sans text-[10px]">Aviso de Privacidad · Términos y Condiciones</p>
      </div>
    </footer>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

function buildRestaurantTheme(brand: RestaurantBrand): CSSProperties {
  const primary = brand.primaryColor || "#1a3d2b";
  const accent = brand.secondaryColor || "#c9612a";
  return {
    "--background": "#f7f3eb",
    "--foreground": "#1c1208",
    "--card": "#fdfaf4",
    "--card-foreground": "#1c1208",
    "--popover": "#fdfaf4",
    "--popover-foreground": "#1c1208",
    "--primary": primary,
    "--primary-foreground": "#f7f3eb",
    "--secondary": "#ede3ce",
    "--secondary-foreground": primary,
    "--muted": "#e6ddc8",
    "--muted-foreground": "#7a6a52",
    "--accent": accent,
    "--accent-foreground": "#fdfaf4",
    "--destructive": "#c0392b",
    "--destructive-foreground": "#ffffff",
    "--border": "rgba(26, 61, 43, 0.18)",
    "--input": "transparent",
    "--input-background": "#ede3ce",
    "--ring": accent,
  } as CSSProperties;
}

type RestaurantLandingProps = {
  /** Identidad del restaurante. Si no se pasa, usa la demo "La Trattoria". */
  brand?: RestaurantBrand;
  /** Catálogo público del tenant (productos disponibles). */
  products?: Product[];
};

/**
 * Sitio institucional (plantilla La Trattoria) alimentado por perfil + menú.
 */
export function RestaurantLanding({
  brand = DEFAULT_RESTAURANT_BRAND,
  products = [],
}: RestaurantLandingProps) {
  const theme = useMemo(() => buildRestaurantTheme(brand), [brand]);

  return (
    <BrandContext.Provider value={brand}>
      <CatalogContext.Provider value={products}>
        <div
          style={theme}
          className="font-nunito-sans bg-background text-foreground overflow-x-hidden"
        >
          <Navbar />
          <Hero />
          <DigitalMenu />
          <Destacados />
          <Promociones />
          <Ordenar />
          {brand.hasReservations ? <Reservaciones /> : null}
          <Nosotros />
          <Galeria />
          <Opiniones />
          <Ubicacion />
          <Contacto />
          <FAQ />
          <ExtrasSection />
          <Footer />
        </div>
      </CatalogContext.Provider>
    </BrandContext.Provider>
  );
}

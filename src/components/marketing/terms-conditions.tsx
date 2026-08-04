import Link from "next/link";
import { QaEnvBadge } from "@/components/env-qa-badge";

/**
 * Términos y Condiciones — superficie de lectura legal del SaaS B2B.
 *
 * THESIS: Documento legal legible, no landing de venta; tipografía y ritmo para
 *   lectura, sin cards ni CTAs de conversión.
 * OWN-WORLD: Hereda charcoal (#0F172A) + esmeralda de la landing B2B; cuerpo
 *   en medida ~65ch, jerarquía por peso/tamaño (sin gradient-text).
 * STORY: El visitante entiende las reglas del servicio y vuelve a la home o
 *   al registro.
 * FIRST VIEWPORT: Marca + título del documento + fecha; luego secciones
 *   numeradas en columna única.
 * FORM: Extensión de la identidad B2B existente (sin concepto nuevo).
 *
 * Nota: «PlatoListo» y Ciudad de México figuran de forma provisional hasta
 * que exista razón social y domicilio fiscal definitivos.
 */

const PROVIDER_NAME = "PlatoListo";
const JURISDICTION = "la Ciudad de México";
const LAST_UPDATED = "Julio de 2026";

interface TermSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  afterBullets?: string[];
  subsections?: { title: string; body: string }[];
}

const SECTIONS: TermSection[] = [
  {
    id: "aceptacion",
    title: "1. Aceptación de los términos",
    paragraphs: [
      `El presente contrato regula los términos y condiciones de uso aplicables al acceso y uso de la plataforma tecnológica identificada como PlatoListo (en adelante, "LA PLATAFORMA"), operada por ${PROVIDER_NAME} (en adelante, "EL PROVEEDOR"). La denominación de EL PROVEEDOR se indica de forma provisional y podrá actualizarse cuando se constituya o comunique la razón social definitiva.`,
      'Al registrarse, acceder o utilizar LA PLATAFORMA, tanto los dueños o administradores de establecimientos gastronómicos (en adelante, "EL CLIENTE") como los comensales o usuarios finales que consultan los menús (en adelante, "EL COMENSAL"), aceptan de manera expresa y sin reserva los presentes Términos y Condiciones.',
    ],
  },
  {
    id: "servicio",
    title: "2. Descripción del servicio",
    paragraphs: [
      "LA PLATAFORMA es un software bajo la modalidad SaaS (Software as a Service) multi-inquilino que proporciona herramientas tecnológicas para:",
    ],
    bullets: [
      "Creación y gestión de menús y catálogos digitales con códigos QR.",
      "Monitoreo y recepción de comandas y pedidos en tiempo real en cocina/barra vía WebSockets.",
      "Generación de enlaces para canalización de pedidos vía WhatsApp y modalidades de entrega/recogida (Pickup).",
      "Visualización de analíticas y métricas operativas.",
    ],
    afterBullets: [
      "Aclaración importante: EL PROVEEDOR actúa exclusivamente como facilitador tecnológico. EL PROVEEDOR no procesa ni elabora alimentos, no realiza servicios de entrega a domicilio (delivery directos) ni interviene como parte en la compraventa de alimentos o bebidas entre EL CLIENTE y EL COMENSAL.",
    ],
  },
  {
    id: "suscripciones",
    title: "3. Suscripciones, tarifas y pagos",
    paragraphs: [],
    subsections: [
      {
        title: "Planes de suscripción",
        body: "EL CLIENTE contratará el servicio de acuerdo con los planes vigentes en LA PLATAFORMA (Plan Básico, Plan Pro, o Plan Enterprise).",
      },
      {
        title: "Cuota de instalación / Setup Fee",
        body: "El Plan Pro incluye un costo único de configuración, instalación y creación del sitio web institucional por la cantidad de $2,000.00 MXN (Dos mil pesos 00/100 M.N.). Dicho pago no es reembolsable una vez entregado el sitio web y configurada la cuenta.",
      },
      {
        title: "Mantenimiento mensual",
        body: "Las tarifas mensuales se cobrarán por adelantado. La falta de pago oportuno faculta a EL PROVEEDOR a suspender temporal o definitivamente el acceso al panel administrativo y al menú digital de EL CLIENTE.",
      },
      {
        title: "Comisiones",
        body: "LA PLATAFORMA no cobra comisiones por transacción sobre las ventas realizadas por EL CLIENTE a través del menú QR.",
      },
    ],
  },
  {
    id: "propiedad",
    title: "4. Propiedad intelectual y contenido",
    paragraphs: [],
    subsections: [
      {
        title: "De la plataforma",
        body: "Todo el código fuente, diseño de interfaces, marcas, logotipos y arquitectura de LA PLATAFORMA son propiedad exclusiva de EL PROVEEDOR.",
      },
      {
        title: "Del cliente",
        body: "EL CLIENTE conserva todos los derechos sobre sus marcas, logotipos, nombres comerciales y fotografías de productos cargadas a LA PLATAFORMA (almacenadas mediante Cloudflare R2). EL CLIENTE garantiza que posee los derechos de propiedad intelectual necesarios sobre dicho material y deslinda a EL PROVEEDOR de cualquier reclamación por infracción a derechos de autor o marcas de terceros.",
      },
    ],
  },
  {
    id: "responsabilidad",
    title: "5. Limitación de responsabilidad",
    paragraphs: [],
    subsections: [
      {
        title: "Calidad de alimentos y alergias",
        body: "EL CLIENTE es el único responsable de la preparación, inocuidad, ingredientes, alérgenos, precios y tiempos de entrega de sus productos. EL PROVEEDOR no asumirá responsabilidad alguna frente a EL COMENSAL por intoxicaciones, reacciones alérgicas o inconformidades con el servicio del restaurante.",
      },
      {
        title: "Disponibilidad del servicio (SLA)",
        body: "EL PROVEEDOR realizará esfuerzos comercialmente razonables para mantener la disponibilidad de LA PLATAFORMA en un 99.5%. No obstante, EL PROVEEDOR no será responsable por interrupciones derivadas de fallas en proveedores de infraestructura en la nube (ej. AWS, Cloudflare, Vercel), fallas en la red de internet del usuario final o eventos de fuerza mayor.",
      },
      {
        title: "Monto máximo de responsabilidad",
        body: "En cualquier caso, la responsabilidad acumulada de EL PROVEEDOR frente a EL CLIENTE por cualquier daño o perjuicio derivado del uso de la plataforma estará limitada al monto equivalente a una (1) mensualidad cobrada a EL CLIENTE.",
      },
    ],
  },
  {
    id: "jurisdiccion",
    title: "6. Legislación aplicable y jurisdicción",
    paragraphs: [
      `Para la interpretación, cumplimiento y resolución de controversias derivadas de los presentes Términos y Condiciones, las partes se someten expresamente a la legislación federal de los Estados Unidos Mexicanos y a la jurisdicción de los Tribunales Competentes de ${JURISDICTION}, renunciando a cualquier otro fuero que pudiera corresponderles por razón de sus domicilios presentes o futuros. La sede jurisdiccional se indica de forma provisional hasta confirmar el domicilio fiscal definitivo de EL PROVEEDOR.`,
    ],
  },
];

export function TermsConditions() {
  return (
    <div
      className="b2b-landing min-h-screen w-full max-w-full overflow-x-hidden font-[family-name:var(--font-jakarta)]"
      style={{ background: "#0F172A", color: "#F8FAFC" }}
    >
      <header className="border-b border-slate-800/80">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-6 lg:h-20">
          <Link href="/" className="group flex items-center gap-2.5">
            <div
              className="flex size-9 items-center justify-center rounded-xl text-lg transition-transform group-hover:scale-110"
              style={{
                background: "linear-gradient(135deg, #10B981, #059669)",
              }}
              aria-hidden
            >
              🍽️
            </div>
            <span
              className="text-lg font-black tracking-tight sm:text-xl"
              style={{
                fontFamily: "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
                color: "#F8FAFC",
              }}
            >
              Plato<span style={{ color: "#10B981" }}>Listo</span>
            </span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-slate-400 transition-colors hover:text-emerald-400"
          >
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-16 lg:py-20">
        <p className="mb-3 text-sm font-medium text-emerald-400">
          Documento legal
        </p>
        <h1
          className="mb-3 text-3xl font-black tracking-tight text-white sm:text-4xl"
          style={{
            fontFamily: "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
          }}
        >
          Términos y Condiciones de Uso
        </h1>
        <p className="mb-4 max-w-[65ch] text-base leading-relaxed text-slate-400">
          Plataforma SaaS &ldquo;PlatoListo&rdquo;
        </p>
        <p className="mb-10 text-sm text-slate-500">
          Última actualización: {LAST_UPDATED}
        </p>

        <nav
          aria-label="Índice de secciones"
          className="mb-14 border-y border-slate-800/80 py-6"
        >
          <ul className="flex flex-col gap-2.5 sm:gap-2">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-slate-400 transition-colors hover:text-emerald-400"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-12 sm:gap-14">
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24"
            >
              <h2
                className="mb-4 text-xl font-bold tracking-tight text-white sm:text-2xl"
                style={{
                  fontFamily:
                    "var(--font-jakarta), Plus Jakarta Sans, sans-serif",
                }}
              >
                {section.title}
              </h2>

              <div className="flex max-w-[65ch] flex-col gap-4 text-[15px] leading-relaxed text-slate-300 sm:text-base">
                {section.paragraphs.map((p, i) => (
                  <p key={`${section.id}-p-${i}`}>{p}</p>
                ))}

                {section.bullets ? (
                  <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-emerald-500">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}

                {section.afterBullets?.map((p, i) => (
                  <p key={`${section.id}-after-${i}`}>{p}</p>
                ))}

                {section.subsections?.map((sub) => (
                  <div key={sub.title} className="flex flex-col gap-1.5">
                    <h3 className="text-base font-semibold text-slate-100">
                      {sub.title}
                    </h3>
                    <p>{sub.body}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="mt-14 max-w-[65ch] border-t border-slate-800/80 pt-8 text-sm leading-relaxed text-slate-500">
          Si tienes dudas sobre estos términos, escríbenos a{" "}
          <a
            href="mailto:hola@platolisto.com?subject=Consulta%20T%C3%A9rminos%20PlatoListo"
            className="text-emerald-400 transition-colors hover:text-emerald-300"
          >
            hola@platolisto.com
          </a>
          .
        </p>
      </main>

      <footer className="border-t border-slate-800/80 py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-start justify-between gap-4 px-5 sm:flex-row sm:items-center sm:px-6">
          <p className="text-xs text-slate-600 inline-flex flex-wrap items-center gap-2">
            © 2026 PlatoListo. Todos los derechos reservados.
            <QaEnvBadge />
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/aviso-de-privacidad"
              className="text-sm font-medium text-slate-400 transition-colors hover:text-emerald-400"
            >
              Aviso de Privacidad
            </Link>
            <Link
              href="/#registro"
              className="text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Registrar mi restaurante
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

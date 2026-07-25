import Link from "next/link";

/**
 * Aviso de Privacidad — superficie de lectura legal (LFPDPPP).
 *
 * THESIS: Documento legal legible bajo la LFPDPPP; misma gramática de lectura
 *   que Términos, sin cards ni CTAs de venta.
 * OWN-WORLD: Charcoal (#0F172A) + esmeralda de la landing B2B; cuerpo ~65ch.
 * STORY: El titular entiende qué datos se recaban, para qué y cómo ejercer ARCO.
 * FIRST VIEWPORT: Marca + título + marco legal + fecha; índice y secciones.
 * FORM: Extensión de la identidad B2B / legal existente.
 *
 * Nota: razón social y domicilio físico son provisionales hasta constitución
 * o comunicación definitiva del Responsable.
 */

const RESPONSIBLE_NAME = "PlatoListo";
const RESPONSIBLE_ADDRESS =
  "Ciudad de México, México (domicilio completo pendiente de actualización)";
const PRIVACY_EMAIL = "hola@platolisto.com";
const LAST_UPDATED = "Julio de 2026";

interface PrivacySection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  afterBullets?: string[];
  subsections?: { title: string; body: string }[];
}

const SECTIONS: PrivacySection[] = [
  {
    id: "responsable",
    title: "1. Identidad y domicilio del responsable",
    paragraphs: [
      `${RESPONSIBLE_NAME}, en adelante "EL RESPONSABLE", con domicilio ubicado en ${RESPONSIBLE_ADDRESS}, es el responsable del tratamiento, uso y protección de sus datos personales. La denominación y el domicilio se indican de forma provisional y podrán actualizarse cuando se constituya o comunique la razón social y el domicilio fiscal definitivos.`,
    ],
  },
  {
    id: "datos",
    title: "2. Datos personales que se recolectan",
    paragraphs: [
      "Para llevar a cabo las finalidades descritas en el presente Aviso de Privacidad, recabamos las siguientes categorías de datos:",
    ],
    subsections: [
      {
        title: "De los restaurantes / clientes B2B",
        body: "Nombre completo del titular, nombre comercial del restaurante, correo electrónico, número telefónico, RFC (para facturación) y dirección fiscal.",
      },
      {
        title: "De los comensales / usuarios B2C",
        body: "Número de mesa o ubicación en el local, desglose de consumo e historial de pedidos. En caso de solicitar pedidos para llevar (Pickup o WhatsApp), se podrá recabar de manera opcional: nombre y número de teléfono celular. No recabamos ni almacenamos datos patrimoniales ni tarjetas bancarias directamente en nuestros servidores.",
      },
    ],
  },
  {
    id: "finalidades",
    title: "3. Finalidades del tratamiento de datos",
    paragraphs: [
      "Los datos personales recabados serán utilizados para las siguientes finalidades necesarias para el servicio:",
    ],
    bullets: [
      "Proveer la infraestructura y funcionamiento de los menús digitales y comandas en tiempo real.",
      "Gestionar el registro, autenticación e identificación de los administradores del sistema.",
      "Procesar las solicitudes de cobro, suscripciones y facturación del servicio SaaS.",
      "Facilitar la comunicación de comandas entre el comensal y el personal de cocina/barra.",
      "Brindar soporte técnico, atención a clientes y resolver incidencias.",
    ],
  },
  {
    id: "transferencia",
    title: "4. Transferencia de datos y uso de servicios en la nube",
    paragraphs: [
      "Sus datos personales son tratados con estricta confidencialidad. Para la prestación del servicio, EL RESPONSABLE utiliza proveedores de infraestructura y almacenamiento en la nube que cumplen con estándares internacionales de seguridad (tales como servidores ubicados en la nube para almacenamiento de archivos y bases de datos). Sus datos no serán vendidos, alquilados ni transferidos a terceros con fines mercadotécnicos distintos a la operación de la plataforma PlatoListo.",
    ],
  },
  {
    id: "arco",
    title: "5. Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)",
    paragraphs: [
      "Usted tiene derecho a conocer qué datos personales tenemos de usted, para qué los utilizamos y las condiciones del uso que les damos (Acceso). Asimismo, es su derecho solicitar la corrección de su información personal (Rectificación), que la eliminemos de nuestros registros o bases de datos (Cancelación), así como oponerse al uso de sus datos personales para fines específicos (Oposición).",
      `Para el ejercicio de cualquiera de los derechos ARCO, usted podrá presentar la solicitud respectiva enviando un correo electrónico a nuestro Oficial de Privacidad: ${PRIVACY_EMAIL}.`,
    ],
  },
];

export function PrivacyNotice() {
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
          Aviso de Privacidad
        </h1>
        <p className="mb-4 max-w-[65ch] text-base leading-relaxed text-slate-400">
          Conforme a la Ley Federal de Protección de Datos Personales en
          Posesión de los Particulares (México)
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
          Para ejercer derechos ARCO o aclarar dudas sobre este aviso, escribe
          a{" "}
          <a
            href={`mailto:${PRIVACY_EMAIL}?subject=Derechos%20ARCO%20PlatoListo`}
            className="text-emerald-400 transition-colors hover:text-emerald-300"
          >
            {PRIVACY_EMAIL}
          </a>
          .
        </p>
      </main>

      <footer className="border-t border-slate-800/80 py-10">
        <div className="mx-auto flex max-w-3xl flex-col items-start justify-between gap-4 px-5 sm:flex-row sm:items-center sm:px-6">
          <p className="text-xs text-slate-600">
            © 2026 PlatoListo. Todos los derechos reservados.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/terminos"
              className="text-sm font-medium text-slate-400 transition-colors hover:text-emerald-400"
            >
              Términos
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

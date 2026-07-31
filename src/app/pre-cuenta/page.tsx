"use client";

/**
 * Showcase / demo de ticket térmico. La integración operativa vive en
 * WaiterTablesBoard, OrdersBoard y KitchenDashboard.
 */

import { useMemo, useState } from "react";
import { Printer, Receipt } from "lucide-react";
import type { Order } from "@/types/api";
import { PreCuentaModal } from "@/components/admin/pre-cuenta-modal";
import { TicketReceipt } from "@/components/admin/ticket-receipt";
import { buildTicketReceiptProps } from "@/lib/ticket-from-order";

const DEMO_ORDER: Order = {
  id: 1084,
  uuid: "demo-pre-cuenta-0001",
  customerName: "Comensal",
  customerPhone: "5512345678",
  orderType: "IN_TABLE",
  tableNumber: "4",
  linkedTables: [],
  staffId: null,
  staffName: "Carlos M.",
  deliveryAddress: null,
  status: "DELIVERED",
  totalAmount: 880,
  formattedTotal: "$880.00",
  createdAt: new Date().toISOString(),
  updatedAt: null,
  items: [
    {
      id: 1,
      productUuid: "p1",
      productName: "Pizza Margherita",
      quantity: 2,
      unitPrice: 160,
      subtotal: 360,
      formattedSubtotal: "$360.00",
      notes: null,
      batchNumber: 1,
      status: "DELIVERED",
      modifiers: [
        {
          modifierUuid: null,
          name: "Extra Queso",
          priceDelta: 20,
          formattedPriceDelta: "+$20.00",
        },
        {
          modifierUuid: null,
          name: "Masa Delgada",
          priceDelta: 0,
          formattedPriceDelta: "",
        },
      ],
    },
    {
      id: 2,
      productUuid: "p2",
      productName: "Pasta Carbonara",
      quantity: 1,
      unitPrice: 180,
      subtotal: 180,
      formattedSubtotal: "$180.00",
      notes: "Sin pimienta negra",
      batchNumber: 1,
      status: "DELIVERED",
      modifiers: [],
    },
    {
      id: 3,
      productUuid: "p3",
      productName: "Copa Vino Red Blend",
      quantity: 2,
      unitPrice: 110,
      subtotal: 220,
      formattedSubtotal: "$220.00",
      notes: null,
      batchNumber: 1,
      status: "DELIVERED",
      modifiers: [],
    },
    {
      id: 4,
      productUuid: "p4",
      productName: "Tiramisú Tradicional",
      quantity: 1,
      unitPrice: 120,
      subtotal: 120,
      formattedSubtotal: "$120.00",
      notes: null,
      batchNumber: 1,
      status: "DELIVERED",
      modifiers: [],
    },
  ],
};

const DEMO_RESTAURANT = {
  name: "La Trattoria",
  rfc: "TRA980415-HK2",
  address: "Av. Revolución 1234, Col. Condesa, CDMX",
  phone: "(55) 8765-4321",
};

export default function PreCuentaShowcasePage() {
  const [modalOpen, setModalOpen] = useState(false);
  const preview = useMemo(
    () => buildTicketReceiptProps(DEMO_ORDER, DEMO_RESTAURANT, "pre-cuenta"),
    [],
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 text-primary">
          <Receipt className="size-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">
            Demo
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Pre-cuenta e impresión térmica
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Ticket 80mm con IVA incluido, propinas sugeridas y QR. En operación se
          abre desde Gestión de Mesas y al cobrar en Cocina.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
        >
          <Printer className="size-4" aria-hidden />
          Abrir modal de pre-cuenta
        </button>
      </div>

      <div className="flex justify-center rounded-2xl border border-border bg-secondary/40 p-6">
        <TicketReceipt {...preview} />
      </div>

      <PreCuentaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        order={DEMO_ORDER}
        restaurant={DEMO_RESTAURANT}
        kind="pre-cuenta"
      />
    </div>
  );
}

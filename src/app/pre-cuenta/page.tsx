"use client";

import React, { useState } from "react";
import { PreCuentaModal } from "@/components/admin/pre-cuenta-modal";
import {
  Printer,
  Receipt,
  Utensils,
  Plus,
  Trash2,
  Share2,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { TicketItem } from "@/components/admin/ticket-receipt";

export default function PreCuentaShowcasePage() {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const [selectedTable, setSelectedTable] = useState("Mesa 4");
  const [waiterName, setWaiterName] = useState("Carlos M.");
  const [orderFolio, setOrderFolio] = useState("#1084");
  const [customerPhone, setCustomerPhone] = useState("5512345678");

  const [items, setItems] = useState<TicketItem[]>([
    {
      id: "1",
      quantity: 2,
      name: "Pizza Margherita",
      price: 360.0,
      modifiers: [
        { name: "Extra Queso", priceDelta: 20.0 },
        { name: "Masa Delgada" },
      ],
    },
    {
      id: "2",
      quantity: 1,
      name: "Pasta Carbonara",
      price: 180.0,
      notes: "Sin pimienta negra",
    },
    {
      id: "3",
      quantity: 2,
      name: "Copa Vino Red Blend",
      price: 220.0,
    },
    {
      id: "4",
      quantity: 1,
      name: "Tiramisú Tradicional",
      price: 120.0,
    },
  ]);

  const handleAddItem = () => {
    const newItem: TicketItem = {
      id: Date.now().toString(),
      quantity: 1,
      name: "Espresso Doble",
      price: 50.0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string | number) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = items.reduce((acc, item) => {
    const modTotal =
      item.modifiers?.reduce((mAcc, m) => mAcc + (m.priceDelta || 0), 0) || 0;
    return acc + (item.price + modTotal * item.quantity);
  }, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-12 relative overflow-x-hidden">
      {/* BACKGROUND GRADIENT DECORATION */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-8 relative z-10">
        
        {/* TOP BAR / DASHBOARD HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Módulo POS / SaaS
              </span>
              <span className="text-xs text-slate-400">Next.js 16 + Tailwind CSS</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <Receipt className="w-8 h-8 text-emerald-400" />
              Generación de Pre-Cuenta & Ticket Térmico
            </h1>
            <p className="text-slate-400 text-sm">
              Sistema de pre-facturación e impresión térmica de 80mm para restaurantes.
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            type="button"
            className="self-start md:self-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-emerald-950/50 transition-all active:scale-95 flex items-center gap-2"
          >
            <Printer className="w-5 h-5" />
            <span>Abrir Pre-Cuenta ({selectedTable})</span>
          </button>
        </header>

        {/* DEMO CONTROL PANEL CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* CONTROL CARD 1: MESA & MESERO */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Utensils className="w-4 h-4 text-emerald-400" />
              Datos de la Orden
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Mesa Seleccionada:</label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Mesa 4">Mesa 4 (Salón Principal)</option>
                  <option value="Mesa 2">Mesa 2 (Terraza)</option>
                  <option value="Mesa 12">Mesa 12 (VIP)</option>
                  <option value="Barra 1">Barra 1</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Folio:</label>
                <input
                  type="text"
                  value={orderFolio}
                  onChange={(e) => setOrderFolio(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Mesero Atendiendo:</label>
                <input
                  type="text"
                  value={waiterName}
                  onChange={(e) => setWaiterName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">WhatsApp Cliente:</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* CONTROL CARD 2: ITEMS EN LA CUENTA */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Consumos de la Mesa</h3>
              <button
                onClick={handleAddItem}
                type="button"
                className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Agregar Ítem
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs"
                >
                  <div>
                    <span className="font-bold text-white mr-2">{item.quantity}x</span>
                    <span className="text-slate-200">{item.name}</span>
                    {item.modifiers && item.modifiers.length > 0 && (
                      <p className="text-[11px] text-slate-400">
                        + {item.modifiers.map((m) => m.name).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-emerald-400">
                      ${item.price.toFixed(2)}
                    </span>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      type="button"
                      className="text-slate-500 hover:text-red-400 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm">
              <span className="text-slate-400 font-medium">Total Consumido:</span>
              <span className="text-xl font-bold font-mono text-emerald-400">
                ${subtotal.toFixed(2)} MXN
              </span>
            </div>
          </div>

        </div>

        {/* INSTRUCTIONS / SPECIFICATIONS HIGHLIGHTS */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3 text-xs text-slate-300">
          <h4 className="font-bold text-white text-sm flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Especificaciones Técnicas Implementadas:
          </h4>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-4 list-disc text-slate-400">
            <li>Simulación exacta de papel térmico de 80mm (<code className="text-emerald-400">w-[302px]</code>, fuente monoespaciada).</li>
            <li>Reglas de impresión pura <code className="text-emerald-400">@media print</code> que ocultan overlays y posicionan el ticket en la esquina superior izquierda.</li>
            <li>Cálculo dinámico de sugerencia de propina opcional (10%, 15%, 18%).</li>
            <li>Acción directa de envío por WhatsApp con plantilla de texto plano y totalización.</li>
            <li>Generación de código QR SVG para retroalimentación Smart Rating.</li>
          </ul>
        </div>
      </div>

      {/* THE INTERACTIVE MODAL */}
      <PreCuentaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tableNumber={selectedTable}
        orderFolio={orderFolio}
        waiterName={waiterName}
        items={items}
        customerPhone={customerPhone}
      />
    </div>
  );
}

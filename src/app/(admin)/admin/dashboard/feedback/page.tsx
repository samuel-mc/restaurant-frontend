import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FeedbackInbox } from "@/components/admin/feedback-inbox";
import { getAdminAccessToken } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Inbox de opiniones · Panel",
  description: "Reclamos privados del Smart Rating (1–3 estrellas).",
};

export default async function AdminFeedbackPage() {
  const tenantSlug = (await headers()).get("x-tenant-slug")?.trim() ?? "";
  if (!tenantSlug) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center gap-3 px-6 py-16">
        <h1 className="text-2xl font-bold tracking-tight">
          Tenant no identificado
        </h1>
        <p className="text-sm text-muted-foreground">
          Abre el panel desde el subdominio de tu restaurante.
        </p>
      </div>
    );
  }

  const token = await getAdminAccessToken();
  if (!token) {
    redirect("/admin/login");
  }

  return <FeedbackInbox />;
}

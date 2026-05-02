import type { Metadata } from "next";
import { CatalogManager } from "./CatalogManager";

export const metadata: Metadata = {
  title: "Meta Catalog | Admin",
  description: "Manage and sync the Facebook/Meta service-intent catalog.",
};

export default function MetaCatalogAdminPage() {
  return <CatalogManager />;
}

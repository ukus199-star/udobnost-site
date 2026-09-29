import type { Metadata } from "next";
import { Dokument } from "@/components/dokument";
import { dokumenty } from "@/data/dokumenty";

const kod = "soglasie-rassylka" as const;

export const metadata: Metadata = {
  title: dokumenty[kod].nazvanie,
  description: dokumenty[kod].opisanie,
};

export default function Stranica() {
  return <Dokument kod={kod} />;
}

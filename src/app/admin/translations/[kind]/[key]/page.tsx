import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { ReadOnly } from "@/components/admin/ReadOnly";
import { can, getAccess } from "@/features/auth/access";
import { LOCALE_NAMES, type Locale } from "@/features/i18n/config";
import { TranslationForm } from "@/features/i18n/components/TranslationForm";
import { translationForEdit } from "@/features/i18n/editorial";
import { ENTITY_LABELS, TARGET_LOCALES } from "@/features/i18n/labels";
import {
  ENTITY_SECTION,
  TRANSLATABLE_ENTITIES,
  type TranslatableEntity,
} from "@/features/i18n/translatable";

export const metadata: Metadata = { title: "Translation" };

export default async function TranslationPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; key: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { kind, key: keyParam } = await params;
  if (!(TRANSLATABLE_ENTITIES as string[]).includes(kind)) notFound();
  const entity = kind as TranslatableEntity;
  const access = await getAccess();
  const section = ENTITY_SECTION[entity];
  if (!access || !can(access.permissions, section, "v")) return <NoAccess />;

  const { locale: localeParam } = await searchParams;
  const locale = (TARGET_LOCALES as string[]).includes(localeParam ?? "")
    ? (localeParam as Locale)
    : TARGET_LOCALES[0];
  const key = decodeURIComponent(keyParam);
  const data = await translationForEdit(entity, key, locale);
  if (!data) notFound();
  const name = data.fields[0]?.original || key;

  return (
    <>
      <PageHeader
        title={`${name} – ${LOCALE_NAMES[locale]}`}
        lead={
          <Link
            href={`/admin/translations?kind=${entity}&locale=${locale}`}
            className="text-[var(--color-link)] underline"
          >
            ← {ENTITY_LABELS[entity]}
          </Link>
        }
      />
      <ReadOnly
        readOnly={!can(access.permissions, section, "e")}
        reason="Translations of this part can only be edited by roles allowed to edit the original."
      >
        <TranslationForm entity={entity} entityKey={key} locale={locale} fields={data.fields} />
      </ReadOnly>
    </>
  );
}

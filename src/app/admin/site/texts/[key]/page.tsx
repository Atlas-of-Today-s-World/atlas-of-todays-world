import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { navIcon } from "@/config/admin-nav";
import { adminRoutes } from "@/config/routes";
import { can, sectionAccess } from "@/features/auth/access";
import { resetUiText, saveUiText } from "@/features/ui-texts/actions";
import { UiTextForm } from "@/features/ui-texts/components/UiTextForm";
import { getUiTextOverride } from "@/features/ui-texts/editorial";
import { editableText, overrideProblem } from "@/features/ui-texts/model";

export const metadata: Metadata = { title: "UI text" };

/** The key from the URL (encoded by adminRoutes.uiText; keys never contain "%"). */
function keyFrom(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Editing one UI text (section `site`: "c" for a first change, "e" after, "d" to reset). */
export default async function UiTextPage({ params }: PageProps<"/admin/site/texts/[key]">) {
  const access = await sectionAccess("site");
  if (!access) return <NoAccess />;
  const text = editableText(keyFrom((await params).key));
  if (!text) notFound();
  const override = await getUiTextOverride(text.key);
  const canSave = override
    ? can(access.permissions, "site", "e")
    : can(access.permissions, "site", "c");
  // A saved version that no longer fits the code isn't shown on the site; start from the default.
  const shown =
    override && overrideProblem(text.key, override.value) === null ? override.value : undefined;

  return (
    <>
      <PageHeader
        icon={navIcon(adminRoutes.uiTexts)}
        title={text.key}
        lead={
          <>
            The site shows the new text within a minute or so — each page updates on its next visit.{" "}
            <Link href={adminRoutes.uiTexts} className="text-[var(--color-link)] underline">
              Back to UI texts
            </Link>
          </>
        }
      />
      <UiTextForm
        textKey={text.key}
        defaultText={text.defaultText}
        value={shown ?? text.defaultText}
        changed={Boolean(override)}
        save={saveUiText}
        reset={resetUiText.bind(null, text.key)}
        canSave={canSave}
        canReset={can(access.permissions, "site", "d")}
      />
    </>
  );
}

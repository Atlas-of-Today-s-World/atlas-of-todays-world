import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { routes } from "@/config/routes";
import { getAccess } from "@/features/auth/access";
import { DeletePosition, PositionForm } from "@/features/careers/components/PositionForm";
import { getPosition, positionRight } from "@/features/careers/editorial";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Position" };

/** New position (`/admin/careers/new`), or editing an existing one. */
export default async function PositionPage({
  params,
  searchParams,
}: PageProps<"/admin/careers/[id]">) {
  const access = await getAccess();
  if (!access || !positionRight(access.permissions, "v")) return <NoAccess />;
  const { id } = await params;

  if (id === "new") {
    if (!positionRight(access.permissions, "c")) return <NoAccess />;
    return (
      <>
        <PageHeader
          title="New position"
          lead="It starts as a draft with the sections of the Editor profile; set it to Open to publish it."
        />
        <PositionForm position={null} />
      </>
    );
  }

  if (!uuid.safeParse(id).success) notFound();
  const position = await getPosition(id);
  if (!position) notFound();
  if (!positionRight(access.permissions, "e")) return <NoAccess />;
  const { saved } = await searchParams;

  return (
    <>
      <PageHeader
        title={position.title}
        lead={
          saved ? (
            <span role="status">Position added.</span>
          ) : position.status === "open" ? (
            <>
              On the website at{" "}
              <a href={routes.career(position.slug)} className="text-[var(--color-link)] underline">
                {routes.career(position.slug)}
              </a>
              .
            </>
          ) : undefined
        }
      />
      <PositionForm position={position} />
      {positionRight(access.permissions, "d") ? (
        <div className="mt-10">
          <DeletePosition id={position.id} title={position.title} />
        </div>
      ) : null}
    </>
  );
}

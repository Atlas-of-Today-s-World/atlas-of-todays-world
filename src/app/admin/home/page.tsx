import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { HomeFeaturedForm } from "@/features/home/components/HomeFeaturedForm";
import { getSubtopicTiles } from "@/features/topics/featured";
import { createServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home page" };

/**
 * Home page (news section): which two subtopics sit under the search field on
 * the home map. A slot left on "newest" shows the newest published subtopic.
 */
export default async function HomeAdminPage() {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const supabase = await createServerClient();
  const [{ data, error }, tiles] = await Promise.all([
    supabase
      .from("home_featured")
      .select("first_chapter, second_chapter")
      .eq("id", 1)
      .maybeSingle(),
    getSubtopicTiles(),
  ]);
  if (error) throw new Error(`[home featured] ${error.message}`);

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/home")}
        title="Home page"
        lead="Two subtopic tiles under the search field on the home map. Pin the ones you want, or leave a slot on “newest” and the newest published subtopic fills it."
      />
      <HomeFeaturedForm
        options={tiles.map(({ id, title, topicTitle }) => ({ id, title, topicTitle }))}
        first={data?.first_chapter ?? null}
        second={data?.second_chapter ?? null}
        canEdit={can(access.permissions, "news", "e")}
      />
    </>
  );
}

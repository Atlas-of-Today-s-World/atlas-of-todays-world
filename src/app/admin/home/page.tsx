import type { Metadata } from "next";
import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { navIcon } from "@/config/admin-nav";
import { can, sectionAccess } from "@/features/auth/access";
import { HomeFeaturedForm } from "@/features/home/components/HomeFeaturedForm";
import { homeFeaturedForEdit } from "@/features/home/editorial";
import { getSubtopicTiles } from "@/features/topics/featured";

export const metadata: Metadata = { title: "Home page" };

/**
 * Home page (news section): which two subtopics sit under the search field on
 * the home map. A slot left on "newest" shows the newest published subtopic.
 */
export default async function HomeAdminPage() {
  const access = await sectionAccess("news");
  if (!access) return <NoAccess />;
  const [pins, tiles] = await Promise.all([homeFeaturedForEdit(), getSubtopicTiles()]);

  return (
    <>
      <PageHeader
        icon={navIcon("/admin/home")}
        title="Home page"
        lead="Two subtopic tiles under the search field on the home map. Pin the ones you want, or leave a slot on “newest” and the newest published subtopic fills it."
      />
      <HomeFeaturedForm
        options={tiles.map(({ id, title, topicTitle }) => ({ id, title, topicTitle }))}
        first={pins.first}
        second={pins.second}
        canEdit={can(access.permissions, "news", "e")}
      />
    </>
  );
}

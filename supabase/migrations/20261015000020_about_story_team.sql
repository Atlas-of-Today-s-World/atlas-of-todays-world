-- About page: what the Atlas is for, its story, how it works with partners and
-- who is behind it — carried over from the original site
-- (atlasoftodaysworld.org/about-us), with plans that have since happened told
-- in the present.
--
-- Content edit requested by the owner. The sections go in after "Our mission"
-- only while that heading is still in the page and the new text isn't there
-- yet, so a page the editors have since rewritten is left alone and re-running
-- changes nothing. The revision trigger keeps the previous text in
-- site_page_revisions.

update public.site_pages
set body_html = replace(
      body_html,
      '<h2 id="data">',
      $html$<h2 id="what-why-how">What, why and how</h2>
<p>We are building a map-based online encyclopedia that invites specialists worldwide to compile a comprehensive, high-level overview of our current world — on a platform accessible and understandable for all.</p>
<h3>Why: a missing complete picture for non-experts</h3>
<p>Thanks to the global media environment, knowledge about almost any specific issue from around the world is at our fingertips. Journalists provide news, stories and explainers, experts offer analyses, and Wikipedia and AI research tools give user-friendly introductions to nearly any topic.</p>
<p>Yet there is no single resource in which anyone — and above all non-expert audiences — can see a complete, accurate picture of the broad socio-political situation in today’s world.</p>
<h3>How: created mostly by experts, popularised for everyone</h3>
<ol>
<li><strong>Entries written by experts.</strong> The encyclopedia is built on big-picture entries that give comprehensive overviews in a user-friendly format. For each entry we seek a relevant specialist — mostly academics from universities and research centres, but also researchers from respected NGOs, neutral think tanks and specialised journalists.</li>
<li><strong>Embedded into a world map.</strong> The encyclopedia sits on an interactive socio-political map of the world. Bringing together existing data, country profiles with recommended third-party resources and visualisations of global issues, it lets everyone see the complete picture in a compact, easy-to-use way.</li>
<li><strong>Descriptive and neutral.</strong> By avoiding political and ethical associations and staying open to new ideas, we want to be an informative source for people of all backgrounds.</li>
<li><strong>Easy to reach.</strong> Inspired by encyclopedias such as Wikipedia and Britannica, we want to be at hand whenever people need the global picture — connected with search engines and selected Wikipedia entries, and through partnerships with journalists, NGOs and influencers.</li>
<li><strong>Multilingual.</strong> The Atlas is written in English but not only for English speakers: to make it available to anyone anywhere, we will work with translators and AI translation tools.</li>
<li><strong>Member-funded.</strong> We are a non-profit, non-governmental initiative funded primarily by our membership community, supported by institutional or private grants and cooperation with universities and NGOs — so our members are always at the core of what we do.</li>
</ol>
<h2 id="our-story">Our story</h2>
<p>From volunteering during the refugee crisis to the student-governed Online Encyclopedia of Migration, our concern has always been the limitations and gaps of the media system. In response, we set out to design a broader source through which everyone can understand the global socio-political situation. Here it is: Atlas of Today’s World.</p>
<h3>2015–2019: Refugee crisis and the Online Encyclopedia of Migration</h3>
<p>During the refugee crisis in 2015, while handing out water and blankets to Syrian refugees in the Balkans, we saw the limits of the media system first-hand. Why had these people been forced to flee? Why were they afraid for their relatives? What was everyday life in Aleppo really like? Their names and migration stories were reported, but deeper knowledge about life in Syria was not available to the wider world.</p>
<p>To address this, in 2017 we launched the <a href="https://www.youtube.com/watch?v=IekFqnXvfow">Online Encyclopedia of Migration</a>, a digital platform with well-researched information about migration to Europe and the situation in the countries of origin, available to everyone. Working with academic institutions, NGOs and media in the Czech Republic, we created special feature projects: <em>A Story of the War in Syria</em> and a project on migrant integration models in Germany, France and Austria, <a href="https://zpravy.aktualne.cz/zahranici/special-integrace-migrantu-v-nemecku-rakousku-a-francii/r~2f8c9d502bf611ec94d2ac1f6b220ee8/">Went to Europe</a>.</p>
<h3>2019–2022: Designing Atlas of Today’s World</h3>
<p>The project taught us a lot and led us to analyse the media system and its limits on a global level. From there, we decided to design a broader information source through which everyone can understand the overall socio-political situation in today’s world.</p>
<h3>May 2024: The prototype and the first community launch</h3>
<p>The first version of the encyclopedia came with initial previews — the <a href="/global-issue/russia-ukraine-war">Russia–Ukraine war</a>, global issues and <a href="/country/russia">Russia</a> — and our first attempt to build a membership community in June and July 2024.</p>
<h3>2026: The Middle East portrait and Atlas Patrons</h3>
<p>We have prepared a portrait of the <a href="/region/middle-east-north-africa">Middle East and North Africa</a>, the first of nine world regions, and we keep looking for authors for the planned entries and building partnerships. We are renewing our membership community, looking for 1,000 Atlas Patrons who would allow us to partly professionalise the team.</p>
<h3>Next: regular content and the map</h3>
<p>We want to publish new content regularly — portraits of the other eight world regions and of global issues — build partnerships with research institutions, NGOs, influencers and media to create new content and bring it to people around the world, and keep developing the interactive world map.</p>
<h2 id="partnerships">A concept built on cooperation and partnerships</h2>
<p><strong>Content.</strong> We do not write the content ourselves. Our role is similar to that of an academic journal: we build the infrastructure and do the editorial work, and invite scholars and other specialists from all over the world to contribute.</p>
<p><strong>Impact.</strong> Through partnerships across the global media system, we want to bring the Atlas to everyone in the moments they need it most, so it is easy to reach for anyone anywhere.</p>
<ul>
<li><strong>Academic partners</strong> help us find specialists and keep the content accurate and neutral.</li>
<li><strong>Funding partners</strong> help us develop faster and fund specific projects.</li>
<li><strong>Media partners</strong> help bring our entries to the public through links, quotations, interactive info boxes and other paths.</li>
</ul>
<h2 id="team">Who we are</h2>
<p>We are an international team of six people who work remotely, mostly as volunteers, combining knowledge of the humanities and social sciences with skills in IT, marketing and media studies. Over almost ten years, around 200 people have been involved in the project. We are a non-profit, non-governmental organisation registered in the Czech Republic since 2016 (originally as Online encyklopedie migrace, z. s.; see the <a href="https://or.justice.cz/ias/ui/rejstrik-firma.vysledky?subjektId=944122&amp;typ=UPLNY">public register</a>).</p>
<ul>
<li><strong>Jakub Mucka</strong> — Founder &amp; CEO</li>
<li><strong>Ružica Eterović</strong> — Fundraiser</li>
<li><strong>Stepan Nasada</strong> — Impact Manager</li>
<li><strong>Vicki McKenna</strong> — Editor</li>
<li><strong>Lukáš Simandl</strong> — Agile Coach</li>
<li><strong>Kally Cunnigham</strong></li>
<li><strong>Sydni Nasada</strong> — Graphic Designer</li>
</ul>
<h2 id="collaborate">Looking for collaborators and partners</h2>
<p>We are looking for specialised authors and for academic, media and funding partners who can help us build the encyclopedia. Write to <a href="mailto:mucka@atlasoftodaysworld.org">mucka@atlasoftodaysworld.org</a>, or <a href="/membership#volunteer">apply as a volunteer editor</a>.</p>
<h2 id="join">Let’s create the Atlas together</h2>
<p>Atlas of Today’s World is membership-driven. By joining our community you help us reach the next milestones, create new content, build partnerships and bring the Atlas to more people around the world. <a href="/membership">Become an Atlas Patron</a>.</p>
<h2 id="data">$html$
    )
where slug = 'about'
  and body_html like '%<h2 id="data">%'
  and body_html not like '%id="our-story"%';

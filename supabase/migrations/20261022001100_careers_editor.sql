-- The first open position on /careers: Editor (volunteer, remote), the
-- profile the team used so far. Applications go through the form under it,
-- so "To apply" points there instead of asking for an e-mail.

insert into public.job_positions (slug, title, location, job_type, summary, body_html, status)
values (
  'editor',
  'Editor',
  'Remote',
  'Volunteer',
  'Help us build a map-based encyclopedia of today''s world: find and work with expert authors, research data and edit entries on socio-political topics.',
  $html$<h2>About the role</h2>
<p>A successful candidate will learn about our mission, the content that we have produced so far, and become an integral member of the team that cooperates with external academics, NGOs, journalists and others. Please note that this role will be on a volunteer basis to start.</p>
<h2>About us</h2>
<p>Atlas of Today’s World is concerned with limitations and gaps inherent in the media system. To address this we are creating a new map-based online encyclopedia. We invite specialists worldwide to compile a comprehensive, high-level overview of our current world on a platform which will be accessible and understandable for all. On this website you can see the world map which we aim to fill with articles provided by experts.</p>
<h2>The duties will include</h2>
<ul>
<li>Researching and addressing potential authors (scholars or NGO specialists worldwide)</li>
<li>Researching historical and current data on global and regional issues</li>
<li>Editing encyclopedic entries on a variety of socio-political topics</li>
<li>Researching data or various third-party resources for publishing</li>
<li>Creating supporting infographics, such as charts or timelines</li>
<li>Uploading content to the website</li>
</ul>
<h2>Minimum requirements</h2>
<ul>
<li>Background in humanities, social sciences or journalism</li>
<li>Exceptional written English</li>
<li>5 hours/week availability</li>
<li>Availability for weekly online meetings</li>
</ul>
<h2>What you can expect</h2>
<p>You can expect support from a diverse Atlas team with expertise in multiple areas and a flexible working schedule. As you work with us, you may learn about other parts of the project and can choose to be more involved. We offer experience, volunteer status, and potential long-term membership in our organisation for committed colleagues. Such involvement allows managerial, leadership and decision-making opportunities, as well as voting rights in the association. In the meantime, we are working hard to create more support and funding for Atlas, and we aim to professionalize this position as soon as possible.</p>
<h2>What we expect from you</h2>
<p>We expect reliable communication. You will familiarize yourself with the project, join regular weekly meetings, and be proactive about resolving tasks of the editing team. You will seek help from others when needed, and be open to feedback.</p>
<h2>To apply</h2>
<p>Use the form below: attach your CV and tell us about yourself in a few paragraphs. Please include links to relevant work samples.</p>$html$,
  'open'
)
on conflict (slug) do nothing;

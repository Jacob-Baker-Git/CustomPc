// Copy for the privacy policy and terms pages.
//
// IMPORTANT: the specifics here describe what the site actually does today —
// no accounts, no cookies, no analytics, builds held in localStorage, one write
// path (the feedback form) into Supabase, and one READ path that fires on every
// page: App.jsx calls loadCatalog() from an unconditional mount effect. If any
// of that changes, this file has to change with it, or the notice becomes
// inaccurate, which is worse than not having one.
//
// There is no retention schedule to keep in step any more. The `email` and
// `ip_hash` columns were dropped and the `purge_feedback_personal_data` pg_cron
// job was unscheduled and dropped with them, so a row holds nothing that could
// expire. Ignore any older comment describing a 30/90-day purge.
//
// ⚠️ The "Who else sees a request" section is pinned to `public/_headers` by
// legalContent.test.js: any remote host in connect-src is a company that
// receives the visitor's IP, so adding one fails the suite until this page
// accounts for it.

// The two things a privacy notice cannot omit: an identifiable controller and a
// route to reach them. Both are now real, and legalContent.test.js asserts
// neither has been reverted to a placeholder — so these pages are publishable.
//
// This address is published on a public page. It will be scraped. Do not swap it
// for a personal mailbox without asking; it is deliberately a separate one, and
// the rights section below commits to answering whatever arrives at it.
export const OPERATOR = {
  name: 'Jacob Baker',
  contactEmail: 'jacob.business@gmail.com',
  location: 'the United Kingdom',
}

export const LAST_UPDATED = '1 August 2026'

// There is deliberately no AFFILIATE_DISCLOSURE here. The site has no affiliate
// relationship with anyone and earns nothing from the outbound links, so there
// is nothing to disclose — and saying otherwise would itself be inaccurate.
//
// If that ever changes, the disclosure has to come back in three places at once
// (the parts listings, the summary price note and the footer), because the CMA
// and ASA require it visible before the click rather than on a policy page.

export const PRIVACY = {
  intro:
    'This site is a free PC-building tool. It has no accounts, no cookies, no analytics and no advertising trackers. Almost everything you do here never leaves your browser.',
  sections: [
    {
      heading: 'Building a PC collects nothing',
      body: [
        'Your build — the parts you pick, your budget, your saved builds — is stored in your own browser using local storage. It is never transmitted to us and we cannot see it.',
        'Clearing your browser data deletes it permanently. We hold no copy, so we cannot restore it for you.',
        'A share link encodes the build into the URL itself. Anyone you send it to can read that build, so treat a share link as public.',
      ],
    },
    {
      heading: 'The feedback form is the only thing that reaches us',
      body: [
        'If you submit feedback we store what you typed: a rating, a category and your message. There is no email field and we do not ask who you are, so feedback reaches us anonymously and we have no way to reply to it.',
        'If you put your own contact details inside the message we will have them, because we store the message as written. Please do not, unless you mean to.',
        'We do not store your IP address, or a hash of it, or anything else that identifies your device. We previously kept a one-way hash of it to stop one person flooding the form; that was removed, along with the ability to rate-limit an individual, because it was the last identifying thing we held.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'Indefinitely, because there is nothing personal in it to expire. A stored row is a rating, a category, a message and the time it arrived.',
        'There is no deletion schedule any more and no longer anything for one to delete. If that changes — if we ever start collecting something that identifies you — this page changes first.',
      ],
    },
    {
      heading: 'Where it is stored',
      body: [
        'Feedback is stored in a Supabase (PostgreSQL) database hosted in the European Union (Ireland).',
        'It is not sold, shared, or used for marketing. We could not send you a newsletter if we wanted to — we do not have your address.',
      ],
    },
    {
      heading: 'Who else sees a request',
      body: [
        'Fonts, 3D models and every other asset are served from this site’s own domain. There is no third-party CDN, no analytics and no advertising tracker, so nothing here follows you between sites.',
        'Two companies do see a request, because they are what serves the site. Netlify hosts the pages. Supabase holds the parts catalogue, and every page fetches it on load — so opening anything here, this page included, sends your IP address to both. That is true of any hosted website; we say it because “no third parties” would be too strong a claim.',
        'Neither request stores anything that identifies you in our own data. Both companies keep operational logs of their own, as every host does, under their own policies.',
        'Links out to retailers are ordinary links. Nothing is sent to them until you choose to click, and once you do you are on their site under their privacy policy, not ours.',
      ],
    },
    {
      heading: 'Lawful basis',
      body: [
        'We hold no personal data, so for the most part UK GDPR has nothing to attach to. There are no accounts, no cookies, no analytics and no contact details, and we keep no logs of our own. What our host and our database provider record in serving the page is covered above.',
        'The one exception is anything you choose to type into a feedback message. Where that happens we rely on legitimate interests — reading feedback in order to improve the site — and you can ask us to erase it.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can ask us for a copy of what we hold about you, ask us to correct it, or ask us to erase it. In practice there will usually be nothing to find, because feedback is anonymous and nothing else is ever stored.',
        'If you did put something identifying in a message and want it gone, tell us the approximate date and what it said, and we will delete the row.',
        'If you think we have handled your data badly you can complain to the Information Commissioner’s Office (ico.org.uk).',
      ],
    },
  ],
}

export const TERMS = {
  intro:
    'This is a free planning tool, provided as-is. Read this before you spend money based on anything it tells you.',
  sections: [
    {
      heading: 'Everything here is an estimate',
      body: [
        'Prices are a curated snapshot, not live retail data. They exist so builds can be compared sensibly against each other. The real price at any retailer will differ, sometimes by a lot.',
        'Frame rates are produced by a simple model, not measured benchmarks. Actual performance depends on settings, drivers, the specific game version, your display and much else besides.',
        'The CustomPC score, bottleneck readings and upgrade suggestions are opinionated heuristics, not objective measurements.',
      ],
    },
    {
      heading: 'Compatibility checks are a help, not a guarantee',
      body: [
        'The compatibility and physical-fit checks catch common mistakes — a mismatched socket, RAM of the wrong generation, a cooler too tall for the case, a power supply with too little headroom.',
        'They cannot catch everything. Manufacturers revise products, specifications vary between regional models, and some incompatibilities only appear in specific combinations.',
        'Always confirm against the manufacturers’ own specifications before you buy. Do not treat a green tick here as the final word.',
      ],
    },
    {
      heading: 'The 3D view is an illustration',
      body: [
        'The 3D assembly is a stylised approximation to help you picture the build. Component models are generic stand-ins, and the arrangement is not an assembly guide. Your actual parts will look different and may fit differently.',
      ],
    },
    {
      heading: 'Links to retailers',
      body: [
        'The links to retailers are ordinary links. We are not an affiliate of any shop, we earn no commission, and nothing we recommend is influenced by what anyone pays us — because nobody does.',
        'We are not a retailer either. You cannot buy anything here, we hold no stock, and we are not party to any purchase you make elsewhere. Your contract, your consumer rights, your warranty and your returns are all with whoever you buy from.',
      ],
    },
    {
      heading: 'No warranty, and what we are not liable for',
      body: [
        'The site is provided without warranties of any kind, express or implied, including fitness for a particular purpose.',
        'To the extent the law allows, we are not liable for money spent on parts, for hardware that turns out to be incompatible or underperforming, or for any other loss arising from relying on this site. Nothing here excludes liability that cannot legally be excluded.',
        'This is general information, not professional advice.',
      ],
    },
    {
      heading: 'Trademarks and third-party content',
      body: [
        'Product, component and game names are the trademarks of their respective owners and are used descriptively to identify hardware. No affiliation with or endorsement by any manufacturer is claimed or implied.',
        'The 3D models are used under Creative Commons licences; the creators and licence terms are credited on the Help page.',
      ],
    },
  ],
}

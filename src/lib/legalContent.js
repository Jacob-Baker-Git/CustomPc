// Copy for the privacy policy and terms pages.
//
// IMPORTANT: the specifics here describe what the site actually does today —
// no accounts, no cookies, no analytics, builds held in localStorage, and one
// write path (the feedback form) into Supabase. If any of that changes, this
// file has to change with it, or the notice becomes inaccurate, which is worse
// than not having one.
//
// The retention periods are the ones enforced by the
// `purge-feedback-personal-data` pg_cron job in Supabase. Changing one without
// the other makes this page a false statement.

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

// Shown next to the outbound retailer links, not buried on a policy page: the
// CMA and ASA both require the disclosure to be visible before the click.
export const AFFILIATE_DISCLOSURE =
  'Some links to retailers may earn us a commission if you buy something. It never changes the price you pay, and it never affects which parts we recommend.'

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
        'If you submit feedback we store what you typed: a rating, a category, your message, and your email address if you chose to give one. The email field is optional and only used to reply to you.',
        'We also store a one-way hash of your IP address. It exists solely to stop one person flooding the form, and it cannot be reversed back into your IP address.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'The IP hash is erased automatically 30 days after submission.',
        'Your email address is erased automatically 90 days after submission.',
        'The message itself may be kept longer to inform how the site is improved, but once the above have been erased it is no longer linked to you.',
        'These deletions run on a scheduled job — they are not something we have to remember to do.',
      ],
    },
    {
      heading: 'Where it is stored',
      body: [
        'Feedback is stored in a Supabase (PostgreSQL) database hosted in the European Union (Ireland).',
        'It is not sold, shared, or used for marketing. We will never send you a newsletter — the only reason we would email you is to reply to feedback you sent us.',
      ],
    },
    {
      heading: 'No third parties are embedded',
      body: [
        'Fonts, 3D models and every other asset are served from this site’s own domain. Nothing is loaded from a third-party CDN, so no other company receives your IP address just because you opened the page.',
        'Links out to retailers are ordinary links. Nothing is sent to them until you choose to click, and once you do you are on their site under their privacy policy, not ours.',
      ],
    },
    {
      heading: 'Lawful basis',
      body: [
        'Where UK GDPR applies, we rely on legitimate interests: running the site, replying to people who contact us, and preventing abuse of the feedback form. Giving your email address is entirely your choice.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can ask us for a copy of what we hold about you, ask us to correct it, or ask us to erase it. Because there are no accounts, please tell us the approximate date and content of your feedback so we can find it.',
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
      heading: 'Affiliate links',
      body: [
        AFFILIATE_DISCLOSURE,
        'We are not a retailer. You cannot buy anything here, we hold no stock, and we are not party to any purchase you make elsewhere. Your contract, your consumer rights, your warranty and your returns are all with whoever you buy from.',
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

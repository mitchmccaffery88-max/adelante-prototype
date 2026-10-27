/** Editable public display inventory; no clinical actions or permissions. */
export const coreValues = ['website.diana.value.life', 'website.diana.value.gaps', 'website.diana.value.whole', 'website.diana.value.connected', 'website.diana.value.dignity'] as const;
// Reserved captions for future supplied photo/video media; no feed or autoplay built.
export const futureHeroCaptions = ['website.diana.caption.reentry', 'website.diana.caption.medication', 'website.diana.caption.recovery'] as const;
export const coreServices = [
 { id: 'therapy', title: 'website.diana.therapy', body: 'website.diana.therapy.body', to: '/care/everyday' },
 { id: 'medication', title: 'website.diana.medication', body: 'website.diana.medication.body', to: '/care/everyday' },
 { id: 'recovery', title: 'website.diana.recovery', body: 'website.diana.recovery.body', to: '/care/recovery' },
 { id: 'groups', title: 'website.diana.groups', body: 'website.diana.groups.body', to: '/how-it-works' },
 { id: 'reentry', title: 'website.diana.reentry', body: 'website.diana.reentry.body', to: '/care/coming-home' },
 { id: 'resources', title: 'website.diana.resources', body: 'website.diana.resources.body', to: '/directory' },
] as const;
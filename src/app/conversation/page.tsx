'use client';

import dynamic from 'next/dynamic';

// Client-only: this route is a mic-driven, auth-gated voice UI. SSR buys it nothing and
// every render-time browser-API access (AudioContext, document, speechSynthesis) becomes a
// server crash. ssr:false requires the dynamic() call to live in a client component (Next 15).
const ConversationPage = dynamic(() => import('./ConversationPageClient'), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-background" />,
});

export default function Page() {
  return <ConversationPage />;
}

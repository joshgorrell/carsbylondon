import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useServices, useStartingPrices } from '../hooks/useData'
import { formatPrice } from '../lib/format'
import tintOptionsImage from '../../public/images/London_tint_options.png'

export default function Services() {
  const { services, loading } = useServices()
  const slugs = useMemo(() => services.map((s) => s.slug), [services])
  const { prices } = useStartingPrices(slugs)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    if (lightboxOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [lightboxOpen])

  return (
    <div className="pt-20 md:pt-24">
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="eyebrow mb-3">Premium Automotive Services</p>
          <h1 className="section-heading mb-4">Our Services</h1>
          <p className="text-brand-silver max-w-2xl mx-auto">Every service uses premium materials and is backed by industry-leading warranties. Pricing is based on your vehicle class — get an exact quote during booking.</p>
        </div>
        {loading ? (
          <div className="text-center text-brand-silver py-20">Loading services…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s) => (
              <div key={s.id} className="card card-hover p-8 group bg-card-gradient">
                <h3 className="text-xl font-semibold text-white mb-2">{s.name}</h3>
                <p className="text-brand-silver text-sm leading-relaxed mb-4">{s.description}</p>
                {prices[s.slug] && <p className="text-brand-blue text-lg font-bold mb-6">Starting at {formatPrice(prices[s.slug])}</p>}
                <Link to={`/book/${s.slug}`} className="text-brand-blue text-sm font-badge font-semibold tracking-wider uppercase inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Book This Service
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Tint Options Visual Guide */}
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="eyebrow mb-3">Window Tinting Options</p>
          <h2 className="section-heading mb-4" style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>Understanding Your Tint Choices</h2>
          <p className="text-brand-silver max-w-2xl mx-auto">From windshield brows to full glass coverage, here's a visual breakdown of every area we can tint on your vehicle.</p>
        </div>
        <div className="card p-4 md:p-8 bg-card-gradient">
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="block w-full rounded-lg overflow-hidden cursor-zoom-in group relative"
            aria-label="Expand tint options graphic"
          >
            <img
              src={tintOptionsImage}
              alt="London Tint window tinting options — windshield brow, full windshield, side windows, rear glass, and port windows"
              className="w-full h-auto object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.01]"
            />
            <span className="md:hidden absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-black/80 backdrop-blur-sm text-white text-xs font-badge font-semibold tracking-wider uppercase border border-brand-border">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                Tap to expand
              </span>
            </span>
          </button>
        </div>
      </section>

      {/* Full-screen image viewer */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Tint options graphic — expanded view"
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-brand-card/80 border border-brand-border flex items-center justify-center text-white hover:text-brand-blue hover:border-brand-blue transition-colors"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
          <img
            src={tintOptionsImage}
            alt="London Tint window tinting options — windshield brow, full windshield, side windows, rear glass, and port windows"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}

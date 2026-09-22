import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { useServices, useFeaturedGallery, useFeaturedReviews, useStartingPrices, useBusinessSettings } from '../hooks/useData'
import { formatPrice } from '../lib/format'

const heroSlides = [
  'https://images.pexels.com/photos/116675/pexels-photo-116675.jpeg',
  'https://images.pexels.com/photos/2127733/pexels-photo-2127733.jpeg',
  'https://images.pexels.com/photos/3593922/pexels-photo-3593922.jpeg',
  'https://images.pexels.com/photos/3786091/pexels-photo-3786091.jpeg',
]

const serviceIcons: { [key: string]: string } = {
  window_tint: 'M4 4h16v16H4V4zm2 2v12h12V6H6z',
  detailing: 'M3 12l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2M3 18l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2',
  quote: 'M9 12h6m-6 4h6M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
}

export default function Home() {
  const { services } = useServices()
  const { items: gallery } = useFeaturedGallery(6)
  const { reviews } = useFeaturedReviews(3)
  const { settings } = useBusinessSettings()
  const slugs = useMemo(() => services.map((s) => s.slug), [services])
  const { prices } = useStartingPrices(slugs)

  return (
    <div>
      {/* ═══ HERO ═══ */}
      <section className="relative h-[100svh] min-h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          {heroSlides.map((src, i) => (
            <div key={src} className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${src})`,
                opacity: i === 0 ? 1 : 0,
                animation: `heroCycle 16s ease-in-out ${i * 4}s infinite`,
              }} />
          ))}
          <div className="absolute inset-0 bg-hero-overlay" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-4xl animate-slide-up">
          <div className="mb-8 flex justify-center">
            <img
              src="/London_Tint_and_Detail_logo.png"
              alt="London Tint & Detail"
              className="max-w-full object-contain"
              style={{
                height: 'clamp(200px, 38vw, 300px)',
                width: 'auto',
                maxWidth: 'calc(100vw - 32px)',
              }}
            />
          </div>

          <h1 className="font-display text-5xl md:text-7xl lg:text-8xl tracking-wide text-white mb-8 text-balance uppercase leading-none">
            Protect. Enhance. Customize.
          </h1>
          <p className="text-brand-silver text-lg md:text-xl max-w-2xl mx-auto mb-10 text-balance">
            Premium tinting and detailing by London. Beautiful tint and expert detailing — trusted by owners of the finest vehicles.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/book" className="btn-primary text-base animate-blue-pulse">Book Now</Link>
            <Link to="/gallery" className="btn-secondary text-base">View Gallery</Link>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10">
          <div className="w-6 h-10 border-2 border-brand-silver/30 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-brand-blue rounded-full animate-bounce" />
          </div>
        </div>

        <style>{`
          @keyframes heroCycle {
            0%, 100% { opacity: 0; }
            10%, 35% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      </section>

      {/* ═══ SERVICES ═══ */}
      <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="eyebrow mb-3">What We Do</p>
          <h2 className="section-heading mb-4">Services</h2>
          <p className="text-brand-silver max-w-2xl mx-auto">Every service is performed with precision and premium materials. No shortcuts, no surprises.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s) => (
            <Link key={s.id} to={`/book/${s.slug}`} className="card card-hover p-8 group bg-card-gradient">
              <div className="w-12 h-12 mb-6 rounded-lg bg-brand-blue/15 flex items-center justify-center group-hover:bg-brand-blue/25 transition-colors">
                <svg className="w-6 h-6 text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d={serviceIcons[s.slug] || serviceIcons.quote} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{s.name}</h3>
              <p className="text-brand-silver text-sm leading-relaxed mb-4">{s.description}</p>
              {prices[s.slug] && <p className="text-brand-blue text-lg font-bold mb-6">Starting at {formatPrice(prices[s.slug])}</p>}
              <span className="text-brand-blue text-sm font-badge font-semibold tracking-wider uppercase inline-flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                Book This Service
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══ GALLERY PREVIEW ═══ */}
      {gallery.length > 0 && (
        <section className="py-20 md:py-32 bg-brand-charcoal">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="eyebrow mb-3">Our Work</p>
              <h2 className="section-heading mb-4">Gallery</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {gallery.map((item, i) => (
                <div key={item.id} className={`relative overflow-hidden rounded-xl group ${i === 0 ? 'col-span-2 row-span-2 md:col-span-2 md:row-span-2' : ''}`}>
                  <img src={item.image} alt={item.caption || 'Gallery'} loading="lazy"
                    className={`w-full ${i === 0 ? 'h-full min-h-[300px]' : 'h-48 md:h-64'} object-cover transition-transform duration-700 group-hover:scale-110`} />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  {item.caption && (
                    <p className="absolute bottom-4 left-4 text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">{item.caption}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="text-center mt-10"><Link to="/gallery" className="btn-secondary">View Full Gallery</Link></div>
          </div>
        </section>
      )}

      {/* ═══ REVIEWS ═══ */}
      {reviews.length > 0 && (
        <section className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="eyebrow mb-3">Client Feedback</p>
            <h2 className="section-heading mb-4">Reviews</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <div key={r.id} className="card p-8 bg-card-gradient">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: r.rating }).map((_, i) => (
                    <svg key={i} className="w-5 h-5 text-brand-blue" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6 6 1-4.5 4.5L18 20l-6-3-6 3 1.5-6.5L3 9l6-1z" /></svg>
                  ))}
                </div>
                <p className="text-brand-silver text-sm leading-relaxed mb-6 italic">"{r.review}"</p>
                <p className="text-white font-semibold text-sm">{r.customer_name}</p>
                {r.vehicle && <p className="text-brand-silver-dark text-xs">{r.vehicle}</p>}
              </div>
            ))}
          </div>
          <div className="text-center mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/reviews" className="btn-ghost">Read All Reviews →</Link>
            {settings?.google_review_url && (
              <a href={settings.google_review_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" fill="#EA4335" /></svg>
                Review Us on Google
              </a>
            )}
          </div>
        </section>
      )}

      {/* ═══ Social Media ═══ */}
      {settings && (settings.facebook_visible || settings.instagram_visible) && (
        <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-brand-charcoal border-t border-brand-border">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="eyebrow mb-3">Stay Connected</p>
              <h2 className="section-heading mb-4">Follow Us</h2>
              <p className="text-brand-silver max-w-xl mx-auto">See our latest work, updates, and behind-the-scenes content on social media.</p>
            </div>
            <div className={`grid gap-8 ${settings.facebook_visible && settings.instagram_visible ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 max-w-2xl mx-auto'}`}>
              {settings.facebook_visible && settings.facebook_url && (
                <div className="card bg-card-gradient overflow-hidden">
                  <div className="flex items-center gap-3 p-5 border-b border-brand-border">
                    <div className="w-9 h-9 rounded-lg bg-[#1877F2]/15 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Facebook</p>
                      <p className="text-brand-silver-dark text-xs">Latest posts & updates</p>
                    </div>
                  </div>
                  <div className="p-2 bg-brand-black/30">
                    <iframe
                      src={`https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(settings.facebook_url)}&tabs=timeline&width=500&height=500&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`}
                      className="w-full rounded"
                      style={{ minHeight: '500px', border: 'none', overflow: 'hidden' }}
                      scrolling="no"
                      frameBorder="0"
                      allowFullScreen
                      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                      title="Facebook Feed"
                    />
                  </div>
                  <div className="p-4 text-center">
                    <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer"
                      className="btn-secondary !text-sm inline-flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#1877F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                      Follow on Facebook
                    </a>
                  </div>
                </div>
              )}

              {settings.instagram_visible && settings.instagram_url && (
                <div className="card bg-card-gradient overflow-hidden">
                  <div className="flex items-center gap-3 p-5 border-b border-brand-border">
                    <div className="w-9 h-9 rounded-lg bg-[#E1306C]/15 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-[#E1306C]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Instagram</p>
                      <p className="text-brand-silver-dark text-xs">Photos & stories</p>
                    </div>
                  </div>
                  <div className="p-8 flex flex-col items-center justify-center gap-6 min-h-[300px]">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#F58529] via-[#E1306C] to-[#833AB4] flex items-center justify-center shadow-lg">
                      <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold mb-2">Follow our work on Instagram</p>
                      <p className="text-brand-silver text-sm max-w-xs">See our latest tints, details, and transformations — one post at a time.</p>
                    </div>
                    <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white text-sm transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, #F58529, #E1306C, #833AB4)' }}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                      Follow on Instagram
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══ CTA ═══ */}
      <section className="py-20 md:py-32 bg-gradient-to-b from-brand-black to-brand-charcoal">
        <div className="max-w-3xl mx-auto text-center px-4">
          <img src="/London_Tint_and_Detail_logo.png" alt="London Tint & Detail" className="mx-auto mb-6" style={{ height: 'clamp(80px, 15vw, 110px)', width: 'auto' }} />
          <h2 className="section-heading mb-6">Ready to Protect Your Vehicle?</h2>
          <p className="text-brand-silver text-lg mb-10 text-balance">
            Book your appointment in under 90 seconds. Choose your service, select your vehicle,
            pay your deposit, and request an appointment. That's it.
          </p>
          <Link to="/book" className="btn-primary text-base animate-blue-pulse">Book Now</Link>
        </div>
      </section>
    </div>
  )
}

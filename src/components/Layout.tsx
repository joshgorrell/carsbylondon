import { Outlet, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useBusinessSettings } from '../hooks/useData'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Services' },
  { to: '/gallery', label: 'Gallery' },
  { to: '/reviews', label: 'Reviews' },
  { to: '/contact', label: 'Contact' },
]

export default function Layout() {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const { settings } = useBusinessSettings()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMenuOpen(false); window.scrollTo(0, 0) }, [location.pathname])

  if (location.pathname.startsWith('/admin')) return <Outlet />

  return (
    <div className="min-h-screen flex flex-col bg-grain">
      {/* ── Header ── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-brand-black/95 backdrop-blur-md border-b border-brand-border' : 'bg-gradient-to-b from-black/70 to-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between">
          <Link to="/" className="group">
            <img src="/images/London_icon.png" alt="London Tint & Detail" className="h-12 w-12 object-contain group-hover:opacity-90 transition-opacity" />
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to}
                className={`font-badge font-semibold tracking-wider uppercase text-sm transition-colors ${
                  location.pathname === l.to ? 'text-brand-blue' : 'text-white hover:text-brand-blue'
                }`}>
                {l.label}
              </Link>
            ))}
            <Link to="/book" className="btn-primary !px-6 !py-2.5 !text-xs">Book Now</Link>
          </nav>

          <button className="md:hidden p-2 text-brand-chrome" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
              : <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-brand-black/98 backdrop-blur-md border-b border-brand-border animate-fade-in">
            <nav className="px-4 py-6 flex flex-col gap-4">
              {navLinks.map((l) => (
                <Link key={l.to} to={l.to}
                  className={`font-badge font-semibold tracking-wider uppercase text-base py-2 ${
                    location.pathname === l.to ? 'text-brand-blue' : 'text-brand-silver'
                  }`}>
                  {l.label}
                </Link>
              ))}
              <Link to="/book" className="btn-primary mt-2">Book Now</Link>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1"><Outlet /></main>

      {/* ── Footer ── */}
      <footer className="bg-brand-charcoal border-t border-brand-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <Link to="/" className="group mb-4">
                <img src="/images/London_icon.png" alt="London Tint & Detail" className="h-16 w-16 object-contain group-hover:opacity-90 transition-opacity" />
              </Link>
              <p className="text-brand-silver text-sm leading-relaxed">Protect. Enhance. Customize.</p>
            </div>
            <div>
              <h4 className="eyebrow mb-3">Services</h4>
              <ul className="space-y-2 text-sm text-brand-silver">
                <li><Link to="/services" className="hover:text-brand-blue transition-colors">Window Tint</Link></li>
                <li><Link to="/services" className="hover:text-brand-blue transition-colors">Detailing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="eyebrow mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-brand-silver">
                <li><Link to="/gallery" className="hover:text-brand-blue transition-colors">Gallery</Link></li>
                <li><Link to="/reviews" className="hover:text-brand-blue transition-colors">Reviews</Link></li>
                <li><Link to="/contact" className="hover:text-brand-blue transition-colors">Contact</Link></li>
                <li><Link to="/admin/login" className="hover:text-brand-blue transition-colors">Admin</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="eyebrow mb-3">Book Now</h4>
              <p className="text-brand-silver text-sm mb-4">Reserve your spot in under 90 seconds.</p>
              <Link to="/book" className="btn-primary !px-5 !py-2.5 !text-xs">Book Appointment</Link>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-brand-border flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-brand-silver-dark text-xs">© {new Date().getFullYear()} Cars by London. All rights reserved.</p>
            <div className="flex items-center gap-3">
              {settings?.facebook_visible && settings.facebook_url && (
                <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-brand-muted/50 flex items-center justify-center text-brand-silver hover:text-[#1877F2] hover:bg-[#1877F2]/10 transition-colors"
                  aria-label="Facebook">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                </a>
              )}
              {settings?.instagram_visible && settings.instagram_url && (
                <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-brand-muted/50 flex items-center justify-center text-brand-silver hover:text-[#E1306C] hover:bg-[#E1306C]/10 transition-colors"
                  aria-label="Instagram">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>
                </a>
              )}
              <p className="text-brand-silver-dark text-xs font-badge tracking-widest uppercase">Protect. Enhance. Customize.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

import { Link } from 'react-router-dom'
import ShieldBadge from '../components/ShieldBadge'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <ShieldBadge size={64} className="mx-auto mb-6" />
        <h1 className="font-display text-7xl md:text-9xl tracking-wider text-brand-blue mb-4">404</h1>
        <p className="text-brand-silver text-lg mb-8">This page doesn't exist.</p>
        <Link to="/" className="btn-primary">Back to Home</Link>
      </div>
    </div>
  )
}

import { useBusinessSettings } from '../hooks/useData'

export default function Contact() {
  const { settings } = useBusinessSettings()
  const days = [
    { label: 'Monday', val: settings?.hours_monday },
    { label: 'Tuesday', val: settings?.hours_tuesday },
    { label: 'Wednesday', val: settings?.hours_wednesday },
    { label: 'Thursday', val: settings?.hours_thursday },
    { label: 'Friday', val: settings?.hours_friday },
    { label: 'Saturday', val: settings?.hours_saturday },
    { label: 'Sunday', val: settings?.hours_sunday },
  ]
  return (
    <div className="pt-20 md:pt-24">
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="eyebrow mb-3">Get In Touch</p>
          <h1 className="section-heading mb-4">Contact</h1>
          <p className="text-brand-silver max-w-2xl mx-auto">Prefer to book online? Use our 90-second booking flow. Need to reach us directly? Here's how.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="card p-8 bg-card-gradient">
            <h2 className="text-xl font-semibold text-white mb-6">Business Info</h2>
            <dl className="space-y-4 text-sm">
              {settings?.phone && (<div><dt className="eyebrow mb-1">Phone</dt><dd className="text-brand-silver"><a href={`tel:${settings.phone}`} className="hover:text-brand-blue transition-colors">{settings.phone}</a></dd></div>)}
              {settings?.email && (<div><dt className="eyebrow mb-1">Email</dt><dd className="text-brand-silver"><a href={`mailto:${settings.email}`} className="hover:text-brand-blue transition-colors">{settings.email}</a></dd></div>)}
              {settings?.address && (<div><dt className="eyebrow mb-1">Address</dt><dd className="text-brand-silver">{settings.address}{settings.maps_url && <a href={settings.maps_url} target="_blank" rel="noopener noreferrer" className="block text-brand-blue text-xs mt-1 hover:underline">Get directions →</a>}</dd></div>)}
            </dl>
          </div>
          <div className="card p-8 bg-card-gradient">
            <h2 className="text-xl font-semibold text-white mb-2">Business Hours</h2>
            <p className="text-brand-silver text-xs mb-6">All hours are by appointment only. Book online to secure your slot.</p>
            <dl className="space-y-3 text-sm">
              {days.map((d) => (
                <div key={d.label} className="flex justify-between items-center py-2 border-b border-brand-border last:border-0">
                  <dt className="text-brand-silver">{d.label}</dt>
                  <dd className={d.val === 'Closed' ? 'text-brand-silver-dark' : 'text-white'}>{d.val || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
        <div className="text-center mt-12"><a href="/book" className="btn-primary text-base">Book an Appointment</a></div>
      </section>
    </div>
  )
}

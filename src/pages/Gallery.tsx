import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { GalleryItem } from '../lib/types'

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    supabase.from('gallery').select('*').order('featured', { ascending: false })
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [])

  const cats = ['all', ...Array.from(new Set(items.map((i) => i.category)))]
  const filtered = filter === 'all' ? items : items.filter((i) => i.category === filter)

  return (
    <div className="pt-20 md:pt-24">
      <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="eyebrow mb-3">Our Work</p>
          <h1 className="section-heading mb-4">Gallery</h1>
          <p className="text-brand-silver max-w-2xl mx-auto">A selection of our recent work. Every vehicle receives the same attention to detail.</p>
        </div>
        {items.length > 1 && (
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {cats.map((c) => (
              <button key={c} onClick={() => setFilter(c)}
                className={`px-4 py-2 rounded-md text-sm font-badge font-semibold tracking-wider uppercase transition-colors ${
                  filter === c ? 'bg-brand-blue text-white' : 'bg-brand-muted/50 text-brand-silver border border-brand-border hover:text-white'
                }`}>{c}</button>
            ))}
          </div>
        )}
        {loading ? <div className="text-center text-brand-silver py-20">Loading gallery…</div>
        : filtered.length === 0 ? <div className="text-center text-brand-silver py-20">No images yet.</div>
        : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((item, i) => (
              <div key={item.id} className={`relative overflow-hidden rounded-xl group ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
                <img src={item.image} alt={item.caption || 'Gallery'} loading="lazy"
                  className={`w-full ${i === 0 ? 'h-full min-h-[300px]' : 'h-48 md:h-64'} object-cover transition-transform duration-700 group-hover:scale-110`} />
                <div className="absolute inset-0 bg-gradient-to-t from-brand-black/80 to-transparent opacity-0 group-hover:opacity-100 max-md:opacity-100 max-md:from-brand-black/40 transition-opacity" />
                {item.caption && <p className="absolute bottom-4 left-4 text-white text-sm font-medium opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity">{item.caption}</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

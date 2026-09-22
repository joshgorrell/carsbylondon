import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import type { GalleryItem } from '../../lib/types'

const CATEGORIES = ['Window Tint', 'Detailing', 'PPF', 'Ceramic Coating', 'General']

export default function GalleryPanel() {
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ category: CATEGORIES[0], caption: '', featured: false })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('gallery').select('*').order('featured', { ascending: false })
    setItems((data || []) as GalleryItem[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  const upload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setError(null)
    try {
      const ext = selectedFile.name.split('.').pop() || 'jpg'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: ue } = await supabase.storage.from('gallery').upload(path, selectedFile, { upsert: false })
      if (ue) throw ue

      const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(path)
      const publicUrl = urlData.publicUrl

      const { error: ie } = await supabase.from('gallery').insert({
        image: publicUrl,
        category: form.category,
        caption: form.caption.trim() || null,
        featured: form.featured,
      })
      if (ie) throw ie

      setForm({ category: CATEGORIES[0], caption: '', featured: false })
      setSelectedFile(null)
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      setShowAdd(false)
      await load()
    } catch (e: any) {
      setError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const toggleFeatured = async (item: GalleryItem) => {
    await supabase.from('gallery').update({ featured: !item.featured }).eq('id', item.id)
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, featured: !i.featured } : i))
  }

  const deleteItem = async (item: GalleryItem) => {
    if (!confirm('Delete this photo from the gallery?')) return
    // Extract storage path from public URL
    const url = item.image
    const storageBase = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/gallery/`
    if (url.startsWith(storageBase)) {
      const path = url.replace(storageBase, '')
      await supabase.storage.from('gallery').remove([path])
    }
    await supabase.from('gallery').delete().eq('id', item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white">Gallery</h2>
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary !text-sm !px-4 !py-2">
          {showAdd ? 'Cancel' : '+ Add Photo'}
        </button>
      </div>

      {showAdd && (
        <div className="card p-6 mb-8 bg-card-gradient space-y-4 animate-slide-up">
          <h3 className="text-lg font-semibold text-white">Upload Photo</h3>

          <div>
            <label className="block text-sm text-brand-silver mb-2">Photo</label>
            <div
              className="border-2 border-dashed border-brand-border rounded-lg p-6 text-center cursor-pointer hover:border-brand-blue transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-cover" />
              ) : (
                <div className="text-brand-silver-dark">
                  <svg className="w-10 h-10 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 16l4-4 4 4 4-8 4 4M4 20h16M12 8V4m0 0l-2 2m2-2l2 2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <p className="text-sm">Click to choose a photo from your device</p>
                  <p className="text-xs mt-1">JPG, PNG, WEBP</p>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-brand-silver mb-2">Category</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-brand-silver mb-2">Caption <span className="text-brand-silver-dark">(optional)</span></label>
              <input className="input" placeholder="e.g. 2024 BMW M3 — Full Front PPF" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setForm({ ...form, featured: !form.featured })}
              className={`w-10 h-6 rounded-full transition-colors ${form.featured ? 'bg-brand-blue' : 'bg-brand-muted'}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${form.featured ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm text-brand-silver">Feature on homepage</span>
          </label>

          {error && <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

          <button onClick={upload} disabled={!selectedFile || uploading} className="btn-primary w-full">
            {uploading ? 'Uploading…' : 'Upload Photo'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center text-brand-silver bg-card-gradient">No photos yet. Upload your first one above.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <div key={item.id} className="relative group rounded-xl overflow-hidden border border-brand-border bg-brand-muted/20">
              <img
                src={item.image}
                alt={item.caption || 'Gallery'}
                className="w-full h-40 object-cover"
              />
              <div className="absolute inset-0 bg-brand-black/70 opacity-0 group-hover:opacity-100 max-md:opacity-100 max-md:bg-brand-black/40 transition-opacity flex flex-col items-center justify-center gap-2">
                <button
                  onClick={() => toggleFeatured(item)}
                  className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${item.featured ? 'bg-brand-blue text-white' : 'bg-brand-muted/80 text-brand-silver border border-brand-border hover:border-brand-blue'}`}
                >
                  {item.featured ? 'Featured' : 'Set Featured'}
                </button>
                <button
                  onClick={() => deleteItem(item)}
                  className="text-xs px-3 py-1.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/40 transition-colors"
                >
                  Delete
                </button>
              </div>
              <div className="p-2">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-brand-silver-dark truncate">{item.caption || item.category}</span>
                  {item.featured && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-blue/20 text-brand-blue shrink-0">Featured</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

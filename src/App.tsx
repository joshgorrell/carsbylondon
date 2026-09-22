import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Services from './pages/Services'
import Gallery from './pages/Gallery'
import Reviews from './pages/Reviews'
import Contact from './pages/Contact'
import Booking from './pages/Booking'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import NotFound from './pages/NotFound'
import ReviewSubmit from './pages/ReviewSubmit'
import Pay from './pages/Pay'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/book" element={<Booking />} />
        <Route path="/book/:serviceSlug" element={<Booking />} />
        <Route path="/review" element={<ReviewSubmit />} />
        <Route path="/pay" element={<Pay />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

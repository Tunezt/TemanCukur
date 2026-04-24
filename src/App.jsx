import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import './App.css'

import BookService  from './pages/BookService'
import BookSchedule from './pages/BookSchedule'
import BookDetails  from './pages/BookDetails'
import BookConfirm  from './pages/BookConfirm'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import { isAdminAuthenticated } from './admin/auth'

function AdminIndex() {
  return (
    <Navigate
      to={isAdminAuthenticated() ? '/admin/dashboard' : '/admin/login'}
      replace
    />
  )
}

/**
 * Reveal when the section scrolls into view — not on first paint.
 * (Hero image grid uses its own on-load reveal — see heroGalleryLoaded.)
 * - Elements mostly below the fold on load animate when they intersect (user scrolled there).
 * - Elements already in the viewport on load wait until the first scroll/wheel before revealing.
 */
function useInView(threshold = 0.12) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  const belowFoldRef = useRef(true)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    belowFoldRef.current =
      el.getBoundingClientRect().top > window.innerHeight * 0.34
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInView(true)
      return
    }

    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return

        const reveal = () => {
          setInView(true)
          obs.disconnect()
        }

        if (belowFoldRef.current) {
          reveal()
          return
        }

        const onInteract = () => reveal()
        window.addEventListener('scroll', onInteract, { passive: true, once: true })
        window.addEventListener('wheel', onInteract, { passive: true, once: true })
      },
      { threshold, rootMargin: '0px 0px -8% 0px' }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return [ref, inView]
}

// Splits a string into individually-animated character spans
function SplitWord({ text, baseDelay, step = 0.042 }) {
  return text.split('').map((char, i) => (
    <span
      key={i}
      className="char"
      style={{ '--cd': `${baseDelay + i * step}s` }}
    >
      {char}
    </span>
  ))
}

/** Google Maps — place page for the physical shop */
const LOCATION_MAPS_URL =
  "https://www.google.com/maps/place/Paddy's+Barbershop/@-1.2413192,116.856102,15z/data=!4m15!1m8!3m7!1s0x2df1470a0221d381:0xd55e9fd09aa16b03!2sPaddy's+Barbershop!8m2!3d-1.2445323!4d116.8610554!10e5!16s%2Fg%2F11hz2drsgz!3m5!1s0x2df1470a0221d381:0xd55e9fd09aa16b03!8m2!3d-1.2445323!4d116.8610554!16s%2Fg%2F11hz2drsgz"

/** Replace with real links */
const INSTAGRAM_URL = 'https://www.instagram.com/'

/** Replace with Rifki’s real business email */
const BUSINESS_EMAIL = 'hello@temancukur.com'
const BUSINESS_MAILTO = `mailto:${BUSINESS_EMAIL}?subject=${encodeURIComponent(
  'Business inquiry: Rifki Muhammad / Teman Cukur'
)}&body=${encodeURIComponent(
  'Hi Rifki,\n\nI’m reaching out about (hiring / sponsorship / collaboration):\n\n\n'
)}`

/** Static assets under `public/images/rifki/` (encode spaces in filenames). */
const rifkiImg = (filename) => `/images/rifki/${encodeURIComponent(filename)}`

/** Hero ticker — trendy cut names in English (industry terms) */
const HERO_CUT_STYLES = [
  'Flow & taper',
  'Low taper',
  'Taper',
  'Skin fade',
  'Mid fade',
  'High fade',
  'Drop fade',
  'Burst fade',
  'Temple fade',
  'Two-block',
  'Texture crop',
  'French crop',
  'Crop fringe',
  'Korean flow',
  'Wolf cut',
  'Mullet',
  'Line-up',
  'Beard blend',
  'Blowout',
  'Slick back',
  'Messy fringe',
  'Undercut',
  'Comb back',
]

const CRAFT_ITEMS = [
  {
    img: rifkiImg('credit_card_1.png'),
    title: 'Flow & fade',
    text: 'Volume yang bergerak, fade yang bersih sampai ke neckline. Terlihat styled tanpa terlihat berlebihan.',
  },
  {
    img: rifkiImg('credit_card_2.png'),
    title: 'Texture & taper',
    text: 'Tekstur alami di atas, transisi yang mulus di bawah. Potongan yang enak dilihat bahkan tanpa sisir.',
  },
  {
    img: rifkiImg('credit_card_3.png'),
    title: 'Korean flow',
    text: 'Rambut yang jatuh dengan arah dan bobot yang tepat. Flow yang terlihat disengaja, bukan sekadar panjang.',
  },
]

function LandingPage() {
  const navigate = useNavigate()

  const [scrolled, setScrolled]         = useState(false)
  const [pastHero, setPastHero]         = useState(false)
  /** Hero image grid — reveal on first paint (first impression), not scroll */
  const [heroGalleryLoaded, setHeroGalleryLoaded] = useState(false)
  const [heroMobileLayout, setHeroMobileLayout] = useState(() =>
    typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 767px)').matches
  )
  const galleryRef                      = useRef(null)
  const [craftRef, craftInView]         = useInView(0.12)
  const [locationRef, locationInView]   = useInView(0.1)
  const [footerRef, footerInView]       = useInView(0.15)
  const cursorRef                       = useRef(null)

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setHeroGalleryLoaded(true)
      return
    }
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setHeroGalleryLoaded(true))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setHeroMobileLayout(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const heroGallery = useMemo(
    () => [
      {
        img: rifkiImg(heroMobileLayout ? 'bottom right.png' : 'tall slot.png'),
        alt: 'Referensi potongan, flow dan taper',
        w: 720,
        h: 960,
      },
      {
        img: rifkiImg('top right.png'),
        alt: 'Referensi potongan, tekstur',
        w: 560,
        h: 560,
      },
      {
        img: rifkiImg('bottom right.png'),
        alt: 'Referensi potongan, fade samping',
        w: 560,
        h: 560,
      },
    ],
    [heroMobileLayout]
  )

  // Navbar + hero-past detection
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 60)
      setPastHero(window.scrollY > window.innerHeight * 0.85)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Smooth cursor glow — lerp with rAF, zero React re-renders
  useEffect(() => {
    let raf
    let cx = window.innerWidth  / 2
    let cy = window.innerHeight / 2
    let tx = cx, ty = cy

    const onMove = (e) => { tx = e.clientX; ty = e.clientY }

    const tick = () => {
      cx += (tx - cx) * 0.1
      cy += (ty - cy) * 0.1
      if (cursorRef.current) {
        cursorRef.current.style.left = `${cx}px`
        cursorRef.current.style.top  = `${cy}px`
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  const goBook = () => navigate('/book')

  const scrollTop = (e) => {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <a href="#main-content" className="skip-link">
        Lompat ke konten
      </a>

      {/* Smooth cursor glow — fades out past hero */}
      <div
        ref={cursorRef}
        className={`cursor-glow${pastHero ? ' cursor-glow--hidden' : ''}`}
        aria-hidden="true"
      />

      {/* ── Navbar: bracket links + underlined wordmark (no box) ── */}
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
        <a href="#top" className="navbar__brand" onClick={scrollTop}>
          <span className="navbar__brand-line">TEMAN</span>
          <span className="navbar__brand-line navbar__brand-line--2">CUKUR</span>
        </a>
        <div className="navbar__nav" role="navigation" aria-label="Bagian halaman">
          <a href="#top" className="navbar__link navbar__link--paren" onClick={scrollTop}>
            Beranda
          </a>
          <a href="#location" className="navbar__link navbar__link--brack">
            Lokasi
          </a>
          <a href="#contact" className="navbar__link navbar__link--paren">
            Kontak
          </a>
        </div>
      </nav>

      <main id="main-content">
      {/* ── Hero ── */}
      <section className="hero" id="top">
        <div className="hero__bg" aria-hidden="true" />

        <div className="hero__inner">
          {/* Text block */}
          <div className="hero__text">
            <p className="hero__eyebrow ha ha-1">Barbershop · Est. 2019</p>
            <h1 className="hero__name">
              <span className="hero__name-word">
                <SplitWord text="Rifki" baseDelay={0.22} />
              </span>
              <em className="hero__name-word">
                <SplitWord text="Muhammad" baseDelay={0.52} step={0.036} />
              </em>
            </h1>
            <p className="hero__role ha ha-role">
              Barber · Flow, fade &amp; tekstur 
            </p>
            <div className="hero__cta-row ha ha-cta">
              <button type="button" className="hero__cta" onClick={goBook}>
                Booking sekarang
              </button>
            </div>
          </div>

          {/* Gallery */}
          <div
            ref={galleryRef}
            className={`hero__gallery${heroGalleryLoaded ? ' hero__gallery--loaded' : ''}`}
          >
            {heroGallery.map(({ img, alt, w, h }, i) => (
              <div
                key={i}
                className={`hero__img-wrap hero__img-wrap--${i + 1}`}
                style={{ '--i': i }}
              >
                <img
                  key={img}
                  src={img}
                  alt={alt}
                  width={w}
                  height={h}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </div>
            ))}
          </div>

          <div className="hero__tagband">
            <div className="hero__marquee" aria-hidden="true">
              <div className="hero__marquee-track">
                {[...HERO_CUT_STYLES, ...HERO_CUT_STYLES].map((cut, i) => (
                  <span key={i} className="hero__marquee-item">
                    {cut}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <a href="#craft" className="hero__scroll-hint">
            <span className="hero__scroll-hint__line" aria-hidden="true" />
            <span className="hero__scroll-hint__text">Jelajahi</span>
          </a>
        </div>
      </section>

      {/* ── Rifki — signature work (personal) ── */}
      <section
        id="craft"
        ref={craftRef}
        className={`craft${craftInView ? ' craft--visible' : ''}`}
        aria-labelledby="craft-heading"
      >
        <div className="craft__header">
          <p className="section-label craft__anim-label">Dari kursi Rifki</p>
          <h2 id="craft-heading" className="craft__title craft__anim-title">
            Potongan yang tetap <em>enak</em> dipandang setelah keluar dari kursi.
          </h2>
          <p className="craft__lede craft__anim-lede">
          Setiap detail diperhatikan, dari garis tepi sampai tekstur akhir. Karena potongan yang bagus terlihat rapi bahkan seminggu setelah meninggalkan kursi.
          </p>
        </div>

        <ul className="craft__grid">
          {CRAFT_ITEMS.map(({ img, title, text }) => (
            <li key={title} className="craft__card">
              <div className="craft__shot">
                <img src={img} alt="" loading="lazy" />
              </div>
              <div className="craft__meta">
                <h3 className="craft__card-title">{title}</h3>
                <p className="craft__card-text">{text}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="craft__cta-row craft__anim-cta">
          <button type="button" className="craft__cta" onClick={goBook}>
            Booking sekarang
          </button>
          <a className="craft__tik" href="https://www.tiktok.com/@rfkiimhmmd" target="_blank" rel="noopener noreferrer">
            Lihat potongan di TikTok ↗
          </a>
        </div>
      </section>

      {/* ── Location ── */}
      <section
        id="location"
        ref={locationRef}
        className={`location reveal${locationInView ? ' in-view' : ''}`}
        aria-labelledby="location-venue-heading"
      >
        <div className="location__inner">
          <div className="location__image-wrap">
            <img
              className="location__image"
              src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&h=800&q=80"
              alt="Interior barbershop Teman Cukur"
              width={1200}
              height={800}
              loading="lazy"
              decoding="async"
            />
          </div>
          <div className="location__info">
            <p id="location-venue-heading" className="section-label">
              Paddy's Barbershop
            </p>
            <address className="location__address">
              Jalan Belakang Mall BB, Damai,<br />
              Balikpapan Selatan
            </address>
            <div className="location__rule" role="separator" />
            <div className="location__hours-block">
              <p className="location__hours-days">Senin – Sabtu</p>
              <p className="location__hours-time">09.00 – 20.00</p>
            </div>
            <a
              className="location__cta location__cta--maps"
              href={LOCATION_MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Buka di Maps{' '}
              <span className="location__cta-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        {/* Business / hiring / sponsorship — anchor #contact */}
        <div
          id="contact"
          ref={footerRef}
          className={`footer__close${footerInView ? ' footer__close--visible' : ''}`}
        >
          <div className="footer__close-inner">
            <div className="footer__close-grid">
              <div className="footer__close-copy">
                <p className="footer__close-label">For business inquiries</p>
                <p className="footer__close-hint">
                  Hiring, collaborations &amp; sponsorship.
                </p>
                <p className="footer__close-customer">
                  Just here for a haircut?{' '}
                  <button type="button" className="footer__close-booklink" onClick={goBook}>
                    Book online
                  </button>
                </p>
              </div>
              <div className="footer__close-actions">
                <a href={BUSINESS_MAILTO} className="footer__close-mail">
                  ( Write Rifki )
                </a>
                <a
                  href="https://www.tiktok.com/@rfkiimhmmd"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer__close-social"
                >
                  [ Portfolio ]
                </a>
                <span className="footer__close-email">{BUSINESS_EMAIL}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="footer__divider" />

        {/* Meta row — balanced on wide screens; same max width as closing band */}
        <div className="footer__meta-band">
          <div className="footer__bottom">
            <div className="footer__info">
              <div className="footer__brand-mark">
                <span className="footer__bm-line">TEMAN</span>
                <span className="footer__bm-line footer__bm-line--2">CUKUR</span>
              </div>
              <p className="footer__meta">
                Balikpapan Selatan <span className="footer__meta-dot" aria-hidden="true">·</span>{' '}
                Sen–Sab 09.00–20.00
              </p>
            </div>
            <nav className="footer__social" aria-label="Media sosial">
              <a
                href="https://www.tiktok.com/@rfkiimhmmd"
                target="_blank"
                rel="noopener noreferrer"
                className="footer__social-btn"
                aria-label="TikTok"
              >
                <svg className="footer__social-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
                  />
                </svg>
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="footer__social-btn"
                aria-label="Instagram"
              >
                <svg className="footer__social-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9zm4.5 2.8A5.2 5.2 0 1 1 6.8 12 5.2 5.2 0 0 1 12 6.8zm0 2A3.2 3.2 0 1 0 15.2 12 3.2 3.2 0 0 0 12 8.8zm5.55-3.15a1.1 1.1 0 1 1-1.1 1.1 1.1 1.1 0 0 1 1.1-1.1z"
                  />
                </svg>
              </a>
            </nav>
          </div>
        </div>

        <p className="footer__copy">© 2026 Teman Cukur · Balikpapan</p>
      </footer>
      </main>
    </>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/"               element={<LandingPage />} />
      <Route path="/book"           element={<BookService />} />
      <Route path="/book/schedule"  element={<BookSchedule />} />
      <Route path="/book/details"   element={<BookDetails />} />
      <Route path="/book/confirm"   element={<BookConfirm />} />
      <Route path="/admin"         element={<AdminIndex />} />
      <Route path="/admin/login"   element={<AdminLogin />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
    </Routes>
  )
}

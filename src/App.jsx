import { useState, useEffect, useRef } from 'react'
import './App.css'

function useInView(threshold = 0.1) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } },
      { threshold }
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

const GALLERY = [
  {
    img: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=600&h=900&q=80',
    alt: 'Texture Fringe',
  },
  {
    img: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&h=500&q=80',
    alt: 'Burst Fade',
  },
  {
    img: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&h=500&q=80',
    alt: 'Taper Fade',
  },
]

export default function App() {
  const [scrolled, setScrolled]         = useState(false)
  const [pastHero, setPastHero]         = useState(false)
  const [galleryRef, galleryInView]     = useInView(0.05)
  const [locationRef, locationInView]   = useInView(0.1)
  const [footerRef, footerInView]       = useInView(0.15)
  const cursorRef                       = useRef(null)

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

  return (
    <>
      {/* Smooth cursor glow — fades out past hero */}
      <div
        ref={cursorRef}
        className={`cursor-glow${pastHero ? ' cursor-glow--hidden' : ''}`}
        aria-hidden="true"
      />

      {/* ── Navbar ── */}
      <nav className={`navbar${scrolled ? ' navbar--scrolled' : ''}`}>
        <div className="navbar__brand">
          <span className="navbar__brand-line">TEMAN</span>
          <span className="navbar__brand-line navbar__brand-line--2">CUKUR</span>
        </div>
        <div className="navbar__right">
          <span className="navbar__location">Balikpapan</span>
          <button className="navbar__cta">Book now</button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero__bg" aria-hidden="true" />

        <div className="hero__inner">
          {/* Text block */}
          <div className="hero__text">
            <p className="hero__eyebrow ha ha-1">Barbershop · Est. 2024</p>
            <h1 className="hero__name">
              <span className="hero__name-word">
                <SplitWord text="Rifki" baseDelay={0.22} />
              </span>
              <em className="hero__name-word">
                <SplitWord text="Muhammad" baseDelay={0.52} step={0.036} />
              </em>
            </h1>
            <p className="hero__role ha ha-role">Barber · Balikpapan</p>
          </div>

          {/* Gallery */}
          <div
            ref={galleryRef}
            className={`hero__gallery${galleryInView ? ' hero__gallery--loaded' : ''}`}
          >
            {GALLERY.map(({ img, alt }, i) => (
              <div
                key={i}
                className={`hero__img-wrap hero__img-wrap--${i + 1}`}
                style={{ '--i': i }}
              >
                <img src={img} alt={alt} loading={i === 0 ? 'eager' : 'lazy'} />
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div className="hero__foot ha ha-foot">
            <p className="hero__tagline">Fresh cuts,<br />clean style.</p>
            <button className="hero__cta">Book now</button>
          </div>
        </div>
      </section>

      {/* ── Location ── */}
      <section
        ref={locationRef}
        className={`location reveal${locationInView ? ' in-view' : ''}`}
      >
        <div className="location__image-wrap">
          <img
            className="location__image"
            src="https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=900&h=1100&q=80"
            alt="teman cukur shop"
            loading="lazy"
          />
        </div>
        <div className="location__info">
          <p className="section-label">Location</p>
          <address className="location__address">
            Jalan Belakang Mall BB,<br />
            Damai, Balikpapan Selatan
          </address>
          <p className="location__hours">Mon – Sat &nbsp;·&nbsp; 09.00 – 20.00</p>
          <button className="location__cta">Book a session</button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        {/* Closing CTA — animates in on scroll */}
        <div
          ref={footerRef}
          className={`footer__cta-block${footerInView ? ' footer__cta-block--visible' : ''}`}
        >
          <p className="footer__statement">
            Walk in.<br /><em>Walk out fresh.</em>
          </p>
          <button className="footer__cta-btn">Book a session ↗</button>
        </div>

        <div className="footer__divider" />

        {/* Meta row */}
        <div className="footer__bottom">
          <div className="footer__info">
            {/* Small brand mark — same identity as navbar, footer scale */}
            <div className="footer__brand-mark">
              <span className="footer__bm-line">TEMAN</span>
              <span className="footer__bm-line footer__bm-line--2">CUKUR</span>
            </div>
            <span className="footer__meta">
              Balikpapan Selatan &nbsp;·&nbsp; Mon–Sat 09.00–20.00
            </span>
          </div>
          <div className="footer__links">
            <a
              href="https://www.tiktok.com/@rfkiimhmmd"
              target="_blank"
              rel="noopener noreferrer"
              className="footer__link"
            >TikTok</a>
            <a href="#" className="footer__link">Instagram</a>
          </div>
        </div>

        <p className="footer__copy">© 2026 Teman Cukur · Balikpapan</p>
      </footer>
    </>
  )
}

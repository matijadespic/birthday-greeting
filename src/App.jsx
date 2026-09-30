import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { content } from './content.js'
import {
  bindAmbientToUnlock,
  initAmbientBed,
  resumeAmbient,
  setAmbientVolume,
  stopAmbient,
} from './ambientBed.js'
import { SceneChrome } from './components/SceneChrome.jsx'
import { FireworksIntro } from './scenes/FireworksIntro.jsx'
import { LeaveWorries } from './scenes/LeaveWorries.jsx'
import { Cocktail } from './scenes/Cocktail.jsx'
import { LovedOnes } from './scenes/LovedOnes.jsx'
import { SingAndDance } from './scenes/SingAndDance.jsx'

const LAST_INDEX = 4
const NAV_LOCK_MS = 480
const COCKTAIL_INDEX = 2
const SING_INDEX = 4

const sceneVariants = {
  enter: { opacity: 0, y: 18 },
  center: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
}

function renderScene(index, goNext, onCocktailBridgeStart) {
  const { scenes, media } = content

  switch (index) {
    case 0:
      return (
        <FireworksIntro
          copy={scenes.fireworksIntro}
          recipientName={content.recipientName}
          videoSrc={media.fireworksVideo}
          onNext={goNext}
        />
      )
    case 1:
      return (
        <LeaveWorries
          copy={scenes.leaveWorries}
          media={media}
          onNext={goNext}
        />
      )
    case 2:
      return (
        <Cocktail
          copy={scenes.cocktail}
          media={media}
          onNext={goNext}
          onBridgeStart={onCocktailBridgeStart}
        />
      )
    case 3:
      return <LovedOnes copy={scenes.lovedOnes} onNext={goNext} />
    case 4:
      return <SingAndDance copy={scenes.singAndDance} />
    default:
      return null
  }
}

export default function App() {
  const [index, setIndex] = useState(0)
  const [sceneReady, setSceneReady] = useState(true)
  const reduceMotion = useReducedMotion()
  const liveRef = useRef(null)
  const navLock = useRef(false)
  const ambientStoppedRef = useRef(false)
  const isIntro = index === 0

  const withNavLock = useCallback((action) => {
    if (navLock.current) return
    navLock.current = true
    action()
    window.setTimeout(() => {
      navLock.current = false
    }, reduceMotion ? 320 : NAV_LOCK_MS)
  }, [reduceMotion])

  const goNext = useCallback(() => {
    withNavLock(() => setIndex((current) => Math.min(current + 1, LAST_INDEX)))
  }, [withNavLock])

  const goBack = useCallback(() => {
    withNavLock(() => setIndex((current) => Math.max(current - 1, 0)))
  }, [withNavLock])

  const onCocktailBridgeStart = useCallback(() => {
    ambientStoppedRef.current = true
    stopAmbient(content.ambient?.bridgeFadeMs ?? 1600)
  }, [])

  useEffect(() => {
    document.title = content.documentTitle
  }, [])

  useEffect(() => {
    initAmbientBed(content.media.septembarMusic || '')
    return bindAmbientToUnlock()
  }, [])

  useEffect(() => {
    const introVolume = content.ambient?.introVolume ?? 0.85
    const barVolume = content.ambient?.barVolume ?? 0.22

    if (index >= SING_INDEX) {
      // Dance scene owns Level Up; Septembar returns only on the closing credits.
      if (!ambientStoppedRef.current) {
        ambientStoppedRef.current = true
        stopAmbient(800)
      }
      return
    }

    if (ambientStoppedRef.current && index < SING_INDEX) {
      ambientStoppedRef.current = false
      resumeAmbient(index === COCKTAIL_INDEX ? barVolume : introVolume)
      return
    }

    if (index === COCKTAIL_INDEX) {
      setAmbientVolume(barVolume, 1100)
    } else {
      setAmbientVolume(introVolume, 800)
    }
  }, [index])

  useEffect(() => {
    setSceneReady(false)
    const id = window.setTimeout(
      () => setSceneReady(true),
      reduceMotion ? 320 : NAV_LOCK_MS,
    )
    return () => window.clearTimeout(id)
  }, [index, reduceMotion])

  useEffect(() => {
    const heading = document.querySelector('.scene-title')
    heading?.focus({ preventScroll: true })
    if (liveRef.current) {
      liveRef.current.textContent = `Scene ${index + 1} of ${LAST_INDEX + 1}`
    }
  }, [index])

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target.isContentEditable) {
        return
      }

      if (event.key === 'ArrowRight' && index < LAST_INDEX) {
        event.preventDefault()
        goNext()
      }

      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault()
        goBack()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, goBack, goNext])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#scene-stage">
        Skip to greeting
      </a>
      <p className="visually-hidden" aria-live="polite" ref={liveRef} />
      <SceneChrome
        hidden={isIntro}
        sceneIndex={index}
        sceneCount={LAST_INDEX + 1}
        progressLabel={content.nav.progressLabel}
        backLabel={content.nav.back}
        onBack={goBack}
      />
      <main id="scene-stage" className="scene-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className="scene-motion"
            variants={sceneVariants}
            initial="enter"
            animate="center"
            exit="exit"
            style={{ pointerEvents: sceneReady ? 'auto' : 'none' }}
            onAnimationStart={() => setSceneReady(false)}
            onAnimationComplete={() => setSceneReady(true)}
            transition={
              reduceMotion
                ? { duration: 0.01 }
                : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }
            }
          >
            {renderScene(index, goNext, onCocktailBridgeStart)}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

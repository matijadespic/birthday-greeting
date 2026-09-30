import { useEffect, useState } from 'react'

function Placeholder({ label, kind = 'image', className = '', decorative = false }) {
  if (decorative) {
    return <div className={`media-placeholder is-atmosphere ${className}`} aria-hidden="true" />
  }

  return (
    <div className={`media-placeholder ${className}`} role="img" aria-label={label}>
      <span className="media-placeholder-kind">{kind === 'video' ? 'Video' : 'Photo'}</span>
      <span className="media-placeholder-label">{label}</span>
    </div>
  )
}

function useLocalMedia(src, type) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)

    if (!src) {
      return undefined
    }

    if (type === 'image') {
      const probe = new Image()
      probe.onload = () => {
        if (!cancelled) setReady(true)
      }
      probe.onerror = () => {
        if (!cancelled) setReady(false)
      }
      probe.src = src
      return () => {
        cancelled = true
        probe.onload = null
        probe.onerror = null
      }
    }

    const probe = document.createElement('video')
    const onOk = () => {
      if (!cancelled) setReady(true)
    }
    const onErr = () => {
      if (!cancelled) setReady(false)
    }
    probe.addEventListener('loadeddata', onOk)
    probe.addEventListener('error', onErr)
    probe.preload = 'metadata'
    probe.src = src
    return () => {
      cancelled = true
      probe.removeEventListener('loadeddata', onOk)
      probe.removeEventListener('error', onErr)
      probe.src = ''
    }
  }, [src, type])

  return Boolean(src) && ready
}

export function SafeImage({
  src,
  alt,
  className = '',
  decorative = false,
  placeholderLabel,
  objectPosition,
}) {
  const ready = useLocalMedia(src, 'image')
  const style = objectPosition ? { objectPosition } : undefined

  if (!ready) {
    return (
      <Placeholder
        label={placeholderLabel || alt}
        kind="image"
        className={className}
        decorative={decorative}
      />
    )
  }

  return (
    <img
      className={`safe-image ${className}`}
      src={src}
      alt={decorative ? '' : alt}
      style={style}
    />
  )
}

export function SafeVideo({ src, caption, className = '' }) {
  const ready = useLocalMedia(src, 'video')

  if (!ready) {
    return <Placeholder label={caption} kind="video" className={className} />
  }

  return (
    <video
      className={`safe-video ${className}`}
      src={src}
      controls
      playsInline
      preload="metadata"
    >
      {caption}
    </video>
  )
}

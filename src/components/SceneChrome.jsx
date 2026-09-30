export function SceneChrome({
  hidden,
  sceneIndex,
  sceneCount,
  progressLabel,
  backLabel,
  onBack,
}) {
  if (hidden) {
    return null
  }

  const current = sceneIndex + 1

  return (
    <header className="scene-chrome">
      <button type="button" className="back-button" onClick={onBack}>
        {backLabel}
      </button>
      <div
        className="progress"
        role="progressbar"
        aria-label={progressLabel}
        aria-valuemin={1}
        aria-valuemax={sceneCount}
        aria-valuenow={current}
        aria-valuetext={`Scene ${current} of ${sceneCount}`}
      >
        {Array.from({ length: sceneCount }, (_, i) => (
          <span
            key={i}
            className={`progress-dot${i === sceneIndex ? ' is-current' : ''}${i < sceneIndex ? ' is-done' : ''}`}
          />
        ))}
      </div>
    </header>
  )
}

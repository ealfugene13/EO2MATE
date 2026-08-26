export default function EO2MateLogo({ compact = false, className = "" }) {
  return (
    <div className={`eo2mate-logo ${compact ? "compact" : ""} ${className}`.trim()}>
      <div className="eo2mate-wordmark" aria-label="EO2MATE">
        <span className="eo2mate-letter">E</span>

        <span className="eo2mate-code-o" aria-hidden="true">
          <span className="eo2mate-code">&lt;/&gt;</span>
        </span>

        <span className="eo2mate-two">2</span>

        {!compact && (
          <>
            <span className="eo2mate-letter eo2mate-m">M</span>
            <span className="eo2mate-letter eo2mate-a">
              A
              <span className="eo2mate-a-dot" aria-hidden="true" />
            </span>
            <span className="eo2mate-letter">T</span>
            <span className="eo2mate-letter">E</span>
          </>
        )}
      </div>

      {!compact && (
        <div className="eo2mate-tagline" aria-hidden="true">
          <span className="eo2mate-tagline-line" />
          <span className="eo2mate-tag-bracket">&lt;</span>
          <span>LET&apos;S AUTO,</span>
          <strong>MATE.</strong>
          <span className="eo2mate-tag-bracket">/&gt;</span>
          <span className="eo2mate-tagline-line" />
        </div>
      )}
    </div>
  );
}

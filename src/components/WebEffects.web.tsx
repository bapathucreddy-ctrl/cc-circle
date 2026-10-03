import React from 'react';
export default function WebEffects(){return <style>{`
 [data-testid="talent-card"], [data-testid="profession-card"] {transition:transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;box-shadow:0 5px 18px rgba(85,76,65,.07)}
 [data-testid="portfolio-cover"] {transition:transform 240ms ease}
 [data-testid="talent-card"]:hover, [data-testid="talent-card"]:focus-within, [data-testid="profession-card"]:hover, [data-testid="profession-card"]:focus-visible {box-shadow:0 14px 28px rgba(85,76,65,.16)}
 @media(prefers-reduced-motion:reduce){[data-testid="talent-card"], [data-testid="profession-card"], [data-testid="portfolio-cover"] {transition:none!important;transform:none!important}}
 `}</style>}

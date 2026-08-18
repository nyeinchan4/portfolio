// Shared Tailwind config — included on every page
tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "outline": "#76777d", "tertiary-fixed-dim": "#b7c8e1",
        "primary-container": "#131b2e", "on-surface-variant": "#45464d",
        "background": "#f7f9fb", "on-surface": "#191c1e", "secondary": "#0058be",
        "inverse-on-surface": "#eff1f3", "surface-container": "#eceef0",
        "on-tertiary-container": "#75859d", "inverse-surface": "#2d3133",
        "surface-container-lowest": "#ffffff", "on-primary": "#ffffff",
        "secondary-fixed": "#d8e2ff", "surface-container-highest": "#e0e3e5",
        "surface": "#f7f9fb", "primary-fixed": "#dae2fd", "primary": "#000000",
        "secondary-container": "#2170e4", "tertiary": "#000000",
        "error": "#ba1a1a", "on-error": "#ffffff", "on-secondary": "#ffffff",
        "surface-container-high": "#e6e8ea", "on-primary-container": "#7c839b",
        "surface-bright": "#f7f9fb", "surface-variant": "#e0e3e5",
        "outline-variant": "#c6c6cd", "primary-fixed-dim": "#bec6e0",
        "secondary-fixed-dim": "#adc6ff", "tertiary-container": "#0b1c30",
        "surface-container-low": "#f2f4f6", "surface-dim": "#d8dadc",
        "on-secondary-container": "#fefcff", "on-background": "#191c1e",
        "on-primary-fixed": "#131b2e", "on-tertiary-fixed": "#0b1c30",
        "on-tertiary": "#ffffff", "tertiary-fixed": "#d3e4fe",
        "on-secondary-fixed": "#001a42", "inverse-primary": "#bec6e0",
        "surface-tint": "#565e74", "on-primary-fixed-variant": "#3f465c",
        "on-tertiary-fixed-variant": "#38485d", "on-secondary-fixed-variant": "#004395",
        "error-container": "#ffdad6", "on-error-container": "#93000a"
      },
      borderRadius: { "DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem" },
      spacing: {
        "container-max": "1120px", "stack-gap-md": "16px",
        "stack-gap-sm": "8px", "margin-mobile": "16px",
        "gutter": "24px", "section-gap": "80px"
      },
      fontFamily: {
        "headline-md": ["Geist"], "display-lg": ["Geist"],
        "headline-sm": ["Geist"], "body-lg": ["Inter"],
        "label-code": ["JetBrains Mono"], "body-md": ["Inter"],
        "headline-lg-mobile": ["Geist"]
      },
      fontSize: {
        "headline-md": ["32px", { lineHeight: "1.2", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-sm": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "label-code": ["14px", { lineHeight: "1.4", fontWeight: "500" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "headline-lg-mobile": ["32px", { lineHeight: "1.2", fontWeight: "700" }]
      }
    }
  }
}

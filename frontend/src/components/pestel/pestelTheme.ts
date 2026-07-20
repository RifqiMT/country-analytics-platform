/** Header + content tint per PESTEL pillar (professional, distinct, non-purple default). */
export const PESTEL_DIMENSION_STYLES: Record<string, { header: string; tint: string }> = {
  POLITICAL: { header: "#0f766e", tint: "#f0fdfa" },
  ECONOMIC: { header: "#334155", tint: "#f8fafc" },
  SOCIOCULTURAL: { header: "#b45309", tint: "#fffbeb" },
  TECHNOLOGICAL: { header: "#0369a1", tint: "#f0f9ff" },
  ENVIRONMENTAL: { header: "#15803d", tint: "#f0fdf4" },
  LEGAL: { header: "#57534e", tint: "#fafaf9" },
};

export const SWOT_STYLES = {
  strengths: { header: "#0f766e", tint: "#f0fdfa", title: "Strengths" },
  weaknesses: { header: "#b45309", tint: "#fffbeb", title: "Weaknesses" },
  opportunities: { header: "#0369a1", tint: "#f0f9ff", title: "Opportunities" },
  threats: { header: "#b91c1c", tint: "#fef2f2", title: "Threats" },
} as const;

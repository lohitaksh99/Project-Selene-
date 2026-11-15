export const GalaxyVertexShader = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aTwinkleSpeed;
  attribute float aBrightness;

  uniform float uTime;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vColor = aColor;

    // Twinkle modulation
    float twinkle = sin(uTime * aTwinkleSpeed + position.x * 5.0) * 0.35 + 0.65;
    vAlpha = aBrightness * twinkle;

    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;

    // Size attenuation based on distance to camera
    gl_PointSize = aSize * uPixelRatio * (280.0 / -viewPosition.z);
    gl_PointSize = max(gl_PointSize, 1.2);
  }
`;

export const GalaxyFragmentShader = /* glsl */ `
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Distance from center of point sprite to create soft glowing circular star particle
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    // Soft Gaussian-like glow falloff
    float strength = pow(1.0 - (dist * 2.0), 2.2);

    gl_FragColor = vec4(vColor, vAlpha * strength * uOpacity);
  }
`;

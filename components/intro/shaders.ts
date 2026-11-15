export const AtmosphereVertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const AtmosphereFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uCoefficient;
  uniform float uPower;

  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = dot(viewDir, vNormal);
    fresnel = clamp(fresnel, 0.0, 1.0);
    float intensity = pow(1.0 - fresnel, uPower) * uCoefficient;

    gl_FragColor = vec4(uColor, intensity);
  }
`;

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

    float twinkle = sin(uTime * aTwinkleSpeed + position.x * 5.0) * 0.35 + 0.65;
    vAlpha = aBrightness * twinkle;

    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;

    gl_Position = projectedPosition;

    gl_PointSize = aSize * uPixelRatio * (280.0 / max(1.0, -viewPosition.z));
    gl_PointSize = max(gl_PointSize, 1.2);
  }
`;

export const GalaxyFragmentShader = /* glsl */ `
  uniform float uOpacity;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float dist = distance(gl_PointCoord, vec2(0.5));
    if (dist > 0.5) discard;

    float strength = pow(1.0 - (dist * 2.0), 2.2);

    gl_FragColor = vec4(vColor, vAlpha * strength * uOpacity);
  }
`;

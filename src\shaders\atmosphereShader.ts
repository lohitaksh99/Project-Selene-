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
    // View vector from camera to fragment
    vec3 viewDir = normalize(-vPosition);
    
    // Fresnel limb darkening factor
    float fresnel = dot(viewDir, vNormal);
    fresnel = clamp(fresnel, 0.0, 1.0);
    float intensity = pow(1.0 - fresnel, uPower) * uCoefficient;

    gl_FragColor = vec4(uColor, intensity);
  }
`;

export const SunCoronaVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const SunCoronaFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColorCore;
  uniform vec3 uColorCorona;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float fresnel = pow(1.0 - abs(dot(viewDir, vNormal)), 3.0);

    // Pulsating coronal plasma streams
    float noiseWave = sin(vUv.x * 20.0 + uTime * 2.5) * cos(vUv.y * 20.0 - uTime * 1.8) * 0.15;
    float intensity = clamp(fresnel + noiseWave, 0.0, 1.0);

    vec3 finalColor = mix(uColorCore, uColorCorona, fresnel);
    gl_FragColor = vec4(finalColor, intensity * 0.85);
  }
`;

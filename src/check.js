import * as THREE from 'three';
	
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.getContext(); // Ensure context is created
document.body.appendChild(renderer.domElement);

// Ensure WebGL2 context:
if (renderer.capabilities.isWebGL2 === false) {
    console.warn("WebGL2 not supported.");
}

// Create a multi-target render texture with 2 outputs
const width = 256, height = 256;
var renderTarget = new THREE.WebGLRenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: THREE.FloatType, // Use FloatType for simulations
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    count: 2
});

// Simple full-screen quad
const geometry = new THREE.PlaneGeometry(2, 2);
const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `#version 300 es
    in vec3 position;
    void main() {
    gl_Position = vec4(position, 1.0);
    }`,
    fragmentShader: `#version 300 es
    precision highp float;

    layout(location = 0) out vec4 outColor0;
    layout(location = 1) out vec4 outColor1;

    void main() {
    // Output red to the first target
    outColor0 = vec4(1.0, 0.0, 0.0, 1.0);
    // Output green to the second target
    outColor1 = vec4(0.0, 1.0, 0.0, 1.0);
    }`
});

const quad = new THREE.Mesh(geometry, material);
const scene = new THREE.Scene();
scene.add(quad);

// Use a camera that covers the full screen quad
const camera = new THREE.Camera();

// Render to the multiple render targets
renderer.setRenderTarget(renderTarget);
renderer.render(scene, camera);
renderer.setRenderTarget(null);

// At this point, renderTarget.texture[0] contains the red image,
// and renderTarget.texture[1] contains the green image.
// You can use these textures elsewhere as needed.

console.log("First target texture:", renderTarget.texture[0]);
console.log("Second target texture:", renderTarget.texture[1]);
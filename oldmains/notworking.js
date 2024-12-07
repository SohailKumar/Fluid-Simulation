import * as THREE from 'three';
import Stats from 'stats.js';

//CREATE STATS PAGE
var stats = new Stats();
stats.setMode(0);
stats.domElement.style.position = "absolute";
stats.domElement.style.left = "5px";
stats.domElement.style.top = "5px";
document.body.appendChild(stats.domElement);

function getRenderWidth() {
    return window.innerWidth; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight; // Adjust based on your needs
}

////////////
/// Set up scene, camera, and renderer
////////////
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1.62, 1.62, 1, -1, -10, 10); //vars: left right top bottom near far
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
renderer.setSize(getRenderWidth(), getRenderHeight());
renderer.setClearColor(0xFF9900)
document.body.prepend(renderer.domElement);

const geo = new THREE.PlaneGeometry(2, 2);
const textureA = new THREE.WebGLRenderTarget(getRenderWidth(), getRenderHeight());
const textureB = new THREE.WebGLRenderTarget(getRenderWidth(), getRenderHeight());

vertexShader = `varying vec2 vUv;
void main() {
    vUv = uv; // Pass UV to the fragment shader
    gl_Position = vec4(position, 1.0);
}`

const shaderMaterial1 = new THREE.ShaderMaterial({
    uniforms: {
        previousTexture: { value: textureA.texture }
    },
    vertexShader: vertexShader,
    fragmentShader: `varying vec2 vUv;
uniform sampler2D previousTexture;

void main() {
    vec4 color = texture2D(previousTexture, vUv);
    gl_FragColor = vec4(1.0 - color.rgb, 1.0); // Invert colors
}`
});

const shaderMaterial2 = new THREE.ShaderMaterial({
    uniforms: {
        previousTexture: { value: textureB.texture }
    },
    vertexShader: vertexShader,
    fragmentShader: `varying vec2 vUv;
uniform sampler2D previousTexture;

void main() {
    vec4 color = texture2D(previousTexture, vUv);
    gl_FragColor = vec4(color.g, color.b, color.r, 1.0); // Shift color channels
}`
});

const mesh = new THREE.Mesh(geo, shaderMaterial1);
scene.add( mesh );

let ping = true; // Start with textureA as the initial texture
function animate() {
    // Step 1: Render to the first texture (initial condition)
    renderer.setRenderTarget(textureA);
    renderer.render(scene, camera);

    // Step 2: Ping-pong the textures
    for (let i = 0; i < 10; i++) {
        // Select the target texture based on the ping state
        renderer.setRenderTarget(ping ? textureB : textureA);
        
        // Select the appropriate shader material based on the texture we're using
        mesh.material = ping ? shaderMaterial2 : shaderMaterial1;
        
        // Render the scene with the selected shader material
        renderer.render(scene, camera);
        
        // Toggle the ping state for the next pass
        ping = !ping;
    }

    // Step 3: Final render to screen (visualize result)
    renderer.setRenderTarget(null); // Render to the default framebuffer
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
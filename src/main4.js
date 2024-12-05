import * as THREE from 'three';
import Stats from 'stats.js';

var stats;
var scene;
var camera;

////////////
/// Set up for stats
////////////
function setupStats(){
    stats = new Stats();
    stats.setMode(0);
    stats.domElement.style.position = "absolute";
    stats.domElement.style.left = "5px";
    stats.domElement.style.top = "5px";
    document.body.appendChild(stats.domElement);
}

function getRenderWidth() {
    return window.innerWidth; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight; // Adjust based on your needs
}

function setupScene(){
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1.62, 1.62, 1, -1, -10, 10); //vars: left right top bottom near far
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
    renderer.setSize(getRenderWidth(), getRenderHeight());
    renderer.setClearColor(0xFF9900)
    document.body.prepend(renderer.domElement);
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

// const vertexShader = loadShader('/shaders/vertexShader.glsl');
// const fragmentShader = loadShader('/shaders/fragmentShader.glsl');    
const geo = new THREE.PlaneGeometry(2,2)
const lbmMaterial = new THREE.ShaderMaterial({
    uniforms: {
        // Define your uniforms here
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2() },
        u_texture: { value: null }
    },
    vertexShader: `
        varying vec2 vUv;

        void main()
        {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float u_time;
        uniform vec2 u_resolution;
        uniform sampler2D u_texture;

        varying vec2 vUv;

        void main() {
        // Implement LBM algorithm here
        // Example: Simple fluid movement
        vec2 st = gl_FragCoord.xy / u_resolution;
        vec2 uv = vUv + 0.1 * vec2(cos(u_time), sin(u_time));
        vec4 color = texture2D(u_texture, uv);
        
        gl_FragColor = color;
        }
    `
})

const textureSize = 256;
const data = new Uint8Array(4 * textureSize * textureSize);
for (let i = 0; i < data.length; i += 4) {
  data[i] = Math.random() * 255;
  data[i + 1] = Math.random() * 255;
  data[i + 2] = Math.random() * 255;
  data[i + 3] = 255;
}
const texture = new THREE.DataTexture(data, textureSize, textureSize, THREE.RGBAFormat);
texture.needsUpdate = true;

lbmMaterial.uniforms.u_texture.value = texture;

const mesh = new THREE.Mesh(geo, lbmMaterial);
scene.add( mesh );


function animate() {
    stats.begin()
    requestAnimationFrame(animate);

    lbmMaterial.uniforms.u_time.value += 0.05;
    lbmMaterial.uniforms.u_resolution.value.set(window.innerWidth, window.innerHeight);

    renderer.render(scene, camera);
    stats.end()
}

setupStats();
animate();
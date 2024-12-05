//the one with shaders

import * as THREE from 'three';
import Stats from 'stats.js';

// Define functions to get current render dimensions
function getRenderWidth() {
    return window.innerWidth; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight; // Adjust based on your needs
}

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1.62, 1.62, 1, -1, -10, 10); //vars: left right top bottom near far
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
renderer.setSize(getRenderWidth(), getRenderHeight());
renderer.setClearColor(0xFF9900)
document.body.prepend(renderer.domElement);

const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 1.0 },
            resolution: { value: new THREE.Vector2() }
        },
        vertexShader: `
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            varying vec2 vUv;

            void main() {
                gl_FragColor = vec4(vUv.x, vUv.y, 1.0, 1.0);
            }
        `
    })
);

scene.add( mesh );


// Render loop
function animate() {
    renderer.render(scene, camera); // Render the current frame
    thing += 1;
}
renderer.setAnimationLoop(animate); // Automatically calls animate in a loop


import * as THREE from 'three';
import Stats from 'stats.js';
import GUI from 'lil-gui';
import * as tf from '@tensorflow/tfjs';

// Define functions to get current render dimensions
function getRenderWidth() {
    return window.innerWidth; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight; // Adjust based on your needs
}
console.log(getRenderWidth(), getRenderHeight());

// Set up scene, camera, and renderer
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); //vars: left right top bottom near far
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
renderer.setSize(getRenderWidth(), getRenderHeight());
renderer.setClearColor(0xFF9900)
document.body.prepend(renderer.domElement);

const gl = renderer.getContext();
console.log(gl.getError());

//CREATE STATS PAGE
var stats = new Stats();
stats.setMode(0);
stats.domElement.style.position = "absolute";
stats.domElement.style.left = "5px";
stats.domElement.style.top = "5px";
document.body.appendChild(stats.domElement);
function thing(){
    "use strict";

    // Placeholder texture data (a simple gradient)
    const size = 128;
    const data = new Uint8Array(size * size * 3); // RGB format (3 channels)

    // Fill the array with gradient data
    for (let i = 0; i < size * size; i++) {
        data[i * 3] = (i % size) * 2;       // Red channel (gradient)
        data[i * 3 + 1] = (i % size) * 2;   // Green channel (gradient)
        data[i * 3 + 2] = 255;              // Blue channel (constant)
    }

    // Create DataTexture
    const texture = new THREE.DataTexture(
        data,                 // Texture data
        size,                 // Width
        size,                 // Height
        THREE.RGBFormat,      // Format (RGB, 3 channels)
        THREE.UnsignedByteType // Type (Uint8Array data)
    );

    // Disable mipmapping and set filters
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;

    // Use the texture in the material
    const material = new THREE.MeshBasicMaterial({ map: texture });
    
    // const streamMaterial = new THREE.ShaderMaterial({
    //     uniforms: {
    //         f_i: { value: fTexture },
    //         gridSize: { value: new THREE.Vector2(gridSize, gridSize) },
    //     },
    //     vertexShader: /* GLSL vertex shader */,
    //     fragmentShader: `
    //         precision highp float;
    //         uniform sampler2D f_i;
    //         uniform vec2 gridSize;
    
    //         void main() {
    //             vec2 coord = gl_FragCoord.xy / gridSize;
    //             vec4 f = texture2D(f_i, coord);
    //             // Compute streaming logic
    //             gl_FragColor = result;
    //         }
    //     `,
    // });

    // const quad = new THREE.PlaneBufferGeometry(2 * (grid.size.x - 2) / grid.size.x, 2 * (grid.size.y - 2) / grid.size.y);
    const geometry = new THREE.PlaneGeometry(2, 2) // fill screen

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

}

thing()

// function createBase(fragmentShader, uniforms, grid){
//     "use strict";
//     var geometry = new THREE.PlaneBufferGeometry(2 * (grid.size.x - 2) / grid.size.x, 2 * (grid.size.y - 2) / grid.size.y);
//     var material = new THREE.ShaderMaterial({
//         uniforms: uniforms,
//         fragmentShader: fs,
//         depthWrite: false,
//         depthTest: false,
//         blending: THREE.NoBlending
//     });
//     var quad = new THREE.Mesh(geometry, material);
    
//     scene.add(quad)

// }

// function createGrid(){
//     var grid = {
//         size: new THREE.Vector2(512, 256),
//         scale: 1,
//         applyBoundaries: true  
//     };
// }


// Render loop
function animate() {
    renderer.render(scene, camera); // Render the current frame
}
renderer.setAnimationLoop(animate); // Automatically calls animate in a loop
//
//DOES THE SAME THING BUT EXPLICITLY
// function animate() {
//     requestAnimationFrame(animate); //schedules the next animation
//     renderer.render(scene, camera);
// }
// animate(); //calling the first animate
///////////////////////////////////////////
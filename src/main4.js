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

async function loadShader(path) {
    return (await fetch(path)).text();
};

async function logShaderContent() {
    const shaderText = await loadShader('/shaders/vertexShader.glsl');
    console.log(shaderText);
}

logShaderContent();
// Render loop
function animate() {
    stats.begin();
    renderer.render(scene, camera); // Render the current frame
    stats.end(); // End measuring frame
}

// async function init(){  
//     // const vertexShader = loadShader('/shaders/vertexShader.glsl');
//     // const fragmentShader = loadShader('/shaders/fragmentShader.glsl');    

//     const mesh = new THREE.Mesh(
//         new THREE.PlaneGeometry(2,2),
//         new THREE.ShaderMaterial( {
//             uniforms: {
//                 time: { value: 1.0 },
//                 resolution: { value: new THREE.Vector2() }
//             },
        
//             vertexShader: vertexShader,
//             fragmentShader: fragmentShader
        
//         } )
//     )
//     scene.add( mesh );

//     renderer.setAnimationLoop(animate);// Automatically calls animate in a loop
// }

// init();
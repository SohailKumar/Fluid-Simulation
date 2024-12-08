

import * as THREE from 'three';
import Stats from 'stats.js';
import GUI from 'lil-gui';

////////////
/// Set up for stats
////////////
var stats;

function setupStats() {
    stats = new Stats();
    stats.setMode(0);
    stats.domElement.style.position = "absolute";
    stats.domElement.style.left = "5px";
    stats.domElement.style.top = "5px";
    document.body.appendChild(stats.domElement);
}

setupStats();

function getRenderWidth() {
    return window.innerWidth; // Adjust based on your needs
}

function getRenderHeight() {
    return window.innerHeight; // Adjust based on your needs
}

////////////////////////
/// global params
////////////////////////
const geoWidth = 2;
const geoHeight = 2;
const resolution = 128; // Adjust resolution as needed

const params = {
    isSimRunning: false,
    step : function(){
        params.isSimRunning = true;
        params.isSingleStep = true;
    }
}

const gui = new GUI();

gui.add( params, 'isSimRunning' );
gui.add( params, 'step' );
gui.open();

////////////////////////
/// Set up scene(main and buffer), camera, and renderer
////////////////////////
var camera;
var renderer;
var geo;

var displayScene;
var displayMaterial;
var displayMesh;

var bufferScene;
// var bufferMaterial;
var bufferMesh;

var rt1;
var rt2;
var currentRT;
var nextRT;

var boundaryTexture;
function createBoundaryMask(){
    const width = resolution;
    const height = resolution;
    const data = new Float32Array(width * height * 4);

    // Set edge pixels to blue (R = 0, G = 0, B = 1, A = 1)
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            
            // Left edge (x = 0)
            if (x === 0) {
                data[index] = 0;     // Red
                data[index + 1] = 0; // Green
                data[index + 2] = 1; // Blue
                data[index + 3] = 1; // Alpha
            }
            // Right edge (x = width - 1)
            else if (x === width - 1) {
                data[index] = 0;     // Red
                data[index + 1] = 0; // Green
                data[index + 2] = 1; // Blue
                data[index + 3] = 1; // Alpha
            }
            // Top edge (y = 0)
            else if (y === 0) {
                data[index] = 0;     // Red
                data[index + 1] = 0; // Green
                data[index + 2] = 1; // Blue
                data[index + 3] = 1; // Alpha
            }
            // Bottom edge (y = height - 1)
            else if (y === height - 1) {
                data[index] = 0;     // Red
                data[index + 1] = 0; // Green
                data[index + 2] = 1; // Blue
                data[index + 3] = 1; // Alpha
            }
        }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
}

function createInitialTexture() {
    const width = resolution;
    const height = resolution;

    const data = new Float32Array(width * height * 4);  // RGBA for each pixel

    // Create the initial texture (red color)
    for (let i = 0; i < width * height; i++) {
        data[i * 4 + 0] = Math.random();  // Red channel
        data[i * 4 + 1] = 0.0;  // Green channel
        data[i * 4 + 2] = 0.0;  // Blue channel
        data[i * 4 + 3] = 1.0;  // Alpha channel (opaque)
    }

    // Create the boundary texture (this assumes createBoundaryMask() is defined already)
    const boundaryTexture = createBoundaryMask();

    // Overlay boundary texture onto initial texture
    const boundaryData = boundaryTexture.image.data;

    for (let i = 0; i < width * height; i++) {
        const index = i * 4;

        const r1 = data[index + 0];  // Initial Red
        const g1 = data[index + 1];  // Initial Green
        const b1 = data[index + 2];  // Initial Blue
        const a1 = data[index + 3];  // Initial Alpha

        const r2 = boundaryData[index + 0];  // Boundary Red
        const g2 = boundaryData[index + 1];  // Boundary Green
        const b2 = boundaryData[index + 2];  // Boundary Blue
        const a2 = boundaryData[index + 3];  // Boundary Alpha

        // Simple blending, using boundary texture's alpha channel for interpolation
        const alpha = a2; // You can modify this if you want a different blend effect

        // Blend the colors
        data[index + 0] = r1 * (1 - alpha) + r2 * alpha;  // Red channel blend
        data[index + 1] = g1 * (1 - alpha) + g2 * alpha;  // Green channel blend
        data[index + 2] = b1 * (1 - alpha) + b2 * alpha;  // Blue channel blend
        data[index + 3] = a1 * (1 - alpha) + a2 * alpha;  // Alpha channel blend
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;

    return texture;
}

function setupScene() {
    // same across scenes
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
    const size = Math.min(getRenderWidth(), getRenderHeight());
    renderer.setSize(size, size);
    renderer.setClearColor('black', 1)

    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000); //vars: left right top bottom near far //TODO: might need to change camera width and heigh to screen width and height. update those every frame if so.
    camera.position.z = 2;

    geo = new THREE.PlaneGeometry(geoWidth, geoHeight);

    //display scene stuff
    displayScene = new THREE.Scene();
    displayMaterial = new THREE.MeshBasicMaterial({ map: null }); // map will be replaced w the right texture later
    displayMesh = new THREE.Mesh(geo, displayMaterial)
    displayScene.add(displayMesh);

    //buffer stuff  
    bufferScene = new THREE.Scene();
    //no buffer material because we'll assign it dynamically
    bufferMesh = new THREE.Mesh(geo, null);
    bufferScene.add(bufferMesh);

    rt1 = new THREE.WebGLRenderTarget(resolution, resolution, {
        format: THREE.RGBAFormat,
        type: THREE.FloatType, // Use FloatType for simulations
        magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearFilter
    });

    rt2 = new THREE.WebGLRenderTarget(resolution, resolution, {
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        magFilter: THREE.LinearFilter,
        minFilter: THREE.LinearFilter
    });

    rt1.texture = createInitialTexture();

    currentRT = rt1;
    nextRT = rt2;
}
setupScene();

////////////////////////
/// Set up shaders
////////////////////////

// var vertexShader;
var shadersDict = {};

function setupShaders(){
    const shaderMultiply = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: null },
        },
        fragmentShader: document.getElementById('multiply').innerHTML
    });
    shadersDict["shaderMultiply"] = shaderMultiply;

    const shaderInvert = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: null },
        },
        fragmentShader: document.getElementById('invert').innerHTML
    });
    shadersDict["shaderInvert"] = shaderInvert;

    const boundaryMaskShader = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: null },
            uBoundary: { value: boundaryTexture}
            // Add more uniforms for velocity, density, etc.
        },
        // vertexShader: `...`,  // TODO: might need a Pass-through vertex shader
        fragmentShader: document.getElementById('boundary').innerHTML
    });
    shadersDict["boundaryMaskShader"] = boundaryMaskShader;
}
setupShaders();

function simulateSingleShader(name){
    //run shader
    let shader = shadersDict[name]
    bufferMesh.material = shadersDict[name]; // here is where we dynamically assign the material
    shader.uniforms.uTexture.value = currentRT.texture;

    //render to buffer scene
    renderer.setRenderTarget(nextRT);
    renderer.render(bufferScene, camera);

    //swap buffers
    [currentRT, nextRT] = [nextRT, currentRT];
}

function simulateAll(){
    // simulateSingleShader("shaderMultiply");
    // simulateSingleShader("shaderInvert");
    simulateSingleShader("boundaryMaskShader");
    simulateSingleShader("collisionShader");
    simulateSingleShader("streamingShader");
    simulateSingleShader("boundaryShader");
    //final output in currentRT since the last target was nextRT and it's data was moved to currentRT
}

function displayInitial(){
    displayMesh.material.map = currentRT.texture;
    // reset to screen framebuffer.
    renderer.setRenderTarget(null);
    renderer.render(displayScene, camera);
}
displayInitial();

function render() {
    stats.begin();

    if(params.isSimRunning){
        simulateAll();

        displayMesh.material.map = currentRT.texture;

        // reset to screen framebuffer.
        renderer.setRenderTarget(null);
        renderer.render(displayScene, camera);

        if(params.isSingleStep == true){
            params.isSimRunning = false;
            params.isSingleStep = false;
        }
    }

    stats.end();
    requestAnimationFrame(render);

}
render();

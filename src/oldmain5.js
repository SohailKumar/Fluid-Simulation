

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

function createInitialTexture() {
    const width = resolution;
    const height = resolution;

    const data = new Float32Array(width * height * 4);  // RGBA for each pixel

    for (let i = 0; i < width * height; i++) {
        data[i * 4 + 0] = 1.0;  // Initial density in Red channel
        data[i * 4 + 1] = 0.0;  // Green channel
        data[i * 4 + 2] = 0.0;  // Blue channel
        data[i * 4 + 3] = 1.0;  // Alpha channel (opaque)
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
}

function setupScene() {
    // same across scenes
    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
    renderer.setSize(getRenderWidth(), getRenderHeight());
    renderer.setClearColor('gray', 1)

    camera = new THREE.OrthographicCamera(-1.5, 1.5, 1, -1, 1, 1000); //vars: left right top bottom near far //TODO: might need to change camera width and heigh to screen width and height. update those every frame if so.
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
        fragmentShader: document.getElementById('multiply').innerHTML
    });
    shadersDict["shaderInvert"] = shaderInvert;
    
    const collisionShader = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: currentRT.texture },
            uOmega: { value: 1.0 },
            uGridSize: { value: new THREE.Vector2(resolution, resolution) }
        },
        fragmentShader: document.getElementById('collision').innerHTML
    });
    shadersDict["collisionShader"] = collisionShader;

    const streamingShader = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: currentRT.texture },
            uGridSize: { value: new THREE.Vector2(resolution, resolution) }
        },
        fragmentShader: document.getElementById('streaming').innerHTML
    });
    shadersDict["streamingShader"] = streamingShader;
}
    

async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

async function loadAllShaders() {
    const multiplyShaderCode = await loadShader('./shaders/multiply.fs');
    document.getElementById('multiply').innerHTML = multiplyShaderCode;
    
    const invertShaderCode = await loadShader('./shaders/invert.fs');
    document.getElementById('invert').innerHTML = invertShaderCode;

    const collisionShaderCode = await loadShader('./shaders/collision.fs');
    document.getElementById('collision').innerHTML = collisionShaderCode;

    const streamingShaderCode = await loadShader('./shaders/streaming.fs');
    document.getElementById('streaming').innerHTML = streamingShaderCode;

    setupShaders();

    // render(); 
}

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

//SIMULATION AND RENDERING
function simulateAll(){
    simulateSingleShader("shaderMultiply");
    simulateSingleShader("shaderInvert");
    // simulateSingleShader("collisionShader");
    // simulateSingleShader("streamingShader");
    //final output in currentRT since the last target was nextRT and it's data was moved to currentRT
}

function render() {
    stats.begin();
    if(params.isSimRunning){
        simulateAll();

        displayMesh.material.map = currentRT.texture;
        displayMesh.material.needsUpdate = true;

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
//wait until all shaders loaded to start rendering.
loadAllShaders().then(() => {
    render();
}).catch((error) => {
    console.error("Error loading shaders:", error);
});

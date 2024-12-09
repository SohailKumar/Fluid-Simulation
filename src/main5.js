

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

// Function to create a boundary mask where alpha is 0 at the edges and 1 elsewhere
function createBoundaryMask() {
    const width = resolution;
    const height = resolution;
    const data = new Float32Array(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;

            // Check if the current pixel is on the boundary
            const isBoundary = x === 0 || x === width - 1 || y === 0 || y === height - 1;

            // Randomize RGB values
            data[index] = Math.random();       // Red
            data[index + 1] = Math.random();   // Green
            data[index + 2] = Math.random();   // Blue

            // Set alpha to 0 for boundaries, 1 otherwise
            data[index + 3] = isBoundary ? 0.0 : 1.0;
        }
    }

    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
}

// Function to create an initial texture and blend with the boundary mask
function createInitialTexture() {
    const size = 128;
    const depth = 2; // Depth is set to 2 instead of size (to create a size * size * 2 texture)
    
    // Create an array to hold the texture data: size * size * depth * 4 channels (RGBA)
    let data = new Float32Array(size * size * depth * 4);  

    for (let z = 0; z < depth; z++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                let index = (z * size * size + y * size + x) * 4;
    
                // Example: random colors for each texel
                data[index] = 0.0;      // Red
                data[index + 1] = Math.random();  // Green
                data[index + 2] = 0.0;  // Blue
                data[index + 3] = 1.0;            // Alpha (fully opaque)
            }
        }
    }

    // Create the 3D texture (size * size * depth)
    const texture = new THREE.Data3DTexture(data, size, size, depth);
    texture.format = THREE.RGBAFormat;
    texture.type = THREE.FloatType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
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
        fragmentShader: `uniform image2D uTexture;

		void main() {
			vec4 color = texture2D(uTexture, gl_FragCoord.xy / vec2(128, 128));
			gl_FragColor = color * vec4(0.5, 1.0, 0.5, 1.0); // Multiply color by greenish color
		}`
    });
    shadersDict["shaderMultiply"] = shaderMultiply;

    const shaderInvert = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: null },
        },
        fragmentShader: document.getElementById('invert').innerHTML
    });
    shadersDict["shaderInvert"] = shaderInvert;

    const boundaryShader = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: null },
            uBoundary: { value: boundaryTexture}
            // Add more uniforms for velocity, density, etc.
        },
        vertexShader: `varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,  // TODO: might need a Pass-through vertex shader
        // fragmentShader: document.getElementById('boundary').innerHTML
        fragmentShader: `uniform sampler2D uTexture;   // The distribution function texture
varying vec2 vUv;

void main() {
    vec4 f = texture2D(uTexture, vUv);      // Fetch distribution function at this point

    // Apply no-slip boundary condition (do nothing at boundary)
    if (f.b > 0.5) {
        // Do nothing to the distribution function at the boundary
        // The distribution function remains unchanged at the boundary
        // f = f;  // This line is redundant but included for clarity
    }

    // Output the (potentially unchanged) distribution functions
    gl_FragColor = f;
}`
    });
    shadersDict["boundaryShader"] = boundaryShader;

    const collisionShader = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: null },
            uTau: { value: 0.8 }
            // Add more uniforms for velocity, density, etc.
        },
        vertexShader: `varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
        // fragmentShader: document.getElementById('collision').innerHTML
        fragmentShader: `uniform sampler2D uTexture;
uniform float tau; // Relaxation time
varying vec2 vUv;

void main() {
    vec4 f = texture2D(uTexture, vUv);

    // Simple BGK collision (relax distribution function to equilibrium)
    float rho = 0.0;
    for ( int i = -1; i <= 1; ++i ) {
        for ( int j = -1; j <= 1; ++j ) {
            vec2 pos = vUv + vec2(float(i), float(j));
            vec4 colorsIJ = texture2D(uTexture, pos); 
            rho += colorsIJ.r;
        }
    }
    
    if(f.b > 0.5){
        rho = 0.0;
        gl_FragColor = f;
    }else{
        // vec4 equilibrium = vec4(rho * 0.25); // Simplified equilibrium distribution TODO make complex
        float equilibrium = rho * 0.25;

        // Relax the distribution functions towards equilibrium
        f.r = f.r + (equilibrium - f.r) / tau; //1/tau is omega

        gl_FragColor = f; // Output the updated distribution functions (no color output yet)
    }
}
`
    });
    shadersDict["collisionShader"] = collisionShader;


    const streamingShader = new THREE.ShaderMaterial({
        uniforms: {
            uTexture: { value: null },
        },
        // vertexShader: `...`,
        // fragmentShader: document.getElementById('streaming').innerHTML // Your LBM streaming step logic
        fragmentShader: `uniform sampler2D uTexture;
varying vec2 vUv;

void main() {
    vec4 f = texture2D(uTexture, vUv);

    // Streaming step: shift the distribution functions based on lattice directions
    // (For simplicity, we're using a shift for demonstration; you'll need to modify it for D2Q9 model)
    vec2 shift = vec2(0.01, 0.0); // Example shift
    vec4 shiftedF = texture2D(uTexture, vUv + shift);

    gl_FragColor = shiftedF; // Output the shifted distribution functions (no color output yet)
}`
    });
    shadersDict["streamingShader"] = streamingShader;

    const visualizationShader = new THREE.ShaderMaterial({
        uniforms: {
            uTexture3D: { value: null },
        },
        vertexShader: `varying vec3 vUv;

void main() {
    vUv = vec3(uv, 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
        // fragmentShader: document.getElementById('streaming').innerHTML // Your LBM streaming step logic
        fragmentShader: `
uniform sampler3D uTexture3D;
varying vec3 vUv;

void main() {
    // Retrieve the distribution functions (stored in RGBA channels)
    vec4 color1 = texture(uTexture3D, vUv);
    vec4 color2 = texture(uTexture3D, vUv);

    gl_FragColor = color1;
}
`
    });
    shadersDict["visualizationShader"] = visualizationShader;
}
setupShaders();

function simulateSingleShader(name){
    //run shader
    let shader = shadersDict[name]
    bufferMesh.material = shader; // here is where we dynamically assign the material
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
    simulateSingleShader("boundaryShader");
    // simulateSingleShader("collisionShader");
    // simulateSingleShader("streamingShader");
    simulateSingleShader("visualizationShader");
    //final output in currentRT since the last target was nextRT and it's data was moved to currentRT
}

function visualize(){
    let shader = shadersDict["visualizationShader"];
    displayMesh.material = shader;
    shader.uniforms.uTexture = currentRT.texture;

    const renderTarget = new THREE.WebGLRenderTarget(10, 10);
    renderTarget.texture.format = THREE.RGBAFormat;
    renderTarget.texture.type = THREE.FloatType;
    renderTarget.texture.minFilter = THREE.LinearFilter;
    renderTarget.texture.magFilter = THREE.LinearFilter;

    renderer.setRenderTarget(renderTarget);
    renderer.render(displayScene, camera);

    console.log((renderTarget.texture))
    displayMesh.material = new THREE.MeshBasicMaterial({map: renderTarget.texture});

}

function displayInitial(){
    visualize();
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

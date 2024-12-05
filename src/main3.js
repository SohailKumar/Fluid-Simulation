import * as THREE from 'three';
import Stats from 'stats.js';

//CREATE STATS PAGE
var stats = new Stats();
stats.setMode(0);
stats.domElement.style.position = "absolute";
stats.domElement.style.left = "5px";
stats.domElement.style.top = "5px";
document.body.appendChild(stats.domElement);


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
const camera = new THREE.OrthographicCamera(-1.62, 1.62, 1, -1, -10, 10); //vars: left right top bottom near far
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('fluidCanvas') });
renderer.setSize(getRenderWidth(), getRenderHeight());
renderer.setClearColor(0xFF9900)
document.body.prepend(renderer.domElement);

const createData = function(){
    opt = {};
    opt.width = opt.width === undefined ? 128: opt.width; //sets to 16 if undefined
    opt.height = opt.height === undefined ? 128: opt.height;
    // default for pix method
    opt.forPix = opt.forPix || function(color, x, y, i, opt){
        let v = Math.floor( THREE.MathUtils.seededRandom() * 255 );
        color.r = v;
        color.g = v;
        color.b = v;
        return color;
    };
    let size = opt.width * opt.height;
    let data = new Uint8Array( 4 * size );
    for ( let i = 0; i < size; i ++ ) {
        let stride = i * 4,
        x = i % opt.width,
        y = Math.floor(i / opt.width),
        color = opt.forPix( new THREE.Color(), x, y, i, opt);
        data[ stride ] = color.r;
        data[ stride + 1 ] = color.g;
        data[ stride + 2 ] = color.b;
        data[ stride + 3 ] = 255;
    }
    return data;
};

// create data texture
const createDataTexture = function(gridWidth, gridHeight){
    const data = createData({});
    let texture = new THREE.DataTexture( data, gridWidth, gridHeight );
    texture.needsUpdate = true;
    return texture;
};

// update a texture
const updateTexture = (texture, opt) => {
    // just updating data array only
    const data = createData(opt);
    texture.image.data = data;
    texture.needsUpdate = true;
};


//random funciton
const forPix = {};
forPix.rndChannel = (r, g, b) => {
   r = r || [0, 255];
   g = g || [0, 255];
   b = b || [0, 255];
   return function(color, x, y, i, opt){
        color.r = r[0] + THREE.MathUtils.seededRandom() * ( r[1] - r[0] );
        color.g = g[0] + THREE.MathUtils.seededRandom() * ( g[1] - g[0] );
        color.b = b[0] + THREE.MathUtils.seededRandom() * ( b[1] - b[0] );
        return color;
    };
};

//-------- ----------
// MESH OBJECTS 
//-------- ----------
const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2,2),
    new THREE.MeshBasicMaterial({
        map : createDataTexture(128, 128)
    })
);
scene.add(mesh)

// ---------- ----------
// ANIMATION LOOP
// ---------- ----------
const FPS_UPDATE = 12, // fps rate to update ( low fps for low CPU use, but choppy video )
FPS_MOVEMENT = 30;     // fps rate to move object by that is independent of frame update rate
FRAME_MAX = 300;
let secs = 0,
frame = 0,
lt = new Date();
// update
const update = function(frame, frameMax){
    // using the update texture method
    updateTexture(mesh.material.map, { forPix: forPix.rndChannel() });
};

// loop
const loop = () => {
    const now = new Date(),
    secs = (now - lt) / 1000;
    requestAnimationFrame(loop);
    if(secs > 1 / FPS_UPDATE){
        // update, render
        update( Math.floor(frame), FRAME_MAX);
        renderer.render(scene, camera);
        // step frame
        frame += FPS_MOVEMENT * secs;
        frame %= FRAME_MAX;
        lt = now;
    }
};
loop();
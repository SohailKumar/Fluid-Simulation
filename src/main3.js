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

// const geometry = new THREE.BoxGeometry( 1, 1, 1 );
const geometry = new THREE.PlaneGeometry(2,     2)

const width = 10, height = 10   ;
const size = width * height;
const data = new Uint8Array( 4 * size );
for ( let i = 0; i < size; i ++ ) {
    const stride = i * 4,
    x = i % width,
    y = Math.floor(i / width),
    v2 = new THREE.Vector2(x, y),
    d = v2.distanceTo( new THREE.Vector2(width / 2, height / 2) ),
    iPer = i / size;
    let dPer = d / (width / 2);
    dPer = dPer > 1 ? 1 : dPer;
    // set r, g, b, and alpha data values
    data[ stride ] = 255 - Math.floor(255 * dPer);
    data[ stride + 1 ] = Math.floor(64 * iPer);
    data[ stride + 2 ] = 64 - Math.floor(64 * iPer);
    data[ stride + 3 ] = 255;
}
const texture = new THREE.DataTexture( data, width, height );
texture.needsUpdate = true;

const material = new THREE.MeshBasicMaterial( { map: texture, side: THREE.FrontSide } );
const plane = new THREE.Mesh( geometry, material );
scene.add( plane );

// // Render loop
// function animate() {
//     stats.begin(); // Start measuring frame
//     renderer.render(scene, camera); // Render the current frame
//     stats.end(); // End measuring frame
// }
// renderer.setAnimationLoop(animate); // Automatically calls animate in a loop

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
const fg = new THREE.Color(255, 255, 255),
bg = new THREE.Color(0, 0, 0),
v2_center = new THREE.Vector2(8, 8);
const update = function(frame, frameMax){
    // update group 
    group.children.forEach( (mesh, i) => {
        // using the update texture method
        updateTexture(mesh.material.map, { forPix: forPix.rndChannel() });
        // square update - size up and down
        if( i % 4 === 0){
            const size = 9 * getBias(frame, frameMax, 2)
            updateTexture(mesh.material.map, { forPix: forPix.square(size, fg, bg, v2_center) });
        }
        // square update - random pos
        if( i % 3 === 0){
            const size = 4;
            const v2_rnd = new THREE.Vector2(16 * Math.random(), 16 * Math.random())
            updateTexture(mesh.material.map, { forPix: forPix.square(size, fg, bg, v2_rnd) });
        }
        // !!! this old way of doing it would result in a loss of context
        //mesh.material.map = createDataTexture({ forPix: forPix.rndChannel() });
    });
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
const uint  q         = 9;
const float weight[q] = float[](
    1./36., 1./9., 1./36.,
    1./9. , 4./9., 1./9. ,
    1./36 , 1./9., 1./36.
);

const float tau   = 0.8;
const float omega = 1/tau;

////
float comp(int i, int j, vec2 v) {
	return i*v.x + j*v.y;
}

float sq(float x) {
	return x*x;
}

float norm(vec2 v) {
	return sqrt(dot(v,v));
}
////

uint indexOfDirection(int i, int j) {
    return 3*(j+1) + (i+1);
}

uint indexOfLatticeCell(uint x, uint y) {
    return q*nX*y + q*x;
}

float w(int i, int j) {
    return weight[indexOfDirection(i,j)];
}

float get(uint x, uint y, int i, int j) {
    return collideCells[indexOfLatticeCell(x,y) + indexOfDirection(i,j)];
}

float equilibrium(float d, vec2 u, int i, int j) {
    return w(i,j)
         * d
         * (1 + 3*comp(i,j,u) + 4.5*sq(comp(i,j,u)) - 1.5*sq(norm(u)));
}
//////////////////////////////

float density(uint x, uint y) {
	const uint idx = indexOfLatticeCell(x, y);
	float d = 0.f;
	for ( int i = 0; i < q; ++i ) {
		d += collideCells[idx + i];
	}
	return d;
}

vec2 velocity(uint x, uint y, float d) {
	return 1.f/d * vec2(
		get(x,y, 1, 0) - get(x,y,-1, 0) + get(x,y, 1, 1) - get(x,y,-1,-1) + get(x,y, 1,-1) - get(x,y,-1,1),
		get(x,y, 0, 1) - get(x,y, 0,-1) + get(x,y, 1, 1) - get(x,y,-1,-1) - get(x,y, 1,-1) + get(x,y,-1,1)
	);
}


//////////////////////////////
const uint x = gl_GlobalInvocationID.x;
const uint y = gl_GlobalInvocationID.y;

const float d = density(x,y);
const vec2  v = velocity(x,y,d);

setFluid(x,y,v,d);

//for each of the 9 directions
for ( int i = -1; i <= 1; ++i ) {
    for ( int j = -1; j <= 1; ++j ) {
        set(
            x,y,i,j,
            get(x,y,i,j) + omega * (equilibrium(d,v,i,j) - get(x,y,i,j))
        );
    }
}
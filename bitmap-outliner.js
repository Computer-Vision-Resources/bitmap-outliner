/**
 * Arrow types.
 */
/*export*/ const BMOL_ARR_NONE  = 0;
/*export*/ const BMOL_ARR_RIGHT = 1;
/*export*/ const BMOL_ARR_LEFT  = 2;
/*export*/ const BMOL_ARR_DOWN  = 3;
/*export*/ const BMOL_ARR_UP    = 4;

/**
 * The arrow states.
 */
const states = {
	[BMOL_ARR_RIGHT]: [
		[{arrow: BMOL_ARR_LEFT,  dx: +1, dy:  0}, {arrow: BMOL_ARR_UP,   dx: +1, dy: -1}, {arrow: BMOL_ARR_RIGHT, dx: +1, dy:  0}, {arrow:BMOL_ARR_DOWN,  dx: +1, dy: +1}],
		[{arrow: BMOL_ARR_DOWN,  dx: +1, dy: +1}, {arrow: BMOL_ARR_DOWN, dx: +1, dy: +1}, {arrow: BMOL_ARR_RIGHT, dx: +1, dy:  0}, {arrow:BMOL_ARR_UP,    dx: +1, dy: -1}],
	],
	[BMOL_ARR_LEFT]: [
		[{arrow: BMOL_ARR_RIGHT, dx: -1, dy:  0}, {arrow: BMOL_ARR_DOWN, dx:  0, dy: +1}, {arrow: BMOL_ARR_LEFT,  dx: -1, dy:  0}, {arrow:BMOL_ARR_UP,    dx:  0, dy: -1}],
		[{arrow: BMOL_ARR_UP,    dx:  0, dy: -1}, {arrow: BMOL_ARR_UP,   dx:  0, dy: -1}, {arrow: BMOL_ARR_LEFT,  dx: -1, dy:  0}, {arrow:BMOL_ARR_DOWN,  dx:  0, dy: +1}],
	],
	[BMOL_ARR_DOWN]: [
		[{arrow: BMOL_ARR_UP,    dx:  0, dy: +2}, {arrow: BMOL_ARR_RIGHT,dx:  0, dy: +1}, {arrow: BMOL_ARR_DOWN,  dx:  0, dy: +2}, {arrow:BMOL_ARR_LEFT,  dx: -1, dy: +1}],
		[{arrow: BMOL_ARR_LEFT,  dx: -1, dy: +1}, {arrow: BMOL_ARR_LEFT, dx: -1, dy: +1}, {arrow: BMOL_ARR_DOWN,  dx:  0, dy: +2}, {arrow:BMOL_ARR_RIGHT, dx:  0, dy: +1}],
	],
	[BMOL_ARR_UP]: [
		[{arrow: BMOL_ARR_DOWN,  dx:  0, dy: -2}, {arrow: BMOL_ARR_LEFT, dx: -1, dy: -1}, {arrow: BMOL_ARR_UP,    dx:  0, dy: -2}, {arrow:BMOL_ARR_RIGHT, dx:  0, dy: -1}],
		[{arrow: BMOL_ARR_RIGHT, dx:  0, dy: -1}, {arrow: BMOL_ARR_RIGHT,dx:  0, dy: -1}, {arrow: BMOL_ARR_UP,    dx:  0, dy: -2}, {arrow:BMOL_ARR_LEFT,  dx: -1, dy: -1}],
	],
};

/**
 * Simulate bitfield struct.
 *
 * typedef struct {
 *     uint8_t type:3;    ///< Arrow type.
 *     uint8_t inner:1;   ///< Associated path is inner path.
 *     uint8_t seen:1;    ///< Has been seen.
 *     uint8_t visited:1; ///< Has been visited.
 * } bmol_arrow;
 */
class ArrowBitfield {

	/**
	 * Initialize with array and index (optional).
	 */
	constructor(array, index) {
		this.array = array;
		this.index = index;
	}

	get value() {
		return this.array[this.index];
	}

	set value(newValue) {
		this.array[this.index] = newValue;
	}

	get type() {
		return this.value & 0x7;
	}

	set type(newValue) {
		this.value = (this.value & ~0x7) | (newValue & 0x7);
	}

	get inner() {
		return (this.value & 0x8) >> 3;
	}

	set inner(newValue) {
		this.value = (this.value & ~0x8) | ((newValue & 0x1) << 3);
	}

	get seen() {
		return (this.value & 0x10) >> 4;
	}

	set seen(newValue) {
		this.value = (this.value & ~0x10) | ((newValue & 0x1) << 4);
	}

	get visited() {
		return (this.value & 0x20) >> 5;
	}

	set visited(newValue) {
		this.value = (this.value & ~0x20) | ((newValue & 0x1) << 5);
	}

	/**
	 * Use given array and index.
	 *
	 * @param list array Array to use.
	 * @param int array Index to use.
	 * @return this.
	 */
	at(array, index) {
		this.array = array;
		this.index = index;

		return this;
	}

}

/**
 * Bitmap outliner class.
 */
class BitmapOutliner {

	/**
	 * Construct bitmap outliner.
	 *
	 * @param width Width of bitmap.
	 * @param height Height of bitmap.
	 * @param data The bitmap data as indexable object (e.g., Uint8Array).
	 */
	constructor(width, height, data) {
		this.width = width;
		this.height = height;
		this.data = data;
		this.grid = this.createGrid();
		this.gridAccessor = new ArrowBitfield();
		this.segments = [];
	}

	/**
	 * Create empty arrow grid.
	 */
	createGrid() {
		let gridWidth = this.width + 3;
		let gridHeight = this.height * 2 + 3;
		let grid = new Array(gridHeight);

		for (var y = 0; y < gridHeight; y++) {
			grid[y] = new Uint8Array(gridWidth);
		}

		return grid;
	}

	/**
	 * Convert arrow grid coordinates to path coordinates.
	 *
	 * @param type Arrow type.
	 * @param gx Grid X-coordinate.
	 * @param gy Grid Y-coordinate.
	 * @return Real coordinates.
	 */
	realCoords(type, gx, gy) {
		const realDelta = {
			[BMOL_ARR_RIGHT]: {x: 0, y: 0},
			[BMOL_ARR_LEFT]:  {x: 1, y: 0},
			[BMOL_ARR_DOWN]:  {x: 0, y: 0},
			[BMOL_ARR_UP]:    {x: 0, y: 1},
		};

		var real = realDelta[type];

		return {
			xr: gx - 1 + real.x,
			yr: (((gy - 1) / 2) | 0) + real.y,
		};
	}

	/**
	 * Add path segment to segment list.
	 */
	pushSegment(type, dx, dy) {
		this.segments.push({type, dx, dy});
	}

	/**
	 * Fill arrow grid.
	 */
	setArrows() {
		var x, y, p, t;
		let width = this.width;
		let height = this.height;
		let map = this.data;
		let grid = this.grid;
		let bitfield = this.gridAccessor;

		for (x = 0; x < width; x++) {
			for (y = 0, t = 0; y < height; y++) {
				if ((p = map[y * width + x]) != t) {
					bitfield.at(grid[y * 2 + 1], x + 1).type = t ? BMOL_ARR_LEFT : BMOL_ARR_RIGHT;
					t = p;
				}
			}

			if (map[(y - 1) * width + x]) {
				bitfield.at(grid[y * 2 + 1], x + 1).type = BMOL_ARR_LEFT;
			}
		}

		for (y = 0; y < height; y++) {
			for (x = 0, t = 0; x < width; x++) {
				if ((p = map[y * width + x]) != t) {
					bitfield.at(grid[y * 2 + 2], x + 1).type = t ? BMOL_ARR_DOWN : BMOL_ARR_UP;
					t = p;
				}
			}

			if (map[y * width + x - 1]) {
				bitfield.at(grid[y * 2 + 2], x + 1).type = BMOL_ARR_DOWN;
			}
		}
	}

	/**
	 * Search adjacent arrow.
	 *
	 * @param type Current arrow type.
	 * @param inner Is inner path.
	 * @param xd Arrow X-coordinate.
	 * @param yd Arrow Y-coordinate.
	 */
	searchAdjacentArrow(type, inner, xd, yd) {
		let arrows = states[type][inner];
		let grid = this.grid;
		let bitfield = this.gridAccessor;

		// search for adjacent arrows in precedence order
		for (var n = 0; n < 4; n++) {
			let search = arrows[n];
			let xn = xd + search.dx;
			let yn = yd + search.dy;
			let nextArrow = bitfield.at(grid[yn], xn);

			// follow adjacent arrow
			if (nextArrow.type === search.arrow && !nextArrow.seen) {
				// is opposite arrow
				if (n == 0) {
					if (!inner && nextArrow.inner) {
						xd = xn;
						yd = yn;

						nextArrow.seen = 0; // do not mark opposite arrow as seen
						type = nextArrow.type;

						// search next inner arrow relative to opposite arrow
						return this.searchAdjacentArrow(type, 1, xd, yd);
					}
					else {
						continue;
					}
				}
				// ignore arrows not in path type
				else if (nextArrow.inner != inner) {
					continue;
				}

				xd = xn;
				yd = yn;

				return {nextArrow, xd, yd};
			}
		}

		// switch to outer path if no more inner path arrows found
		if (inner) {
			return this.searchAdjacentArrow(type, 0, xd, yd);
		}

		return null;
	}

	/**
	 * Make path segments.
	 *
	 * @param x First path arrow.
	 * @param y First path arrow.
	 */
	makePath(x, y) {
		var xd = x;
		var yd = y;
		var xp, yp;
		let grid = this.grid;
		let bitfield = this.gridAccessor;
		var currentArrow = bitfield.at(grid[yd], xd);
		var nextArrow = currentArrow;
		var type = currentArrow.type;
		let inner = +(type === BMOL_ARR_LEFT);
		var prevtype = type;

		var {xr, yr} = this.realCoords(type, xd, yd);

		xp = xr;
		yp = yr;

		this.pushSegment(BMOL_ARR_NONE, xr, yr);

		do {
			currentArrow = nextArrow;
			currentArrow.seen = 1; // mark as seen

			var next = this.searchAdjacentArrow(type, inner, xd, yd);
			type = BMOL_ARR_NONE;

			if (next) {
				var {nextArrow, xd, yd} = next;
				type = nextArrow.type;
				inner = nextArrow.inner; // switch arrow type
			}

			// end path segment if arrow changes
			// and ignore last path segment
			if (type != prevtype && type) {
				let {xr, yr} = this.realCoords(type, xd, yd);
				let dx = xr - xp;
				let dy = yr - yp;

				xp = xr;
				yp = yr;

				this.pushSegment(prevtype, dx, dy);

				prevtype = type;
			}
		}
		while (type);
	}

	/**
	 * Mark arrow as outer and inner.
	 *
	 * @param x First path arrow.
	 * @param y First path arrow.
	 */
	setPathType(x, y) {
		let grid = this.grid;
		let bitfield = this.gridAccessor;
		let arrow = bitfield.at(grid[y], x);
		let type = arrow.type;
		let inner = +(type === BMOL_ARR_LEFT);

		do {
			let arrows = states[type][inner];

			// mark as visited
			arrow.visited = 1;
			arrow.inner = inner;

			type = BMOL_ARR_NONE;

			// search for adjacent arrows in precedence order
			for (var n = 1; n < 4; n++) {
				let search = arrows[n];
				let xn = x + search.dx;
				let yn = y + search.dy;
				let nextArrow = bitfield.at(grid[yn], xn);

				// follow adjacent arrow
				if (nextArrow.type === search.arrow && !nextArrow.visited) {
					x = xn;
					y = yn;
					type = nextArrow.type;
					arrow = nextArrow;
					break;
				}
			}
		}
		while (type);
	}

	/**
	 * Search all paths in arrow grid.
	 */
	searchPaths() {
		let gridWidth = this.width + 3;
		let gridHeight = this.height * 2 + 3;
		let grid = this.grid;
		let bitfield = this.gridAccessor;

		// set arrow types
		for (var y = 1; y < gridHeight - 1; y += 2) {
			for (var x = 1; x < gridWidth - 1; x++) {
				var arrow = bitfield.at(grid[y], x);

				if (arrow.type && !arrow.visited) {
					this.setPathType(x, y);
				}
			}
		}

		// search right and left arrows in grid
		for (var y = 1; y < gridHeight - 1; y += 2) {
			for (var x = 1; x < gridWidth - 1; x++) {
				var arrow = bitfield.at(grid[y], x);

				if (arrow.type && !arrow.seen) {
					this.makePath(x, y);
				}
			}
		}
	}

	findPaths() {
		this.segments.length = 0;

		this.setArrows();
		this.searchPaths();

		return this.segments;
	}

	svgPath() {
		let segments = this.findPaths();

		let path = segments.reduce((path, segment) => {
			switch (segment.type) {
				case BMOL_ARR_NONE: {
					if (path.length) {
						path += 'z';
					}

					path += `M ${segment.dx} ${segment.dy}`;
					break;
				}
				case BMOL_ARR_RIGHT:
				case BMOL_ARR_LEFT: {
					path += `h${segment.dx}`;
					break;
				}
				case BMOL_ARR_DOWN:
				case BMOL_ARR_UP: {
					path += `v${segment.dy}`;
					break;
				}
			}

			return path;
		}, '');

		path += 'z';

		return path;
	}

}

// -----------------------------------------------------------------------------

/*
const width = 7;
const height = 7;
const data = new Uint8Array([
	1, 1, 0, 1, 0, 1, 1,
	0, 0, 1, 0, 1, 0, 0,
	1, 0, 1, 1, 1, 0, 1,
	1, 1, 0, 0, 0, 1, 1,
	1, 1, 0, 0, 0, 1, 1,
	1, 1, 0, 1, 0, 1, 1,
	1, 1, 0, 1, 0, 1, 1,
]);
*/

/*
const width = 5;
const height = 10;
const data = new Uint8Array([
	1, 0, 1, 0, 1,
	0, 1, 0, 1, 0,
	1, 0, 1, 0, 1,
	0, 1, 0, 1, 0,
	1, 0, 1, 0, 1,
	1, 0, 1, 0, 1,
	0, 1, 0, 1, 0,
	1, 0, 1, 0, 1,
	0, 1, 0, 1, 0,
	1, 0, 1, 0, 1,
]);
*/

const width = 21;
const height = 21;
const data = new Uint8Array([
	1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1,
	1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1,
	1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1,
	1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,
	1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,
	1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1,
	1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1,
	0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
	1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0,
	0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1,
	1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 1, 0,
	1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1,
	1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1,
	0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1,
	1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1,
	1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0,
	1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0,
	1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1,
	1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 1,
	1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1,
	1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0,
]);

var outliner = new BitmapOutliner(width, height, data);

let path = outliner.svgPath();
let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><path d="${path}"></path></svg>`;

console.log(svg);

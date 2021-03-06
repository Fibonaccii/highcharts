/**
 * (c) 2010-2016 Torstein Honsi
 *
 * License: www.highcharts.com/license
 */
'use strict';
import H from '../parts/Globals.js';
import '../parts/Utilities.js';
import '../parts/Color.js';
import '../parts/SvgRenderer.js';
var cos = Math.cos,
	PI = Math.PI,
	sin = Math.sin;
		

var animObject = H.animObject,
	charts = H.charts,
	color = H.color,
	defined = H.defined,
	deg2rad = H.deg2rad,
	each = H.each,
	extend = H.extend,
	inArray = H.inArray,
	map = H.map,
	merge = H.merge,
	perspective = H.perspective,
	pick = H.pick,
	SVGElement = H.SVGElement,
	SVGRenderer = H.SVGRenderer,
	wrap = H.wrap;
/*** 
	EXTENSION TO THE SVG-RENDERER TO ENABLE 3D SHAPES
	***/
////// HELPER METHODS //////

var dFactor = (4 * (Math.sqrt(2) - 1) / 3) / (PI / 2);


//Shoelace algorithm -- http://en.wikipedia.org/wiki/Shoelace_formula
function shapeArea(vertexes) {
	var area = 0,
		i,
		j;
	for (i = 0; i < vertexes.length; i++) {
		j = (i + 1) % vertexes.length;
		area += vertexes[i].x * vertexes[j].y - vertexes[j].x * vertexes[i].y;
	}
	return area / 2;
}

function averageZ(vertexes) {
	var z = 0,
		i;
	for (i = 0; i < vertexes.length; i++) {
		z += vertexes[i].z;
	}
	return vertexes.length ? z / vertexes.length : 0;
}

/** Method to construct a curved path
  * Can 'wrap' around more then 180 degrees
  */
function curveTo(cx, cy, rx, ry, start, end, dx, dy) {
	var result = [], 
		arcAngle = end - start;
	if ((end > start) && (end - start > Math.PI / 2 + 0.0001)) {
		result = result.concat(curveTo(cx, cy, rx, ry, start, start + (Math.PI / 2), dx, dy));
		result = result.concat(curveTo(cx, cy, rx, ry, start + (Math.PI / 2), end, dx, dy));
		return result;
	}
	if ((end < start) && (start - end > Math.PI / 2 + 0.0001)) {			
		result = result.concat(curveTo(cx, cy, rx, ry, start, start - (Math.PI / 2), dx, dy));
		result = result.concat(curveTo(cx, cy, rx, ry, start - (Math.PI / 2), end, dx, dy));
		return result;
	} 
	return [
		'C', 
		cx + (rx * Math.cos(start)) - ((rx * dFactor * arcAngle) * Math.sin(start)) + dx,
		cy + (ry * Math.sin(start)) + ((ry * dFactor * arcAngle) * Math.cos(start)) + dy,
		cx + (rx * Math.cos(end)) + ((rx * dFactor * arcAngle) * Math.sin(end)) + dx,
		cy + (ry * Math.sin(end)) - ((ry * dFactor * arcAngle) * Math.cos(end)) + dy,

		cx + (rx * Math.cos(end)) + dx,
		cy + (ry * Math.sin(end)) + dy
	];
}

/*= if (!build.classic) { =*/
/**
 * Override the SVGRenderer initiator to add definitions used by brighter and
 * darker faces of the cuboids.
 */
wrap(SVGRenderer.prototype, 'init', function (proceed) {
	proceed.apply(this, [].slice.call(arguments, 1));

	each([{
		name: 'darker',
		slope: 0.6
	}, {
		name: 'brighter',
		slope: 1.4
	}], function (cfg) {
		this.definition({
			tagName: 'filter',
			id: 'highcharts-' + cfg.name,
			children: [{
				tagName: 'feComponentTransfer',
				children: [{
					tagName: 'feFuncR',
					type: 'linear',
					slope: cfg.slope
				}, {
					tagName: 'feFuncG',
					type: 'linear',
					slope: cfg.slope
				}, {
					tagName: 'feFuncB',
					type: 'linear',
					slope: cfg.slope
				}]
			}]
		});
	}, this);
});
/*= } =*/

SVGRenderer.prototype.toLinePath = function (points, closed) {
	var result = [];

	// Put "L x y" for each point
	each(points, function (point) {
		result.push('L', point.x, point.y);
	});

	if (points.length) {
		// Set the first element to M
		result[0] = 'M';

		// If it is a closed line, add Z
		if (closed) {
			result.push('Z');
		}
	}

	return result;
};

////// CUBOIDS //////
SVGRenderer.prototype.cuboid = function (shapeArgs) {

	var result = this.g(),
		paths = this.cuboidPath(shapeArgs);

	/*= if (build.classic) { =*/
	result.attr({
		'stroke-linejoin': 'round'
	});
	/*= } =*/

	// create the 3 sides
	result.front = this.path(paths[0]).attr({
		'class': 'highcharts-3d-front',
		zIndex: paths[3]
	}).add(result);
	result.top = this.path(paths[1]).attr({
		'class': 'highcharts-3d-top',
		zIndex: paths[4]
	}).add(result);
	result.side = this.path(paths[2]).attr({
		'class': 'highcharts-3d-side',
		zIndex: paths[5]
	}).add(result);

	// apply the fill everywhere, the top a bit brighter, the side a bit darker
	result.fillSetter = function (fill) {
		this.front.attr({
			fill: fill
		});
		this.top.attr({
			fill: color(fill).brighten(0.1).get()
		});
		this.side.attr({
			fill: color(fill).brighten(-0.1).get()
		});

		this.color = fill;
		return this;
	};

	// apply opacaity everywhere
	result.opacitySetter = function (opacity) {
		this.front.attr({ opacity: opacity });
		this.top.attr({ opacity: opacity });
		this.side.attr({ opacity: opacity });
		return this;
	};

	result.attr = function (args) {
		if (args.shapeArgs || defined(args.x)) {
			var shapeArgs = args.shapeArgs || args;
			var paths = this.renderer.cuboidPath(shapeArgs);
			this.front.attr({ d: paths[0], zIndex: paths[3] });
			this.top.attr({ d: paths[1], zIndex: paths[4] });
			this.side.attr({ d: paths[2], zIndex: paths[5] });
		} else {
			return H.SVGElement.prototype.attr.call(this, args); // getter returns value
		}

		return this;
	};

	result.animate = function (args, duration, complete) {
		if (defined(args.x) && defined(args.y)) {
			var paths = this.renderer.cuboidPath(args);
			this.front.attr({ zIndex: paths[3] }).animate({ d: paths[0] }, duration, complete);
			this.top.attr({ zIndex: paths[4] }).animate({ d: paths[1] }, duration, complete);
			this.side.attr({ zIndex: paths[5] }).animate({ d: paths[2] }, duration, complete);
			this.attr({
				zIndex: -paths[6] // #4774
			});
		} else if (args.opacity) {
			this.front.animate(args, duration, complete);
			this.top.animate(args, duration, complete);
			this.side.animate(args, duration, complete);
		} else {
			SVGElement.prototype.animate.call(this, args, duration, complete);
		}
		return this;
	};

	// destroy all children
	result.destroy = function () {
		this.front.destroy();
		this.top.destroy();
		this.side.destroy();

		return null;
	};

	// Apply the Z index to the cuboid group
	result.attr({ zIndex: -paths[6] });

	return result;
};

/**
 *	Generates a cuboid
 */
SVGRenderer.prototype.cuboidPath = function (shapeArgs) {
	var x = shapeArgs.x,
		y = shapeArgs.y,
		z = shapeArgs.z,
		h = shapeArgs.height,
		w = shapeArgs.width,
		d = shapeArgs.depth,		
		chart = charts[this.chartIndex];

	// The 8 corners of the cube
	var pArr = [
		{ x: x, y: y, z: z },
		{ x: x + w, y: y, z: z },
		{ x: x + w, y: y + h, z: z },
		{ x: x, y: y + h, z: z },
		{ x: x, y: y + h, z: z + d },
		{ x: x + w, y: y + h, z: z + d },
		{ x: x + w, y: y, z: z + d },
		{ x: x, y: y, z: z + d }
	];

	// apply perspective
	pArr = perspective(pArr, chart, shapeArgs.insidePlotArea);

	// helper method to decide which side is visible
	function mapPath(i) {
		return pArr[i];
	}
	var pickShape = function (path1, path2) {
		var ret = [];
		path1 = map(path1, mapPath);
		path2 = map(path2, mapPath);
		if (shapeArea(path1) < 0) {
			ret = path1;
		} else if (shapeArea(path2) < 0) {
			ret = path2;
		}
		return ret;
	};

	// front or back
	var front = [3, 2, 1, 0];
	var back = [7, 6, 5, 4];
	var path1 = pickShape(front, back);

	// top or bottom
	var top = [1, 6, 7, 0];
	var bottom = [4, 5, 2, 3];
	var path2 = pickShape(top, bottom);

	// side
	var right = [1, 2, 5, 6];
	var left = [0, 7, 4, 3];
	var path3 = pickShape(right, left);

	return [this.toLinePath(path1, true), this.toLinePath(path2, true), this.toLinePath(path3, true), averageZ(path1), averageZ(path2), averageZ(path3), averageZ(map(bottom, mapPath)) * 9e9]; // #4774
};

////// SECTORS //////
H.SVGRenderer.prototype.arc3d = function (attribs) {

	var wrapper = this.g(),
		renderer = wrapper.renderer,
		customAttribs = ['x', 'y', 'r', 'innerR', 'start', 'end'];

	/**
	 * Get custom attributes. Mutate the original object and return an object with only custom attr.
	 */
	function suckOutCustom(params) {
		var hasCA = false,
			ca = {};
		for (var key in params) {
			if (inArray(key, customAttribs) !== -1) {
				ca[key] = params[key];
				delete params[key];
				hasCA = true;
			}
		}
		return hasCA ? ca : false;
	}

	attribs = merge(attribs);

	attribs.alpha *= deg2rad;
	attribs.beta *= deg2rad;
	
	// Create the different sub sections of the shape
	wrapper.top = renderer.path();
	wrapper.side1 = renderer.path();
	wrapper.side2 = renderer.path();
	wrapper.inn = renderer.path();
	wrapper.out = renderer.path();

	/**
	 * Add all faces
	 */
	wrapper.onAdd = function () {
		var parent = wrapper.parentGroup, 
			className = wrapper.attr('class');
		wrapper.top.add(wrapper);

		// These faces are added outside the wrapper group because the z index
		// relates to neighbour elements as well
		each(['out', 'inn', 'side1', 'side2'], function (face) {
			wrapper[face]
				.addClass(className + ' highcharts-3d-side')
				.add(parent);
		});
	};

	/**
	 * Compute the transformed paths and set them to the composite shapes
	 */
	wrapper.setPaths = function (attribs) {

		var paths = wrapper.renderer.arc3dPath(attribs),
			zIndex = paths.zTop * 100;

		wrapper.attribs = attribs;

		wrapper.top.attr({ d: paths.top, zIndex: paths.zTop });
		wrapper.inn.attr({ d: paths.inn, zIndex: paths.zInn });
		wrapper.out.attr({ d: paths.out, zIndex: paths.zOut });
		wrapper.side1.attr({ d: paths.side1, zIndex: paths.zSide1 });
		wrapper.side2.attr({ d: paths.side2, zIndex: paths.zSide2 });


		// show all children
		wrapper.zIndex = zIndex;
		wrapper.attr({ zIndex: zIndex });

		// Set the radial gradient center the first time
		if (attribs.center) {
			wrapper.top.setRadialReference(attribs.center);
			delete attribs.center;
		}
	};
	wrapper.setPaths(attribs);

	// Apply the fill to the top and a darker shade to the sides
	wrapper.fillSetter = function (value) {
		var darker = color(value).brighten(-0.1).get();
		
		this.fill = value;

		this.side1.attr({ fill: darker });
		this.side2.attr({ fill: darker });
		this.inn.attr({ fill: darker });
		this.out.attr({ fill: darker });
		this.top.attr({ fill: value });
		return this;
	};

	// Apply the same value to all. These properties cascade down to the children
	// when set to the composite arc3d.
	each(['opacity', 'translateX', 'translateY', 'visibility'], function (setter) {
		wrapper[setter + 'Setter'] = function (value, key) {
			wrapper[key] = value;
			each(['out', 'inn', 'side1', 'side2', 'top'], function (el) {
				wrapper[el].attr(key, value);
			});
		};
	});

	/**
	 * Override attr to remove shape attributes and use those to set child paths
	 */
	wrap(wrapper, 'attr', function (proceed, params) {
		var ca;
		if (typeof params === 'object') {
			ca = suckOutCustom(params);
			if (ca) {
				extend(wrapper.attribs, ca);
				wrapper.setPaths(wrapper.attribs);
			}
		}
		return proceed.apply(this, [].slice.call(arguments, 1));
	});

	/**
	 * Override the animate function by sucking out custom parameters related to the shapes directly,
	 * and update the shapes from the animation step.
	 */
	wrap(wrapper, 'animate', function (proceed, params, animation, complete) {
		var ca,
			from = this.attribs,
			to,
			anim;

		// Attribute-line properties connected to 3D. These shouldn't have been in the 
		// attribs collection in the first place.
		delete params.center;
		delete params.z;
		delete params.depth;
		delete params.alpha;
		delete params.beta;

		anim = animObject(pick(animation, this.renderer.globalAnimation));
		
		if (anim.duration) {
			params = merge(params); // Don't mutate the original object
			ca = suckOutCustom(params);
			params.dummy = 1; // Params need to have a property in order for the step to run (#5765)

			if (ca) {
				to = ca;
				anim.step = function (a, fx) {
					function interpolate(key) {
						return from[key] + (pick(to[key], from[key]) - from[key]) * fx.pos;
					}
						
					if (fx.prop === 'dummy') {
						fx.elem.setPaths(merge(from, {
							x: interpolate('x'),
							y: interpolate('y'),
							r: interpolate('r'),
							innerR: interpolate('innerR'),
							start: interpolate('start'),
							end: interpolate('end')
						}));
					}
				};
			}
			animation = anim; // Only when duration (#5572)
		}
		return proceed.call(this, params, animation, complete);
	});

	// destroy all children
	wrapper.destroy = function () {
		this.top.destroy();
		this.out.destroy();
		this.inn.destroy();
		this.side1.destroy();
		this.side2.destroy();

		SVGElement.prototype.destroy.call(this);
	};
	// hide all children
	wrapper.hide = function () {
		this.top.hide();
		this.out.hide();
		this.inn.hide();
		this.side1.hide();
		this.side2.hide();
	};
	wrapper.show = function () {
		this.top.show();
		this.out.show();
		this.inn.show();
		this.side1.show();
		this.side2.show();
	};
	return wrapper;
};

/**
 * Generate the paths required to draw a 3D arc
 */
SVGRenderer.prototype.arc3dPath = function (shapeArgs) {
	var cx = shapeArgs.x, // x coordinate of the center
		cy = shapeArgs.y, // y coordinate of the center
		start = shapeArgs.start, // start angle
		end = shapeArgs.end - 0.00001, // end angle
		r = shapeArgs.r, // radius
		ir = shapeArgs.innerR, // inner radius
		d = shapeArgs.depth, // depth
		alpha = shapeArgs.alpha, // alpha rotation of the chart
		beta = shapeArgs.beta; // beta rotation of the chart

	// Derived Variables
	var cs = Math.cos(start),		// cosinus of the start angle
		ss = Math.sin(start),		// sinus of the start angle
		ce = Math.cos(end),			// cosinus of the end angle
		se = Math.sin(end),			// sinus of the end angle
		rx = r * Math.cos(beta),		// x-radius 
		ry = r * Math.cos(alpha),	// y-radius
		irx = ir * Math.cos(beta),	// x-radius (inner)
		iry = ir * Math.cos(alpha),	// y-radius (inner)
		dx = d * Math.sin(beta),		// distance between top and bottom in x
		dy = d * Math.sin(alpha);	// distance between top and bottom in y

	// TOP
	var top = ['M', cx + (rx * cs), cy + (ry * ss)];
	top = top.concat(curveTo(cx, cy, rx, ry, start, end, 0, 0));
	top = top.concat([
		'L', cx + (irx * ce), cy + (iry * se)
	]);
	top = top.concat(curveTo(cx, cy, irx, iry, end, start, 0, 0));
	top = top.concat(['Z']);
	// OUTSIDE
	var b = (beta > 0 ? Math.PI / 2 : 0),
		a = (alpha > 0 ? 0 : Math.PI / 2);

	var start2 = start > -b ? start : (end > -b ? -b : start),
		end2 = end < PI - a ? end : (start < PI - a ? PI - a : end),
		midEnd = 2 * PI - a;
	
	// When slice goes over bottom middle, need to add both, left and right outer side.
	// Additionally, when we cross right hand edge, create sharp edge. Outer shape/wall:
	//
	//            -------
	//          /    ^    \
	//    4)   /   /   \   \  1)
	//        /   /     \   \
	//       /   /       \   \
	// (c)=> ====         ==== <=(d) 
	//       \   \       /   /
	//        \   \<=(a)/   /
	//         \   \   /   / <=(b)
	//    3)    \    v    /  2)
	//            -------
	//
	// (a) - inner side
	// (b) - outer side
	// (c) - left edge (sharp)
	// (d) - right edge (sharp)
	// 1..n - rendering order for startAngle = 0, when set to e.g 90, order changes clockwise (1->2, 2->3, n->1) and counterclockwise for negative startAngle

	var out = ['M', cx + (rx * cos(start2)), cy + (ry * sin(start2))];
	out = out.concat(curveTo(cx, cy, rx, ry, start2, end2, 0, 0));

	if (end > midEnd && start < midEnd) { // When shape is wide, it can cross both, (c) and (d) edges, when using startAngle
		// Go to outer side
		out = out.concat([
			'L', cx + (rx * cos(end2)) + dx, cy + (ry * sin(end2)) + dy
		]);
		// Curve to the right edge of the slice (d)
		out = out.concat(curveTo(cx, cy, rx, ry, end2, midEnd, dx, dy));
		// Go to the inner side
		out = out.concat([
			'L', cx + (rx * cos(midEnd)), cy + (ry * sin(midEnd))
		]);
		// Curve to the true end of the slice
		out = out.concat(curveTo(cx, cy, rx, ry, midEnd, end, 0, 0));
		// Go to the outer side
		out = out.concat([
			'L', cx + (rx * cos(end)) + dx, cy + (ry * sin(end)) + dy
		]);
		// Go back to middle (d)
		out = out.concat(curveTo(cx, cy, rx, ry, end, midEnd, dx, dy));
		out = out.concat([
			'L', cx + (rx * cos(midEnd)), cy + (ry * sin(midEnd))
		]);
		// Go back to the left edge
		out = out.concat(curveTo(cx, cy, rx, ry, midEnd, end2, 0, 0));
	} else if (end > PI - a && start < PI - a) { // But shape can cross also only (c) edge:
		// Go to outer side
		out = out.concat([
			'L', cx + (rx * Math.cos(end2)) + dx, cy + (ry * Math.sin(end2)) + dy
		]);
		// Curve to the true end of the slice
		out = out.concat(curveTo(cx, cy, rx, ry, end2, end, dx, dy));
		// Go to the inner side
		out = out.concat([
			'L', cx + (rx * Math.cos(end)), cy + (ry * Math.sin(end))
		]);
		// Go back to the artifical end2
		out = out.concat(curveTo(cx, cy, rx, ry, end, end2, 0, 0));
	}

	out = out.concat([
		'L', cx + (rx * Math.cos(end2)) + dx, cy + (ry * Math.sin(end2)) + dy
	]);
	out = out.concat(curveTo(cx, cy, rx, ry, end2, start2, dx, dy));
	out = out.concat(['Z']);

	// INSIDE
	var inn = ['M', cx + (irx * cs), cy + (iry * ss)];
	inn = inn.concat(curveTo(cx, cy, irx, iry, start, end, 0, 0));
	inn = inn.concat([
		'L', cx + (irx * Math.cos(end)) + dx, cy + (iry * Math.sin(end)) + dy
	]);
	inn = inn.concat(curveTo(cx, cy, irx, iry, end, start, dx, dy));
	inn = inn.concat(['Z']);

	// SIDES
	var side1 = [
		'M', cx + (rx * cs), cy + (ry * ss),
		'L', cx + (rx * cs) + dx, cy + (ry * ss) + dy,
		'L', cx + (irx * cs) + dx, cy + (iry * ss) + dy,
		'L', cx + (irx * cs), cy + (iry * ss),
		'Z'
	];
	var side2 = [
		'M', cx + (rx * ce), cy + (ry * se),
		'L', cx + (rx * ce) + dx, cy + (ry * se) + dy,
		'L', cx + (irx * ce) + dx, cy + (iry * se) + dy,
		'L', cx + (irx * ce), cy + (iry * se),
		'Z'
	];

	// correction for changed position of vanishing point caused by alpha and beta rotations
	var angleCorr = Math.atan2(dy, -dx),
		angleEnd = Math.abs(end + angleCorr),
		angleStart = Math.abs(start + angleCorr),
		angleMid = Math.abs((start + end) / 2 + angleCorr);

	// set to 0-PI range
	function toZeroPIRange(angle) {
		angle = angle % (2 * Math.PI);
		if (angle > Math.PI) {
			angle = 2 * Math.PI - angle; 
		}
		return angle;
	}
	angleEnd = toZeroPIRange(angleEnd);
	angleStart = toZeroPIRange(angleStart);
	angleMid = toZeroPIRange(angleMid);

	// *1e5 is to compensate pInt in zIndexSetter
	var incPrecision = 1e5,
		a1 = angleMid * incPrecision,
		a2 = angleStart * incPrecision,
		a3 = angleEnd * incPrecision;

	return {
		top: top,
		zTop: Math.PI * incPrecision + 1, // max angle is PI, so this is allways higher
		out: out,
		zOut: Math.max(a1, a2, a3),
		inn: inn,
		zInn: Math.max(a1, a2, a3),
		side1: side1,
		zSide1: a3 * 0.99, // to keep below zOut and zInn in case of same values
		side2: side2,
		zSide2: a2 * 0.99
	};
};

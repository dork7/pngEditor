let statusField;
let canvas;
let background;
let context;
let canvasCopy;
let canvasCopyContext;
let borderSize = 2;
let shadowSize = 4;
let alphaThreshold = 0;
let blurPassNumber = 5;
let borderColor = [255, 255, 255, 255];
let shadowColor = [0, 0, 0, 2];
let backGroundColor = "#f5f5dc";

function download() {
	let image = canvas
		.toDataURL("image/png", 1.0)
		.replace("image/png", "image/octet-stream");
	var link = document.createElement("a");
	link.download = "my-image.png";
	link.href = image;
	link.click();
}

function hexToRgb(hex) {
	var bigint = parseInt(hex.substring(1), 16);
	var r = (bigint >> 16) & 255;
	var g = (bigint >> 8) & 255;
	var b = bigint & 255;

	return [r, g, b];
}

function initContext() {
	canvas = document.getElementById("canvas");
	context = canvas.getContext("2d");

	canvasCopy = document.createElement("canvas");
	canvasCopyContext = canvasCopy.getContext("2d");

	background = document.getElementById("background");
	background.style.backgroundColor = background;
}

function copyColor(hexColor, toCopy) {
	let color = hexToRgb(hexColor);
	for (let i = 0; i < 3; i++) toCopy[i] = color[i];
	return toCopy;
}

function changeBackground(newColor) {
	background.style.backgroundColor = newColor;
}

function onInputChange(name, value) {
	if (name === "borderSize") {
		borderSize = parseInt(value);
		repocessImage(canvasCopy, canvasCopy.width, canvasCopy.height);
	} else if (name === "shadowSize") {
		shadowSize = parseInt(value);
		repocessImage(canvasCopy, canvasCopy.width, canvasCopy.height);
	} else if (name === "borderColor") {
		borderColor = copyColor(value, borderColor);
		repocessImage(canvasCopy, canvasCopy.width, canvasCopy.height);
	} else if (name === "shadowColor") {
		shadowColor = copyColor(value, shadowColor);
		repocessImage(canvasCopy, canvasCopy.width, canvasCopy.height);
	} else if (name == "shadowAlpha") {
		shadowColor[3] = parseInt(value);
		repocessImage(canvasCopy, canvasCopy.width, canvasCopy.height);
	} else if (name == "alphaThreshold") {
		alphaThreshold = parseInt(value);
		repocessImage(canvasCopy, canvasCopy.width, canvasCopy.height);
	} else if (name == "blurPassNumber") {
		blurPassNumber = parseInt(value);
		repocessImage(canvasCopy, canvasCopy.width, canvasCopy.height);
	}
}

function repocessImage(image, width, height) {
	let startTime = Date.now();
	drawImage(canvas, context, image, width, height);
	processImage();
	let endTime = Date.now();
	console.log("ProcessTime:" + (endTime - startTime));
}

async function processImage() {
	// Gets the canvas data
	let canvasData = context.getImageData(0, 0, canvas.width, canvas.height);

	let originalData = canvasData.data.slice();
	let borderData = originalData.slice();

	// Dilates the image
	borderData = dilate(
		borderData,
		canvas.width,
		canvas.height,
		borderColor,
		alphaThreshold,
		borderSize
	);

	let shadowData = borderData.slice();

	// Dilates the image
	shadowData = dilate(
		shadowData,
		canvas.width,
		canvas.height,
		shadowColor,
		alphaThreshold,
		shadowSize
	);

	// Mix the data arrays
	let finalData = mixDatas(originalData, borderData, shadowData);
	// Sets the final data
	canvasData.data.set(finalData);
	// Sets the data into the canvas
	context.putImageData(canvasData, 0, 0);
}

function drawImage(canvas, context, image, width, height) {
	// New Size of the image with the borders
	const extra = borderSize + shadowSize;
	const newWidth = width + extra * 10;
	const newHeight = height + extra * 10;
	// Resize the canvas
	canvas.width = newWidth;
	canvas.height = newHeight;
	// Draws the image into the canvas
	context.drawImage(image, extra * 5, extra * 5);
}

function drawImageNoResize(canvas, context, image, width, height) {
	// Resize the canvas
	canvas.width = width;
	canvas.height = height;
	// Draws the image into the canvas
	context.drawImage(image, 0, 0);
}

function onImageChange(event) {
	const file = event.target.files[0];

	if (file.type.match("image.*")) {
		let reader = new FileReader();
		// Read the file
		reader.readAsDataURL(file);
		reader.onload = function(event) {
			if (event.target.readyState == FileReader.DONE) {
				let image = new Image();
				image.onload = function(_event) {
					drawImageNoResize(
						canvasCopy,
						canvasCopyContext,
						image,
						image.width,
						image.height
					);

					repocessImage(image, image.width, image.height);
				};
				image.src = event.target.result;
			}
		};
	}
}

function getIndex(row, column, width) {
	return (row * width + column) * 4;
}

function setColor(data, index, color) {
	data[index + 0] = color[0];
	data[index + 1] = color[1];
	data[index + 2] = color[2];
	data[index + 3] = color[3];
}

function getColor(data, index) {
	return [data[index + 0], data[index + 1], data[index + 2], data[index + 3]];
}

function overlay(topValue, bottomValue, alpha) {
	const normalizedAlpha = alpha / 255.0;

	return topValue * normalizedAlpha + (1.0 - normalizedAlpha) * bottomValue;
}

function overlayColor(topColor, bottomColor) {
	let finalColor = new Array(4);
	for (let i = 0; i < 3; i++)
		finalColor[i] = overlay(topColor[i], bottomColor[i], topColor[3]);

	finalColor[3] = Math.max(topColor[3], bottomColor[3]);

	return finalColor;
}

function mixDatas(topLayer, midLayer, bottomLayer) {
	let finalMix = bottomLayer.slice();

	for (let i = 0; i < finalMix.length; i += 4) {
		// Get the color of the three layers
		let bottomColor = getColor(bottomLayer, i);
		let midColor = getColor(midLayer, i);
		let topColor = getColor(topLayer, i);

		let finalColor = overlayColor(
			topColor,
			overlayColor(midColor, bottomColor)
		);

		setColor(finalMix, i, finalColor);
	}

	return finalMix;
}

function dilatePass(data, width, height, dilationAlpha) {
	let dataCopy = data.slice();
	let kernel = [
		0.176,
		0.329,
		0.533,
		0.757,
		0.933,
		1,
		0.933,
		0.757,
		0.533,
		0.329,
		0.176
	];

	let kernelSize = 5;
	let maxAlpha = 0;
	for (let i = 0; i < height; i++) {
		for (let j = 0; j < width; j++) {
			let finalColor = [0, 0, 0, 0];
			for (
				let kernelStep = -kernelSize;
				kernelStep <= kernelSize;
				kernelStep++
			) {
				let row = i + kernelStep;
				let column = j;
				let validRow = row >= 0 && row < height;
				if (validRow) {
					let color = getColor(data, getIndex(row, column, width));
					let kernelValue = Math.round(
						color[3] * kernel[kernelStep + kernelSize]
					);
					if (finalColor[3] < kernelValue) {
						finalColor = color;
						finalColor[3] = kernelValue;
						maxAlpha = kernelValue;
					}
				}
			}
			setColor(dataCopy, getIndex(i, j, width), finalColor);
		}
	}

	let dataCopy2 = dataCopy.slice();
	for (let i = 0; i < height; i++) {
		for (let j = 0; j < width; j++) {
			let finalColor = [0, 0, 0, 0];
			for (
				let kernelStep = -kernelSize;
				kernelStep <= kernelSize;
				kernelStep++
			) {
				let row = i;
				let column = j + kernelStep;
				let validColumn = column >= 0 && column < width;
				if (validColumn) {
					let color = getColor(dataCopy, getIndex(row, column, width));
					let kernelValue = Math.round(
						color[3] * kernel[kernelStep + kernelSize]
					);
					if (finalColor[3] < kernelValue) {
						finalColor = color;
						finalColor[3] = kernelValue;
						maxAlpha = kernelValue;
					}
				}
			}
			setColor(dataCopy2, getIndex(i, j, width), finalColor);
		}
	}

	for (let i = 0; i < height * width * 4; i++) {
		let color = getColor(dataCopy2, i);
		color[3] = Math.round((color[3] / maxAlpha) * 0.01 * dilationAlpha);
		setColor(dataCopy2, i, color);
	}
	return dataCopy2;
}

function dilate(
	data,
	width,
	height,
	dilationColor,
	alphaThreshold,
	numberOfpass
) {
	let dataCopy = data.slice();

	let maxAlpha = 0;

	// Binarize
	let size = width * height * 4;
	for (let i = 0; i < size; i += 4) {
		let color = getColor(data, i);
		if (color[3] > alphaThreshold) {
			let newColor = dilationColor.slice();
			newColor[3] = (color[3] * dilationColor[3]) / 255;
			setColor(dataCopy, i, newColor);
		}
	}

	for (let pass = 0; pass < numberOfpass; pass++) {
		dataCopy = dilatePass(dataCopy, width, height, dilationColor[3]);
	}

	return dataCopy;
}

initContext();

const videoElement = document.createElement('video');
const canvasElement = document.getElementById('myCanvas');
const canvasCtx = canvasElement.getContext('2d');

const hands = new Hands({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
  }
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({image: videoElement});
  },
  width: 640,
  height: 480
});
camera.start();

let polygons = [];
const numPolygons = 6; // 다각형(이미지)의 개수
let scrollSpeed = 0;
let fingersClose = false; // 엄지와 검지가 맞닿았는지의 상태

let images = []; // 이미지 객체를 저장할 배열
const imageUrls = [
  'http://localhost:3000/setting.png',
  'http://localhost:3000/bookmark.png',
  'http://localhost:3000/folder.png',
  'http://localhost:3000/map.png',
  'http://localhost:3000/music.png',
  'http://localhost:3000/video.png'
  // 추가 이미지 URL
];

const imageTexts = ['Setting', 'Bookmark', 'Folder', 'Map', 'Music', 'Video']; // 이미지에 해당하는 텍스트

// 이미지 불러오기
function loadImages() {
  for (let url of imageUrls) {
    let img = new Image();
    img.src = url;
    images.push(img);
  }
}

loadImages();

function initializePolygons() {
  polygons = [];
  for (let i = 0; i < numPolygons; i++) {
    polygons.push({
      x: i * 400 + canvasElement.width / 4, // 사이의 거리를 더 벌림
      y: canvasElement.height / 2,
      size: 100, // 이미지 크기 조정
      image: images[i % images.length], // 이미지 할당
      text: imageTexts[i % imageTexts.length] // 텍스트 할당
    });
  }
}

initializePolygons();

window.onresize = function() {
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
  initializePolygons();
};

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.translate(canvasElement.width, 0);
  canvasCtx.scale(-1, 1);

  let closestPolygonDistance = Infinity;  // 이 변수를 초기화합니다.

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#373A47', lineWidth: 5});

      // 엄지와 검지 끝의 랜드마크
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];

      // 엄지와 검지 사이의 거리 계산
      const distance = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
      fingersClose = distance < 0.1;

      // 나머지 랜드마크를 기본 색상으로 그림
      drawLandmarks(canvasCtx, landmarks, {color: '#373A47', lineWidth: 2});

      // 각 이미지와 중앙과의 거리를 계산하여 가장 가까운 이미지의 거리를 찾습니다.
      polygons.forEach(polygon => {
        const distanceToCenter = Math.abs(polygon.x - canvasElement.width / 2);
        if (distanceToCenter < closestPolygonDistance) {
          closestPolygonDistance = distanceToCenter;
        }
      });

      // 중앙 이미지에 가까울 때 엄지와 검지 랜드마크 색상 변경
      let thumbIndexColor = '#FFFFFF';
      if (fingersClose) {
        thumbIndexColor = '#5BADFF';
      } else if (closestPolygonDistance > 100) {
        thumbIndexColor = '#373A47';
      }

      canvasCtx.fillStyle = thumbIndexColor;
      canvasCtx.beginPath();
      canvasCtx.arc(thumbTip.x * canvasElement.width, thumbTip.y * canvasElement.height, 5, 0, 2 * Math.PI);
      canvasCtx.arc(indexTip.x * canvasElement.width, indexTip.y * canvasElement.height, 5, 0, 2 * Math.PI);
      canvasCtx.fill();

      // 스크롤 속도 계산
      const tip = landmarks[8];
      scrollSpeed = (tip.x * canvasElement.width - canvasElement.width / 2) / 50;
    }
  }

  updatePolygons(scrollSpeed);
  drawPolygons();

  canvasCtx.restore();
}

function drawPolygons() {
  for (const polygon of polygons) {
    const img = polygon.image;
    if (img.complete) {
      canvasCtx.drawImage(img, polygon.x - polygon.size / 2, polygon.y - polygon.size / 2, polygon.size, polygon.size);

      const distanceToCenter = Math.abs(polygon.x - canvasElement.width / 2);
      if (distanceToCenter < 100) {
        let alpha = 1 - distanceToCenter / 100;
        drawShadowedCircle(canvasCtx, polygon.x, polygon.y, polygon.size / 2, alpha);
        drawText(canvasCtx, polygon.x, polygon.y + polygon.size / 2 + 40, polygon.text);
      }
    }
  }
}

function drawShadowedCircle(ctx, x, y, radius, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = fingersClose ? '#5BADFF' : 'white';
  ctx.lineWidth = 5;
  ctx.shadowColor = fingersClose ? '#5BADFF' : 'white';
  ctx.shadowBlur = 15;
  ctx.stroke();
  ctx.restore();
}

function drawTextBackground(ctx, x, y, text, padding) {
  ctx.save();
  ctx.scale(-1, 1);
  const textWidth = ctx.measureText(text).width;
  const boxWidth = textWidth + 8 * padding;
  const boxHeight = 40;
  const rectX = -x - boxWidth / 2;
  const rectY = y - boxHeight / 2;

  ctx.beginPath();
  ctx.moveTo(rectX + 20, rectY);
  ctx.arcTo(rectX + boxWidth, rectY, rectX + boxWidth, rectY + boxHeight, 20);
  ctx.arcTo(rectX + boxWidth, rectY + boxHeight, rectX, rectY + boxHeight, 20);
  ctx.arcTo(rectX, rectY + boxHeight, rectX, rectY, 20);
  ctx.arcTo(rectX, rectY, rectX + boxWidth, rectY, 20);
  ctx.closePath();

  ctx.fillStyle = fingersClose ? '#5BADFF' : 'rgba(255, 255, 255, 0.7)';
  ctx.fill();
  ctx.restore();
}

function drawText(ctx, x, y, text) {
  const padding = 10;
  drawTextBackground(ctx, x, y + 20, text, padding);
  ctx.save();
  ctx.scale(-1, 1);
  ctx.font = '500 20px Poppins';
  ctx.fillStyle = fingersClose ? '#FFFFFF' : 'black';
  ctx.textAlign = 'center';
  ctx.fillText(text, -x, y + 27);
  ctx.restore();
}

function updatePolygons(speed) {
  for (const polygon of polygons) {
    polygon.x += speed;
    if (polygon.x < -polygon.size) polygon.x = canvasElement.width + polygon.size;
    if (polygon.x > canvasElement.width + polygon.size) polygon.x = -polygon.size;

    const distanceToCenter = Math.abs(canvasElement.width / 2 - polygon.x);
    polygon.size = 200 + (100 - distanceToCenter / 10);
  }
}

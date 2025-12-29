/**
 * main.js
 * Entry point for Fruit Catch Game.
 * Connects PoseEngine (Webcam/AI) with GameEngine (Logic/UI).
 */

let poseEngine;
let gameEngine;
let stabilizer;
let ctx;

window.onload = () => {
  // 1. Initialize Engines
  gameEngine = new GameEngine();
  poseEngine = new PoseEngine("./my_model/");

  // Stabilizer (assuming standard implementation)
  if (typeof PredictionStabilizer !== 'undefined') {
    stabilizer = new PredictionStabilizer({
      threshold: 0.85, // Higher confidence needed
      smoothingFrames: 5 // More smoothing
    });
  } else {
    console.warn("Stabilizer not found, using raw predictions");
  }

  // 2. Setup Canvas for Preview
  const canvas = document.getElementById("canvas");
  ctx = canvas.getContext("2d");
  canvas.width = 200;
  canvas.height = 200;

  // 3. Configure Pose Engine Callbacks
  poseEngine.setPredictionCallback(handlePrediction);
  poseEngine.setDrawCallback(drawPose);

  // 4. Intercept Game Start to force Webcam Init
  // The GameEngine constructor attached a listener to start-btn that calls gameEngine.start()
  // We override gameEngine.start to inject webcam logic first.
  const originalStart = gameEngine.start.bind(gameEngine);

  gameEngine.start = async () => {
    const startBtn = document.getElementById('start-btn');

    // Initialize Webcam if not ready
    if (!poseEngine.webcam) {
      startBtn.disabled = true;

      try {
        // Step 1: Load Model
        startBtn.innerText = "🤖 Model Loading...";
        await poseEngine.loadModel();

        // Step 2: Setup Webcam
        startBtn.innerText = "📷 Requesting Camera...";

        await poseEngine.setupWebcam({ size: 200, flip: true });

        // Start
        poseEngine.start();

        startBtn.disabled = false;
      } catch (err) {
        console.error(err);

        let msg = "오류가 발생했습니다.";
        if (err.message.includes("Failed to fetch")) {
          msg = "모델 파일 로딩 실패! (CORS/경로 오류)\nVS Code의 'Live Server'로 실행했는지 확인해주세요.";
        } else if (err.message.includes("Permission denied") || err.name === "NotAllowedError") {
          msg = "카메라 권한이 거부되었습니다.\n브라우저 주소창 자물쇠 아이콘을 눌러 권한을 허용해주세요.";
        } else if (err.name === "NotReadableError" || err.message.includes("Could not start video source")) {
          msg = "카메라를 시작할 수 없습니다.\n줌(Zoom), 팀즈 등 카메라를 사용하는 다른 프로그램을 종료해주세요!";
        } else {
          msg = `오류 내용: ${err.message}`;
        }

        alert(msg);
        startBtn.innerText = "Camera Busy? Retry";
        startBtn.disabled = false;
        return;
      }
    }

    // Start Game Logic
    startBtn.innerText = "GAME START"; // Reset text
    originalStart(); // Call actual game start
  };
};

// Handle Presdictions
function handlePrediction(predictions, pose) {
  let topResult;

  // Use Stabilizer if available
  if (stabilizer) {
    topResult = stabilizer.stabilize(predictions);
  } else {
    // Fallback: Find max probability
    topResult = predictions.reduce((prev, current) =>
      (prev.probability > current.probability) ? prev : current
    );
  }

  // Update Label
  const poseLabel = document.getElementById("pose-label");
  if (topResult.className) {
    const className = topResult.className.toUpperCase(); // Ensure LEFT/CENTER/RIGHT
    poseLabel.innerText = `${className} (${(topResult.probability * 100).toFixed(0)}%)`;

    // Send to Game Engine
    if (gameEngine) {
      gameEngine.setBasketZone(className);
    }
  }
}

// Draw Skeleton on Canvas
function drawPose(pose) {
  if (!poseEngine.webcam) return;

  ctx.drawImage(poseEngine.webcam.canvas, 0, 0, 200, 200);

  if (pose) {
    const minPartConfidence = 0.5;
    tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
    tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
  }
}

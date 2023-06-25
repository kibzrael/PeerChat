import { v4 as uuid4 } from "https://jspm.dev/uuid";

let APP_ID = "a511bd6822c64666bf43b9ede355f263";
let token = null;
let uid = uuid4();
console.log("My uid: ", uid);

let client;
let channel;

let query = window.location.search;
let params = new URLSearchParams(query);
let roomId = params.get("room");

if (!roomId) {
  window.location = "/lobby.html";
}

let localStream;
let remoteStream;
let peerConnection;

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

let constraints = {
  video: {
    width: {
      min: 640,
      ideal: 1920,
      max: 1920,
    },
    height: {
      min: 480,
      ideal: 1080,
      max: 1080,
    },
    facingMode: { ideal: "user" },
  },
  audio: { echoCancellation: true, noiseSuppression: true },
};

let init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, token });

  channel = client.createChannel(roomId);
  await channel.join();

  channel.on("MemberJoined", join);
  channel.on("MemberLeft", handleMemberLeft);
  client.on("MessageFromPeer", handleMessageFromPeer);

  loadStream();
};

let loadStream = async () => {
  localStream = await navigator.mediaDevices.getUserMedia(constraints);

  document.querySelector("#user-1").srcObject = localStream;
};

let handleMessageFromPeer = async (message, memberId) => {
  message = JSON.parse(message.text);
  console.log("Message from: ", memberId, "Message: ", message);
  if (message.type == "offer") {
    createAnswer(memberId, message.offer);
  } else if (message.type == "answer") {
    addAnswer(message.answer);
  } else if (message.type == "candidate") {
    if (peerConnection) {
      peerConnection.addIceCandidate(message.candidate);
    }
  }
};

let join = async (memberId) => {
  console.log("New member joined: ", memberId);
  createOffer(memberId);
};

let handleMemberLeft = async (memberId) => {
  console.log("Member left: ", memberId);
  document.querySelector("#user-2").style.display = "none";
  document.querySelector("#user-1").classList.remove("smallFrame");
};

let createPeerConnection = async (memberId) => {
  peerConnection = new RTCPeerConnection(servers);

  remoteStream = new MediaStream();
  document.querySelector("#user-2").srcObject = remoteStream;
  document.querySelector("#user-2").style.display = "block";

  document.querySelector("#user-1").classList.add("smallFrame");

  if (!localStream) {
    await loadStream();
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      console.log("Sending Candidate:", event.candidate);
      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          }),
        },
        memberId
      );
    }
  };
};

let createOffer = async (memberId) => {
  await createPeerConnection(memberId);

  let offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  console.log("Sending Offer:", offer);
  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "offer", offer: offer }) },
    memberId
  );
};

const createAnswer = async (memberId, offer) => {
  await createPeerConnection(memberId);

  await peerConnection.setRemoteDescription(offer);

  let answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "answer", answer: answer }) },
    memberId
  );
};

const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

let leave = async () => {
  await channel.leave();
  await client.logout();
};

let toggleCamera = async () => {
  let videoTrack = localStream
    .getTracks()
    .find((track) => track.kind == "video");
  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    console.log(typeof videoTrack);
    document.querySelector("#camera-btn").style.backgroundColor =
      "rgb(255, 80, 80)";
  } else {
    videoTrack.enabled = true;
    document.querySelector("#camera-btn").style.backgroundColor =
      "rgba(179, 102, 249, .9)";
  }
};

let toggleMic = async () => {
  let audioTrack = localStream
    .getTracks()
    .find((track) => track.kind == "audio");
  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.querySelector("#mic-btn").style.backgroundColor =
      "rgb(255, 80, 80)";
  } else {
    audioTrack.enabled = true;
    document.querySelector("#mic-btn").style.backgroundColor =
      "rgba(179, 102, 249, .9)";
  }
};

window.addEventListener("beforeunload", leave);

document.querySelector("#camera-btn").addEventListener("click", toggleCamera);
document.querySelector("#mic-btn").addEventListener("click", toggleMic);

init();

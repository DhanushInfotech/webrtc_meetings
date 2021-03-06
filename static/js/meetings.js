"use strict";

//to do. Ability to refresh a particular peer
var myHostname = window.location.hostname;
var myPort = window.location.port;
console.log("Hostname: " + myHostname);
var uniqueId = Math.floor((1 + Math.random()) * 0x100000);
var serverUrl = null;
var localStream = null;
var peers = {};
var dataChannels = {}
var remoteVideos = {}
var minWidthInput = document.querySelector('div#minWidth input');
var maxWidthInput = document.querySelector('div#maxWidth input');
var minHeightInput = document.querySelector('div#minHeight input');
var maxHeightInput = document.querySelector('div#maxHeight input');
var framerateInput = document.querySelector('div#framerate input');
minWidthInput.onchange = maxWidthInput.onchange =
    minHeightInput.onchange = maxHeightInput.onchange =
    framerateInput.onchange = displayRangeValue;
var getUserMediaConstraintsDiv =
    document.querySelector('div#getUserMediaConstraints');

// Utility to show the value of a range in a sibling span element
function displayRangeValue(e) {
  var span = e.target.parentElement.querySelector('span');
  span.textContent = e.target.value;

}


var offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};
var dataChannelOptions = null;
var videoContainer = document.getElementById('video-container');
var localVideoContainer = document.getElementById('my-video-container');
var localVideo = null;
/*
document.getElementById("my-video");
localVideo.addEventListener('loadedmetadata', function() {
      trace('Local video videoWidth: ' + this.videoWidth +
        'px,  videoHeight: ' + this.videoHeight + 'px');
    });
*/

// EXCHANGE MESSAGES //
var JOINED_ROOM = 'JOINED-ROOM';
var OFFER_REQUEST = 'OFFER';
var OFFER_ANSWER  = 'ANSWER';
var NEW_ICE_FOUND = 'NEW-ICE-FOUND'
var TEXT_MESSAGE = 'TEXT-MESSAGE'
// ---------------------//

//Text message types //
var SERVER_NOTICE = 1
var PEER_TEXT = 2
//------------------//
var iceServers;
function getIceServers() {
    return iceServers;
}


function getUserMediaConstraints() {
  var constraints = {};
  constraints.audio = true;
  constraints.video = {};
  if (minWidthInput.value !== '0') {
    constraints.video.width = {};
    constraints.video.width.min = minWidthInput.value;
  }
  if (maxWidthInput.value !== '0') {
    constraints.video.width = constraints.video.width || {};
    constraints.video.width.max = maxWidthInput.value;
  }
  if (minHeightInput.value !== '0') {
    constraints.video.height = {};
    constraints.video.height.min = minHeightInput.value;
  }
  if (maxHeightInput.value !== '0') {
    constraints.video.height = constraints.video.height || {};
    constraints.video.height.max = maxHeightInput.value;
  }
  if (framerateInput.value !== '0') {
    constraints.video.frameRate = {};
    constraints.video.frameRate.min = framerateInput.value;
  }
  return constraints;
}

//using websockets
var connection = null;

// Simulate an ice restart.
function restartIce() {
  offerOptions.iceRestart = true;
  trace('my createOffer restart');
  peers[uniqueId].createOffer(
    offerOptions
  ).then(
    onCreateOfferSuccess,
    onCreateSessionDescriptionError
  );
}


function refreshVideos() {
    //redraw all available videos loop through available peers
    for(peer_id in obj){

    }

}
function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function gotRemoteStream(e, peer_id) {
  var remoteVideo = document.createElement('video');
  remoteVideo.srcObject = e.stream;
  remoteVideo.src = window.URL.createObjectURL(e.stream);
  remoteVideo.id = peer_id;
  videoContainer.appendChild(remoteVideo);
  remoteVideos[peer_id] = remoteVideo;
  trace('received remote stream from: ' + peer_id);
}


function sendThroughServer(msg) {
  trace("Sending '" + msg.type + "' message: " + msg);
  var msgJSON = JSON.stringify(msg);
//  switch (connection.readyState) {
//      case WebSocket.CLOSING:
//      case WebSocket.CLOSED:
//        alert('Looks like you got offline. Pls Check your network and restart the call');
//        return;
//  }
  connection.send(msgJSON);
}

function connect(path, ice_uri) {
  var scheme = "ws";

  // If this is an HTTPS connection, we have to use a secure WebSocket
  // connection too, so add another "s" to the scheme.
  var req_protocol = document.location.protocol;
  if (req_protocol === "https:") {
      scheme += "s";
  }
  serverUrl = scheme + "://" + myHostname + ':' + myPort + path;
  initialize(serverUrl);
  ice_uri = req_protocol + "//" + myHostname + ':' + myPort + ice_uri;
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
       if (xhttp.readyState == 4 && xhttp.status == 200) {
          iceServers = JSON.parse(xhttp.responseText);
       }
  };
 trace('using ice uri: ' + ice_uri);
 xhttp.open("GET", ice_uri, true);
 xhttp.send();
 trace('my unique id: ' + uniqueId);
}

function initialize(serverUrl, callbacks) {
  if(callbacks === undefined)
    callbacks = {};
  connection = new WebSocket(serverUrl);
  connection.onopen = function(event) {
    trace('connection opened.');
    var onMediaInit = null;
    if(callbacks.onMediaInit)
      onMediaInit = callbacks.onMediaInit;
    //get ice servers
    start(onMediaInit);
    trace('on signal open sequence complete.');
  };

  connection.onclose = function() {
    trace('server connection closed');
  }

  connection.onmessage = function(evt) {
    handleServerMsg(evt.data);
  }
};

function handleServerMsg(msg_string) {
  trace('handle server msg recieved: ' + msg_string);
  var msg = JSON.parse(msg_string);
  if(msg.name == uniqueId) {
    //trace('message not for me: '+ msg_string + ' test: ' + (msg.target == uniqueId));
    return;
  }

  if(msg.target !== undefined && msg.target != uniqueId )
    return; // mesages withouout a target are considered to be public  messages

  switch(msg.type) {
    case JOINED_ROOM:
      return handleGuest(msg.name);
    case OFFER_REQUEST:
      return handleOfferRequest(msg);
    case OFFER_ANSWER:
      return handleVideoAnswerMsg(msg);
    case NEW_ICE_FOUND:
      return handleNewICECandidateMsg(msg);
    case TEXT_MESSAGE:
      return updateChat(msg, TEXT_MESSAGE);
  }

  trace('unknown message: ' + msg);

}

function start(onMediaInit) {
  /**
  1. Start
  2. get local stream
  3. announce presence (other whatever action is specified in onMediaInit)
  4. wait for response (basically exit. handled from listener)
  **/
  trace('Requesting local stream');
  trace('using media callback ' + onMediaInit);
  var mediaConstraints = getUserMediaConstraints();
  trace('using media constraints: ' + mediaConstraints);
  navigator.mediaDevices.getUserMedia(mediaConstraints)
  .then(function(stream) {
      trace('got user media');
      gotLocalStream(stream); //this is the self stream.
      if(onMediaInit) {
        onMediaInit();
      }
      else {
        announcePresence();
      }
  })
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });
}

function gotLocalStream(stream) {
  trace('Received local stream');
  localVideo = document.createElement('video');
  videoContainer.appendChild(remoteVideo);
  localVideo.src = window.URL.createObjectURL(stream);
  localVideo.srcObject = stream;
  localVideoContainer = localVideoContainer.appendChild(localVideo);
  localStream = stream;
  trace('done setting local stream');
}

function announcePresence() {
    /* This basically announces that  */
    return sendThroughServer({'type' : JOINED_ROOM, 'name' : uniqueId});
}

function resetPeers() {
  //typically remove all the peers and videos

}

function makeOrGetPeer(id) {
  if(peers[id] !== undefined)
     return peers[id];
  var peerConnection = new RTCPeerConnection({
        iceServers: getIceServers()
  });
  peerConnection.onicecandidate = function(e) {
        onIceCandidate(e, id);
  };
  peerConnection.oniceconnectionstatechange = function(e) {
                handleICEConnectionStateChangeEvent(e, id);
  };
  peerConnection.onaddstream = function(e) {
        gotRemoteStream(e, id);
  }
  peers[id] = peerConnection;
  return peerConnection;
}

function handleGuest(peer_id) {
    /**
    new guest joined.
    1) Create webrtc peer connection
    2) then call the created peer
    **/
    makeOrGetPeer(peer_id);
    return call(peer_id);
}

function handleGuestLeft(peer_id) {
    delete peers[peer_id];
    videoContainer.removeChild(remoteVideos[peer_id]);
    delete remoteVideos[peer_id];
}

function handleVideoAnswerMsg(msg) {
  var peer_id = msg.name;
  var desc = new RTCSessionDescription(msg.sdp);
  trace(peer_id + ': setRemoteDescription start');
  var peerConnection = makeOrGetPeer(peer_id);
  peerConnection.setRemoteDescription(desc)
   .then(function() {
    onSetRemoteSuccess(peer_id);
  })
  .catch(function(error) {
    onSetSessionDescriptionError(error, peer_id);
  });
}

function handleNewICECandidateMsg(msg) {
  var peer_id = msg.name;
  var candidate = new RTCIceCandidate(msg.candidate);
  trace(peer_id + ": Adding received ICE candidate: " + JSON.stringify(candidate));
  var peerConnection = makeOrGetPeer(peer_id);
  peerConnection.addIceCandidate(candidate)
    .then(
        function() {
          onAddIceCandidateSuccess(peerConnection);
        })
    .catch(
        function(err) {
          onAddIceCandidateError(peerConnection, err);
        });

}

function onIceCandidate(event, peer_id) {
  if (event.candidate) {
//    myPeerConnection.onicecandidate = function(){};
    trace(peer_id + ': sending ice candidate: ' + event.candidate);
    sendThroughServer({
      name: uniqueId,
      type: NEW_ICE_FOUND,
      target: peer_id,
      candidate: event.candidate
    });
    trace(peer_id + ' ICE candidate: \n' + event.candidate);
  }
}

function handleICEConnectionStateChangeEvent(event, peer_id) {
  var peerConnection = makeOrGetPeer(peer_id);
  trace(peer_id + "*** ICE connection state changed to " + peerConnection.iceConnectionState);

  switch(peerConnection.iceConnectionState) {
    case "closed":
    case "failed":
    //case "disconnected": removing this becos some networks might still recover
      //updateChat({text: peer_id + ' disconnected.'});
      //closeVideoCall();
      break;
    case "completed":
    //case "connected":    //stated might be connected but might still get better connection. Thos is allow new ice
      //peerConnected = true;
      trace(peer_id + ': has been connection completed');
      break;
  }
}


function onAddIceCandidateSuccess(peer_id) {
  trace(peer_id + ' addIceCandidate success');
}

function onAddIceCandidateError(peer_id, error) {
  trace(peer_id + ' failed to add ICE Candidate: ' + error.toString());
}


function handleOfferRequest(msg) {
  var peer_id = msg.name;
  var peerConnection = makeOrGetPeer(peer_id);
//  hangupButton.disabled = false;
  peerConnection.ondatachannel = function(e) { receiveDataChannel(e, peer_id); }; //register to use callers datachannel
  var desc = new RTCSessionDescription(msg.sdp);
  trace('Accepting call from: '+ peer_id);
  trace('recieved offer: '+ peer_id + ' is ' + desc);
  peerConnection.setRemoteDescription(desc)
    .then(function() {
    onSetRemoteSuccess(peer_id);
    var peerConnection = makeOrGetPeer(peer_id);
    trace('Adding remote stream to: ' + peer_id);
    peerConnection.addStream(localStream);
    trace(peer_id + ' createAnswer start');
      // Since the 'remote' side has no media stream we need
      // to pass in the right constraints in order for it to
      // accept the incoming offer of audio and video.
    peerConnection.createAnswer(function(desc) {
                                    onCreateAnswerSuccess(desc, peer_id);
                                }, onCreateSessionDescriptionError);
  })
  .catch(function(error) {
    onSetSessionDescriptionError(error, peer_id);
  });
}

function onSetRemoteSuccess(peer_id) {
  trace(peer_id + ' setRemoteDescription complete');
}

function onCreateAnswerSuccess(desc, peer_id) {
  trace('Answer from ' + peer_id + ': ' + desc.sdp);
  trace(peer_id + ' myPeerConnection setLocalDescription start');
  var peerConnection = makeOrGetPeer(peer_id);
  peerConnection.setLocalDescription(desc)
    .then( function() {
      onSetLocalSuccess(peer_id);
      trace("Sending answer packet back to: " + peer_id);
      sendThroughServer({
          name: uniqueId,
          target: peer_id,
          type: OFFER_ANSWER,
          sdp: desc
        });
  })
   .catch(
   function(error) {
        onSetSessionDescriptionError(error, peer_id);
   });
  // We've configured our end of the call now. Time to send our
  // answer back to the caller so they know that we want to talk
  // and how to talk to us.

}

function onSetLocalSuccess(peer_id) {
  trace(peer_id + ' setLocalDescription complete');
}

function call(peer_id) {
//  hangupButton.disabled = false;
  trace('Starting call');
  trace('creating data channel');
  var peerConnection = makeOrGetPeer(peer_id);
  dataChannels[peer_id] = peerConnection.createDataChannel("chat", dataChannelOptions);
  setUpDataChannel(peer_id);
  trace(peer_id + ' Adding remote stream to myPeerConnection');
  peerConnection.addStream(localStream);
  trace(peer_id + ' createOffer start');
  peerConnection.createOffer(offerOptions)
    .then(function(desc){
        onCreateOfferSuccess(desc, peer_id);
    })
    .catch(function(error) {
        onCreateSessionDescriptionError(error);
    });
}

function onCreateOfferSuccess(desc, peer_id) {
  var localDesc = desc;
  trace('Offer from '+ peer_id + ': '  + desc.sdp);
  trace(peer_id+ ' setLocalDescription start');
  var peerConnection = makeOrGetPeer(peer_id);
  peerConnection.setLocalDescription(desc)
  .then(function() {
    onSetLocalSuccess(peerConnection);
    trace("Sending offer packet back to: " + peer_id);
    sendThroughServer({
        name: uniqueId,
        target: peer_id,
        type: OFFER_REQUEST,
        sdp: desc
      });
  })
  .catch(function(error) {
    onSetSessionDescriptionError(error, peer_id);
    });
}

function onSetSessionDescriptionError(error, peer_id) {
  trace('Failed to set session description ' + peer_id+ ': ' + error.toString());
}

function receiveDataChannel(event, peer_id) {
        trace('recieved data channel: '+ peer_id);
        dataChannels[peer_id] = event.channel;
        setUpDataChannel(peer_id);
}

function setUpDataChannel(peer_id) {
  trace('setting up data channel: ' + peer_id);
  var dataChannel = dataChannels[peer_id];
  dataChannel.onerror = function (error) {
    trace(peer_id + ": Data Channel Error:" + error);
  };

  dataChannel.onmessage = onReceiveDataChannelMessage;

  dataChannel.onopen = function () {
    trace(peer_id + ' Send channel state is: ' + dataChannel.readyState);
    updateChat({text: 'Connected to ' + peer_id});
    enableChat();
  };

  dataChannel.onclose = function () {
    trace(peer_id + ": The Data Channel is Closed");
    disableChat();
  };
  trace('done setting up channel: '+ peer_id);
}



function onReceiveDataChannelMessage (event, peer_id) {
    trace(per_id + ": Got Data Channel Message:" + event.data);
    var msg = JSON.parse(event.data);
    switch(msg.type) {
        case MESSAGE:
            updateChat(msg, PEER_TEXT);
            break;
        case "hang-up":
            handleHangUpMsg(msg);
            break;
    };
  };

function updateChat(msg, text_type) {

}

function enableChat() {

}

function disableChat() {

}


function muteVideo() {
  if(localStream)
    localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
}

function muteAudio() {
  if(localStream)
    localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
}
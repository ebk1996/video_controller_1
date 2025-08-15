import React, { useState, useEffect, useRef, useCallback } from 'react';

// Use this hook for managing local state, which will be the basis for HOCs
const useVideoChatState = () => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  return {
    localStream,
    setLocalStream,
    remoteStream,
    setRemoteStream,
    isCalling,
    setIsCalling,
    isLoading,
    setIsLoading,
    error,
    setError,
  };
};

// Higher-order component to provide state and logic to components
const withVideoChatLogic = (WrappedComponent) => {
  const VideoChatHOC = (props) => {
    const {
      localStream,
      setLocalStream,
      remoteStream,
      setRemoteStream,
      isCalling,
      setIsCalling,
      isLoading,
      setIsLoading,
      error,
      setError,
    } = useVideoChatState();
    
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const signalingSocketRef = useRef(null);

    const STUN_SERVERS = ['stun:stun.l.google.com:19302'];
    // For a production app, you would add TURN servers here.
    const TURN_SERVERS = [];

    const serverConfig = {
      iceServers: [
        ...STUN_SERVERS.map(url => ({ urls: url })),
        ...TURN_SERVERS.map(url => ({ urls: url })),
      ],
    };

    // This function simulates a signaling service. In a real app,
    // this would be a WebSocket connection to a dedicated signaling server.
    const connectToSignalingServer = () => {
      // For this demonstration, we'll use a mock socket that
      // communicates via a simple event loop. In a real scenario,
      // this would be a WebSocket URL to a globally distributed
      // signaling service.
      const mockSignalingSocket = {
        onmessage: null,
        send: (message) => {
          setTimeout(() => {
            const data = JSON.parse(message);
            console.log(`Mock Signaling: ${data.type}`);
            
            // Simulate receiving a message from the other peer
            if (data.type === 'offer' && mockSignalingSocket.onmessage) {
              mockSignalingSocket.onmessage({ data: JSON.stringify({
                type: 'answer',
                sdp: 'mock-sdp-answer'
              })});
            } else if (data.type === 'answer' && mockSignalingSocket.onmessage) {
                // In a real app, this would be a peer's SDP answer
            } else if (data.type === 'candidate' && mockSignalingSocket.onmessage) {
                // In a real app, this would be a peer's ICE candidate
            }
          }, 1000);
        }
      };
      signalingSocketRef.current = mockSignalingSocket;
      return mockSignalingSocket;
    };

    const startCall = useCallback(async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const peerConnection = new RTCPeerConnection(serverConfig);
        peerConnectionRef.current = peerConnection;

        // Add local stream to the peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        // Set up event listeners for the peer connection
        peerConnection.ontrack = (event) => {
          console.log('Received remote track');
          setRemoteStream(event.streams[0]);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('Found ICE candidate');
            // In a real app, send this candidate to the other peer via the signaling server
            signalingSocketRef.current?.send(JSON.stringify({
              type: 'candidate',
              candidate: event.candidate,
            }));
          }
        };

        // Create a mock offer and set it as the local description
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send the offer to the signaling server
        signalingSocketRef.current?.send(JSON.stringify({
          type: 'offer',
          sdp: offer.sdp,
        }));
        
        setIsCalling(true);
      } catch (err) {
        console.error('Error starting the call:', err);
        setError('Failed to access camera/microphone or establish connection.');
      } finally {
        setIsLoading(false);
      }
    }, [setLocalStream, setIsCalling, setIsLoading, setError]);

    const endCall = useCallback(() => {
      // Stop media streams
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }

      // Reset state
      setLocalStream(null);
      setRemoteStream(null);
      setIsCalling(false);
      setIsLoading(false);
      setError(null);
    }, [localStream, setLocalStream, setRemoteStream, setIsCalling, setIsLoading, setError]);

    useEffect(() => {
      connectToSignalingServer();
      return () => {
        // Clean up on component unmount
        if (signalingSocketRef.current) {
          signalingSocketRef.current = null;
        }
        endCall();
      };
    }, [endCall]);

    return (
      <WrappedComponent
        {...props}
        localVideoRef={localVideoRef}
        remoteVideoRef={remoteVideoRef}
        startCall={startCall}
        endCall={endCall}
        isCalling={isCalling}
        isLoading={isLoading}
        error={error}
      />
    );
  };
  return VideoChatHOC;
};

// Main App Component with Higher-order Component pattern
const App_2 = withVideoChatLogic(({
  localVideoRef,
  remoteVideoRef,
  startCall,
  endCall,
  isCalling,
  isLoading,
  error,
}) => {
  return (
    <div className="min-h-screen bg-black text-gray-100 p-8 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-4xl p-6 bg-gray-900 rounded-lg shadow-2xl space-y-6 border border-gray-700">
        <h1 className="text-4xl font-bold text-center text-white mb-6">Video Chat</h1>
        
        {error && (
          <div className="bg-red-800 text-white p-4 rounded-lg text-center">
            <p className="font-semibold">Error: {error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-600 shadow-inner">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 w-full h-full object-cover rounded-lg"
            ></video>
            <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-75 text-white text-xs px-2 py-1 rounded-full">
              Your Video
            </div>
          </div>
          <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden border border-gray-600 shadow-inner">
            {isCalling ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover rounded-lg"
              ></video>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                Waiting for peer...
              </div>
            )}
            <div className="absolute bottom-2 left-2 bg-gray-900 bg-opacity-75 text-white text-xs px-2 py-1 rounded-full">
              Peer Video
            </div>
          </div>
        </div>

        <div className="flex justify-center space-x-4 mt-6">
          {isCalling ? (
            <button
              onClick={endCall}
              disabled={isLoading}
              className="px-6 py-3 bg-red-600 text-white font-bold rounded-full shadow-lg hover:bg-red-700 transition duration-300 transform hover:scale-105 disabled:opacity-50"
            >
              End Call
            </button>
          ) : (
            <button
              onClick={startCall}
              disabled={isLoading}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-full shadow-lg hover:bg-indigo-700 transition duration-300 transform hover:scale-105 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connecting...
                </>
              ) : (
                'Start Call'
              )}
            </button>
          )}
        </div>
      </div>
      <div className="mt-8 text-center text-gray-500 text-sm">
        <p>This is a demonstration of a scalable video chat app. In a real-world scenario, you would have dedicated services for signaling, media routing (SFU/TURN), and user management.</p>
      </div>
    </div>
  );
});

export default App_2;

// apps/maid/app/video-call.tsx

import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  PermissionsAndroid,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONTS, SPACING, RADIUS, API_URL } from "../constants";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../stores/authStore";

// ── Import Agora correctly ──
import RtcEngine, {
  RtcLocalView,
  RtcRemoteView,
  VideoRenderMode,
  ChannelProfile,
  ClientRole,
} from "react-native-agora";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface CallParams {
  booking_id: string;
  channel: string;
  token: string;
  app_id: string;
  caller_name: string;
}

type CallStatus =
  | "idle"
  | "dialing"
  | "ringing"
  | "connected"
  | "ended"
  | "error";

export default function VideoCallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<CallParams>();
  const { token: authToken } = useAuthStore();

  // ── State ──────────────────────────────────────────────────────────
  const [engine, setEngine] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  const [error, setError] = useState("");
  const [callDuration, setCallDuration] = useState(0);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const engineRef = useRef<any>(null);
  const remoteUserRef = useRef<number | null>(null);

  // ── Validate parameters ──────────────────────────────────────────
  const finalAppId = params.app_id || "76bf723b062d4aa39f6395c53fff650e";
  const finalChannel = params.channel || null;
  const finalToken = params.token || null;

  const isValidToken =
    finalToken &&
    typeof finalToken === "string" &&
    finalToken !== "undefined" &&
    finalToken !== "null" &&
    finalToken.length > 10;

  const isValidChannel =
    finalChannel &&
    typeof finalChannel === "string" &&
    /^[a-zA-Z0-9_-]{1,64}$/.test(finalChannel);

  // ── Request permissions ──────────────────────────────────────────
  const requestPermissions = async () => {
    if (Platform.OS === "android") {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        const cameraGranted =
          grants[PermissionsAndroid.PERMISSIONS.CAMERA] ===
          PermissionsAndroid.RESULTS.GRANTED;
        const audioGranted =
          grants[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
          PermissionsAndroid.RESULTS.GRANTED;
        return cameraGranted && audioGranted;
      } catch (err) {
        console.error("Permission error:", err);
        return false;
      }
    }
    return true;
  };

  // ── Initialize Agora Engine ──────────────────────────────────────
  useEffect(() => {
    if (!isValidToken || !finalChannel || !finalAppId) {
      setError("Invalid call parameters. Please try again.");
      return;
    }

    async function initAgora() {
      try {
        // Request permissions
        const hasPermissions = await requestPermissions();
        if (!hasPermissions) {
          setError("Camera and microphone permissions are required.");
          return;
        }

        setCallStatus("dialing");
        setStatusMessage("Dialing...");
        setIsJoining(true);

        // ── Create RTC engine ──
        const rtcEngine = await RtcEngine.create(finalAppId);
        engineRef.current = rtcEngine;
        setEngine(rtcEngine);

        // ── Set channel profile ──
        rtcEngine.setChannelProfile(ChannelProfile.LiveBroadcasting);
        rtcEngine.setClientRole(ClientRole.Broadcaster);

        // ── Enable video ──
        rtcEngine.enableVideo();

        // ── Set video encoder configuration ──
        rtcEngine.setVideoEncoderConfiguration({
          width: 640,
          height: 480,
          frameRate: 15,
          bitrate: 400,
          orientationMode: 0,
        });

        // ── Event listeners ──
        rtcEngine.addListener("UserJoined", (uid: number) => {
          console.log(`👤 Remote user ${uid} joined`);
          remoteUserRef.current = uid;
          setRemoteUid(uid);
          setCallStatus("connected");
          setStatusMessage("Connected");
          setIsJoining(false);
          startDurationTimer();
        });

        rtcEngine.addListener("UserOffline", (uid: number) => {
          console.log(`👋 Remote user ${uid} left`);
          if (uid === remoteUserRef.current) {
            remoteUserRef.current = null;
            setRemoteUid(null);
            setCallStatus("ringing");
            setStatusMessage("Remote user left");
            if (durationInterval.current) {
              clearInterval(durationInterval.current);
            }
          }
        });

        rtcEngine.addListener("ConnectionStateChanged", (state: number) => {
          console.log(`🔄 Connection state: ${state}`);
          if (state === 3) {
            setStatusMessage("Connected");
          } else if (state === 4) {
            setStatusMessage("Reconnecting...");
          } else if (state === 5) {
            setError("Connection failed. Please try again.");
            setIsJoining(false);
          }
        });

        rtcEngine.addListener("Error", (err: any) => {
          console.error("❌ Agora error:", err);
          if (err === 101) {
            setError("Invalid App ID. Please contact support.");
          } else {
            setError(`Error: ${err}`);
          }
          setIsJoining(false);
        });

        // ── Join channel ──
        setStatusMessage("Ringing...");
        setCallStatus("ringing");
        rtcEngine.joinChannel(finalToken, finalChannel, null, 0);
        console.log(`✅ Joined channel: ${finalChannel}`);
        setStatusMessage(
          `Ringing ${params.caller_name || "the other party"}...`,
        );
      } catch (err: any) {
        console.error("❌ Agora init error:", err);
        setError(err.message || "Failed to initialize video call");
        setIsJoining(false);
        setCallStatus("error");
      }
    }

    initAgora();

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      if (engineRef.current) {
        try {
          engineRef.current.leaveChannel();
          engineRef.current.destroy();
        } catch (e) {
          console.error("Cleanup error:", e);
        }
      }
      console.log("🧹 Cleaned up");
    };
  }, [finalAppId, finalChannel, finalToken, isValidToken, isValidChannel]);

  // ── Call duration timer ──────────────────────────────────────────
  const startDurationTimer = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    durationInterval.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // ── Controls ──────────────────────────────────────────────────
  const toggleMute = async () => {
    try {
      if (engine) {
        const mute = !isMuted;
        await engine.muteLocalAudioStream(mute);
        setIsMuted(mute);
      }
    } catch (err) {
      console.error("Toggle mute error:", err);
    }
  };

  const toggleVideo = async () => {
    try {
      if (engine) {
        const off = !isVideoOff;
        await engine.muteLocalVideoStream(off);
        setIsVideoOff(off);
      }
    } catch (err) {
      console.error("Toggle video error:", err);
    }
  };

  const endCall = async () => {
    try {
      setCallStatus("ended");
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      if (engineRef.current) {
        await engineRef.current.leaveChannel();
        await engineRef.current.destroy();
      }
      await fetch(`${API_URL}/api/bookings/${params.booking_id}/video-call`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      }).catch(() => {});
    } catch (err) {
      console.error("End call error:", err);
    }
    router.back();
  };

  const switchCamera = async () => {
    try {
      if (engine) {
        await engine.switchCamera();
      }
    } catch (err) {
      console.error("Switch camera error:", err);
    }
  };

  // ── Render Remote Video ──────────────────────────────────────────
  const renderRemoteVideo = () => {
    if (!remoteUid) {
      return (
        <View style={styles.statusContainer}>
          {callStatus === "dialing" && (
            <>
              <View style={styles.dialingAnimation}>
                <ActivityIndicator size="large" color="#3b82f6" />
              </View>
              <Text style={styles.statusTitle}>Dialing...</Text>
              <Text style={styles.statusSubText}>
                {params.caller_name || "Calling..."}
              </Text>
            </>
          )}
          {callStatus === "ringing" && (
            <>
              <View style={styles.ringingAnimation}>
                <Ionicons
                  name="phone-portrait-outline"
                  size={48}
                  color="#3b82f6"
                />
                <View style={styles.ringingPulse} />
              </View>
              <Text style={styles.statusTitle}>Ringing...</Text>
              <Text style={styles.statusSubText}>
                Waiting for {params.caller_name || "the other party"} to answer
              </Text>
            </>
          )}
          {callStatus === "ended" && (
            <>
              <Ionicons name="call-outline" size={48} color="#ef4444" />
              <Text style={styles.statusTitle}>Call Ended</Text>
              <Text style={styles.statusSubText}>The call has been ended</Text>
            </>
          )}
          {callStatus === "idle" && (
            <>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.statusTitle}>Initializing...</Text>
            </>
          )}
          {callStatus === "error" && (
            <>
              <Ionicons name="alert-circle-outline" size={48} color="#dc3545" />
              <Text style={[styles.statusTitle, { color: "#dc3545" }]}>
                Error
              </Text>
              <Text style={styles.statusSubText}>{error}</Text>
            </>
          )}
        </View>
      );
    }

    return (
      <View style={styles.remoteVideoContainer}>
        <RtcRemoteView.SurfaceView
          style={styles.remoteVideo}
          uid={remoteUid}
          renderMode={VideoRenderMode.Hidden}
        />
        <View style={styles.durationOverlay}>
          <Text style={styles.durationText}>
            {formatDuration(callDuration)}
          </Text>
        </View>
        <View style={styles.remoteLabelContainer}>
          <Text style={styles.remoteLabel}>
            {params.caller_name || "Remote User"}
          </Text>
        </View>
      </View>
    );
  };

  // ── Render error state ──────────────────────────────────────────
  if (error && callStatus !== "error") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="call-outline" size={64} color="#dc3545" />
          <Text style={styles.errorTitle}>Connection Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity
            style={styles.endCallBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.endCallBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ──────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Remote video */}
      {renderRemoteVideo()}

      {/* Local video (picture-in-picture) */}
      {(callStatus === "dialing" ||
        callStatus === "ringing" ||
        callStatus === "connected") && (
        <View style={styles.localVideoContainer}>
          <RtcLocalView.SurfaceView
            style={styles.localVideo}
            renderMode={VideoRenderMode.Hidden}
          />
          <View style={styles.localLabelContainer}>
            <Text style={styles.localLabel}>You</Text>
          </View>
        </View>
      )}

      {/* Controls */}
      {(callStatus === "dialing" ||
        callStatus === "ringing" ||
        callStatus === "connected") && (
        <View style={styles.controls}>
          {callStatus === "connected" && (
            <>
              <TouchableOpacity
                style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                onPress={toggleMute}
              >
                <Ionicons
                  name={isMuted ? "mic-off" : "mic"}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.controlBtn,
                  isVideoOff && styles.controlBtnActive,
                ]}
                onPress={toggleVideo}
              >
                <Ionicons
                  name={isVideoOff ? "videocam-off" : "videocam"}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlBtn}
                onPress={switchCamera}
              >
                <Ionicons name="camera-reverse" size={24} color="#fff" />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.endCallBtn} onPress={endCall}>
            <Ionicons name="call" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  remoteVideoContainer: {
    flex: 1,
    backgroundColor: "#1e293b",
  },
  remoteVideo: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  remoteLabelContainer: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
  },
  remoteLabel: {
    color: "#fff",
    fontFamily: FONTS.medium,
    fontSize: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  durationOverlay: {
    position: "absolute",
    top: 60,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  durationText: {
    color: "#fff",
    fontFamily: FONTS.bold,
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  statusContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 20,
  },
  statusTitle: {
    color: "#fff",
    fontFamily: FONTS.bold,
    fontSize: 24,
    marginTop: 16,
  },
  statusSubText: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: FONTS.regular,
    fontSize: 16,
    marginTop: 8,
    textAlign: "center",
  },
  dialingAnimation: {
    marginBottom: 8,
  },
  ringingAnimation: {
    position: "relative",
    marginBottom: 8,
  },
  ringingPulse: {
    position: "absolute",
    top: -12,
    left: -12,
    right: -12,
    bottom: -12,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#3b82f6",
    opacity: 0,
  },
  localVideoContainer: {
    position: "absolute",
    bottom: 100,
    right: 16,
    width: SCREEN_W * 0.25,
    height: SCREEN_H * 0.2,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "#1e1e2e",
    zIndex: 20,
    minWidth: 100,
    minHeight: 140,
  },
  localVideo: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  localLabelContainer: {
    position: "absolute",
    bottom: 8,
    right: 8,
    zIndex: 5,
  },
  localLabel: {
    color: "rgba(255,255,255,0.6)",
    fontFamily: FONTS.regular,
    fontSize: 10,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  controls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.lg,
    gap: 20,
    backgroundColor: "#0f172a",
    paddingBottom: SPACING.xl,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2d2d44",
    justifyContent: "center",
    alignItems: "center",
  },
  controlBtnActive: {
    backgroundColor: "#dc2626",
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
  },
  endCallBtnText: {
    color: "#fff",
    fontFamily: FONTS.bold,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: SPACING.xl,
  },
  errorTitle: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    color: "#dc3545",
    marginTop: SPACING.md,
  },
  errorMessage: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
});

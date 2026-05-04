import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  initializeFirestore,
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
} from "firebase/firestore";
import {
  Play,
  Pause,
  Square,
  Rewind,
  FastForward,
  Settings2,
  Lock,
  Unlock,
  X,
  Edit,
  Trash2,
  Headphones,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  Info,
  Link as LinkIcon,
  Loader2,
  AlignLeft,
  Activity,
  Mic,
} from "lucide-react";

// --- ★ 관리자님의 완벽한 파이어베이스 독립 설정입니다 ★ ---
const firebaseConfig = {
  apiKey: "AIzaSyB6aOTeCJxB3mdCxQjDEe4YRURL0H-BsEA",
  authDomain: "songpo-digital-gallery.firebaseapp.com",
  projectId: "songpo-digital-gallery",
  storageBucket: "songpo-digital-gallery.firebasestorage.app",
  messagingSenderId: "446273966586",
  appId: "1:446273966586:web:2a372d0d1fefd13afe1443",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

// 프로젝트 식별자 고정 (변경 금지)
const appId = "songpo-digital-gallery";

// 링크 자동 변환 함수
const getDirectAudioUrl = (url: string) => {
  if (!url) return "";
  if (url.includes("dropbox.com")) {
    let newUrl = url.replace("www.dropbox.com", "dl.dropboxusercontent.com");
    newUrl = newUrl.replace("dropbox.com", "dl.dropboxusercontent.com");
    newUrl = newUrl.replace("?dl=0", "").replace("&dl=0", "");
    return newUrl;
  }
  let fileId = null;
  const regex1 = /\/d\/([a-zA-Z0-9_-]+)/;
  const regex2 = /[?&]id=([a-zA-Z0-9_-]+)/;
  if (url.match(regex1)) fileId = url.match(regex1)?.[1];
  else if (url.match(regex2)) fileId = url.match(regex2)?.[1];
  if (fileId) return `https://drive.google.com/uc?export=download&id=${fileId}`;
  return url;
};

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [artworks, setArtworks] = useState<any>({});
  const [dbAdminPassword, setDbAdminPassword] = useState("0000");

  const [loading, setLoading] = useState(true);

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [selectedArt, setSelectedArt] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [editingNumber, setEditingNumber] = useState<number | null>(null);
  const [audioError, setAudioError] = useState("");

  const [todayPlays, setTodayPlays] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);

  // 인증 로직 (제미나이 코드를 완벽 제거하고, 오직 '익명 로그인'만 수행합니다)
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("인증 오류:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 데이터베이스 연결
  useEffect(() => {
    if (!user) return;
    // 경로를 독립된 앱 환경에 맞춰 구성합니다.
    const artworksRef = collection(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "artworks"
    );
    const unsubscribeArtworks = onSnapshot(
      artworksRef,
      (snapshot) => {
        const loadedArtworks: any = {};
        snapshot.docs.forEach((doc) => {
          loadedArtworks[doc.data().number] = { id: doc.id, ...doc.data() };
        });
        setArtworks(loadedArtworks);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const settingsRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "settings",
      "adminConfig"
    );
    const unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDbAdminPassword(data.password);
      } else {
        setDoc(settingsRef, { password: "0000" }).catch(() => {});
      }
    });

    const statsRef = doc(
      db,
      "artifacts",
      appId,
      "public",
      "data",
      "stats",
      "daily_usage"
    );
    const unsubscribeStats = onSnapshot(statsRef, (docSnap) => {
      if (docSnap.exists()) {
        const todayStr = new Date().toISOString().split("T")[0];
        setTodayPlays(docSnap.data()[todayStr] || 0);
      }
    });

    return () => {
      unsubscribeArtworks();
      unsubscribeSettings();
      unsubscribeStats();
    };
  }, [user]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("오디오 재생 실패:", error);
          setIsPlaying(false);
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, selectedArt]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const trackPlayCount = async () => {
    if (!user || isAdmin) return;
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const statsRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "stats",
        "daily_usage"
      );
      await setDoc(
        statsRef,
        {
          [todayStr]: increment(1),
        },
        { merge: true }
      );
    } catch (e) {
      console.error("트래픽 기록 오류:", e);
    }
  };

  const handleAudioError = (e: any) => {
    setAudioError(
      "오늘 관람 인원을 초과했습니다. 내일 다시 전시관으로 찾아와 주세요!"
    );
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (audioError) {
      setAudioError("");
      if (audioRef.current) audioRef.current.load();
    }
    if (!isPlaying) {
      trackPlayCount();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleClosePlayer = () => {
    handleStop();
    setSelectedArt(null);
  };

  const skipForward = () => {
    if (audioRef.current) audioRef.current.currentTime += 10;
  };
  const skipBackward = () => {
    if (audioRef.current)
      audioRef.current.currentTime = Math.max(
        0,
        audioRef.current.currentTime - 10
      );
  };

  const handleSelectArt = (number: number) => {
    if (loading) return;
    if (isAdmin) {
      setEditingNumber(number);
      return;
    }
    if (artworks[number]) {
      if (selectedArt?.number === number) {
        handlePlayPause();
      } else {
        setSelectedArt(artworks[number]);
        setAudioError("");
        setPlaybackRate(1);
        setIsPlaying(true);
        trackPlayCount();
      }
    }
  };

  const handleAdminLogin = (e: any) => {
    e.preventDefault();
    if (loginPassword === dbAdminPassword) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setLoginPassword("");
      setLoginError("");
      handleStop();
      setSelectedArt(null);
    } else {
      setLoginError("비밀번호가 일치하지 않습니다.");
    }
  };

  const gridNumbers = Array.from({ length: 60 }, (_, i) => i + 1);
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  const estimatedMB = todayPlays * 2;
  const maxMB = 20000;
  const usagePercentage = Math.min((estimatedMB / maxMB) * 100, 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col pb-64">
      <header className="bg-gray-800 border-b border-gray-700 p-3 sm:p-4 sticky top-0 z-10 shadow-md">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex bg-yellow-500/10 p-1.5 sm:p-2 rounded-xl flex-shrink-0">
              <Headphones className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-500" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-[10px] sm:text-sm text-yellow-500/80 font-medium mb-0.5 leading-none mt-1">
                목소리로 피어나는 명화의 숨결
              </span>
              <h1 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-white leading-tight mt-0.5">
                함께 듣는 송포 미술관
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {loading && (
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin mr-1 sm:mr-2" />
            )}
            {isAdmin && (
              <button
                onClick={() => setShowPasswordChange(true)}
                className="flex items-center gap-1 px-2 py-1.5 sm:px-3 text-xs sm:text-sm bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-200"
              >
                <KeyRound className="w-4 h-4" />
                <span className="hidden sm:inline">비밀번호 변경</span>
              </button>
            )}
            <button
              onClick={() =>
                isAdmin ? setIsAdmin(false) : setShowAdminLogin(true)
              }
              className={`p-2 rounded-full transition-colors ${
                isAdmin
                  ? "bg-green-500/10 hover:bg-green-500/20"
                  : "hover:bg-gray-700"
              }`}
            >
              {isAdmin ? (
                <Unlock className="w-5 h-5 text-green-400" />
              ) : (
                <Lock className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-6">
        {isAdmin && (
          <div className="mb-8">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-4 shadow-lg animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-blue-400" />
                <h2 className="font-bold text-gray-200">
                  오늘 예상 트래픽 사용량
                </h2>
              </div>

              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>
                  {todayPlays}회 재생 (약 {estimatedMB}MB)
                </span>
                <span>20,000MB 한도</span>
              </div>

              <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden border border-gray-700">
                <div
                  className={`h-full transition-all duration-500 ${
                    estimatedMB > 18000
                      ? "bg-red-500"
                      : estimatedMB > 15000
                      ? "bg-yellow-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${usagePercentage}%` }}
                ></div>
              </div>

              <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                오디오 1회 재생을 2MB로 계산한 추정치입니다. 바(Bar)가 꽉 차면
                관람객에게 인원 초과 안내문이 노출될 수 있습니다.
              </p>
            </div>
          </div>
        )}

        <div className="mb-6 text-center flex flex-col items-center justify-center min-h-[40px]">
          {isAdmin ? (
            <div className="inline-block bg-green-500/10 text-green-400 px-4 py-2 rounded-full text-sm font-medium">
              관리자 모드: 번호를 클릭하여 작품을 등록/수정하세요.
            </div>
          ) : (
            <div className="transition-opacity duration-300">
              {loading ? (
                <p className="text-gray-400 text-sm animate-pulse">
                  데이터를 연결 중입니다...
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-gray-400 text-sm">
                    전시관에 오신 것을 환영합니다.
                  </p>
                  <p className="text-gray-400 text-sm">
                    안내를 원하는 작품의 번호를 터치하세요.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          className={`grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-3 transition-opacity duration-500 ${
            loading ? "opacity-50" : "opacity-100"
          }`}
        >
          {gridNumbers.map((num) => {
            const isAvailable = !!artworks[num];
            const isSelected = selectedArt?.number === num;
            return (
              <button
                key={num}
                onClick={() => handleSelectArt(num)}
                className={`
                  relative flex flex-col items-center justify-center aspect-square rounded-xl text-lg font-semibold transition-all duration-300 shadow-sm
                  ${
                    loading
                      ? "bg-gray-800/30 text-gray-600 cursor-wait animate-pulse"
                      : ""
                  } 
                  ${
                    !loading && isAdmin
                      ? "hover:ring-2 hover:ring-yellow-500 cursor-pointer"
                      : ""
                  }
                  ${
                    !loading && !isAdmin && isAvailable
                      ? "cursor-pointer hover:scale-105 active:scale-95"
                      : ""
                  }
                  ${
                    !loading && !isAdmin && !isAvailable
                      ? "cursor-default opacity-40"
                      : ""
                  }
                  ${
                    !loading && isSelected
                      ? "bg-yellow-500 text-gray-900 shadow-yellow-500/50 shadow-lg"
                      : ""
                  }
                  ${
                    !loading && !isSelected && isAvailable
                      ? "bg-gray-800 text-white border border-gray-700"
                      : ""
                  }
                  ${
                    !loading && !isSelected && !isAvailable
                      ? "bg-gray-800/50 text-gray-500"
                      : ""
                  }
                `}
              >
                {num}
                {!loading && isAvailable && !isSelected && !isAdmin && (
                  <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-yellow-500"></div>
                )}
                {!loading && isSelected && isPlaying && !audioError && (
                  <div className="absolute bottom-1 flex gap-0.5 items-end h-2">
                    <div className="w-0.5 h-full bg-gray-900 animate-pulse"></div>
                    <div className="w-0.5 h-1/2 bg-gray-900 animate-pulse delay-75"></div>
                    <div className="w-0.5 h-3/4 bg-gray-900 animate-pulse delay-150"></div>
                  </div>
                )}
                {!loading && isSelected && audioError && (
                  <AlertCircle className="absolute bottom-1 w-3 h-3 text-red-500" />
                )}
                {!loading && isAdmin && isAvailable && (
                  <Edit className="absolute top-1 right-1 w-3 h-3 text-gray-400" />
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* 하단 확장형 오디오 플레이어 & 텍스트 뷰어 */}
      {selectedArt && !isAdmin && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.5)] z-20 animate-in slide-in-from-bottom-5 duration-300 rounded-t-3xl">
          <button
            onClick={handleClosePlayer}
            className="absolute -top-4 right-4 bg-gray-700 border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-600 rounded-full p-2 shadow-lg transition-colors z-30"
            title="창 닫기"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-w-4xl mx-auto px-4 py-5 flex flex-col gap-4 relative">
            <div className="flex items-center gap-4 pr-8">
              <div
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl transition-colors shadow-inner ${
                  audioError
                    ? "bg-red-900 text-red-400"
                    : "bg-gray-900 text-yellow-500"
                }`}
              >
                {selectedArt.number}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate text-lg leading-tight">
                  {selectedArt.title}
                </h3>

                {selectedArt.docent && !audioError && (
                  <p className="text-xs sm:text-sm text-blue-300 font-medium flex items-center gap-1 mt-1 truncate">
                    <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />{" "}
                    도슨트: {selectedArt.docent}
                  </p>
                )}

                {audioError ? (
                  <p
                    className="text-sm text-red-400 font-medium flex items-start gap-1.5 mt-2"
                    title={audioError}
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span className="leading-tight break-keep">
                      {audioError}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-yellow-500 mt-1">
                    {isPlaying ? "재생 중" : "일시정지"} • {playbackRate}x 속도
                  </p>
                )}
              </div>
            </div>

            {selectedArt.description && !audioError && (
              <div className="w-full bg-gray-900/80 border border-gray-700/50 rounded-2xl p-5 overflow-y-auto max-h-[35vh] md:max-h-[30vh] text-[15px] leading-relaxed text-gray-200 whitespace-pre-wrap shadow-inner custom-scrollbar">
                {selectedArt.description}
              </div>
            )}

            {!audioError && (
              <div className="flex items-center justify-between gap-2 px-2 pt-1">
                <div className="flex items-center gap-3 sm:gap-6 flex-1 justify-center">
                  <button
                    onClick={handleStop}
                    className="p-3 text-gray-400 hover:text-white transition-colors"
                    title="정지"
                  >
                    <Square className="w-6 h-6" fill="currentColor" />
                  </button>
                  <button
                    onClick={skipBackward}
                    className="p-3 text-gray-300 hover:text-white hover:bg-gray-700 rounded-full transition-all active:scale-90"
                    title="10초 되감기"
                  >
                    <Rewind className="w-7 h-7" fill="currentColor" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className={`w-16 h-16 bg-yellow-500 hover:bg-yellow-400 text-gray-900 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg transition-transform active:scale-95`}
                  >
                    {isPlaying ? (
                      <Pause className="w-7 h-7" fill="currentColor" />
                    ) : (
                      <Play className="w-7 h-7 ml-1" fill="currentColor" />
                    )}
                  </button>
                  <button
                    onClick={skipForward}
                    className="p-3 text-gray-300 hover:text-white hover:bg-gray-700 rounded-full transition-all active:scale-90"
                    title="10초 앞으로"
                  >
                    <FastForward className="w-7 h-7" fill="currentColor" />
                  </button>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="p-3 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors flex items-center gap-1"
                    title="재생 속도 조절"
                  >
                    <Settings2 className="w-6 h-6" />
                    <span className="text-sm font-medium w-6 text-center">
                      {playbackRate}x
                    </span>
                  </button>
                  {showSpeedMenu && (
                    <div className="absolute bottom-full right-0 mb-3 bg-gray-700 border border-gray-600 rounded-xl shadow-2xl overflow-hidden min-w-[120px]">
                      {speedOptions.map((rate) => (
                        <button
                          key={rate}
                          onClick={() => {
                            setPlaybackRate(rate);
                            setShowSpeedMenu(false);
                          }}
                          className={`w-full text-left px-5 py-3 text-sm hover:bg-gray-600 transition-colors ${
                            playbackRate === rate
                              ? "text-yellow-400 font-bold bg-gray-800/50"
                              : "text-gray-200"
                          }`}
                        >
                          {rate}x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <audio
            ref={audioRef}
            src={getDirectAudioUrl(selectedArt.audioUrl)}
            onEnded={() => setIsPlaying(false)}
            onLoadedData={() => setAudioError("")}
            onError={handleAudioError}
            className="hidden"
          />
        </div>
      )}

      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-gray-800 rounded-3xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Lock className="w-5 h-5 text-yellow-500" /> 관리자 접속
              </h2>
              <button
                onClick={() => {
                  setShowAdminLogin(false);
                  setLoginError("");
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdminLogin}>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">
                  비밀번호
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setLoginError("");
                  }}
                  className={`w-full bg-gray-900 border ${
                    loginError ? "border-red-500" : "border-gray-700"
                  } rounded-xl p-3 text-white focus:outline-none focus:border-yellow-500`}
                  placeholder="비밀번호 입력"
                  autoFocus
                />
                {loginError && (
                  <p className="text-red-400 text-sm mt-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> {loginError}
                  </p>
                )}
              </div>
              <button
                type="submit"
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-xl mt-2"
              >
                접속하기
              </button>
            </form>
          </div>
        </div>
      )}

      {showPasswordChange && isAdmin && (
        <PasswordChangeModal
          db={db}
          appId={appId}
          currentDbPassword={dbAdminPassword}
          onClose={() => setShowPasswordChange(false)}
        />
      )}

      {editingNumber !== null && (
        <AdminEditModal
          number={editingNumber}
          existingData={artworks[editingNumber]}
          onClose={() => setEditingNumber(null)}
          db={db}
          appId={appId}
        />
      )}
    </div>
  );
}

function PasswordChangeModal({ db, appId, currentDbPassword, onClose }: any) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError("");
    if (currentPassword !== currentDbPassword)
      return setError("현재 비밀번호가 일치하지 않습니다.");
    if (newPassword.length < 4)
      return setError("새 비밀번호는 4자리 이상이어야 합니다.");
    if (newPassword !== confirmPassword)
      return setError("새 비밀번호가 서로 일치하지 않습니다.");
    setIsSaving(true);
    try {
      await updateDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "settings",
          "adminConfig"
        ),
        { password: newPassword }
      );
      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError("비밀번호 변경 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-3xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <KeyRound className="w-5 h-5 text-yellow-500" /> 비밀번호 변경
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={success}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {success ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">변경 완료!</h3>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <input
                  type="password"
                  placeholder="현재 비밀번호"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="새 비밀번호 (4자리 이상)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
                  required
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="새 비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white"
                  required
                />
              </div>
            </div>
            {error && (
              <p className="text-red-400 text-sm mt-4 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> {error}
              </p>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-xl mt-6 disabled:opacity-50"
            >
              {isSaving ? "변경 중..." : "변경 저장"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function AdminEditModal({ number, existingData, onClose, db, appId }: any) {
  const [title, setTitle] = useState(existingData?.title || "");

  const initialDocent = existingData?.docent || "";
  let initGrade = "",
    initClass = "",
    initName = "";
  const gradeMatch = initialDocent.match(/(\d+)\s*학년/);
  const classMatch = initialDocent.match(/(\d+)\s*반/);

  if (gradeMatch) initGrade = gradeMatch[1];
  if (classMatch) initClass = classMatch[1];
  initName = initialDocent
    .replace(/\d+\s*학년/g, "")
    .replace(/\d+\s*반/g, "")
    .trim();

  const [docentGrade, setDocentGrade] = useState(initGrade);
  const [docentClass, setDocentClass] = useState(initClass);
  const [docentName, setDocentName] = useState(initName);

  const [audioUrl, setAudioUrl] = useState(existingData?.audioUrl || "");
  const [description, setDescription] = useState(
    existingData?.description || ""
  );
  const [isSaving, setIsSaving] = useState(false);
  const [testError, setTestError] = useState("");

  const handleSave = async (e: any) => {
    e.preventDefault();
    if (!title || !audioUrl) return;

    let finalDocentArr = [];
    if (docentGrade.trim()) finalDocentArr.push(`${docentGrade.trim()}학년`);
    if (docentClass.trim()) finalDocentArr.push(`${docentClass.trim()}반`);
    if (docentName.trim()) finalDocentArr.push(docentName.trim());
    const finalDocent = finalDocentArr.join(" ");

    setIsSaving(true);
    try {
      const docRef = doc(
        db,
        "artifacts",
        appId,
        "public",
        "data",
        "artworks",
        existingData?.id || `art_${number}`
      );
      await setDoc(docRef, {
        number,
        title,
        docent: finalDocent,
        audioUrl,
        description,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch (error) {
      console.error("저장 실패:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingData?.id) return;
    setIsSaving(true);
    try {
      await deleteDoc(
        doc(
          db,
          "artifacts",
          appId,
          "public",
          "data",
          "artworks",
          existingData.id
        )
      );
      onClose();
    } catch (error) {
      console.error("삭제 실패:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const testAudioUrl = getDirectAudioUrl(audioUrl);

  const handleTestError = (e: any) => {
    const error = e.target.error;
    if (error && error.code === 2)
      setTestError("오류: 네트워크 연결 거부됨. 다른 클라우드를 이용해주세요.");
    else if (error && error.code === 4)
      setTestError(
        "오류: 브라우저가 지원하지 않는 파일 형식입니다. (mp3가 아닐 수 있음)"
      );
    else setTestError("오류: 재생할 수 없는 링크입니다.");
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-gray-800 rounded-3xl p-6 w-full max-w-md border border-gray-700 shadow-2xl my-auto mt-10 mb-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <span className="w-8 h-8 rounded-full bg-yellow-500 text-gray-900 flex items-center justify-center text-sm">
              {number}
            </span>
            번 작품 {existingData ? "수정" : "등록"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-green-900/30 border border-green-700 rounded-lg p-4 mb-5 text-sm text-green-100">
          <p className="font-bold mb-2 flex items-center gap-1 text-green-400">
            <Info className="w-4 h-4" /> 드롭박스(Dropbox) 권장
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-xs text-gray-300">
            <li>드롭박스에 mp3 파일 업로드</li>
            <li>
              파일의 <strong>[공유] ➔ [링크 복사]</strong> 클릭
            </li>
            <li>아래 URL 칸에 복사한 링크 붙여넣기</li>
          </ol>
        </div>

        <form onSubmit={handleSave}>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2">
              명화 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-yellow-500"
              placeholder="예: 모나리자"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-1">
              도슨트 정보 (선택사항)
            </label>
            <div className="flex gap-2 items-center">
              <div className="flex-[0.8] flex items-center bg-gray-900 border border-gray-700 rounded-xl overflow-hidden focus-within:border-yellow-500 transition-colors">
                <input
                  type="text"
                  inputMode="numeric"
                  value={docentGrade}
                  onChange={(e) => setDocentGrade(e.target.value)}
                  className="w-full bg-transparent text-white py-3 pl-3 pr-1 outline-none text-center"
                  placeholder="1"
                />
                <span className="text-gray-400 pr-3 flex-shrink-0 text-sm whitespace-nowrap">
                  학년
                </span>
              </div>
              <div className="flex-[0.8] flex items-center bg-gray-900 border border-gray-700 rounded-xl overflow-hidden focus-within:border-yellow-500 transition-colors">
                <input
                  type="text"
                  inputMode="numeric"
                  value={docentClass}
                  onChange={(e) => setDocentClass(e.target.value)}
                  className="w-full bg-transparent text-white py-3 pl-3 pr-1 outline-none text-center"
                  placeholder="2"
                />
                <span className="text-gray-400 pr-3 flex-shrink-0 text-sm whitespace-nowrap">
                  반
                </span>
              </div>
              <div className="flex-[1.5]">
                <input
                  type="text"
                  value={docentName}
                  onChange={(e) => setDocentName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
                  placeholder="이름 (홍길동)"
                />
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-2 flex justify-between items-end">
              <span>
                오디오 링크 (드롭박스 권장){" "}
                <span className="text-red-500">*</span>{" "}
                <LinkIcon className="w-3 h-3 inline ml-1" />
              </span>
            </label>
            <input
              type="url"
              value={audioUrl}
              onChange={(e) => {
                setAudioUrl(e.target.value);
                setTestError("");
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white mb-2 focus:outline-none focus:border-yellow-500"
              placeholder="https://www.dropbox.com/scl/fi/..."
              required
            />

            {testAudioUrl && (
              <div className="bg-gray-900 p-3 rounded-xl border border-gray-700 mt-1">
                <p className="text-xs text-gray-400 mb-2">▶ 미리듣기 테스트</p>
                <audio
                  controls
                  src={testAudioUrl}
                  onError={handleTestError}
                  onLoadedData={() => setTestError("")}
                  className="w-full h-10 rounded"
                />
                {testError && (
                  <p className="text-red-400 text-xs mt-2">{testError}</p>
                )}
              </div>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-sm text-gray-400 mb-2 flex items-center gap-1">
              <AlignLeft className="w-4 h-4" /> 작품 해설 / 스크립트 (선택사항)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white h-24 resize-none focus:outline-none focus:border-yellow-500 custom-scrollbar"
              placeholder="관람객이 오디오를 들으며 읽을 수 있는 글이나 대본을 적어주세요."
            />
          </div>

          <div className="flex gap-3">
            {existingData && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving}
                className="flex items-center justify-center gap-1 px-4 py-3 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-xl transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-3 rounded-xl disabled:opacity-50 transition-colors"
            >
              {isSaving ? "저장 중..." : "저장하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

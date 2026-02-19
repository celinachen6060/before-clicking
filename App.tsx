import React, { useState, useCallback, useEffect } from 'react';
import { ViewState, Outfit, ClothingItem, Category } from './types';
import ModelViewer from './components/ModelViewer';
import Wardrobe from './components/Wardrobe';

/**
 * FIREBASE CONFIGURATION
 * Replace the object below with the one from your Firebase Console
 */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase using the compat SDKs imported in index.html
const fb = (window as any).firebase;
if (fb && !fb.apps.length) {
  fb.initializeApp(firebaseConfig);
}

const auth = fb ? fb.auth() : null;
const db = fb ? fb.firestore() : null;

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('main');
  const [outfit, setOutfit] = useState<Outfit>({});
  const [wardrobeItems, setWardrobeItems] = useState<ClothingItem[]>([]);
  const [baseModelImage, setBaseModelImage] = useState<string | undefined>(undefined);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Auth State Observer
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    // Set persistence to SESSION to handle restricted environments (like iframes)
    auth.setPersistence(fb.auth.Auth.Persistence.SESSION).catch(console.error);

    // Handle the result of a redirect login
    auth.getRedirectResult().then((result: any) => {
      if (result.user) {
        console.log("Successfully logged in via redirect", result.user);
      }
    }).catch((error: any) => {
      console.error("Redirect login error:", error);
      if (error.code === 'auth/operation-not-supported-in-this-environment') {
        setAuthError("Environment restricted: Standard login is unavailable. Use Guest Mode to continue.");
      }
    });

    const unsubscribe = auth.onAuthStateChanged((u: any) => {
      setUser(u);
      setLoading(false);
      if (u && !u.isAnonymous) {
        loadUserData(u.uid);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch data from Firestore on login
  const loadUserData = async (uid: string) => {
    if (!db) return;
    try {
      const doc = await db.collection('users').doc(uid).collection('data').doc('current_session').get();
      if (doc.exists) {
        const data = doc.data();
        if (data?.wardrobeItems) setWardrobeItems(data.wardrobeItems);
        if (data?.outfit) setOutfit(data.outfit);
        if (data?.baseModelImage) setBaseModelImage(data.baseModelImage);
      }
    } catch (e) {
      console.error("Cloud load error:", e);
    }
  };

  // Background Cloud Sync (Auto-save)
  useEffect(() => {
    // Only sync if it's a real logged-in user and not a guest
    if (!user || !db || user.isAnonymous) return;
    
    const syncTimeout = setTimeout(async () => {
      setSyncing(true);
      try {
        await db.collection('users').doc(user.uid).collection('data').doc('current_session').set({
          wardrobeItems,
          outfit,
          baseModelImage,
          lastUpdated: fb.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.error("Cloud sync error:", e);
      } finally {
        setSyncing(false);
      }
    }, 2000);

    return () => clearTimeout(syncTimeout);
  }, [wardrobeItems, outfit, baseModelImage, user]);

  const handleLogin = async () => {
    if (!auth) return;
    setAuthError(null);
    const provider = new fb.auth.GoogleAuthProvider();
    try {
      await auth.signInWithRedirect(provider);
    } catch (e: any) {
      console.error("Login call failed", e);
      if (e.code === 'auth/operation-not-supported-in-this-environment') {
        setAuthError("This browser environment does not support Google Login. Please use Guest Mode.");
      } else {
        alert("Login could not be initiated.");
      }
    }
  };

  const handleGuestLogin = () => {
    // Mock user for local testing if the environment is restricted
    setUser({
      uid: 'guest_user',
      displayName: 'Guest Stylist',
      photoURL: 'https://ui-avatars.com/api/?name=Guest+Stylist&background=1A1A1A&color=fff',
      isAnonymous: true
    });
  };

  const handleLogout = () => {
    if (user?.isAnonymous) {
      if (confirm("Sign out? Your items will not be saved for next time in Guest Mode.")) {
        setUser(null);
        setWardrobeItems([]);
        setOutfit({});
        setBaseModelImage(undefined);
      }
      return;
    }

    if (!auth) return;
    if (confirm("Sign out and clear local view? Your items are saved in the cloud.")) {
      auth.signOut();
      setWardrobeItems([]);
      setOutfit({});
      setBaseModelImage(undefined);
      setView('main');
    }
  };

  const saveCurrentOutfit = async () => {
    if (user?.isAnonymous) {
      alert("Sign in to cloud-archive your looks!");
      return;
    }
    if (!user || !db || Object.keys(outfit).length === 0) return;
    setSyncing(true);
    try {
      const outfitId = `look_${Date.now()}`;
      await db.collection('users').doc(user.uid).collection('outfits').doc(outfitId).set({
        outfit,
        createdAt: fb.firestore.FieldValue.serverTimestamp()
      });
      alert("Style archived to your collection!");
    } catch (e) {
      alert("Save failed.");
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectItem = useCallback((item: ClothingItem) => {
    setOutfit(prev => ({ ...prev, [item.category]: item }));
    setView('main');
  }, []);

  const resetAll = () => {
    if (confirm("Reset current canvas?")) {
      setOutfit({});
      setBaseModelImage(undefined);
    }
  };

  const removeItemFromOutfit = (category: Category) => {
    setOutfit(prev => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#FAF9F7]">
        <div className="w-8 h-8 border-2 border-[#1A1A1A] border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-[10px] uppercase font-bold tracking-widest text-[#888888]">Authenticating</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-[100dvh] w-full bg-[#FAF9F7] flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-20%] w-[60%] aspect-square bg-[#1A1A1A]/5 rounded-full blur-[100px]"></div>
        <div className="z-10 flex flex-col items-center max-w-sm w-full">
          <div className="w-16 h-16 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white mb-8 shadow-2xl">
            <i className="fas fa-shopping-bag text-2xl"></i>
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-[#1A1A1A] uppercase leading-none mb-3">
            BEFORE<span className="font-light">CLICKING</span>
          </h1>
          <p className="text-sm text-[#888888] font-medium leading-relaxed mb-10 px-4">
            Sign in to access your digital wardrobe and try on looks virtually.
          </p>
          
          <div className="space-y-3 w-full">
            <button 
              onClick={handleLogin}
              className="w-full bg-white border border-[#EEECE8] text-[#1A1A1A] py-4 rounded-2xl flex items-center justify-center gap-4 font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google Sign In
            </button>

            <button 
              onClick={handleGuestLogin}
              className="w-full bg-[#1A1A1A]/5 text-[#1A1A1A] py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all hover:bg-[#1A1A1A]/10"
            >
              Continue as Guest
            </button>
          </div>

          {authError && (
            <div className="mt-8 p-4 bg-red-50 rounded-xl border border-red-100 text-left">
              <p className="text-[10px] text-red-600 font-bold uppercase tracking-widest flex items-center gap-2">
                <i className="fas fa-exclamation-triangle"></i> Environment Note
              </p>
              <p className="text-[11px] text-red-800 mt-1 leading-relaxed">
                {authError} 
                <br/><br/>
                <span className="font-bold">Tip:</span> To use Google login, you must run this app using a local server (e.g., VS Code Live Server) instead of opening the file directly.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#FAF9F7] text-[#1A1A1A] flex flex-col relative overflow-hidden">
      <div className="flex-1 flex flex-col w-full max-w-[480px] mx-auto bg-white md:shadow-[0_0_40px_rgba(0,0,0,0.03)] relative h-full overflow-hidden">
        
        <header className="flex-shrink-0 px-5 py-3 flex justify-between items-center bg-white border-b border-[#EEECE8] z-40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-[#1A1A1A] rounded-full flex items-center justify-center text-white">
              <i className="fas fa-shopping-bag text-[10px]"></i>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs font-black tracking-tighter text-[#1A1A1A] uppercase leading-none">
                  BEFORE<span className="font-light">CLICKING</span>
                </h1>
                {syncing && <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse"></div>}
              </div>
              <p className="text-[6px] text-[#888888] font-bold uppercase tracking-[0.1em] mt-0.5">
                {user.isAnonymous ? 'Guest Mode (No Sync)' : 'Cloud Synced'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={resetAll} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FAF9F7] text-[#888888]">
              <i className="fas fa-trash-alt text-[10px]"></i>
            </button>
            <button onClick={saveCurrentOutfit} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FAF9F7] text-[#888888]">
              <i className="fas fa-bookmark text-[10px]"></i>
            </button>
            <div className="w-[1px] h-4 bg-[#EEECE8] mx-1"></div>
            <div className="flex items-center gap-1">
              <img src={user.photoURL} className="w-7 h-7 rounded-full border border-[#EEECE8]" />
              <button onClick={handleLogout} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#FAF9F7] text-[#D1CFCA]">
                <i className="fas fa-sign-out-alt text-[10px]"></i>
              </button>
            </div>
          </div>
        </header>

        <main className={`flex-1 min-h-0 relative flex flex-col p-4 gap-3 transition-all duration-500 overflow-hidden ${view === 'wardrobe' ? 'opacity-20 blur-md' : 'opacity-100'}`}>
          <div className="flex-1 min-h-0 flex justify-center w-full">
            <ModelViewer outfit={outfit} baseModelImage={baseModelImage} onModelUpload={setBaseModelImage} />
          </div>

          <div className="flex-shrink-0 flex flex-col gap-2 pb-2">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-[#888888]">Selection</h3>
              {Object.keys(outfit).length > 0 && (
                <button onClick={() => setOutfit({})} className="text-[9px] font-bold uppercase text-[#1A1A1A]">Reset</button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
              {Object.keys(outfit).length === 0 ? (
                <div className="w-full py-2 border border-dashed border-[#EEECE8] rounded-xl flex items-center justify-center">
                  <p className="text-[9px] font-bold text-[#D1CFCA] uppercase">Empty</p>
                </div>
              ) : (
                (Object.entries(outfit) as [Category, ClothingItem][]).map(([cat, item]) => (
                  <div key={cat} className="snap-start flex-shrink-0 flex items-center gap-2 p-1.5 bg-white rounded-lg border border-[#EEECE8] min-w-[120px]">
                    <div className="w-8 h-8 bg-[#FAF9F7] rounded flex items-center justify-center p-0.5 border border-[#EEECE8]">
                      <img src={item.imageBlob} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[7px] font-bold uppercase text-[#888888] truncate">{cat}</p>
                      <p className="text-[9px] text-[#1A1A1A] font-bold truncate">{item.description}</p>
                    </div>
                    <button onClick={() => removeItemFromOutfit(cat as Category)} className="text-[#D1CFCA] hover:text-red-500">
                      <i className="fas fa-times text-[7px]"></i>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>

        <div className={`fixed inset-0 z-50 transition-all duration-500 ${view === 'wardrobe' ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-[#1A1A1A]/10 backdrop-blur-sm" onClick={() => setView('main')} />
          <div className="absolute bottom-0 left-0 right-0 h-[92vh] bg-white rounded-t-[2rem] shadow-2xl flex flex-col overflow-hidden max-w-[480px] mx-auto">
             <Wardrobe onSelectItem={handleSelectItem} wardrobeItems={wardrobeItems} setWardrobeItems={setWardrobeItems} onBack={() => setView('main')} />
          </div>
        </div>

        <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-300 ${view === 'wardrobe' ? 'scale-0' : 'scale-100'}`}>
          <button onClick={() => setView('wardrobe')} className="w-12 h-12 bg-[#1A1A1A] text-white rounded-full shadow-xl flex items-center justify-center text-lg">
            <i className="fas fa-plus"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
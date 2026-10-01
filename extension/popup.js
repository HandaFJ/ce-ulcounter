document.getElementById("select-btn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // ページ側で選択・可視化スクリプトを実行
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: enableVisualPicker,
  });

  // ポップアップを閉じる
  window.close();
});

// --- ページ側（コンテンツスクリプト）で実行される関数 ---
function enableVisualPicker() {
  // 二重起動防止
  if (window._ulPickerInitialized) return;
  window._ulPickerInitialized = true;

  const ID_PREFIX = "_ul-picker_";
  const STYLE_ID = ID_PREFIX + "style";
  const TOAST_ID = ID_PREFIX + "toast";

  // 1. スタイルの定義（常時赤枠 ＋ ホバー時の強調 ＋ クリック時のカーソル）
  const styleContent = `
    ul { 
      position: relative; 
    }
    /* すべてのulに常時赤枠を表示 */
    ul::after {
      content: '';
      position: absolute;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none;
      box-sizing: border-box;
      border: 2px solid rgba(255, 0, 0, 0.7) !important;
      background-color: rgba(255, 0, 0, 0.05);
      z-index: 2147483647; /* 最前面 */
      border-radius: 2px;
    }
    
    /* ホバー時はさらに強調 */
    ul:hover::after {
      border-color: #ff0000 !important;
      background-color: rgba(255, 0, 0, 0.15);
      box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
    }

    /* 選択モード中はクリック可能なカーソルにする */
    body._ul-picker-cursor ul {
      cursor: crosshair !important;
    }
  `;

  // スタイルを適用
  const styleSheet = document.createElement("style");
  styleSheet.id = STYLE_ID;
  styleSheet.textContent = styleContent;
  document.head.appendChild(styleSheet);

  // カーソル変更用のクラスをbodyに追加
  document.body.classList.add("_ul-picker-cursor");

  // 2. ガイドメッセージ（トースト）の作成
  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.textContent = "クリックして ul の子要素数をカウント (ESCで終了)";
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483648; /* トーストを最前面に */
    background: #333;
    color: white;
    padding: 15px 25px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: sans-serif;
    font-size: 14px;
    font-weight: bold;
    animation: _ul-picker-fadein 0.3s ease;
    pointer-events: none;
  `;

  // アニメーション定義の追加
  const keyframes = document.createElement("style");
  keyframes.textContent = `
    @keyframes _ul-picker-fadein {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes _ul-picker-fadeout {
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(keyframes);
  document.body.appendChild(toast);

  // 3. クリックイベントの処理
  function onClick(e) {
    const ul = e.target.closest("ul");
    if (!ul) return; // ul以外がクリックされた場合は何もしない

    e.preventDefault();
    e.stopPropagation();

    const count = ul.children.length;
    showResultToast(count);
    cleanup(); // 1回クリックしたら終了
  }

  // 4. キーボードイベント（ESCでキャンセル）
  function onKeyDown(e) {
    if (e.key === "Escape") {
      cleanup();
    }
  }

  // 終了処理（スタイルとイベントリスナーの削除）
  function cleanup() {
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(TOAST_ID)?.remove();
    keyframes.remove();
    document.body.classList.remove("_ul-picker-cursor");
    window._ulPickerInitialized = false;
  }

  // イベントリスナー登録（キャプチャフェーズで確実に拾う）
  document.addEventListener("click", onClick, true);
  document.addEventListener("keydown", onKeyDown, true);

  // --- 結果表示用のトースト関数 ---
  function showResultToast(count) {
    const resultToast = document.createElement("div");
    resultToast.style.cssText = `
      position: fixed;
      top: 80px; /* 最初のガイドの下に配置 */
      right: 20px;
      z-index: 2147483648;
      background: #c62828; /* 警告色 */
      color: white;
      padding: 15px 25px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      font-family: sans-serif;
      font-size: 18px;
      font-weight: bold;
      animation: _ul-picker-fadein 0.3s ease, _ul-picker-fadeout 0.5s ease 2.5s forwards; /* 3秒後に消える */
      pointer-events: none;
    `;
    resultToast.textContent = `この UL の子要素数は ${count} 個です`;
    document.body.appendChild(resultToast);

    // 3.5秒後に要素自体を削除
    setTimeout(() => resultToast.remove(), 3500);
  }
}

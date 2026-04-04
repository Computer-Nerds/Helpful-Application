import { useState, useEffect, useRef, useCallback } from "react";

// ── Chess Logic ─────────────────────────────────────────────
// FEN starting position
const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const FILES = ["a","b","c","d","e","f","g","h"];
const RANKS = [8,7,6,5,4,3,2,1];

// Parse FEN into a board array [rank0..rank7][file0..file7]
function fenToBoard(fen) {
  const rows = fen.split(" ")[0].split("/");
  return rows.map(row => {
    const cells = [];
    for (const ch of row) {
      if (/\d/.test(ch)) { for (let i = 0; i < parseInt(ch); i++) cells.push(null); }
      else cells.push(ch);
    }
    return cells;
  });
}

const PIECE_UNICODE = {
  K:"♔", Q:"♕", R:"♖", B:"♗", N:"♘", P:"♙",
  k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟",
};

const RATINGS = [
  { label: "Beginner",     rating: 400,  skill: 1,  depth: 1 },
  { label: "Casual",       rating: 800,  skill: 3,  depth: 2 },
  { label: "Intermediate", rating: 1200, skill: 7,  depth: 5 },
  { label: "Advanced",     rating: 1600, skill: 12, depth: 8 },
  { label: "Expert",       rating: 2000, skill: 17, depth: 12 },
  { label: "Master",       rating: 2500, skill: 20, depth: 20 },
];

export default function ChessApp() {
  const [screen, setScreen] = useState("select"); // select | game
  const [selectedRating, setSelectedRating] = useState(null);
  const [board, setBoard] = useState(fenToBoard(START_FEN));
  const [fen, setFen] = useState(START_FEN);
  const [selected, setSelected] = useState(null); // {rank, file}
  const [turn, setTurn] = useState("w");
  const [status, setStatus] = useState("Your turn");
  const [history, setHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [legalMoves, setLegalMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [promotion, setPromotion] = useState(null); // {from, to}
  const [capturedByWhite, setCapturedByWhite] = useState([]);
  const [capturedByBlack, setCapturedByBlack] = useState([]);

  const stockfishRef = useRef(null);
  const gameRef = useRef(null); // chess.js instance
  const engineReady = useRef(false);

  // ── Load chess.js and stockfish via script tags ────────────
  useEffect(() => {
    const loadScript = (src) => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = res;
      s.onerror = rej;
      document.head.appendChild(s);
    });

    Promise.all([
      loadScript("https://unpkg.com/chess.js@0.12.0/chess.min.js"),
    ]).then(() => {
      // chess.js loaded — init
      gameRef.current = new window.Chess();
    }).catch(e => console.error("Script load error", e));

    return () => {
      if (stockfishRef.current) { stockfishRef.current.terminate(); stockfishRef.current = null; }
    };
  }, []);

  // ── Init Stockfish worker ──────────────────────────────────
  const initEngine = (skillLevel, depth) => {
    if (stockfishRef.current) stockfishRef.current.terminate();
    // Use unpkg CDN stockfish
    const sf = new Worker("https://unpkg.com/stockfish@16.0.0/src/stockfish-nnue-16.js");
    sf.onmessage = (e) => handleEngineMsg(e.data, depth);
    sf.postMessage("uci");
    sf.postMessage(`setoption name Skill Level value ${skillLevel}`);
    sf.postMessage("ucinewgame");
    stockfishRef.current = sf;
    engineReady.current = true;
  };

  const handleEngineMsg = useCallback((msg, depth) => {
    if (typeof msg !== "string") return;
    if (msg.startsWith("bestmove")) {
      const parts = msg.split(" ");
      const move = parts[1];
      if (move && move !== "(none)" && gameRef.current) {
        const result = gameRef.current.move({ from: move.slice(0,2), to: move.slice(2,4), promotion: move[4] || "q" });
        if (result) {
          const newFen = gameRef.current.fen();
          setFen(newFen);
          setBoard(fenToBoard(newFen));
          setLastMove({ from: move.slice(0,2), to: move.slice(2,4) });
          setTurn("w");
          setHistory(prev => [...prev, result.san]);
          updateCaptured(result);
          checkGameOver("Your turn");
        }
      }
      setThinking(false);
    }
  }, []);

  const updateCaptured = (move) => {
    if (move.captured) {
      const p = move.captured.toUpperCase();
      if (move.color === "w") setCapturedByWhite(prev => [...prev, p]);
      else setCapturedByBlack(prev => [...prev, p]);
    }
  };

  const checkGameOver = (defaultStatus) => {
    const g = gameRef.current;
    if (!g) return;
    if (g.in_checkmate()) { setStatus(g.turn() === "w" ? "You lost — checkmate!" : "You win — checkmate!"); setGameOver(true); }
    else if (g.in_draw()) { setStatus("Draw!"); setGameOver(true); }
    else if (g.in_stalemate()) { setStatus("Stalemate — draw!"); setGameOver(true); }
    else if (g.in_check()) setStatus(g.turn() === "w" ? "You're in check!" : "Bot is in check!");
    else setStatus(defaultStatus);
  };

  // ── Start game ─────────────────────────────────────────────
  const startGame = (rating) => {
    setSelectedRating(rating);
    if (!gameRef.current) gameRef.current = new window.Chess();
    else gameRef.current.reset();
    setFen(START_FEN);
    setBoard(fenToBoard(START_FEN));
    setSelected(null); setTurn("w"); setStatus("Your turn");
    setHistory([]); setGameOver(false); setThinking(false);
    setLegalMoves([]); setLastMove(null);
    setCapturedByWhite([]); setCapturedByBlack([]);
    initEngine(rating.skill, rating.depth);
    setScreen("game");
  };

  // ── Square click handler ───────────────────────────────────
  const squareId = (rank, file) => FILES[file] + (8 - rank);

  const handleSquareClick = (rank, file) => {
    if (gameOver || turn !== "w" || thinking) return;
    const g = gameRef.current;
    if (!g) return;

    const sq = squareId(rank, file);
    const piece = g.get(sq);

    if (selected) {
      // Try to make the move
      const from = squareId(selected.rank, selected.file);

      // Check if promotion
      const movingPiece = g.get(from);
      const isPromotion = movingPiece && movingPiece.type === "p" && movingPiece.color === "w" && rank === 0;

      if (isPromotion) {
        setPromotion({ from, to: sq });
        setSelected(null); setLegalMoves([]);
        return;
      }

      const result = g.move({ from, to: sq });
      if (result) {
        const newFen = g.fen();
        setFen(newFen); setBoard(fenToBoard(newFen));
        setLastMove({ from, to: sq });
        setHistory(prev => [...prev, result.san]);
        updateCaptured(result);
        setSelected(null); setLegalMoves([]);
        checkGameOver("Bot is thinking…");
        setTurn("b");
        setThinking(true);
        setTimeout(() => engineMove(newFen), 300);
      } else {
        // Invalid move — maybe selecting a different piece
        if (piece && piece.color === "w") {
          setSelected({ rank, file });
          const moves = g.moves({ square: sq, verbose: true });
          setLegalMoves(moves.map(m => m.to));
        } else {
          setSelected(null); setLegalMoves([]);
        }
      }
    } else {
      if (piece && piece.color === "w") {
        setSelected({ rank, file });
        const moves = g.moves({ square: sq, verbose: true });
        setLegalMoves(moves.map(m => m.to));
      }
    }
  };

  const handlePromotion = (piece) => {
    const g = gameRef.current;
    if (!g || !promotion) return;
    const result = g.move({ from: promotion.from, to: promotion.to, promotion: piece });
    if (result) {
      const newFen = g.fen();
      setFen(newFen); setBoard(fenToBoard(newFen));
      setLastMove({ from: promotion.from, to: promotion.to });
      setHistory(prev => [...prev, result.san]);
      updateCaptured(result);
      checkGameOver("Bot is thinking…");
      setTurn("b"); setThinking(true);
      setTimeout(() => engineMove(newFen), 300);
    }
    setPromotion(null);
  };

  const engineMove = (currentFen) => {
    const sf = stockfishRef.current;
    if (!sf) return;
    sf.postMessage(`position fen ${currentFen}`);
    sf.postMessage(`go depth ${selectedRating?.depth || 5}`);
  };

  // ── Helpers ────────────────────────────────────────────────
  const isSelected = (r, f) => selected && selected.rank === r && selected.file === f;
  const isLegal = (r, f) => legalMoves.includes(squareId(r, f));
  const isLastMove = (r, f) => {
    const sq = squareId(r, f);
    return lastMove && (lastMove.from === sq || lastMove.to === sq);
  };

  const lightSq = "#c8d8c0";
  const darkSq  = "#4a7060";
  const selectedColor = "rgba(255,220,0,0.5)";
  const lastMoveColor = "rgba(255,220,0,0.25)";
  const legalDot = "rgba(0,0,0,0.2)";

  // ── Rating select screen ───────────────────────────────────
  if (screen === "select") {
    return (
      <div style={{ minHeight:"100vh", background:"#111312", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>
        <div style={{ fontSize:32, marginBottom:8 }}>♟️</div>
        <div style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>Chess vs Bot</div>
        <div style={{ fontSize:14, color:"#7a9e8e", marginBottom:36 }}>Choose your opponent's strength</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:14, width:"100%", maxWidth:680 }}>
          {RATINGS.map(r => (
            <button key={r.label} onClick={() => startGame(r)}
              style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:14, padding:"20px 16px", cursor:"pointer", textAlign:"left", transition:"all 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor="#00d18c"}
              onMouseLeave={e => e.currentTarget.style.borderColor="#1f2e28"}
            >
              <div style={{ fontSize:16, fontWeight:700, color:"#e8f0ed", marginBottom:4 }}>{r.label}</div>
              <div style={{ fontSize:13, color:"#00d18c", fontWeight:600 }}>~{r.rating} ELO</div>
              <div style={{ fontSize:11, color:"#7a9e8e", marginTop:6 }}>Skill level {r.skill} / 20</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Game screen ────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#111312", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", padding:"24px 16px" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16, width:"100%", maxWidth:560 }}>
        <button onClick={() => setScreen("select")} style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#7a9e8e", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:13 }}>← Back</button>
        <div style={{ flex:1, fontSize:15, fontWeight:700 }}>{selectedRating?.label} <span style={{ color:"#7a9e8e", fontWeight:400 }}>~{selectedRating?.rating} ELO</span></div>
        <button onClick={() => startGame(selectedRating)} style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#00d18c", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:13 }}>New Game</button>
      </div>

      {/* Status */}
      <div style={{ fontSize:14, fontWeight:600, color: gameOver ? "#f74e4e" : thinking ? "#f7a94e" : "#00d18c", marginBottom:12, height:20 }}>{status}</div>

      {/* Captured by black (bot took these) */}
      <div style={{ height:22, marginBottom:4, fontSize:14, letterSpacing:1 }}>
        {capturedByBlack.map((p,i) => <span key={i}>{PIECE_UNICODE[p]}</span>)}
      </div>

      {/* Board */}
      <div style={{ position:"relative", borderRadius:4, overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,0.6)", border:"2px solid #1f2e28" }}>
        {board.map((row, rank) => (
          <div key={rank} style={{ display:"flex" }}>
            {row.map((piece, file) => {
              const light = (rank + file) % 2 === 0;
              const sel   = isSelected(rank, file);
              const legal = isLegal(rank, file);
              const lm    = isLastMove(rank, file);
              const hasPiece = !!piece;

              let bg = light ? lightSq : darkSq;
              if (sel || lm) bg = selectedColor;

              return (
                <div key={file} onClick={() => handleSquareClick(rank, file)}
                  style={{ width:64, height:64, background:bg, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", cursor: turn==="w" && !gameOver ? "pointer" : "default", userSelect:"none" }}>
                  {/* Last move tint */}
                  {lm && !sel && <div style={{ position:"absolute", inset:0, background:lastMoveColor, pointerEvents:"none" }}/>}
                  {/* Legal move indicator */}
                  {legal && !hasPiece && <div style={{ width:20, height:20, borderRadius:"50%", background:legalDot, pointerEvents:"none" }}/>}
                  {legal && hasPiece && <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:"3px solid rgba(0,0,0,0.3)", pointerEvents:"none" }}/>}
                  {/* Piece */}
                  {piece && (
                    <span style={{ fontSize:40, lineHeight:1, filter: piece===piece.toUpperCase() ? "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" : "drop-shadow(0 1px 2px rgba(0,0,0,0.7))", zIndex:1 }}>
                      {PIECE_UNICODE[piece]}
                    </span>
                  )}
                  {/* Rank label on left edge */}
                  {file === 0 && <span style={{ position:"absolute", top:2, left:3, fontSize:10, fontWeight:700, color: light ? darkSq : lightSq, opacity:0.8 }}>{8 - rank}</span>}
                  {/* File label on bottom edge */}
                  {rank === 7 && <span style={{ position:"absolute", bottom:2, right:4, fontSize:10, fontWeight:700, color: light ? darkSq : lightSq, opacity:0.8 }}>{FILES[file]}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Captured by white (you took these) */}
      <div style={{ height:22, marginTop:4, fontSize:14, letterSpacing:1 }}>
        {capturedByWhite.map((p,i) => <span key={i}>{PIECE_UNICODE[p.toLowerCase()]}</span>)}
      </div>

      {/* Move history */}
      <div style={{ marginTop:16, width:"100%", maxWidth:520 }}>
        <div style={{ fontSize:11, color:"#4a7060", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6, fontWeight:700 }}>Move History</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {history.reduce((acc, move, i) => {
            if (i % 2 === 0) acc.push([move]);
            else acc[acc.length-1].push(move);
            return acc;
          }, []).map((pair, i) => (
            <span key={i} style={{ fontSize:12, color:"#7a9e8e", background:"#1a1f1d", padding:"2px 8px", borderRadius:4 }}>
              {i+1}. {pair[0]}{pair[1] ? ` ${pair[1]}` : ""}
            </span>
          ))}
        </div>
      </div>

      {/* Promotion modal */}
      {promotion && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:14, padding:28, display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
            <div style={{ fontSize:16, fontWeight:700 }}>Promote Pawn</div>
            <div style={{ display:"flex", gap:12 }}>
              {["q","r","b","n"].map(p => (
                <button key={p} onClick={() => handlePromotion(p)}
                  style={{ width:60, height:60, background:"#111312", border:"1px solid #1f2e28", borderRadius:10, fontSize:36, cursor:"pointer" }}>
                  {PIECE_UNICODE[p.toUpperCase()]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

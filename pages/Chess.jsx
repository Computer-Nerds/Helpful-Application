import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
//  BUILT-IN CHESS ENGINE  (no external deps)
// ─────────────────────────────────────────────────────────────
const FILES = ["a","b","c","d","e","f","g","h"];

const PIECE_UNICODE = {
  K:"♔", Q:"♕", R:"♖", B:"♗", N:"♘", P:"♙",
  k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟",
};

const RATINGS = [
  { label:"Beginner",     elo:400,  depth:1, rand:0.9  },
  { label:"Casual",       elo:800,  depth:2, rand:0.5  },
  { label:"Intermediate", elo:1200, depth:2, rand:0.2  },
  { label:"Advanced",     elo:1600, depth:3, rand:0.1  },
  { label:"Expert",       elo:2000, depth:3, rand:0.02 },
  { label:"Master",       elo:2500, depth:4, rand:0    },
];

// piece values
const VALS = { p:100, n:320, b:330, r:500, q:900, k:20000 };

// Simple position tables (white's perspective, rank 0 = row nearest white)
const PST = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

// ── Board representation: 8x8 array of {type, color} or null ──
function emptyBoard() { return Array.from({length:8}, () => Array(8).fill(null)); }

function startBoard() {
  const b = emptyBoard();
  const backRank = ["r","n","b","q","k","b","n","r"];
  for (let f = 0; f < 8; f++) {
    b[0][f] = { type: backRank[f], color: "b" };
    b[1][f] = { type: "p", color: "b" };
    b[6][f] = { type: "p", color: "w" };
    b[7][f] = { type: backRank[f], color: "w" };
  }
  return b;
}

function cloneBoard(b) { return b.map(r => r.map(c => c ? {...c} : null)); }

function sqName(r, f) { return FILES[f] + (8 - r); }

// ── Move generation ────────────────────────────────────────
function inBounds(r, f) { return r >= 0 && r < 8 && f >= 0 && f < 8; }

function rawMoves(board, r, f, state) {
  const piece = board[r][f];
  if (!piece) return [];
  const { type, color } = piece;
  const opp = color === "w" ? "b" : "w";
  const moves = [];
  const add = (tr, tf, extra={}) => {
    if (!inBounds(tr, tf)) return;
    const t = board[tr][tf];
    if (t && t.color === color) return;
    moves.push({ from:[r,f], to:[tr,tf], ...extra });
  };
  const slide = (dirs) => {
    for (const [dr,df] of dirs) {
      let tr=r+dr, tf=f+df;
      while (inBounds(tr,tf)) {
        const t = board[tr][tf];
        if (t) { if (t.color===opp) moves.push({from:[r,f],to:[tr,tf]}); break; }
        moves.push({from:[r,f],to:[tr,tf]});
        tr+=dr; tf+=df;
      }
    }
  };

  if (type==="p") {
    const dir = color==="w" ? -1 : 1;
    const startRow = color==="w" ? 6 : 1;
    const promRow  = color==="w" ? 0 : 7;
    // forward
    if (inBounds(r+dir,f) && !board[r+dir][f]) {
      const isPromRow = (r+dir)===promRow;
      if (isPromRow) { for (const p of ["q","r","b","n"]) moves.push({from:[r,f],to:[r+dir,f],promo:p}); }
      else { moves.push({from:[r,f],to:[r+dir,f]}); }
      // double push
      if (r===startRow && !board[r+2*dir][f]) moves.push({from:[r,f],to:[r+2*dir,f]});
    }
    // captures
    for (const df of [-1,1]) {
      const tr=r+dir, tf=f+df;
      if (!inBounds(tr,tf)) continue;
      const isPromRow = tr===promRow;
      if (board[tr][tf] && board[tr][tf].color===opp) {
        if (isPromRow) { for (const p of ["q","r","b","n"]) moves.push({from:[r,f],to:[tr,tf],promo:p}); }
        else moves.push({from:[r,f],to:[tr,tf]});
      }
      // en passant
      if (state.ep && sqName(tr,tf)===state.ep) moves.push({from:[r,f],to:[tr,tf],ep:true});
    }
  } else if (type==="n") {
    for (const [dr,df] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r+dr,f+df);
  } else if (type==="b") {
    slide([[-1,-1],[-1,1],[1,-1],[1,1]]);
  } else if (type==="r") {
    slide([[-1,0],[1,0],[0,-1],[0,1]]);
  } else if (type==="q") {
    slide([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
  } else if (type==="k") {
    for (const [dr,df] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) add(r+dr,f+df);
    // castling
    const crow = color==="w"?7:0;
    if (r===crow && f===4) {
      const ck = color==="w"?"K":"k", cq = color==="w"?"Q":"q";
      if (state.castle.includes(ck) && !board[crow][5] && !board[crow][6])
        moves.push({from:[r,f],to:[crow,6],castle:"k"});
      if (state.castle.includes(cq) && !board[crow][3] && !board[crow][2] && !board[crow][1])
        moves.push({from:[r,f],to:[crow,2],castle:"q"});
    }
  }
  return moves;
}

function findKing(board, color) {
  for (let r=0;r<8;r++) for (let f=0;f<8;f++) if (board[r][f]?.type==="k"&&board[r][f]?.color===color) return [r,f];
  return null;
}

function isAttacked(board, r, f, byColor, state={castle:"",ep:null}) {
  // check if square [r,f] is attacked by byColor
  const opp = byColor;
  for (let sr=0;sr<8;sr++) for (let sf=0;sf<8;sf++) {
    if (board[sr][sf]?.color!==opp) continue;
    const ms = rawMoves(board,sr,sf,state);
    if (ms.some(m=>m.to[0]===r&&m.to[1]===f)) return true;
  }
  return false;
}

function applyMove(board, move, state) {
  const nb = cloneBoard(board);
  const [fr,ff] = move.from, [tr,tf] = move.to;
  const piece = nb[fr][ff];
  nb[tr][tf] = move.promo ? {type:move.promo,color:piece.color} : piece;
  nb[fr][ff] = null;
  // en passant capture
  if (move.ep) { const epDir = piece.color==="w"?1:-1; nb[tr+epDir][tf]=null; }
  // castling rook
  if (move.castle==="k") { nb[fr][5]=nb[fr][7]; nb[fr][7]=null; }
  if (move.castle==="q") { nb[fr][3]=nb[fr][0]; nb[fr][0]=null; }
  // new state
  const ns = {
    castle: state.castle,
    ep: null,
    turn: state.turn==="w"?"b":"w",
  };
  if (piece.type==="p" && Math.abs(tr-fr)===2) ns.ep = sqName((fr+tr)/2,ff);
  if (piece.type==="k") ns.castle = ns.castle.replace(piece.color==="w"?"K":"k","").replace(piece.color==="w"?"Q":"q","");
  if (piece.type==="r") {
    if (ff===0) ns.castle=ns.castle.replace(piece.color==="w"?"Q":"q","");
    if (ff===7) ns.castle=ns.castle.replace(piece.color==="w"?"K":"k","");
  }
  return {board:nb, state:ns};
}

function legalMoves(board, color, state) {
  const moves = [];
  for (let r=0;r<8;r++) for (let f=0;f<8;f++) {
    if (board[r][f]?.color!==color) continue;
    for (const m of rawMoves(board,r,f,state)) {
      const {board:nb} = applyMove(board,m,state);
      const kPos = findKing(nb,color);
      if (kPos && !isAttacked(nb,kPos[0],kPos[1],color==="w"?"b":"w",state)) moves.push(m);
    }
  }
  return moves;
}

// ── Evaluation ─────────────────────────────────────────────
function evaluate(board) {
  let score = 0;
  for (let r=0;r<8;r++) for (let f=0;f<8;f++) {
    const p = board[r][f];
    if (!p) continue;
    const pstRow = p.color==="w" ? r : 7-r;
    const pstIdx = pstRow*8+f;
    const val = VALS[p.type] + (PST[p.type]?.[pstIdx]||0);
    score += p.color==="w" ? val : -val;
  }
  return score;
}

// ── Minimax with alpha-beta ─────────────────────────────────
function minimax(board, state, depth, alpha, beta, maximizing) {
  const color = state.turn;
  const moves = legalMoves(board, color, state);
  if (moves.length===0) {
    const kPos = findKing(board,color);
    if (kPos && isAttacked(board,kPos[0],kPos[1],color==="w"?"b":"w",state)) return maximizing ? -99999 : 99999;
    return 0; // stalemate
  }
  if (depth===0) return evaluate(board);
  if (maximizing) {
    let best=-Infinity;
    for (const m of moves) {
      const {board:nb,state:ns}=applyMove(board,m,state);
      best=Math.max(best,minimax(nb,ns,depth-1,alpha,beta,false));
      alpha=Math.max(alpha,best);
      if (beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for (const m of moves) {
      const {board:nb,state:ns}=applyMove(board,m,state);
      best=Math.min(best,minimax(nb,ns,depth-1,alpha,beta,true));
      beta=Math.min(beta,best);
      if (beta<=alpha) break;
    }
    return best;
  }
}

function getBotMove(board, state, depth, rand) {
  const moves = legalMoves(board, "b", state);
  if (!moves.length) return null;
  // randomize a bit for lower levels
  if (rand > 0 && Math.random() < rand) return moves[Math.floor(Math.random()*moves.length)];
  let best=-Infinity, bestMove=null;
  for (const m of moves) {
    const {board:nb,state:ns}=applyMove(board,m,state);
    const score = minimax(nb,ns,depth-1,-Infinity,Infinity,true);
    if (score>best) { best=score; bestMove=m; }
  }
  return bestMove || moves[0];
}

// ─────────────────────────────────────────────────────────────
//  REACT COMPONENT
// ─────────────────────────────────────────────────────────────
const initState = () => ({ castle:"KQkq", ep:null, turn:"w" });

export default function ChessApp({ onTimeUpdate }) {
  const [screen, setScreen] = useState("select");
  const [rating, setRating] = useState(null);
  const [board, setBoard] = useState(startBoard());
  const [state, setState] = useState(initState());
  const [selected, setSelected] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [status, setStatus] = useState("Your turn");
  const [gameOver, setGameOver] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [history, setSanHistory] = useState([]);
  const [promotion, setPromotion] = useState(null);

  // ── Timer ──────────────────────────────────────────────────
  const [timerRunning, setTimerRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setElapsed(e => {
          const next = e + 1;
          if (onTimeUpdate) onTimeUpdate(next);
          return next;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const formatTime = (s) => {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    if (h>0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
    return `${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  };

  // ── Start game ─────────────────────────────────────────────
  const startGame = (r) => {
    setRating(r);
    setBoard(startBoard());
    setState(initState());
    setSelected(null); setHighlights([]);
    setLastMove(null); setStatus("Your turn");
    setGameOver(false); setThinking(false);
    setSanHistory([]); setPromotion(null);
    setScreen("game");
    // auto-start timer
    setElapsed(0); setTimerRunning(true);
  };

  // ── Derive legal moves for current board/state ─────────────
  const getStatus = useCallback((b, st, playerJustMoved) => {
    const toMove = st.turn;
    const moves = legalMoves(b, toMove, st);
    const kPos = findKing(b, toMove);
    const inCheck = kPos && isAttacked(b,kPos[0],kPos[1],toMove==="w"?"b":"w",st);
    if (moves.length===0) {
      if (inCheck) return { text: toMove==="w"?"Checkmate — you lose!":"Checkmate — you win! 🎉", over:true };
      return { text:"Stalemate — draw!", over:true };
    }
    if (inCheck) return { text: toMove==="w"?"You're in check!":"Bot is in check!", over:false };
    return { text: playerJustMoved?"Bot is thinking…":"Your turn", over:false };
  }, []);

  // ── Square click ───────────────────────────────────────────
  const handleClick = (r, f) => {
    if (gameOver || state.turn!=="w" || thinking) return;
    const piece = board[r][f];

    if (selected) {
      const move = highlights.find(m => m.to[0]===r && m.to[1]===f);
      if (move) {
        // pawn promotion
        if (board[selected[0]][selected[1]]?.type==="p" && r===0) {
          setPromotion({ move });
          return;
        }
        executeMove(move, board, state);
        return;
      }
    }
    // Select piece
    if (piece?.color==="w") {
      setSelected([r,f]);
      const moves = legalMoves(board,"w",state).filter(m=>m.from[0]===r&&m.from[1]===f);
      setHighlights(moves);
    } else {
      setSelected(null); setHighlights([]);
    }
  };

  const executeMove = (move, b, st, promoType) => {
    const finalMove = promoType ? {...move, promo:promoType} : move;
    const {board:nb, state:ns} = applyMove(b, finalMove, st);
    setBoard(nb); setState(ns);
    setLastMove(move);
    setSelected(null); setHighlights([]);
    setPromotion(null);

    // san-ish history
    const piece = b[move.from[0]][move.from[1]];
    const capture = b[move.to[0]][move.to[1]] ? "x" : "";
    const san = (piece.type!=="p"?piece.type.toUpperCase():"")+capture+sqName(move.to[0],move.to[1])+(promoType?"="+promoType.toUpperCase():"");
    setSanHistory(prev=>[...prev,san]);

    const {text,over} = getStatus(nb,ns,true);
    setStatus(text);
    if (over) { setGameOver(true); setTimerRunning(false); return; }

    // Bot's turn
    setThinking(true);
    setTimeout(() => {
      const botMove = getBotMove(nb,"b"===ns.turn?ns:{...ns,turn:"b"}, rating.depth, rating.rand);
      // fix: ns.turn is already "b" after applyMove
      const bm = getBotMove(nb, ns, rating.depth, rating.rand);
      if (!bm) { setThinking(false); return; }
      const {board:nb2,state:ns2}=applyMove(nb,bm,ns);
      setBoard(nb2); setState(ns2);
      setLastMove(bm);
      const botSan = (nb[bm.from[0]][bm.from[1]]?.type!=="p"?(nb[bm.from[0]][bm.from[1]]?.type||"").toUpperCase():"")+sqName(bm.to[0],bm.to[1]);
      setSanHistory(prev=>[...prev,botSan]);
      const {text:t2,over:o2}=getStatus(nb2,ns2,false);
      setStatus(t2);
      if (o2) { setGameOver(true); setTimerRunning(false); }
      setThinking(false);
    }, 50);
  };

  const isHighlighted = (r,f) => highlights.some(m=>m.to[0]===r&&m.to[1]===f);
  const isLastMove = (r,f) => lastMove && ((lastMove.from[0]===r&&lastMove.from[1]===f)||(lastMove.to[0]===r&&lastMove.to[1]===f));
  const isSelected = (r,f) => selected && selected[0]===r && selected[1]===f;

  // ── Rating select ──────────────────────────────────────────
  if (screen==="select") return (
    <div style={{ minHeight:"100vh", background:"#111312", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32 }}>
      <div style={{ fontSize:40, marginBottom:8 }}>♟️</div>
      <div style={{ fontSize:24, fontWeight:800, marginBottom:6 }}>Chess vs Bot</div>
      <div style={{ fontSize:14, color:"#7a9e8e", marginBottom:36 }}>Choose your opponent's strength</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:12, width:"100%", maxWidth:620 }}>
        {RATINGS.map(r=>(
          <button key={r.label} onClick={()=>startGame(r)}
            style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:14, padding:"20px 16px", cursor:"pointer", textAlign:"left", color:"#e8f0ed" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#00d18c"}
            onMouseLeave={e=>e.currentTarget.style.borderColor="#1f2e28"}>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{r.label}</div>
            <div style={{ fontSize:13, color:"#00d18c", fontWeight:600 }}>~{r.elo} ELO</div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Game screen ────────────────────────────────────────────
  const lightSq="#c8d8c0", darkSq="#4a7060";

  return (
    <div style={{ minHeight:"100vh", background:"#111312", color:"#e8f0ed", fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column", alignItems:"center", padding:"20px 16px" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, width:"100%", maxWidth:480 }}>
        <button onClick={()=>{ setScreen("select"); setTimerRunning(false); }}
          style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#7a9e8e", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:13 }}>← Back</button>
        <div style={{ flex:1, fontSize:15, fontWeight:700 }}>{rating?.label} <span style={{ color:"#7a9e8e", fontWeight:400 }}>~{rating?.elo} ELO</span></div>
        {/* Timer */}
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:10, padding:"6px 12px" }}>
          <span style={{ fontSize:15, fontWeight:800, letterSpacing:"1px", color:"#e8f0ed", minWidth:52, textAlign:"center" }}>{formatTime(elapsed)}</span>
          <button onClick={()=>setTimerRunning(v=>!v)}
            style={{ background: timerRunning?"#f74e4e":"#00d18c", border:"none", borderRadius:6, padding:"3px 10px", cursor:"pointer", fontSize:12, fontWeight:700, color: timerRunning?"#fff":"#003d2a" }}>
            {timerRunning?"Pause":"Play"}
          </button>
        </div>
        <button onClick={()=>startGame(rating)}
          style={{ background:"#1a1f1d", border:"1px solid #1f2e28", color:"#00d18c", borderRadius:8, padding:"6px 14px", cursor:"pointer", fontSize:13 }}>New</button>
      </div>

      {/* Status */}
      <div style={{ fontSize:13, fontWeight:600, marginBottom:10, height:18,
        color: gameOver?"#f74e4e": thinking?"#f7a94e":"#00d18c" }}>{status}</div>

      {/* Board */}
      <div style={{ borderRadius:4, overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,0.6)", border:"2px solid #1f2e28" }}>
        {board.map((row,rank)=>(
          <div key={rank} style={{ display:"flex" }}>
            {row.map((piece,file)=>{
              const light=(rank+file)%2===0;
              const sel=isSelected(rank,file);
              const hl=isHighlighted(rank,file);
              const lm=isLastMove(rank,file);
              let bg=light?lightSq:darkSq;
              if (sel) bg="rgba(255,220,0,0.6)";
              else if (lm) bg=light?"rgba(255,220,0,0.4)":"rgba(255,200,0,0.35)";
              return (
                <div key={file} onClick={()=>handleClick(rank,file)}
                  style={{ width:58, height:58, background:bg, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", cursor:"pointer", userSelect:"none" }}>
                  {hl && !piece && <div style={{ width:18, height:18, borderRadius:"50%", background:"rgba(0,0,0,0.22)", pointerEvents:"none" }}/>}
                  {hl && piece  && <div style={{ position:"absolute", inset:0, border:"3px solid rgba(0,0,0,0.25)", borderRadius:2, pointerEvents:"none" }}/>}
                  {piece && <span style={{ fontSize:38, lineHeight:1, zIndex:1,
                    filter: piece.color==="w"?"drop-shadow(0 1px 1px rgba(0,0,0,0.4))":"drop-shadow(0 1px 1px rgba(0,0,0,0.7))" }}>
                    {PIECE_UNICODE[piece.color==="w"?piece.type.toUpperCase():piece.type]}
                  </span>}
                  {file===0 && <span style={{ position:"absolute", top:2, left:3, fontSize:9, fontWeight:700, color:light?darkSq:lightSq, opacity:0.7, pointerEvents:"none" }}>{8-rank}</span>}
                  {rank===7 && <span style={{ position:"absolute", bottom:2, right:3, fontSize:9, fontWeight:700, color:light?darkSq:lightSq, opacity:0.7, pointerEvents:"none" }}>{FILES[file]}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Move history */}
      <div style={{ marginTop:14, width:"100%", maxWidth:480 }}>
        <div style={{ fontSize:11, color:"#4a7060", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6, fontWeight:700 }}>Moves</div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, maxHeight:80, overflowY:"auto" }}>
          {history.reduce((acc,m,i)=>{ if(i%2===0) acc.push([m]); else acc[acc.length-1].push(m); return acc; },[]).map((pair,i)=>(
            <span key={i} style={{ fontSize:11, color:"#7a9e8e", background:"#1a1f1d", padding:"2px 8px", borderRadius:4 }}>
              {i+1}. {pair[0]}{pair[1]?` ${pair[1]}`:""}
            </span>
          ))}
        </div>
      </div>

      {/* Promotion modal */}
      {promotion && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"#1a1f1d", border:"1px solid #1f2e28", borderRadius:14, padding:28, display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
            <div style={{ fontSize:16, fontWeight:700 }}>Promote Pawn</div>
            <div style={{ display:"flex", gap:12 }}>
              {["q","r","b","n"].map(p=>(
                <button key={p} onClick={()=>executeMove(promotion.move, board, state, p)}
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
